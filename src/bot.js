import { Telegraf, session, Markup, Input } from 'telegraf';
import axios from 'axios';
import { initializeConfig, getConfig, validateConfig, getConfigStatus } from './config.js';
import { FragmentApi } from './fragmentApi.js';
import { pollOrderConfirmation } from './orderPolling.js';
import { TonPaymentService } from './tonSender.js';
import {
  setUserOrder,
  getUserOrder,
  clearUserOrder,
  linkUserOrder,
  updateUserOrder,
} from './store.js';
import { TelegramWalletService } from './telegramWallet.js';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { getPriceList, initializePrices, clearPriceCache } from './services/priceService.js';
import { saveOrUpdateUser } from './services/userService.js';
import { httpAgent, httpsAgent } from './utils/httpAgents.js';
import { PrismaClient } from '@prisma/client';

// 初始化 Prisma 客户端
const prisma = new PrismaClient();

let fragmentApi = null;
let configStatus = null;
let config = null;

// 初始化配置（从数据库加载）
await initializeConfig();
config = getConfig();

if (config.proxy.url) {
  process.env.HTTP_PROXY = config.proxy.url;
  process.env.HTTPS_PROXY = config.proxy.url;
  console.log(`✅ 已设置环境变量代理：${config.proxy.url}`);
}

/**
 * 检查用户余额，足够则扣减并允许继续；不足则通过 @iipay 发起收款并提示用户。
 * 返回 true 表示可以继续下单；返回 false 表示已触发收款，暂不继续。
 */
