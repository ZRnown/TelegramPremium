// scripts/gen-telegram-session.js
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const input = require('input');

(async () => {
  const apiId = Number(process.env.TELEGRAM_WALLET_API_ID || (await input.text('api_id: ')));
  const apiHash = process.env.TELEGRAM_WALLET_API_HASH || (await input.text('api_hash: '));

  // 强制使用本地 SOCKS5 代理 127.0.0.1:7897 生成会话
  const socksHost = '127.0.0.1';
  const socksPort = 7897;
  const socksUser = undefined;
  const socksPass = undefined;

  const stringSession = new StringSession('');
  const clientOptions = { connectionRetries: 5 };

  clientOptions.proxy = {
    ip: socksHost,
    port: Number(socksPort),
    socksType: 5,
    username: socksUser,
    password: socksPass,
    timeout: 30000,
  };
  console.log('🌐 使用本地 SOCKS5 代理生成会话:', {
    host: socksHost,
    port: Number(socksPort),
    auth: Boolean(socksUser && socksPass),
  });

  const client = new TelegramClient(stringSession, apiId, apiHash, clientOptions);
  await client.start({
    phoneNumber: async () => await input.text('手机号（含国家码，如 +8613812345678）: '),
    password: async () => await input.text('两步验证密码（如有则填）: ', { replace: '*' }),
    phoneCode: async () => await input.text('短信/Telegram 验证码: '),
    onError: (err) => console.error('登录错误:', err),
  });

  console.log('\n✅ 登录成功！下面是你的 StringSession（请妥善保管）:');
  console.log('='.repeat(60));
  console.log(client.session.save());
  console.log('='.repeat(60));
  await client.disconnect();
  process.exit(0);
})();