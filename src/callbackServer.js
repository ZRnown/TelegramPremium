import express from 'express';

import { config } from './config.js';
import {
  epusdtClient,
  processOrderAfterPayment,
  createMessengerForChat,
} from './bot.js';
import { getOrderByExternalId, updateUserOrder } from './store.js';

function getNotifyPath(url) {
  if (!url) return '/epusdt/notify';
  try {
    const parsed = new URL(url);
    return parsed.pathname || '/epusdt/notify';
  } catch (error) {
    console.warn('EPUSDT_NOTIFY_URL 无法解析，默认使用 /epusdt/notify');
    return '/epusdt/notify';
  }
}

export function launchCallbackServer() {
  if (!config.epusdt.enabled || !epusdtClient) {
    console.log('Epusdt 未启用，跳过回调服务启动');
    return null;
  }

  const app = express();
  app.use(express.json());

  const notifyPath = getNotifyPath(config.epusdt.notifyUrl);

  app.post(notifyPath, async (req, res) => {
    const payload = req.body || {};

    if (!epusdtClient.verifySignature(payload)) {
      console.warn('收到无效签名的 Epusdt 回调', payload);
      res.status(401).json({ message: 'invalid signature' });
      return;
    }

    const { order_id: orderId, status } = payload;
    const orderRecord = getOrderByExternalId(orderId);

    if (!orderRecord || !orderRecord.order) {
      console.warn(`未找到对应订单：${orderId}`);
      res.status(200).send('ok');
      return;
    }

    const { userId, order } = orderRecord;

    if (status !== 2) {
      const mappedStatus = status === 3 ? 'expired' : 'waiting_user_payment';
      updateUserOrder(userId, {
        status: mappedStatus,
        epusdtStatus: payload,
      });
      res.status(200).send('ok');
      return;
    }

    const messenger = createMessengerForChat(order.chatId);

    try {
      await messenger.text('✅ 检测到 USDT 支付成功，正在自动开通 Premium…');

      const updatedOrder = updateUserOrder(userId, {
        status: 'processing_payment',
        epusdtStatus: payload,
      });

      await processOrderAfterPayment({
        userId,
        order: updatedOrder,
        messenger,
      });

      res.status(200).send('ok');
    } catch (error) {
      console.error('处理 Epusdt 支付回调失败：', error);
      res.status(500).json({ message: 'internal error' });
    }
  });

  const server = app.listen(config.server.port, () => {
    console.log(`Epusdt 回调服务已启动，端口 ${config.server.port}，路径 ${notifyPath}`);
  });

  return server;
}

