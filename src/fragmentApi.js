import axios from 'axios';
import { httpAgent, httpsAgent } from './utils/httpAgents.js';
import { config } from './config.js';

/**
 * Fragment API 封装，负责 Premium 礼物购买流程所需的接口调用。
 * 所有请求都必须带上 Cookie 以及 hash 参数。
 */
export class FragmentApi {
  constructor({ baseURL, cookie, hash, pollHash, cookieManager }) {
    if (!cookie) throw new Error('FragmentApi 初始化失败：缺少 Cookie');
    if (!hash) throw new Error('FragmentApi 初始化失败：缺少 hash');

    this.hash = hash;
    this.pollHash = pollHash || hash;
    this.cookieManager = cookieManager;
    this.client = axios.create({
      baseURL,
      headers: {
        Cookie: cookie,
        'User-Agent': 'PremiumBot/1.0 (+https://fragment.com)',
        Accept: 'application/json, text/plain, */*',
      },
            timeout: 15_000,
            httpAgent,
            httpsAgent,
    });

    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401 || error.response?.status === 403) {
          if (this.cookieManager) {
            console.warn('检测到 Cookie 失效，尝试刷新...');
            const refreshed = await this.cookieManager.refreshCookie();
            if (refreshed) {
              const newCookie = this.cookieManager.getCookie();
              const newHash = this.cookieManager.getHash();
              if (newCookie && newHash) {
                this.hash = newHash;
                this.pollHash = newHash;
                this.client.defaults.headers.Cookie = newCookie;
                console.log('Cookie 已刷新，重试请求...');
                return this.client.request(error.config);
              }
            }
          }
        }
        return Promise.reject(error);
      },
    );
  }

  async searchPremiumGiftRecipient({ query, months }) {
    const { data } = await this.client.get('/searchPremiumGiftRecipient', {
      params: {
        hash: this.hash,
        query,
        months,
      },
    });

    if (!data?.recipient) {
      throw new Error('未在 Fragment 中找到指定的收礼用户');
    }

    return data.recipient;
  }

  async initGiftPremiumRequest({ recipient, months }) {
    const { data } = await this.client.post(
      '/initGiftPremiumRequest',
      { recipient, months },
      { params: { hash: this.hash } },
    );

    if (!data?.req_id) {
      throw new Error('创建礼物订单失败，缺少 req_id');
    }

    return {
      reqId: data.req_id,
      amount: Number(data.amount),
      raw: data,
    };
  }

  async getGiftPremiumLink({ reqId, showSender = true }) {
    const { data } = await this.client.get('/getGiftPremiumLink', {
      params: {
        hash: this.hash,
        id: reqId,
        show_sender: showSender ? 1 : 0,
      },
    });

    if (!data?.check_params?.id) {
      throw new Error('确认礼物订单失败，返回数据缺少 check_params.id');
    }

    return data;
  }

  async getTonkeeperRequest({ reqId }) {
    const { data } = await this.client.get('/tonkeeper/rawRequest', {
      params: {
        id: reqId,
        qr: 1,
      },
    });

    const message = data?.body?.messages?.[0];
    if (!message) {
      throw new Error('TON 支付信息缺失');
    }

    return {
      ...this.#parseTonkeeperMessage(message),
      raw: data,
    };
  }

  async checkRequest({ reqId }) {
    const { data } = await this.client.get('/checkReq', {
      params: {
        hash: this.pollHash,
        id: reqId,
      },
    });
    return data;
  }

  #parseTonkeeperMessage(message) {
    const amountNano = BigInt(message.amount);
    const amountTon = Number(amountNano) / 1_000_000_000;

    return {
      address: message.address,
      amountNano,
      amountTon,
      payload: message.payload,
    };
  }
}

