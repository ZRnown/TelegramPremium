/**
 * 简化的 Cookie 管理器
 * 只负责从环境变量读取 Cookie 和 Hash，不再自动获取
 */

/**
 * 获取 Cookie 和 Hash（仅从环境变量）
 */
export function getCookieAndHash() {
  const cookie = process.env.FRAGMENT_COOKIE;
  const hash = process.env.FRAGMENT_HASH;
  
  if (!cookie || !hash) {
    throw new Error('缺少 FRAGMENT_COOKIE 或 FRAGMENT_HASH 环境变量，请在 .env 文件中设置');
  }
  
  console.log('✅ 已从环境变量加载 Cookie 和 Hash');
  console.log('   Hash:', hash.substring(0, 10) + '...');
  console.log('   Cookie 长度:', cookie.length);
  
  return { cookie, hash };
}