async function ensureBalanceOrRequestPayment(ctx, months) {
  try {
    // 价格（USDT）
    const priceUsdt = PRICE_LIST[months];
    if (!priceUsdt) {
      await ctx.reply('未找到所选时长的价格，请稍后重试。', getReplyKeyboard());
      return false;
    }

    const userIdStr = ctx.from.id.toString();
    let user = await prisma.user.findUnique({ where: { userId: userIdStr } });
    if (!user) {
      user = await saveOrUpdateUser({
        userId: ctx.from.id,
        username: ctx.from.username,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name,
      });
    }

    const balance = Number(user.balance || 0);
    if (balance >= priceUsdt) {
      // 扣减余额
      await prisma.user.update({
        where: { userId: userIdStr },
        data: { balance: { decrement: priceUsdt } },
      });
      console.log('[Balance] 余额支付成功，已扣减', { userId: userIdStr, amount: priceUsdt });
      await ctx.reply(`✅ 余额支付成功：-${priceUsdt.toFixed(2)} USDT\n当前余额：${(balance - priceUsdt).toFixed(2)} USDT`, getReplyKeyboard());
      return true;
    }

    // 余额不足，发起收款
    const need = +(priceUsdt - balance).toFixed(2);
    await ctx.reply(`⚠️ 余额不足\n需要支付：${priceUsdt.toFixed(2)} USDT\n当前余额：${balance.toFixed(2)} USDT\n仍需：${need.toFixed(2)} USDT`, getReplyKeyboard());

    try {
      // 创建充值订单记录（pending）
      await prisma.rechargeOrder.create({
        data: {
          orderId: `RECHARGE_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
          userId: user.id,
          amount: need,
          status: 'pending',
          expiredAt: new Date(Date.now() + 10 * 60 * 1000),
        },
      });
    } catch (e) {
      console.warn('创建充值订单失败（继续尝试发起收款）:', e?.message);
    }

    if (!telegramWallet) {
      await ctx.reply('Telegram 钱包客户端未配置，暂无法自动发起收款，请联系管理员。', getReplyKeyboard());
      return false;
    }

    const peerUsername = ctx.from.username;
    const res = await telegramWallet.requestUserPayment({
      userId: ctx.from.id,
      username: peerUsername,
      amount: need,
    });

    if (res?.success) {
      await ctx.reply(`已向你发送收款请求，请在聊天中确认并完成支付（@iipay 收款 ${need} USDT）。支付完成后再回来继续操作。`, getReplyKeyboard());
    } else {
      await ctx.reply(`发起收款失败：${res?.error || '未知错误'}\n请联系管理员或稍后重试。`, getReplyKeyboard());
    }

    return false;
  } catch (error) {
    console.error('ensureBalanceOrRequestPayment 失败:', error);
    await ctx.reply('处理余额/收款时发生错误，请稍后重试或联系管理员。', getReplyKeyboard());
    return false;
  }
}

// 初始化价格数据
await initializePrices();

async function initializeBot() {
  configStatus = await validateConfig();

  // 直接从环境变量获取 Cookie 和 Hash
  try {
    const { getCookieAndHash } = await import('./cookieManager.js');
    const { cookie: fragmentCookie, hash: fragmentHash } = getCookieAndHash();
    
    console.log('✅ Fragment API 初始化成功（Cookie 来源：环境变量）');
    console.log('📋 使用的 Hash:', fragmentHash.substring(0, 10) + '...');

    fragmentApi = new FragmentApi({
      baseURL: config.fragment.baseURL,
      cookie: fragmentCookie,
      hash: fragmentHash,
      pollHash: fragmentHash,
      walletDevice: config.fragment.walletDevice,
      mnemonic: config.ton.mnemonic,
    });
  } catch (error) {
    console.error('❌ Fragment API 初始化失败：', error.message);
    console.error('💡 请确保 .env 文件中设置了 FRAGMENT_COOKIE 和 FRAGMENT_HASH');
    console.error('');
    console.error('获取方法：');
    console.error('1. 访问 https://fragment.com/');
    console.error('2. 连接 TON 钱包');
    console.error('3. 打开浏览器开发者工具（F12）-> Network 标签');
    console.error('4. 执行任意操作，找到 fragment.com/api?hash=... 的请求');
    console.error('5. 复制 hash 参数和 Cookie 请求头');
    console.error('6. 更新 .env 文件');
    console.error('');
    throw error;
  }
}

await initializeBot();

const tonService = new TonPaymentService({
  endpoint: config.ton.endpoint,
  apiKey: config.ton.apiKey,
  mnemonic: config.ton.mnemonic,
});

// Telegram 钱包服务（使用 iipay）
const telegramWallet = config.telegramWallet?.apiId && config.telegramWallet?.apiHash
  ? new TelegramWalletService({
      apiId: config.telegramWallet.apiId,
      apiHash: config.telegramWallet.apiHash,
      sessionString: config.telegramWallet.sessionString,
    })
  : null;

if (!config.telegramBotToken) {
  console.error('错误：缺少 BOT_TOKEN，机器人无法启动');
  process.exit(1);
}

const botOptions = {};
if (config.proxy.url) {
  try {
    const agent = new HttpsProxyAgent(config.proxy.url, {
      keepAlive: true,
      keepAliveMsecs: 1000,
      maxSockets: 256,
      maxFreeSockets: 256,
      timeout: 30000,
    });
    botOptions.telegram = {
      agent,
      webhookReply: false,
    };
    console.log(`✅ 已为 Telegram Bot 配置代理：${config.proxy.url}`);
  } catch (error) {
    console.warn(`⚠️ 配置代理失败：${error.message}，将尝试使用环境变量`);
  }
}

const bot = new Telegraf(config.telegramBotToken, botOptions);

// 添加错误处理
bot.catch((err, ctx) => {
  console.error('机器人错误:', err);
  if (ctx) {
    try {
      ctx.reply('❌ 发生错误，请稍后重试。').catch(() => {});
    } catch (e) {
      // 忽略错误
    }
  }
});

bot.use(session({ defaultSession: () => ({ flow: { step: 'idle' } }) }));

// 价格列表将从数据库动态加载
let PRICE_LIST = {
  3: 12.5,
  6: 16.5,
  12: 29.9,
};

// 初始化价格列表
let pricesLoaded = false;
async function loadPrices(silent = false) {
  try {
    PRICE_LIST = await getPriceList();
    if (!silent && !pricesLoaded) {
      console.log('✅ 价格列表已加载:', PRICE_LIST);
      pricesLoaded = true;
    }
  } catch (error) {
    console.error('加载价格失败，使用默认价格:', error);
  }
}

// 启动时加载价格
await loadPrices();

// 定期刷新价格缓存（每 5 分钟，静默加载）
setInterval(async () => {
  clearPriceCache();
  await loadPrices(true);
}, 5 * 60 * 1000).unref();


function getReplyKeyboard() {
  return Markup.keyboard([
    ['🎁 开通会员'],
    ['👤 个人中心', '💬 联系客服'],
  ])
    .resize()
    .persistent();
}

function removeReplyKeyboard() {
  return Markup.removeKeyboard();
}

/**
 * 下载图片并转换为 InputFile
 * @param {string} url - 图片 URL
 * @returns {Promise<object|null>} InputFile 对象或 null
 */
async function downloadImageAsInputFile(url) {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10_000,
      httpAgent,
      httpsAgent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
      },
    });
    
    const buffer = Buffer.from(response.data);
    return Input.fromBuffer(buffer, 'photo.jpg');
  } catch (error) {
    console.warn('下载图片失败:', error.message);
    return null;
  }
}

bot.start(async (ctx) => {
  ctx.session.flow = { step: 'idle' };
  
  // 保存用户信息到数据库
  try {
    await saveOrUpdateUser({
      userId: ctx.from.id,
      username: ctx.from.username,
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name,
    });
  } catch (error) {
    console.error('保存用户信息失败:', error);
  }
  
  // 每次启动时重新加载价格，确保显示最新价格（静默加载）
  await loadPrices(true);
  
  const welcomeMessage = [
    '💎 代开会员',
    '',
    '✈️ Telegram会员官方代开',
    '',
    '欢迎使用 Telegram Premium 自助开通服务。',
    '',
    '💰 当前价格：',
    `🕒  3 个月 ${PRICE_LIST[3] || 12.5} USDT`,
    `🕕  6 个月 ${PRICE_LIST[6] || 16.5} USDT`,
    `🕛 12 个月 ${PRICE_LIST[12] || 29.9} USDT`,
  ].join('\n');
  
  await ctx.reply(welcomeMessage, getReplyKeyboard());
});





bot.command('gift', async (ctx) => {
  // 保存用户信息到数据库
  try {
    await saveOrUpdateUser({
      userId: ctx.from.id,
      username: ctx.from.username,
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name,
    });
  } catch (error) {
    console.error('保存用户信息失败:', error);
  }
  
  await showPurchaseMenu(ctx);
});


bot.hears('🎁 开通会员', async (ctx) => {
  // 保存用户信息到数据库
  try {
    await saveOrUpdateUser({
      userId: ctx.from.id,
      username: ctx.from.username,
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name,
    });
  } catch (error) {
    console.error('保存用户信息失败:', error);
  }
  
  await showPurchaseMenu(ctx);
});

bot.hears('👤 个人中心', async (ctx) => {
  // 保存用户信息到数据库
  try {
    await saveOrUpdateUser({
      userId: ctx.from.id,
      username: ctx.from.username,
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name,
    });
  } catch (error) {
    console.error('保存用户信息失败:', error);
  }
  
  await showUserProfile(ctx);
});

bot.hears('💬 联系客服', async (ctx) => {
  // 保存用户信息到数据库
  try {
    await saveOrUpdateUser({
      userId: ctx.from.id,
      username: ctx.from.username,
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name,
    });
  } catch (error) {
    console.error('保存用户信息失败:', error);
  }
  
  await ctx.reply('💬 如需联系客服，请发送您的问题，我们会尽快回复。', getReplyKeyboard());
});

async function showPurchaseMenu(ctx) {
  if (!fragmentApi) {
    const status = getConfigStatus();
    const errorMsg = !status.isValid
      ? '❌ 配置不完整，无法使用此功能。\n\n请使用 /config 查看配置状态。\n\n提示：Cookie 会在程序启动时自动获取，如果获取失败，请检查：\n1. 网络连接和代理设置\n2. 或手动设置 FRAGMENT_COOKIE 和 FRAGMENT_HASH 环境变量'
      : '❌ Fragment API 未初始化，Cookie 获取失败。\n\n请检查：\n1. 网络连接和代理设置\n2. 或手动设置 FRAGMENT_COOKIE 和 FRAGMENT_HASH 环境变量\n3. 然后重启程序';
    
    await ctx.reply(errorMsg, getReplyKeyboard());
    return;
  }
  
  // 重新加载价格，确保显示最新价格（静默加载）
  await loadPrices(true);
  
  const welcomeMessage = [
    '欢迎使用 Telegram Premium 自助开通服务。',
    '',
    '💰 当前价格：',
    `🕒  3 个月 ${PRICE_LIST[3] || 12.5} USDT`,
    `🕕  6 个月 ${PRICE_LIST[6] || 16.5} USDT`,
    `🕛 12 个月 ${PRICE_LIST[12] || 29.9} USDT`,
    '',
    '👉 请选择下方按钮操作',
  ].join('\n');
  
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '👤 为自己开通', callback_data: 'purchase:self' },
        ],
        [
          { text: '🎁 赠送给他人', callback_data: 'purchase:gift' },
        ],
      ],
    },
  };
  
  await ctx.reply(welcomeMessage, keyboard);
}

async function getMonthsKeyboard() {
  // 确保使用最新价格（静默加载，不打印日志）
  await loadPrices(true);
  
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: `3 个月 - ${PRICE_LIST[3] || 12.5} USDT`, callback_data: 'months:3' },
          { text: `6 个月 - ${PRICE_LIST[6] || 16.5} USDT`, callback_data: 'months:6' },
        ],
        [
          { text: `12 个月 - ${PRICE_LIST[12] || 29.9} USDT`, callback_data: 'months:12' },
        ],
      ],
    },
  };
}

bot.command('status', async (ctx) => {
  // 保存用户信息到数据库
  try {
    await saveOrUpdateUser({
      userId: ctx.from.id,
      username: ctx.from.username,
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name,
    });
  } catch (error) {
    console.error('保存用户信息失败:', error);
  }
  
  await showOrderStatus(ctx);
});

async function showOrderStatus(ctx) {
  if (!fragmentApi) {
    await ctx.reply('❌ Fragment API 未初始化，请检查配置。', getReplyKeyboard());
    return;
  }

  const order = getUserOrder(ctx.from.id);
  if (!order) {
    await ctx.reply('当前没有进行中的订单。', getReplyKeyboard());
    return;
  }

  try {
    const status = await fragmentApi.checkRequest({ reqId: order.reqId });
    if (status.confirmed) {
      clearUserOrder(ctx.from.id);
      ctx.session.flow = { step: 'idle' };
      await ctx.reply('✅ Premium 已成功开通！', getReplyKeyboard());
      return;
    }

    const lines = [
      `订单号：${order.reqId}`,
      `当前状态：${mapOrderStatus(order.status)}`,
      `最后检查：${new Date().toLocaleString()}`,
    ];

    if (order.walletPayment) {
      lines.push(
        `支付方式：Telegram 钱包`,
        `支付状态：${order.walletPayment.success ? '成功' : '失败'}`,
      );
    }

    lines.push('系统会持续自动检查，请稍候。');
    await ctx.reply(lines.join('\n'), getReplyKeyboard());
  } catch (error) {
    console.error('查询订单状态失败：', error);
    await ctx.reply(`查询订单状态失败：${error.message ?? '未知错误'}`, getReplyKeyboard());
  }
}

async function showUserProfile(ctx) {
  try {
    const userId = ctx.from.id.toString();
    
    // 先查找用户，如果不存在则创建
    let user = await prisma.user.findUnique({
      where: { userId },
    });

    if (!user) {
      // 如果用户不存在，先创建
      user = await saveOrUpdateUser({
        userId: ctx.from.id,
        username: ctx.from.username,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name,
      });
    }

    // 查询用户订单统计
    const orders = await prisma.order.findMany({
      where: { userId: user.id },
      select: {
        amountUsdt: true,
        status: true,
      },
    });

    // 计算统计数据
    const totalOrders = orders?.length || 0;
    const totalPaid = orders
      ?.filter(order => order.status === 'completed' && order.amountUsdt)
      ?.reduce((sum, order) => sum + (order.amountUsdt || 0), 0) || 0;
    
    // 获取用户余额
    const balance = user.balance || 0;

    // 构建个人中心消息
    const profileMessage = [
      '👤 个人中心',
      '',
      `🆔 用户 ID: ${userId}`,
      `💰 当前余额: ${balance.toFixed(2)} USDT`,
      '➖➖➖➖➖➖➖➖➖➖➖➖',
      `📊 累计下单: ${totalOrders} 单`,
      `💵 累计支付: ${totalPaid.toFixed(2)} USDT`,
    ].join('\n');

    // 内联菜单
    const profileKeyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '💰 余额充值', callback_data: 'profile:recharge' },
            { text: '📋 充值记录', callback_data: 'profile:recharge_history' },
          ],
          [
            { text: '📊 历史订单', callback_data: 'profile:order_history' },
          ],
          [
            { text: '💬 联系客服', callback_data: 'profile:contact' },
            { text: '❌ 关闭', callback_data: 'profile:close' },
          ],
        ],
      },
    };

    await ctx.reply(profileMessage, profileKeyboard);
  } catch (error) {
    console.error('显示个人中心失败:', error);
    await ctx.reply('❌ 获取个人中心信息失败，请稍后重试。', getReplyKeyboard());
  }
}

// 显示充值菜单
async function showRechargeMenu(ctx) {
  try {
    const rechargeAmounts = [10, 20, 50, 100, 200, 500]; // 预设充值金额
    
    const message = [
      '💰 余额充值',
      '',
      '请选择充值金额（USDT）：',
    ].join('\n');

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: `💵 ${rechargeAmounts[0]} USDT`, callback_data: `profile:recharge_amount:${rechargeAmounts[0]}` },
            { text: `💵 ${rechargeAmounts[1]} USDT`, callback_data: `profile:recharge_amount:${rechargeAmounts[1]}` },
          ],
          [
            { text: `💵 ${rechargeAmounts[2]} USDT`, callback_data: `profile:recharge_amount:${rechargeAmounts[2]}` },
            { text: `💵 ${rechargeAmounts[3]} USDT`, callback_data: `profile:recharge_amount:${rechargeAmounts[3]}` },
          ],
          [
            { text: `💵 ${rechargeAmounts[4]} USDT`, callback_data: `profile:recharge_amount:${rechargeAmounts[4]}` },
            { text: `💵 ${rechargeAmounts[5]} USDT`, callback_data: `profile:recharge_amount:${rechargeAmounts[5]}` },
          ],
          [
            { text: '🔙 返回', callback_data: 'profile:back' },
          ],
        ],
      },
    };

    // 检查原消息类型
    const originalMessage = ctx.callbackQuery?.message;
    if (originalMessage?.photo) {
      try {
        await ctx.deleteMessage();
      } catch (e) {
        // 忽略删除失败
      }
      await ctx.reply(message, keyboard);
    } else {
      await ctx.editMessageText(message, keyboard);
    }
  } catch (error) {
    console.error('显示充值菜单失败:', error);
    await ctx.answerCbQuery('显示充值菜单失败', true);
  }
}

// 处理充值（使用 Telegram 钱包）
async function processRecharge(ctx, amount) {
  try {
    if (!telegramWallet) {
      await ctx.answerCbQuery('Telegram 钱包未配置，请联系管理员', true);
      return;
    }

    const userId = ctx.from.id.toString();
    
    // 查找或创建用户
    let user = await prisma.user.findUnique({
      where: { userId },
    });

    if (!user) {
      user = await saveOrUpdateUser({
        userId: ctx.from.id,
        username: ctx.from.username,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name,
      });
    }

    // 生成充值订单号
    const orderId = `RECHARGE_${Date.now()}_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    // 创建充值订单
    const rechargeOrder = await prisma.rechargeOrder.create({
      data: {
        orderId,
        userId: user.id,
        amount: amount,
        status: 'pending',
        expiredAt: new Date(Date.now() + 10 * 60 * 1000), // 10分钟过期
      },
    });

    await ctx.answerCbQuery('充值功能开发中，请稍后...', true);
  } catch (error) {
    console.error('处理充值失败:', error);
    await ctx.answerCbQuery(`充值失败：${error.message}`, true);
  }
}

// 显示充值记录
async function showRechargeHistory(ctx) {
  try {
    const userId = ctx.from.id.toString();
    
    // 先查找用户
    const user = await prisma.user.findUnique({
      where: { userId },
    });
    
    if (!user) {
      await ctx.answerCbQuery('暂无充值记录', true);
      return;
    }
    
    const recharges = await prisma.rechargeOrder.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    
    if (recharges.length === 0) {
      await ctx.answerCbQuery('暂无充值记录', true);
      return;
    }
    
    const rechargeList = recharges.map((recharge, index) => {
      const status = recharge.status === 'completed' ? '✅' : recharge.status === 'pending' ? '⏳' : recharge.status === 'expired' ? '⏰' : '❌';
      const date = new Date(recharge.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      return `${index + 1}. ${status} ${recharge.amount.toFixed(2)} USDT - ${date}`;
    }).join('\n');
    
    const message = `📋 充值记录（最近20条）：\n\n${rechargeList}`;
    
    // 检查原消息类型
    const originalMessage = ctx.callbackQuery?.message;
    if (originalMessage?.photo) {
      try {
        await ctx.deleteMessage();
      } catch (e) {
        // 忽略删除失败
      }
      await ctx.reply(message, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 返回', callback_data: 'profile:back' }],
          ],
        },
      });
    } else {
      await ctx.editMessageText(message, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 返回', callback_data: 'profile:back' }],
          ],
        },
      });
    }
  } catch (error) {
    console.error('获取充值记录失败:', error);
    await ctx.answerCbQuery('获取充值记录失败', true);
  }
}

