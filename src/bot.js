import { Telegraf, session, Markup } from 'telegraf';
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
import { EpusdtClient } from './epusdtClient.js';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { getPriceList, initializePrices, clearPriceCache } from './services/priceService.js';
import { saveOrUpdateUser } from './services/userService.js';

let cookieManager = null;
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

// 初始化价格数据
await initializePrices();

async function initializeBot() {
  configStatus = await validateConfig();

  try {
    const { cookieManager: cm } = await import('./cookieManager.js');
    cookieManager = cm;

    let hasCookie = false;

    if (config.fragment.cookie && config.fragment.hash) {
      cookieManager.setCookie(config.fragment.cookie, config.fragment.hash);
      hasCookie = true;
    } else {
      const loaded = await cookieManager.load();
      if (loaded && cookieManager.getCookie() && cookieManager.getHash()) {
        hasCookie = true;
      }
    }

    if (!hasCookie) {
      console.log('未找到 Cookie，正在自动获取...');
      const result = await cookieManager.autoFetchCookie();
      if (result.success) {
        console.log('✅ Cookie 自动获取成功');
        hasCookie = true;
      } else {
        console.warn('⚠️ Cookie 自动获取失败：', result.error);
        console.warn('提示：可以手动设置 FRAGMENT_COOKIE 和 FRAGMENT_HASH 环境变量');
      }
    }

    if (hasCookie || cookieManager.getCookie()) {
      const isValid = await cookieManager.ensureValid();
      if (isValid) {
        config.fragment.cookie = cookieManager.getCookie();
        config.fragment.hash = cookieManager.getHash();
        if (!config.fragment.pollHash) {
          config.fragment.pollHash = cookieManager.getHash();
        }

        fragmentApi = new FragmentApi({
          baseURL: config.fragment.baseURL,
          cookie: config.fragment.cookie,
          hash: config.fragment.hash,
          pollHash: config.fragment.pollHash,
          cookieManager,
        });
        console.log('✅ Fragment API 初始化成功');
      } else {
        console.warn('⚠️ Cookie 验证失败，Fragment API 未初始化');
      }
    } else {
      console.warn('⚠️ 无法获取 Cookie，Fragment API 未初始化');
    }
  } catch (error) {
    console.error('初始化 Cookie 管理器失败：', error.message);
  }
}

await initializeBot();

const tonService = new TonPaymentService({
  endpoint: config.ton.endpoint,
  apiKey: config.ton.apiKey,
  mnemonic: config.ton.mnemonic,
});

const epusdtClient = config.epusdt.enabled
  ? new EpusdtClient({
      baseURL: config.epusdt.baseURL,
      token: config.epusdt.token,
    })
  : null;

if (!config.telegramBotToken) {
  console.error('错误：缺少 BOT_TOKEN，机器人无法启动');
  process.exit(1);
}

const botOptions = {};
if (config.proxy.url) {
  try {
    const agent = new HttpsProxyAgent(config.proxy.url);
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
    ['🎁 购买会员'],
    ['📋 查看订单', '💬 联系客服'],
  ])
    .resize()
    .persistent();
}

