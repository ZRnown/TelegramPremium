import axios from 'axios';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { WalletContractV5R1 } from '@ton/ton';
import { beginCell, storeStateInit } from '@ton/core';

const DEFAULT_DEVICE_JSON =
  '{"platform":"mac","appName":"tonkeeper","appVersion":"4.3.2","maxProtocolVersion":2,"features":["SendTransaction",{"name":"SendTransaction","maxMessages":255,"extraCurrencySupported":true},{"name":"SignData","types":["text","binary","cell"]}]}';
const TRANSACTION_VALUE = '1';

function assertString(value, message) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(message);
  }
}

export class FragmentApi {
  constructor({ baseURL, cookie, hash, pollHash, walletDevice, mnemonic }) {
    assertString(baseURL, 'Fragment baseURL 不能为空');
    assertString(cookie, 'Fragment Cookie 不能为空');
    assertString(hash, 'Fragment hash 不能为空');

    this.baseURL = baseURL.replace(/\/$/, '');
    this.cookie = cookie;
    this.hash = hash;
    this.pollHash = pollHash || hash;
    this.walletDevice = walletDevice || DEFAULT_DEVICE_JSON;
    this.mnemonic = mnemonic;

    this.accountPayloadCache = null;
    this.accountPayloadPromise = null;

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        Cookie: this.cookie,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
      },
      timeout: 30_000,
    });
  }

  async request({ method, params = {}, usePollHash = false }) {
    assertString(method, 'Fragment API method 不能为空');

    const redact = (obj) => {
      try {
        const o = { ...obj };
        if (o.account) o.account = '[redacted]';
        if (o.device) o.device = '[device]';
        return o;
      } catch {
        return {};
      }
    };

    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        searchParams.set(key, String(value));
      }
    }
    searchParams.set('method', method);

    const hashParam = usePollHash ? this.pollHash : this.hash;
    const url = `/api?hash=${encodeURIComponent(hashParam)}`;

    const started = Date.now();
    try {
      console.log(
        `[FragmentAPI] -> ${method} ${url} params=${JSON.stringify(redact(params))}`,
      );
      const response = await this.client.post(url, searchParams.toString());
      const ms = Date.now() - started;
      const preview =
        response?.data && typeof response.data === 'object'
          ? JSON.stringify({ ok: response.data.ok, has_link: Boolean(response.data.link), keys: Object.keys(response.data).slice(0, 6) })
          : String(response?.data ?? '');
      console.log(
        `[FragmentAPI] <- ${method} status=${response.status} time=${ms}ms data=${preview}`,
      );
      return response.data;
    } catch (error) {
      const ms = Date.now() - started;
      const status = error.response?.status;
      const data = error.response?.data;
      const details = data && typeof data === 'object' ? JSON.stringify(data) : String(data ?? '');
      console.error(
        `[FragmentAPI] xx ${method} time=${ms}ms status=${status ?? 'n/a'} error=${error.message} resp=${details}`,
      );
      throw new Error(
        `Fragment API 请求失败 (${method})${status ? ` [HTTP ${status}]` : ''}: ${error.message}${details ? ` | 响应: ${details}` : ''}`,
      );
    }
  }

  async searchPremiumGiftRecipient({ query, months }) {
    assertString(query, '查询用户名不能为空');
    const payload = {
      query: query.trim(),
    };
    if (months) {
      payload.months = String(months);
    }

    const result = await this.request({
      method: 'searchPremiumGiftRecipient',
      params: payload,
    });

    if (!result?.ok) {
      throw new Error(
        `searchPremiumGiftRecipient 调用失败：${result?.error ?? '未知错误'}`,
      );
    }

    return result.found ?? result;
  }

  async initGiftPremiumRequest({ recipient, months }) {
    assertString(recipient, 'recipient 参数不能为空');
    const result = await this.request({
      method: 'initGiftPremiumRequest',
      params: {
        recipient: recipient.trim(),
        months: months ? String(months) : undefined,
      },
    });

    const reqId = result?.req_id;
    if (typeof reqId !== 'string' || reqId.trim().length === 0) {
      throw new Error(
        `initGiftPremiumRequest 调用失败：未返回有效的 req_id（响应: ${JSON.stringify(result)})`,
      );
    }

    return {
      reqId: reqId.trim(),
      amount: result?.amount ?? null,
      raw: result,
    };
  }

  async getGiftPremiumLink({ reqId, showSender = 1 }) {
    assertString(reqId, 'reqId 参数不能为空');

    const accountPayload = await this.buildAccountPayload();

    const result = await this.request({
      method: 'getGiftPremiumLink',
      params: {
        id: reqId.trim(),
        show_sender: String(showSender),
        transaction: TRANSACTION_VALUE,
        account: accountPayload,
        device: this.walletDevice,
      },
    });

    if (!result?.ok) {
      throw new Error(
        `getGiftPremiumLink 调用失败：${result?.error ?? '未知错误'}（reqId=${reqId})`,
      );
    }

    return result;
  }

  async checkRequest({ reqId }) {
    assertString(reqId, 'reqId 参数不能为空');

    return this.request({
      method: 'checkReq',
      params: { id: reqId.trim() },
      usePollHash: true,
    });
  }

  async buildAccountPayload() {
    if (this.accountPayloadCache) {
      return this.accountPayloadCache;
    }

    if (!this.mnemonic) {
      throw new Error('缺少 TON 助记词，无法生成 Fragment account 参数');
    }

    if (!this.accountPayloadPromise) {
      this.accountPayloadPromise = (async () => {
        const cleanedMnemonic = this.mnemonic
          .replace(/\r?\n/g, ' ')
          .replace(/\r/g, ' ')
          .split(' ')
          .map((word) => word.trim())
          .filter((word) => word.length > 0);

        if (cleanedMnemonic.length !== 12 && cleanedMnemonic.length !== 24) {
          throw new Error(
            `助记词格式错误：应为 12 或 24 个单词，当前解析到 ${cleanedMnemonic.length} 个`,
          );
        }

        const keyPair = await mnemonicToPrivateKey(cleanedMnemonic);
        const wallet = WalletContractV5R1.create({ publicKey: keyPair.publicKey });
        const stateInitCell = beginCell().store(storeStateInit(wallet.init)).endCell();

        const account = {
          address: wallet.address.toRawString(),
          chain: '-239',
          walletStateInit: stateInitCell.toBoc().toString('base64'),
          publicKey: Buffer.from(keyPair.publicKey).toString('hex'),
        };

        console.log('🆕 Fragment account payload (v5r1):', account);

        const payloadString = JSON.stringify(account);
        this.accountPayloadCache = payloadString;
        return payloadString;
      })();
    }

    try {
      return await this.accountPayloadPromise;
    } finally {
      this.accountPayloadPromise = null;
    }
  }
}
