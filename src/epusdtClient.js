import axios from 'axios';
import crypto from 'crypto';
import { httpAgent, httpsAgent } from './utils/httpAgents.js';
import { config } from './config.js';

export class EpusdtClient {
  constructor({ baseURL, token }) {
    if (!token) {
      throw new Error('EpusdtClient 初始化失败：缺少 API Token');
    }

    this.token = token;
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
            timeout: 15_000,
            httpAgent,
            httpsAgent,
    });
  }

  generateSignature(params) {
    const entries = Object.entries(params)
      .filter(([key, value]) => key !== 'signature' && value !== undefined && value !== null && `${value}` !== '')
      .sort(([a], [b]) => (a > b ? 1 : -1));

    const signString = entries.map(([key, value]) => `${key}=${value}`).join('&');
    const md5 = crypto.createHash('md5');
    md5.update(`${signString}${this.token}`, 'utf8');
    return md5.digest('hex');
  }

  verifySignature(payload) {
    const expected = this.generateSignature(payload);
    const provided = (payload.signature || '').toLowerCase();
    return expected === provided;
  }

  async createTransaction({ orderId, amount, notifyUrl, redirectUrl }) {
    const body = {
      order_id: orderId,
      amount: Number(amount).toFixed(2),
      notify_url: notifyUrl,
    };

    if (redirectUrl) {
      body.redirect_url = redirectUrl;
    }

    const signature = this.generateSignature(body);
    const payload = { ...body, signature };

    const { data } = await this.client.post('/api/v1/order/create-transaction', payload);

    if (data?.status_code !== 200) {
      const message = data?.message || '创建 Epusdt 交易失败';
      throw new Error(message);
    }

    return data.data;
  }
}

