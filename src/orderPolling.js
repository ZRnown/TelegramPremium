/**
 * 轮询 Fragment 订单状态直到 confirmed === true 或超时
 * 
 * 使用 checkReq API 检查支付状态（根据 @gd801 提供的方法）：
 * POST https://fragment.com/api?hash=xxx
 * 参数: id={reqId}&method=checkReq
 * 返回: {"confirmed": false} 或 {"confirmed": true}
 * 
 * 注意：必须使用 payload 支付才能正确确认（链上信息）
 */
export async function pollOrderConfirmation({
  fragmentApi,
  reqId,
  intervalMs = 3_000,
  maxAttempts = 40,
  onTick,
}) {
  console.log('🔄 开始轮询订单状态（使用 checkReq API）');
  console.log(`   订单 ID: ${reqId}`);
  console.log(`   检查间隔: ${intervalMs / 1000} 秒`);
  console.log(`   最大尝试: ${maxAttempts} 次`);
  
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const status = await fragmentApi.checkRequest({ reqId });
      
      console.log(`   [${attempt}/${maxAttempts}] 状态:`, status?.confirmed ? '✅ 已支付' : '⏳ 未支付');
      
      if (typeof onTick === 'function') {
        onTick({ attempt, status });
      }

      if (status?.confirmed) {
        console.log('✅ 订单已确认！支付成功');
        return { confirmed: true, status };
      }
    } catch (error) {
      console.error(`   [${attempt}/${maxAttempts}] 检查失败:`, error.message);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  console.warn('⚠️ 轮询超时，订单未确认');
  return { confirmed: false };
}