function removeReplyKeyboard() {
  return Markup.removeKeyboard();
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


bot.hears('🎁 购买会员', async (ctx) => {
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

bot.hears('📋 查看订单', async (ctx) => {
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

    if (order.epusdt) {
      lines.push(
        `USDT 金额：${order.epusdt.actual_amount}（CNY：${order.amount}）`,
        `支付地址：${order.epusdt.token}`,
      );
      
      if (order.epusdt.payment_url) {
        const statusKeyboard = {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '💳 前往支付页面', url: order.epusdt.payment_url },
              ],
            ],
          },
        };
        
        const message = lines.join('\n') + '\n\n系统会持续自动检查，请稍候。';
        await ctx.reply(message, statusKeyboard);
        return;
      }
    }

    lines.push('系统会持续自动检查，请稍候。');
    await ctx.reply(lines.join('\n'), getReplyKeyboard());
  } catch (error) {
    console.error('查询订单状态失败：', error);
    await ctx.reply(`查询订单状态失败：${error.message ?? '未知错误'}`, getReplyKeyboard());
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
  
  try {
    await ctx.answerCbQuery();
  } catch (e) {
    // 忽略回调查询错误
  }


      if (data === 'purchase:self') {
        const user = ctx.from;
        const displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || '用户';
        const username = user.username ? `@${user.username}` : '（未设置用户名）';
        
        // 为自己开通时，使用用户名或 Telegram ID
        const targetUsername = user.username || user.id.toString();
        
        // 获取用户头像
        let userPhoto = null;
        try {
          const photos = await ctx.telegram.getUserProfilePhotos(user.id, 0, 1);
          if (photos.total_count > 0 && photos.photos.length > 0) {
            // 获取最大尺寸的头像
            const photoSizes = photos.photos[0];
            const largestPhoto = photoSizes[photoSizes.length - 1];
            userPhoto = largestPhoto.file_id;
          }
        } catch (error) {
          console.warn('获取用户头像失败:', error.message);
        }
        
        ctx.session.flow = { step: 'confirmSelf', type: 'self', targetUser: targetUsername };
        
        const confirmMessage = [
          '开通用户: ' + username,
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
        
        // 如果有头像，发送带图片的消息
        if (userPhoto) {
          try {
            await ctx.editMessageMedia(
              {
                type: 'photo',
                media: userPhoto,
                caption: confirmMessage,
              },
              confirmKeyboard
            );
          } catch (error) {
            // 如果编辑失败，尝试发送新消息
            await ctx.replyWithPhoto(userPhoto, {
              caption: confirmMessage,
              ...confirmKeyboard,
            });
          }
        } else {
          // 没有头像时，只发送文本
          await ctx.editMessageText(confirmMessage, confirmKeyboard);
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
    await ctx.editMessageText('请选择订阅时长：', monthsKeyboard);
    return;
  }
  
  // 处理取消赠送
  if (data === 'cancel:gift') {
    ctx.session.flow = { step: 'idle' };
    await ctx.editMessageText('已取消操作。', getReplyKeyboard());
    return;
  }

  if (data.startsWith('months:')) {
    const months = Number.parseInt(data.split(':')[1], 10);
    const flow = ctx.session.flow || {};
    
    // 直接使用 USDT 支付，不需要选择支付方式
    const paymentMethod = 'usdt';
    
    ctx.session.flow = {
      ...flow,
      months,
      paymentMethod,
    };
    
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
        `已选择 ${months} 个月订阅\n支付方式：💵 TRC20 USDT\n\n请输入接收方的用户名（无需 @）：`
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
    await fragmentApi.getGiftPremiumLink({ reqId });
    const tonPayment = await fragmentApi.getTonkeeperRequest({ reqId });

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
      status: paymentMethod === 'usdt' && config.epusdt.enabled ? 'waiting_user_payment' : 'processing_payment',
      amountTon: tonPayment.amountTon,
      address: tonPayment.address,
      autoPay: config.ton.autoPay,
      tonPayment,
      amount,
      chatId: ctx.chat.id,
      externalIds: [reqId],
      paymentMethod,
    });

    linkUserOrder(ctx.from.id, reqId);

    if (loadingMsg) {
      try {
        await ctx.deleteMessage(loadingMsg.message_id);
      } catch (e) {
        // 忽略删除消息失败
      }
    }

    await ctx.reply(
      [
        '🎁 订单创建成功，正在准备支付。',
        `目标用户：@${cleanUsername}`,
        `订阅时长：${months} 个月`,
        `订单号：${reqId}`,
        `支付方式：💵 TRC20 USDT`,
      ].join('\n'),
      getReplyKeyboard(),
    );


    if (paymentMethod === 'usdt' && config.epusdt.enabled && epusdtClient) {
      try {
        const epusdtOrder = await epusdtClient.createTransaction({
          orderId: reqId,
          amount,
          notifyUrl: config.epusdt.notifyUrl,
          redirectUrl: config.epusdt.redirectUrl,
        });

        updateUserOrder(ctx.from.id, {
          status: 'waiting_user_payment',
          epusdt: epusdtOrder,
          expirationTime: Date.now() + 10 * 60 * 1000,
        });
        linkUserOrder(ctx.from.id, epusdtOrder.order_id);

        const paymentMessage = [
          '✅ 订单创建成功！',
          '',
          `💰 充值金额：${amount.toFixed(2)} CNY`,
          `💵 USDT 金额：${epusdtOrder.actual_amount} USDT`,
          `📋 订单号：${epusdtOrder.order_id}`,
          '',
          '请通过以下方式完成支付：',
          '',
          '1️⃣ 点击下方按钮访问支付页面',
          '2️⃣ 或直接向以下钱包地址转账 USDT（TRC20）：',
          `${epusdtOrder.token}`,
          '',
          '⚠️ 请确保转账金额与显示的 USDT 金额一致',
          '⏰ 支付有效期：10分钟',
        ].join('\n');

        const paymentKeyboard = {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '💳 前往支付页面',
                  url: epusdtOrder.payment_url,
                },
              ],
            ],
          },
        };

        await ctx.reply(paymentMessage, paymentKeyboard);

        return;
      } catch (error) {
        console.error('创建 Epusdt 交易失败：', error);
        updateUserOrder(ctx.from.id, { status: 'processing_payment' });
        await ctx.reply(
          `Epusdt 支付创建失败：${error.message ?? '未知错误'}，改为尝试自动 TON 支付。`,
          getReplyKeyboard(),
        );
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
        
        // 先查询用户信息（仅用于查询用户，不传 months）
        try {
          const userInfo = await fragmentApi.searchPremiumGiftRecipient({ query: username });
          
          // 从 Fragment API 返回的数据中提取用户信息
          const displayName = userInfo.name || username; // 使用 API 返回的 name，如果没有则使用用户名
          const usernameDisplay = username.startsWith('@') ? username : `@${username}`;
          
          // 提取头像 URL（如果 API 返回了 photo HTML）
          let userPhotoUrl = null;
          if (userInfo.photo) {
            // 从 HTML img 标签中提取 src
            const match = userInfo.photo.match(/src="([^"]+)"/);
            if (match) {
              userPhotoUrl = match[1];
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
              await ctx.replyWithPhoto(userPhotoUrl, {
                caption: confirmMessage,
                ...confirmKeyboard,
              });
            } catch (error) {
              console.warn('发送头像图片失败，使用文本消息:', error.message);
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
  epusdtClient,
  bot as telegramBot,
};

export function launchBot() {
  return bot.launch().then(() => {
    console.log('Telegram Premium Bot 已启动');
  });
}

export function stopBot() {
  bot.stop('SIGTERM');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  launchBot();

  process.once('SIGINT', () => stopBot());
  process.once('SIGTERM', () => stopBot());
}