bot.on('callback_query', async (ctx) => {
  // 保存用户信息到数据库
  try {
    await saveOrUpdateUser({
      userId: ctx.from.id,
      username: ctx.from.username,
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name,
    });
  } catch (error) {
    console.error('保存用户信息失败:', error);
  }
  
  const data = ctx.callbackQuery.data;
  
  // 处理个人中心相关操作（放在最前面，避免被其他条件拦截）
  if (data.startsWith('profile:')) {
    const action = data.replace('profile:', '');
    
    try {
      if (action === 'recharge') {
        await ctx.answerCbQuery();
        await showRechargeMenu(ctx);
        return;
      }
      
      if (action === 'recharge_history') {
        await ctx.answerCbQuery();
        await showRechargeHistory(ctx);
        return;
      }
      
      if (action.startsWith('recharge_amount:')) {
        const amount = parseFloat(action.replace('recharge_amount:', ''));
        if (isNaN(amount) || amount <= 0) {
          await ctx.answerCbQuery('充值金额无效', true);
          return;
        }
        await ctx.answerCbQuery();
        await processRecharge(ctx, amount);
        return;
      }
      
      if (action === 'order_history') {
        try {
          const userId = ctx.from.id.toString();
          // 先查找用户
          const user = await prisma.user.findUnique({
            where: { userId },
          });
          
          if (!user) {
            await ctx.answerCbQuery('暂无历史订单', true);
            return;
          }
          
          const orders = await prisma.order.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' },
            take: 10,
          });
          
          if (orders.length === 0) {
            await ctx.answerCbQuery('暂无历史订单', true);
            return;
          }
          
          await ctx.answerCbQuery();
          
          const orderList = orders.map((order, index) => {
            const status = order.status === 'completed' ? '✅' : order.status === 'pending' ? '⏳' : order.status === 'failed' ? '❌' : '⏰';
            const date = new Date(order.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
            return `${index + 1}. ${status} @${order.targetUsername} - ${order.months}个月 - ${(order.amountUsdt || order.amount).toFixed(2)} USDT - ${date}`;
          }).join('\n');
          
          const message = `📊 历史订单（最近10条）：\n\n${orderList}\n\n💡 状态说明：✅ 已完成 | ⏳ 处理中 | ❌ 失败 | ⏰ 已过期`;
          
          // 检查原消息类型，如果是图片消息则删除并发送新消息
          const originalMessage = ctx.callbackQuery?.message;
          if (originalMessage?.photo) {
            try {
              await ctx.deleteMessage();
            } catch (e) {
              // 忽略删除失败
            }
            await ctx.reply(message, {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🔙 返回', callback_data: 'profile:back' }],
                ],
              },
            });
          } else {
            await ctx.editMessageText(message, {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🔙 返回', callback_data: 'profile:back' }],
                ],
              },
            });
          }
        } catch (error) {
          console.error('获取历史订单失败:', error);
          await ctx.answerCbQuery('获取历史订单失败', true);
        }
        return;
      }
      
      if (action === 'contact') {
        await ctx.answerCbQuery();
        
        // 从配置中获取客服联系方式
        const customerService = await prisma.config.findUnique({
          where: { key: 'customer_service' },
        });
        
        let contactMessage = '💬 联系客服\n\n';
        if (customerService && customerService.value) {
          contactMessage += customerService.value;
        } else {
          contactMessage += '如需联系客服，请发送您的问题，我们会尽快回复。';
        }
        
        await ctx.reply(contactMessage, getReplyKeyboard());
        return;
      }
      
      if (action === 'close') {
        await ctx.answerCbQuery();
        try {
          await ctx.deleteMessage();
        } catch (e) {
          // 忽略删除失败
        }
        return;
      }
      
      if (action === 'back') {
        await ctx.answerCbQuery();
        // 检查原消息类型，如果是图片消息则删除并发送新消息
        const originalMessage = ctx.callbackQuery?.message;
        if (originalMessage?.photo) {
          try {
            await ctx.deleteMessage();
          } catch (e) {
            // 忽略删除失败
          }
          await showUserProfile(ctx);
        } else {
          // 文本消息，直接更新
          try {
            const userId = ctx.from.id.toString();
            let user = await prisma.user.findUnique({
              where: { userId },
            });

            if (!user) {
              user = await saveOrUpdateUser({
                userId: ctx.from.id,
                username: ctx.from.username,
                firstName: ctx.from.first_name,
                lastName: ctx.from.last_name,
              });
            }

            const orders = await prisma.order.findMany({
              where: { userId: user.id },
              select: {
                amountUsdt: true,
                status: true,
              },
            });

            const totalOrders = orders?.length || 0;
            const totalPaid = orders
              ?.filter(order => order.status === 'completed' && order.amountUsdt)
              ?.reduce((sum, order) => sum + (order.amountUsdt || 0), 0) || 0;
            
            // 重新获取用户余额（可能已更新）
            const updatedUser = await prisma.user.findUnique({
              where: { userId },
            });
            const balance = updatedUser?.balance || 0;

            const profileMessage = [
              '👤 个人中心',
              '',
              `🆔 用户 ID: ${userId}`,
              `💰 当前余额: ${balance} USDT`,
              '➖➖➖➖➖➖➖➖➖➖➖➖',
              `📊 累计下单: ${totalOrders} 单`,
              `💵 累计支付: ${totalPaid.toFixed(2)} USDT`,
            ].join('\n');

            const profileKeyboard = {
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: '💰 余额充值', callback_data: 'profile:recharge' },
                    { text: '📋 充值记录', callback_data: 'profile:recharge_history' },
                  ],
                  [
                    { text: '📊 历史订单', callback_data: 'profile:order_history' },
                  ],
                  [
                    { text: '💬 联系客服', callback_data: 'profile:contact' },
                    { text: '❌ 关闭', callback_data: 'profile:close' },
                  ],
                ],
              },
            };

            await ctx.editMessageText(profileMessage, profileKeyboard);
          } catch (error) {
            console.error('返回个人中心失败:', error);
            await showUserProfile(ctx);
          }
        }
        return;
      }
    } catch (error) {
      console.error('处理个人中心操作失败:', error);
      try {
        await ctx.answerCbQuery('操作失败，请稍后重试', true);
      } catch (e) {
        // 忽略错误
      }
    }
    return;
  }

  // 其他 callback_query 处理
  try {
    await ctx.answerCbQuery();
  } catch (e) {
    // 忽略回调查询错误
  }

  if (data === 'purchase:self') {
    const user = ctx.from;
        // 为自己开通时，使用用户名或 Telegram ID（去掉 @ 符号）
        let targetUsername = user.username || user.id.toString();
        targetUsername = targetUsername.replace(/^@/, '').trim();
        
        ctx.session.flow = { step: 'confirmSelf', type: 'self', targetUser: targetUsername };
        
        // 通过 Fragment API 查询用户信息（使用默认月份 3，仅用于查询用户）
        try {
          const userInfo = await fragmentApi.searchPremiumGiftRecipient({ query: targetUsername, months: 3 });
          
          // 从 Fragment API 返回的数据中提取用户信息
          const displayName = userInfo.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || '用户';
          const usernameDisplay = user.username ? `@${user.username}` : `ID: ${user.id}`;
          
          // 提取头像 URL（改进的提取逻辑，支持多种格式）
          let userPhotoUrl = null;
          if (userInfo.photo) {
            // 方法1: 从 HTML img 标签中提取 src
            const imgMatch = userInfo.photo.match(/src=["']([^"']+)["']/i);
            if (imgMatch && imgMatch[1]) {
              userPhotoUrl = imgMatch[1];
            } else {
              // 方法2: 从 background-image: url() 中提取
              const bgMatch = userInfo.photo.match(/background-image:\s*url\(["']?([^"')]+)["']?\)/i);
              if (bgMatch && bgMatch[1]) {
                userPhotoUrl = bgMatch[1];
              } else {
                // 方法3: 直接检查是否是 URL
                const urlPattern = /https?:\/\/[^\s<>"']+/i;
                const urlMatch = userInfo.photo.match(urlPattern);
                if (urlMatch) {
                  userPhotoUrl = urlMatch[0];
                }
              }
            }
            
            // 如果是相对路径，转换为绝对路径
            if (userPhotoUrl && userPhotoUrl.startsWith('//')) {
              userPhotoUrl = 'https:' + userPhotoUrl;
            } else if (userPhotoUrl && userPhotoUrl.startsWith('/')) {
              userPhotoUrl = 'https://fragment.com' + userPhotoUrl;
            }
          }
          
          const confirmMessage = [
            '开通用户: ' + usernameDisplay,
            '用户昵称: ' + displayName,
            '',
            '确定为此用户 开通/续费 Telegram Premium会员吗?',
          ].join('\n');
          
          const confirmKeyboard = {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '✅ 确定', callback_data: 'confirm:self' },
                  { text: '❌ 取消', callback_data: 'cancel:self' },
                ],
              ],
            },
          };
          
          // 如果有头像 URL，尝试发送带图片的消息
          if (userPhotoUrl) {
            try {
              // 先下载图片，然后使用 InputFile 发送
              const photoFile = await downloadImageAsInputFile(userPhotoUrl);
              
              if (photoFile) {
                try {
                  // 先尝试编辑消息（如果原消息存在）
                  await ctx.editMessageMedia(
                    {
                      type: 'photo',
                      media: photoFile,
                      caption: confirmMessage,
                    },
                    confirmKeyboard
                  );
                } catch (error) {
                  // 如果编辑失败，尝试发送新消息
                  await ctx.replyWithPhoto(photoFile, {
                    caption: confirmMessage,
                    ...confirmKeyboard,
                  });
                }
              } else {
                // 下载失败，使用文本消息
                throw new Error('图片下载失败');
              }
            } catch (error) {
              console.warn('发送头像图片失败，使用文本消息:', error.message);
              console.warn('头像 URL:', userPhotoUrl);
              // 如果发送图片失败，删除原消息并发送文本消息
              try {
                await ctx.deleteMessage();
              } catch (e) {
                // 忽略删除失败
              }
              await ctx.reply(confirmMessage, confirmKeyboard);
            }
          } else {
            // 没有头像时，删除原消息并发送文本消息
            try {
              await ctx.deleteMessage();
            } catch (e) {
              // 忽略删除失败
            }
            await ctx.reply(confirmMessage, confirmKeyboard);
          }
          
          // 保存用户信息到 session，供后续使用
          ctx.session.flow.userInfo = userInfo;
        } catch (error) {
          console.error('查询用户信息失败:', error);
          // 如果 Fragment API 查询失败，使用 Telegram Bot API 的信息
          const displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || '用户';
          const usernameDisplay = user.username ? `@${user.username}` : `ID: ${user.id}`;
          
          const confirmMessage = [
            '开通用户: ' + usernameDisplay,
            '用户昵称: ' + displayName,
            '',
            '⚠️ 无法从 Fragment 获取用户信息，将使用 Telegram 信息',
            '',
            '确定为此用户 开通/续费 Telegram Premium会员吗?',
          ].join('\n');
          
          const confirmKeyboard = {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '✅ 确定', callback_data: 'confirm:self' },
                  { text: '❌ 取消', callback_data: 'cancel:self' },
                ],
              ],
            },
          };
          
          try {
            await ctx.deleteMessage();
          } catch (e) {
            // 忽略删除失败
          }
          await ctx.reply(confirmMessage, confirmKeyboard);
        }
        return;
      }
      
      // 处理确认为自己开通
      if (data === 'confirm:self') {
        const flow = ctx.session.flow || {};
        const targetUsername = flow.targetUser;
        
        if (!targetUsername) {
          // 检查当前消息是否是图片消息
          const message = ctx.callbackQuery.message;
          if (message.photo) {
            await ctx.editMessageCaption('❌ 错误：未找到用户信息，请重新开始。');
          } else {
            await ctx.editMessageText('❌ 错误：未找到用户信息，请重新开始。');
          }
          return;
        }
        
        ctx.session.flow = { step: 'selectMonths', type: 'self', targetUser: targetUsername };
        
        const monthsKeyboard = await getMonthsKeyboard();
        
        // 检查当前消息是否是图片消息
        const message = ctx.callbackQuery.message;
        if (message.photo) {
          // 如果是图片消息，删除原消息并发送新消息
          try {
            await ctx.deleteMessage();
          } catch (e) {
            // 忽略删除失败
          }
          await ctx.reply('请选择订阅时长：', monthsKeyboard);
        } else {
          await ctx.editMessageText('请选择订阅时长：', monthsKeyboard);
        }
        return;
      }
      
      // 处理取消
      if (data === 'cancel:self') {
        ctx.session.flow = { step: 'idle' };
        const message = ctx.callbackQuery.message;
        if (message.photo) {
          try {
            await ctx.deleteMessage();
          } catch (e) {
            // 忽略删除失败
          }
          await ctx.reply('已取消操作。', getReplyKeyboard());
        } else {
          await ctx.editMessageText('已取消操作。', getReplyKeyboard());
        }
        return;
      }

  if (data === 'purchase:gift') {
    ctx.session.flow = { step: 'askGiftUsername', type: 'gift' };
    await ctx.editMessageText(
      '⚠️ 请发送您要赠送会员的 Telegram 用户名，如：@premium 或 premium\n\n如需批量开通，每个用户名中间请使用中英文逗号或者空格隔开，如：@Premium @BotFather'
    );
    return;
  }
  
  // 处理确认赠送
  if (data.startsWith('confirm:gift:')) {
    const username = data.replace('confirm:gift:', '');
    const flow = ctx.session.flow || {};
    
    ctx.session.flow = { step: 'selectMonths', username, type: 'gift' };
    
    const monthsKeyboard = await getMonthsKeyboard();
    
    // 删除原消息（包括图片消息），然后发送新的文本消息，不显示头像
    try {
      await ctx.deleteMessage();
    } catch (e) {
      // 忽略删除失败
    }
    await ctx.reply('请选择订阅时长：', monthsKeyboard);
    return;
  }
  
  // 处理取消赠送
  if (data === 'cancel:gift') {
    ctx.session.flow = { step: 'idle' };
    
    // 检查原消息类型，如果是图片消息则编辑 caption，否则编辑文本
    try {
      const message = ctx.callbackQuery?.message;
      if (message?.photo) {
        // 图片消息，编辑 caption
        await ctx.editMessageCaption('已取消操作。', getReplyKeyboard());
      } else {
        // 文本消息，编辑文本
        await ctx.editMessageText('已取消操作。', getReplyKeyboard());
      }
    } catch (error) {
      // 如果编辑失败，尝试删除原消息并发送新消息
      try {
        await ctx.deleteMessage();
      } catch (e) {
        // 忽略删除失败
      }
      await ctx.reply('已取消操作。', getReplyKeyboard());
    }
    return;
  }


  if (data.startsWith('months:')) {
    const months = Number.parseInt(data.split(':')[1], 10);
    const flow = ctx.session.flow || {};
    
    // 默认使用 TON 自动支付（基于助记词）
    const paymentMethod = 'ton';
    
    ctx.session.flow = {
      ...flow,
      months,
      paymentMethod,
    };
    
    // 余额校验与可能的收款
    const canProceed = await ensureBalanceOrRequestPayment(ctx, months);
    if (!canProceed) {
      // 等待用户完成收款后再继续
      return;
    }

    // 直接创建订单，不显示支付方式选择
    if (flow.type === 'self') {
      ctx.session.flow.step = 'creatingOrder';
      await processOrderCreation(ctx, flow.targetUser, months, true, paymentMethod);
    } else if (flow.usernames && flow.usernames.length > 1) {
      ctx.session.flow.step = 'creatingBatchOrders';
      await processBatchOrders(ctx, flow.usernames, months, paymentMethod);
    } else if (flow.username) {
      ctx.session.flow.step = 'creatingOrder';
      await processOrderCreation(ctx, flow.username, months, true, paymentMethod);
    } else {
      ctx.session.flow.step = 'askUsername';
      await ctx.editMessageText(
        `已选择 ${months} 个月订阅\n支付方式：🔵 TON 自动支付\n\n请输入接收方的用户名（无需 @）：`
      );
    }
    return;
  }
});

