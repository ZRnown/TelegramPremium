import dotenv from 'dotenv';

dotenv.config();

function requireEnv(name, fallback = undefined) {
  const value = process.env[name];
  if (value && value.trim()) {
    return value.trim();
  }
  return fallback;
}

export const config = {
  telegramBotToken: requireEnv('BOT_TOKEN'),
  fragment: {
    baseURL: requireEnv('FRAGMENT_BASE_URL', 'https://fragment.com/api'),
    cookie: requireEnv('FRAGMENT_COOKIE'),
    hash: requireEnv('FRAGMENT_HASH'),
    pollHash: requireEnv('FRAGMENT_POLL_HASH', requireEnv('FRAGMENT_HASH')),
    autoRefresh: requireEnv('FRAGMENT_AUTO_REFRESH', 'true').toLowerCase() === 'true',
  },
  ton: {
    endpoint: requireEnv('TON_ENDPOINT', 'https://toncenter.com/api/v2/jsonRPC'),
    apiKey: requireEnv('TON_API_KEY'),
    mnemonic: requireEnv('TON_MNEMONIC'),
    autoPay: requireEnv('TON_AUTOPAY', 'true').toLowerCase() === 'true',
  },
  epusdt: {
    baseURL: requireEnv('EPUSDT_BASE_URL', 'https://api.epusdt.com'),
    token: requireEnv('EPUSDT_TOKEN'),
    notifyUrl: requireEnv('EPUSDT_NOTIFY_URL'),
    redirectUrl: requireEnv('EPUSDT_REDIRECT_URL'),
  },
  server: {
    port: Number.parseInt(requireEnv('SERVER_PORT', '3000'), 10),
  },
  store: {
    orderTtlMs: Number.parseInt(requireEnv('ORDER_TTL_SECONDS', '900'), 10) * 1000,
    maxEntries: Number.parseInt(requireEnv('ORDER_MAX_ENTRIES', '500'), 10),
  },
  proxy: {
    url: requireEnv('HTTP_PROXY'),
  },
};

export function getConfigStatus() {
  const issues = [];
  const warnings = [];

  if (!config.telegramBotToken) {
    issues.push('缺少 BOT_TOKEN');
  }

  if (!config.fragment.cookie || !config.fragment.hash) {
    issues.push('缺少 Fragment Cookie 或 Hash');
  }

  if (config.ton.autoPay) {
    if (!config.ton.mnemonic) {
      warnings.push('已启用自动支付，但缺少 TON_MNEMONIC');
    }
    if (!config.ton.endpoint) {
      warnings.push('已启用自动支付，但缺少 TON_ENDPOINT');
    }
  }

  const epusdtEnabled = Boolean(config.epusdt.token);
  config.epusdt.enabled = epusdtEnabled;
  if (epusdtEnabled) {
    if (!config.epusdt.notifyUrl) {
      warnings.push('已配置 EPUSDT_TOKEN，但缺少 EPUSDT_NOTIFY_URL');
    }
    if (!config.epusdt.redirectUrl) {
      warnings.push('已配置 EPUSDT_TOKEN，但缺少 EPUSDT_REDIRECT_URL');
    }
  }

  if (!Number.isFinite(config.store.orderTtlMs) || config.store.orderTtlMs <= 0) {
    config.store.orderTtlMs = 15 * 60 * 1000;
  }

  if (!Number.isFinite(config.store.maxEntries) || config.store.maxEntries <= 0) {
    config.store.maxEntries = 500;
  }

  return {
    isValid: issues.length === 0,
    issues,
    warnings,
  };
}

export async function validateConfig() {
  const status = getConfigStatus();
  if (!status.isValid) {
    console.warn('配置检查发现问题：', status.issues.join(', '));
  }
  if (status.warnings.length > 0) {
    console.warn('配置警告：', status.warnings.join(', '));
  }
  return status;
}

