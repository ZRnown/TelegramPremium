import { getAllConfig as loadAllConfigFromDB } from './services/configService.js';

// 异步初始化配置
let configInitialized = false;
// 提供默认配置对象，避免导入时出错
let config = {
  telegramBotToken: null,
  fragment: {
    baseURL: 'https://fragment.com/api',
    cookie: null,
    hash: null,
    pollHash: null,
    autoRefresh: true,
  },
  ton: {
    endpoint: 'https://toncenter.com/api/v2/jsonRPC',
    apiKey: null,
    mnemonic: null,
    autoPay: true,
  },
  telegramWallet: {
    apiId: null,
    apiHash: null,
    sessionString: null,
  },
  server: {
    port: 3000,
  },
  store: {
    orderTtlMs: 15 * 60 * 1000,
    maxEntries: 500,
  },
  proxy: {
    url: null,
  },
};

export async function initializeConfig() {
  if (configInitialized) {
    return config;
  }

  // 从数据库加载配置
  const dbConfig = await loadAllConfigFromDB();

  config = {
    telegramBotToken: dbConfig['bot_token'] || null,
    fragment: {
      baseURL: dbConfig['fragment_base_url'] || 'https://fragment.com',
      cookie: dbConfig['fragment_cookie'] || null,
      hash: dbConfig['fragment_hash'] || null,
      pollHash: dbConfig['fragment_poll_hash'] || dbConfig['fragment_hash'] || null,
      autoRefresh: String(dbConfig['fragment_auto_refresh'] || 'true').toLowerCase() === 'true',
      // 钱包信息（用于 getGiftPremiumLink，默认值在 FragmentApi 中硬编码）
      walletAccount: dbConfig['fragment_wallet_account'] || null,
      walletDevice: dbConfig['fragment_wallet_device'] || null,
    },
    ton: {
      endpoint: dbConfig['ton_endpoint'] || 'https://toncenter.com/api/v2/jsonRPC',
      apiKey: dbConfig['ton_api_key'] || null,
      mnemonic: dbConfig['ton_mnemonic'] || null,
      autoPay: String(dbConfig['ton_autopay'] || 'true').toLowerCase() === 'true',
    },
    telegramWallet: {
      apiId: Number.parseInt(dbConfig['telegram_wallet_api_id'] || '0', 10) || null,
      apiHash: dbConfig['telegram_wallet_api_hash'] || null,
      sessionString: dbConfig['telegram_wallet_session'] || null,
    },
    server: {
      port: Number.parseInt(dbConfig['server_port'] || '3000', 10),
    },
    store: {
      orderTtlMs: Number.parseInt(dbConfig['order_ttl_seconds'] || '900', 10) * 1000,
      maxEntries: Number.parseInt(dbConfig['order_max_entries'] || '500', 10),
    },
    proxy: {
      url: dbConfig['http_proxy'] || null,
    },
  };

  configInitialized = true;
  return config;
}

// 获取配置（如果未初始化则先初始化）
export async function getConfigAsync() {
  if (!configInitialized) {
    await initializeConfig();
  }
  return config;
}

// 同步获取配置（必须在初始化后调用）
export function getConfig() {
  if (!configInitialized) {
    throw new Error('配置未初始化，请先调用 initializeConfig()');
  }
  return config;
}

// 为了向后兼容，导出一个 config 对象（会在初始化后更新）
// 注意：这个对象在初始化前是 null，初始化后才会被赋值
export { config };

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

  // Telegram Wallet 支付已移除，现在只使用 TON 支付

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