function parseUsernames(input) {
  return input
    .split(/[，,、\s]+/)
    .map((u) => u.trim().replace(/^@/, ''))
    .filter((u) => u.length > 0);
}

async function processBatchOrders(ctx, usernames, months, paymentMethod = 'usdt') {
  if (!fragmentApi) {
    await ctx.reply('❌ Fragment API 未初始化，无法创建订单。', getReplyKeyboard());
    return;
  }

  const loadingMsg = await ctx.reply(`⏳ 正在为 ${usernames.length} 个用户创建订单，请稍候…`, getReplyKeyboard());
  const results = [];
  const errors = [];

  for (const username of usernames) {
    try {
      await processOrderCreation(ctx, username, months, false, paymentMethod);
      results.push(username);
    } catch (error) {
      errors.push({ username, error: error.message });
    }
  }

  try {
    await ctx.deleteMessage(loadingMsg.message_id);
  } catch (e) {
    // 忽略删除消息失败
  }

  const message = [
    `✅ 批量订单创建完成`,
    `成功：${results.length} 个`,
    `失败：${errors.length} 个`,
    '',
    ...(errors.length > 0 ? ['失败详情：', ...errors.map((e) => `• @${e.username}: ${e.error}`), ''] : []),
    '请使用 /status 或点击"查看订单"查看订单状态。',
  ].join('\n');

  await ctx.reply(message, getReplyKeyboard());
  ctx.session.flow = { step: 'idle' };
}

