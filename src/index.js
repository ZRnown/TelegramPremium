/**
 * PremiumBot 主入口
 * 启动 Telegram Bot
 */

console.log('🚀 启动 PremiumBot...');
console.log('');

// 启动 Bot（显式调用启动函数，避免仅导入后进程退出）
const { launchBot, stopBot } = await import('./bot.js');
await launchBot();

console.log('✅ Bot 已启动');

// 优雅退出
process.once('SIGINT', () => stopBot?.());
process.once('SIGTERM', () => stopBot?.());
