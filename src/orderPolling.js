/**
 * 轮询 Fragment 订单状态直到 confirmed === true 或超时。
 */
export async function pollOrderConfirmation({
  fragmentApi,
  reqId,
  intervalMs = 3_000,
  maxAttempts = 40,
  onTick,
}) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const status = await fragmentApi.checkRequest({ reqId });
    if (typeof onTick === 'function') {
      onTick({ attempt, status });
    }

    if (status?.confirmed) {
      return { confirmed: true, status };
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return { confirmed: false };
}