async function processOrderCreation(ctx, username, months, showLoading = true, paymentMethod = 'usdt') {
  if (!fragmentApi) {
    await ctx.reply('❌ Fragment API 未初始化，无法创建订单。', getReplyKeyboard());
    return;
  }

  // 保存用户信息到数据库
  try {
    await saveOrUpdateUser({
      userId: ctx.from.id,
      username: ctx.from.username,
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name,
    });
  } catch (error) {
    console.error('保存用户信息失败:', error);
  }

  const loadingMsg = showLoading ? await ctx.reply('⏳ 正在查询用户并创建订单，请稍候…', getReplyKeyboard()) : null;

  try {
    // 清理用户名：移除 @ 符号，如果是纯数字则保持原样
    const cleanUsername = username.toString().replace(/^@/, '').trim();
    
    if (!cleanUsername) {
      throw new Error('用户名不能为空');
    }

    const userInfo = await fragmentApi.searchPremiumGiftRecipient({ query: cleanUsername, months });
    const recipient = typeof userInfo === 'string' ? userInfo : userInfo.recipient;
    const { reqId, amount } = await fragmentApi.initGiftPremiumRequest({ recipient, months });
    
    // 步骤 3: getGiftPremiumLink 用于确认订单并获取支付链接
    // 必须包含 account, device, transaction 参数，否则会报 "Session expired. Please reconnect your wallet"
    // 使用第二步获取的 reqId 作为 id 参数
    let giftPremiumLinkData = null;
    try {
      console.log('📋 步骤 3: 开始调用 getGiftPremiumLink（包含钱包信息）');
      giftPremiumLinkData = await fragmentApi.getGiftPremiumLink({ 
        reqId,        // ← 使用第二步 initGiftPremiumRequest 返回的 reqId
        showSender: 1,
      });
      console.log('✅ 步骤 3: getGiftPremiumLink 调用成功');
      if (giftPremiumLinkData?.check_params?.id) {
        console.log('   📋 check_params.id:', giftPremiumLinkData.check_params.id);
      }
      if (giftPremiumLinkData?.link) {
        console.log('   🔗 支付链接:', giftPremiumLinkData.link);
      }
      if (giftPremiumLinkData?.expire_after) {
        const expireTime = new Date(Date.now() + giftPremiumLinkData.expire_after * 1000);
        console.log('   ⏰ 订单过期时间:', expireTime.toLocaleString('zh-CN'));
      }
    } catch (error) {
      console.error('❌ 步骤 3: getGiftPremiumLink 调用失败');
      console.error('   错误信息:', error.message);
      console.error('   这一步失败通常是因为：');
      console.error('   1. Cookie 已过期或钱包未连接');
      console.error('   2. 钱包信息（account/device）不正确');
      throw error; // getGiftPremiumLink 失败则无法继续
    }
    
    // 从 getGiftPremiumLink 返回的数据中提取支付信息
    // 不再需要调用 getTonkeeperRequest，因为所有信息都在第三步返回了
    const tonPayment = {
      address: giftPremiumLinkData.transaction.messages[0].address,
      amountNano: BigInt(giftPremiumLinkData.transaction.messages[0].amount),
      amountTon: Number(giftPremiumLinkData.transaction.messages[0].amount) / 1_000_000_000,
      payload: giftPremiumLinkData.transaction.messages[0].payload,
      validUntil: giftPremiumLinkData.transaction.validUntil,
      from: giftPremiumLinkData.transaction.from,
    };
    
    console.log('📋 步骤 4: 已从 getGiftPremiumLink 提取支付信息');
    console.log('   💸 金额:', tonPayment.amountTon.toFixed(2), 'TON');
    console.log('   📍 地址:', tonPayment.address);
    console.log('   ⏰ 有效期至:', new Date(tonPayment.validUntil * 1000).toLocaleString('zh-CN'));

    ctx.session.flow = {
      step: 'waitingPayment',
      username: cleanUsername,
      months,
      reqId,
      amount,
      tonPayment,
      paymentMethod,
    };

    const baseOrder = setUserOrder(ctx.from.id, {
      reqId,
      username: cleanUsername,
      months,
      status: paymentMethod === 'wallet' && telegramWallet ? 'processing_payment' : 'processing_payment',
      amountTon: tonPayment.amountTon,
      address: tonPayment.address,
      autoPay: config.ton.autoPay,
      tonPayment,
      amount,
      chatId: ctx.chat.id,
      externalIds: [reqId],
      paymentMethod,
      giftPremiumLinkData, // 保存 getGiftPremiumLink 返回的数据，用于钱包支付
    });

    linkUserOrder(ctx.from.id, reqId);

    if (loadingMsg) {
      try {
        await ctx.deleteMessage(loadingMsg.message_id);
      } catch (e) {
        // 忽略删除消息失败
      }
    }

    // 不再发送手动支付链接；若自动支付不可用，仅提示配置问题
    if (!(paymentMethod === 'ton' && config.ton.autoPay && tonService?.isReady)) {
      await ctx.reply(
        [
          '🎁 订单创建成功！',
          `👤 目标用户：@${cleanUsername}`,
          `⏱️ 订阅时长：${months} 个月`,
          `💰 支付金额：${tonPayment.amountTon.toFixed(2)} TON`,
          `📋 订单号：${reqId}`,
          ``,
          '⚠️ 自动支付未启用或配置不完整（缺少助记词或节点），请联系管理员。',
        ].join('\n'),
        Markup.inlineKeyboard([
          [Markup.button.callback('📋 查看订单状态', `status:${reqId}`)],
        ]),
      );
    }


    // 使用 Telegram 钱包支付（iipay）
    if (paymentMethod === 'wallet' && telegramWallet && giftPremiumLinkData) {
      try {
        // 从 getGiftPremiumLink 返回的数据中提取 check_params.id（用于支付表单）
        // 根据 Go 代码：返回结构 { ok, link, qr_link, check_method, check_params: { id }, expire_after }
        const formId = giftPremiumLinkData?.check_params?.id;
        
        if (formId) {
          console.log('💰 尝试使用 Telegram 钱包支付...');
          console.log('📋 FormId (check_params.id):', formId);
          console.log('📋 Link:', giftPremiumLinkData?.link || '未提供');
          
          // 使用 check_params.id 作为 formId，使用 reqId 作为 invoice slug
          // payPremiumOrder 现在支持直接传递 reqId 字符串
          const paymentResult = await telegramWallet.payPremiumOrder({
            formId,
            invoice: reqId, // 直接传递 reqId，会自动转换为 InputInvoiceSlug
            comment: `Premium subscription for ${username}`,
          });

          if (paymentResult.success) {
            updateUserOrder(ctx.from.id, {
              status: 'processing_payment',
              walletPayment: paymentResult,
            });

            await ctx.reply(
              '✅ 订单创建成功！正在使用 Telegram 钱包支付...',
              getReplyKeyboard(),
            );

            // 继续处理订单确认
            const messenger = createMessengerFromContext(ctx);
            await processOrderAfterPayment({
              userId: ctx.from.id,
              order: getUserOrder(ctx.from.id),
              messenger,
            });

            return;
          } else {
            console.warn('⚠️ 钱包支付失败，改为使用 TON 支付:', paymentResult.error);
          }
        } else {
          console.warn('⚠️ 无法从 getGiftPremiumLink 获取 formId，改为使用 TON 支付');
        }
      } catch (error) {
        console.error('❌ Telegram 钱包支付失败：', error);
        // 继续使用 TON 支付
      }
    }

    // TON 自动支付（根据 @gd801 提供的方法）
    // 使用助记词（= 私钥）进行自动支付，类似波场 API
    if (paymentMethod === 'ton' && config.ton.autoPay && config.ton.mnemonic && tonService) {
      try {
        console.log('💰 开始 TON 自动支付（使用助记词 = 私钥，类似波场 API）...');
        console.log('   收款地址:', tonPayment.address);
        console.log('   金额:', tonPayment.amountTon.toFixed(2), 'TON');
        console.log('   Payload (bin):', tonPayment.payload.substring(0, 30) + '...');
        
        const tonResult = await tonService.sendTransfer({
          toAddress: tonPayment.address,
          amountNano: tonPayment.amountNano,
          payload: tonPayment.payload, // 必须包含 payload（bin），Fragment 通过此识别订单
        });

        if (tonResult.seqno) {
          updateUserOrder(ctx.from.id, {
            status: 'processing_payment',
            tonTx: tonResult,
          });

          await ctx.reply(
            `✅ TON 自动支付已发送！\n\n` +
            `💸 金额：${tonPayment.amountTon.toFixed(2)} TON\n` +
            `📍 地址：${tonPayment.address}\n` +
            `📦 Seqno：${tonResult.seqno}\n\n` +
            `⏳ 正在使用 checkReq API 检查支付状态...\n` +
            `💡 必须使用 payload 支付才能正确确认`,
            Markup.inlineKeyboard([
              [Markup.button.callback('📋 查看订单状态', `status:${reqId}`)],
            ]),
          );

          // 开始轮询订单状态（使用 checkReq POST 请求）
          startPollingOrderStatus(ctx, reqId);
          return;
        }
      } catch (error) {
        console.error('❌ TON 自动支付失败：', error);
        await ctx.reply(
          `⚠️ TON 自动支付失败：${error.message}\n\n` +
          `请使用手动支付方式（点击上方支付链接）。`,
        );
        // 继续显示手动支付选项
      }
    }

    const messenger = createMessengerFromContext(ctx);
    const result = await processOrderAfterPayment({
      userId: ctx.from.id,
      order: baseOrder,
      messenger,
    });

    if (result.success) {
      ctx.session.flow = { step: 'idle' };
    }
  } catch (error) {
    console.error('创建订单失败：', error);
    console.error('错误详情：', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data,
      status: error.response?.status,
    });
    
    if (loadingMsg) {
      try {
        await ctx.deleteMessage(loadingMsg.message_id);
      } catch (e) {
        // 忽略删除消息失败
      }
    }
    ctx.session.flow = { step: 'idle' };
    if (showLoading) {
      // 显示详细的错误信息
      let errorMessage = `❌ 创建订单失败：${error.message ?? '未知错误'}`;
      if (error.response) {
        errorMessage += `\n\nHTTP 状态码：${error.response.status}`;
        if (error.response.data) {
          errorMessage += `\n错误详情：${JSON.stringify(error.response.data)}`;
        }
      }
      errorMessage += '\n\n请稍后重试或联系客服。';
      
      await ctx.reply(errorMessage, getReplyKeyboard());
    }
    throw error;
  }
}

