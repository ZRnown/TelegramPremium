import { PrismaClient } from '@prisma/client';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

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

/**
 * 保存或更新用户信息到数据库
 * @param {Object} userData - 用户数据
 * @param {string} userData.userId - Telegram 用户 ID
 * @param {string} [userData.username] - 用户名
 * @param {string} [userData.firstName] - 名
 * @param {string} [userData.lastName] - 姓
 * @returns {Promise<Object>} 用户对象
 */
export async function saveOrUpdateUser({ userId, username, firstName, lastName }) {
  try {
    const user = await prisma.user.upsert({
      where: { userId: userId.toString() },
      update: {
        username: username || undefined,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        lastActiveAt: new Date(),
      },
      create: {
        userId: userId.toString(),
        username: username || null,
        firstName: firstName || null,
        lastName: lastName || null,
        createdAt: new Date(),
        lastActiveAt: new Date(),
      },
    });
    
    return user;
  } catch (error) {
    console.error('保存用户信息失败:', error);
    throw error;
  }
}

/**
 * 获取用户信息
 * @param {string} userId - Telegram 用户 ID
 * @returns {Promise<Object|null>} 用户对象或 null
 */
export async function getUser(userId) {
  try {
    const user = await prisma.user.findUnique({
      where: { userId: userId.toString() },
    });
    return user;
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return null;
  }
}

