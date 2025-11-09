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

// 价格缓存，避免频繁查询数据库
let priceCache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 1000; // 缓存 60 秒

/**
 * 获取价格列表
 * @returns {Promise<Object>} 价格对象，key 为月数，value 为价格
 */
export async function getPriceList() {
  const now = Date.now();
  
  // 如果缓存有效，直接返回
  if (priceCache && (now - cacheTimestamp) < CACHE_TTL) {
    return priceCache;
  }

  try {
    const prices = await prisma.price.findMany({
      where: { isActive: true },
      orderBy: { months: 'asc' },
    });

    // 转换为对象格式 { 3: 12.5, 6: 16.5, 12: 29.9 }
    const priceMap = {};
    prices.forEach((price) => {
      priceMap[price.months] = price.price;
    });

    // 更新缓存
    priceCache = priceMap;
    cacheTimestamp = now;

    return priceMap;
  } catch (error) {
    console.error('获取价格失败:', error);
    // 如果数据库查询失败，返回默认价格
    return {
      3: 12.5,
      6: 16.5,
      12: 29.9,
    };
  }
}

/**
 * 获取指定月数的价格
 * @param {number} months - 月数
 * @returns {Promise<number>} 价格
 */
export async function getPrice(months) {
  const prices = await getPriceList();
  return prices[months] || null;
}

/**
 * 清除价格缓存，强制下次重新从数据库读取
 */
export function clearPriceCache() {
  priceCache = null;
  cacheTimestamp = 0;
}

/**
 * 初始化价格数据（如果数据库中没有价格，创建默认价格）
 */
export async function initializePrices() {
  try {
    const existingPrices = await prisma.price.findMany();
    
    if (existingPrices.length === 0) {
      console.log('初始化默认价格...');
      await prisma.price.createMany({
        data: [
          { months: 3, price: 12.5, isActive: true },
          { months: 6, price: 16.5, isActive: true },
          { months: 12, price: 29.9, isActive: true },
        ],
      });
      console.log('默认价格初始化完成');
    }
  } catch (error) {
    console.error('初始化价格失败:', error);
  }
}