bot.on('text', async (ctx) => {
  // 保存用户信息到数据库
  try {
    await saveOrUpdateUser({
      userId: ctx.from.id,
      username: ctx.from.username,
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name,
    });
  } catch (error) {
    console.error('保存用户信息失败:', error);
  }
  
  const text = ctx.message.text.trim();
  const { flow } = ctx.session;

  if (!flow || flow.step === 'idle') {
    return;
  }

  try {
    if (flow.step === 'askGiftUsername') {
      const usernames = parseUsernames(text);
      
      if (usernames.length === 0) {
        await ctx.reply('⚠️ 未检测到有效的用户名，请重新输入。\n\n格式：@premium 或 premium\n批量：@Premium @BotFather', getReplyKeyboard());
        return;
      }

      if (usernames.length === 1) {
        // 单个用户，先查询用户信息并显示确认界面
        const username = usernames[0];
        ctx.session.flow = { step: 'confirmGift', username, type: 'gift' };
        
        // 先查询用户信息（使用默认月份 3，仅用于查询用户）
        try {
          const userInfo = await fragmentApi.searchPremiumGiftRecipient({ query: username, months: 3 });
          
          // 从 Fragment API 返回的数据中提取用户信息
          const displayName = userInfo.name || username; // 使用 API 返回的 name，如果没有则使用用户名
          const usernameDisplay = username.startsWith('@') ? username : `@${username}`;
          
          // 提取头像 URL（改进的提取逻辑，支持多种格式）
          let userPhotoUrl = null;
          if (userInfo.photo) {
            // 方法1: 从 HTML img 标签中提取 src
            const imgMatch = userInfo.photo.match(/src=["']([^"']+)["']/i);
            if (imgMatch && imgMatch[1]) {
              userPhotoUrl = imgMatch[1];
            } else {
              // 方法2: 从 background-image: url() 中提取
              const bgMatch = userInfo.photo.match(/background-image:\s*url\(["']?([^"')]+)["']?\)/i);
              if (bgMatch && bgMatch[1]) {
                userPhotoUrl = bgMatch[1];
              } else {
                // 方法3: 直接检查是否是 URL
                const urlPattern = /https?:\/\/[^\s<>"']+/i;
                const urlMatch = userInfo.photo.match(urlPattern);
                if (urlMatch) {
                  userPhotoUrl = urlMatch[0];
                }
              }
            }
            
            // 如果是相对路径，转换为绝对路径
            if (userPhotoUrl && userPhotoUrl.startsWith('//')) {
              userPhotoUrl = 'https:' + userPhotoUrl;
            } else if (userPhotoUrl && userPhotoUrl.startsWith('/')) {
              userPhotoUrl = 'https://fragment.com' + userPhotoUrl;
            }
          }
          
          const confirmMessage = [
            '开通用户: ' + usernameDisplay,
            '用户昵称: ' + displayName,
            '',
            '确定为此用户 开通/续费 Telegram Premium会员吗?',
          ].join('\n');
          
          const confirmKeyboard = {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '✅ 确定', callback_data: `confirm:gift:${username}` },
                  { text: '❌ 取消', callback_data: 'cancel:gift' },
                ],
              ],
            },
          };
          
          // 如果有头像 URL，尝试发送带图片的消息
          if (userPhotoUrl) {
            try {
              // 先下载图片，然后使用 InputFile 发送
              const photoFile = await downloadImageAsInputFile(userPhotoUrl);
              
              if (photoFile) {
                await ctx.replyWithPhoto(photoFile, {
                  caption: confirmMessage,
                  ...confirmKeyboard,
                });
              } else {
                // 下载失败，使用文本消息
                console.warn('图片下载失败，使用文本消息');
                await ctx.reply(confirmMessage, confirmKeyboard);
              }
            } catch (error) {
              console.warn('发送头像图片失败，使用文本消息:', error.message);
              console.warn('头像 URL:', userPhotoUrl);
              await ctx.reply(confirmMessage, confirmKeyboard);
            }
          } else {
            await ctx.reply(confirmMessage, confirmKeyboard);
          }
          
          // 保存用户信息到 session，供后续使用
          ctx.session.flow.userInfo = userInfo;
        } catch (error) {
          console.error('查询用户信息失败:', error);
          await ctx.reply(
            `❌ 查询用户失败：${error.message}\n\n请确保用户名正确，且该用户已注册 Telegram。`,
            getReplyKeyboard()
          );
        }
      } else {
        // 批量用户，直接进入选择时长
        ctx.session.flow = { step: 'selectMonths', usernames, type: 'gift' };
        const monthsKeyboard = await getMonthsKeyboard();
        await ctx.reply(
          `已选择 ${usernames.length} 个用户：\n${usernames.map((u) => `• @${u}`).join('\n')}\n\n请选择订阅时长：`,
          monthsKeyboard
        );
      }
      return;
    }

    if (flow.step === 'askUsername') {
      const months = flow.months;
      const username = text.replace(/^@/, '');
      
      if (!username || username.length === 0) {
        await ctx.reply('用户名不能为空，请重新输入：', getReplyKeyboard());
        return;
      }

      const flow = ctx.session.flow || {};
      ctx.session.flow = { step: 'creatingOrder', username, months, type: flow.type || 'gift', paymentMethod: flow.paymentMethod || 'usdt' };
      await processOrderCreation(ctx, username, months, true, flow.paymentMethod || 'usdt');
      return;
    }

    if (flow.step === 'waitingPayment') {
      await ctx.reply('订单已创建，系统正在处理，请使用 /status 或点击"订单状态"查看最新进展。', getReplyKeyboard());
    }
  } catch (error) {
    console.error('处理文本消息失败：', error);
    ctx.session.flow = { step: 'idle' };
    await ctx.reply(`出现错误：${error.message ?? '未知错误'}，请稍后重试。`, getReplyKeyboard());
  }
});

