import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

// 使用单例模式，避免创建多个 Prisma 实例
const globalForPrisma = globalThis;

// 确保 DATABASE_URL 已设置
if (!process.env.DATABASE_URL) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  process.env.DATABASE_URL = `file:${join(__dirname, '../../prisma/dev.db')}`;
}

const prisma = globalForPrisma.prisma || new PrismaClient({
  log: ['error'], // 只记录错误，不记录查询日志
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// 配置缓存
let configCache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 1000; // 缓存 60 秒

/**
 * 从数据库加载配置
 * @returns {Promise<Object>} 配置对象
 */
async function loadConfigFromDatabase() {
  const now = Date.now();
  
  // 如果缓存有效，直接返回
  if (configCache && (now - cacheTimestamp) < CACHE_TTL) {
    return configCache;
  }

  try {
    const configs = await prisma.config.findMany();
    
    // 转换为对象格式（保持原始 key，不转换）
    const configMap = {};
    configs.forEach((item) => {
      configMap[item.key] = item.value;
    });

    // 更新缓存
    configCache = configMap;
    cacheTimestamp = now;

    return configMap;
  } catch (error) {
    console.error('从数据库加载配置失败:', error);
    return {};
  }
}

/**
 * 获取配置值（优先从数据库，如果不存在则从环境变量）
 * @param {string} key - 配置键
 * @param {string} envKey - 环境变量键（可选）
 * @param {string} defaultValue - 默认值（可选）
 * @returns {Promise<string|undefined>} 配置值
 */
export async function getConfig(key, envKey = null, defaultValue = undefined) {
  const dbConfig = await loadConfigFromDatabase();
  
  // 优先使用数据库配置
  if (dbConfig[key]) {
    return dbConfig[key];
  }
  
  // 如果数据库没有，尝试环境变量
  if (envKey && process.env[envKey]) {
    return process.env[envKey];
  }
  
  return defaultValue;
}

/**
 * 清除配置缓存，强制下次重新从数据库读取
 */
export function clearConfigCache() {
  configCache = null;
  cacheTimestamp = 0;
}

/**
 * 获取所有配置（用于初始化）
 * @returns {Promise<Object>} 所有配置
 */
export async function getAllConfig() {
  return await loadConfigFromDatabase();
}