function createMessengerFromContext(ctx) {
  return {
    text(message, extra) {
      return ctx.reply(message, extra);
    },
    markdown(message) {
      return ctx.reply(message);
    },
  };
}

function createMessengerForChat(chatId) {
  return {
    text(message, extra) {
      return bot.telegram.sendMessage(chatId, message, extra);
    },
    markdown(message) {
      return bot.telegram.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    },
  };
}

async function processOrderAfterPayment({ userId, order, messenger }) {
  if (!order?.tonPayment) {
    await messenger.text('订单缺少 TON 支付信息，无法自动开通，请联系管理员。');
    return { success: false };
  }

  if (!config.ton.autoPay) {
    await messenger.text('自动支付未开启，请手动完成 TON 转账并使用 /status 查询。');
    return { success: false };
  }

  if (!tonService.isReady) {
    await messenger.text('自动支付配置不完整（缺少助记词或节点信息），请联系管理员处理。');
    return { success: false };
  }

  try {
    await messenger.text('🔄 正在执行自动支付\n\n请稍候，系统会自动完成 TON 转账并开通会员。');

    updateUserOrder(userId, { status: 'broadcasting' });

    await tonService.sendTransfer({
      toAddress: order.tonPayment.address,
      amountNano: order.tonPayment.amountNano,
      payload: order.tonPayment.payload,
    });

    updateUserOrder(userId, { status: 'broadcasted' });
    await messenger.text('交易已广播，正在实时确认订单状态…');

    const result = await pollOrderConfirmation({
      fragmentApi,
      reqId: order.reqId,
      onTick: ({ attempt }) => {
        if (attempt % 5 === 0) {
          messenger.text('仍在确认中，请稍候…').catch(() => {});
        }
      },
    });

    if (result.confirmed) {
      updateUserOrder(userId, { status: 'completed' });
      clearUserOrder(userId);
      await messenger.text('✅ Premium 已成功开通！');
      return { success: true };
    }

    updateUserOrder(userId, { status: 'waiting_confirmation' });
    await messenger.text('尚未确认订单，请稍后使用 /status 再次查看或联系管理员。');
    return { success: false };
  } catch (error) {
    console.error('自动支付失败：', error);
    updateUserOrder(userId, {
      status: 'error',
      error: error.message,
    });
    await messenger.text(`自动支付失败：${error.message ?? '未知错误'}，请手动支付或联系管理员。`);
    return { success: false, error };
  }
}

function mapOrderStatus(status) {
  switch (status) {
    case 'waiting_user_payment':
      return '等待用户支付 USDT';
    case 'processing_payment':
      return '正在执行自动支付';
    case 'broadcasting':
      return '正在广播 TON 交易';
    case 'broadcasted':
      return '已广播，等待上链确认';
    case 'waiting_confirmation':
      return '等待 Fragment 确认';
    case 'completed':
      return '已完成';
    case 'error':
      return '执行失败，请联系管理员';
    default:
      return '处理中';
  }
}

export {
  processOrderAfterPayment,
  createMessengerForChat,
  createMessengerFromContext,
  fragmentApi,
  tonService,
  telegramWallet,
  bot as telegramBot,
};

export async function launchBot() {
  let retries = 3;
  let lastError = null;
  
  while (retries > 0) {
    try {
      await bot.launch();
      console.log('✅ Telegram Premium Bot 已启动');
      return;
    } catch (error) {
      lastError = error;
      retries--;
      console.error(`启动失败 (剩余重试次数: ${retries}):`, error.message);
      
      if (retries > 0) {
        console.log('等待 3 秒后重试...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  }
  
  console.error('❌ 机器人启动失败，已重试 3 次');
  throw lastError;
}

export function stopBot() {
  bot.stop('SIGTERM');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  launchBot();

  process.once('SIGINT', () => stopBot());
  process.once('SIGTERM', () => stopBot());
}

