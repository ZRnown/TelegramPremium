import { mnemonicToPrivateKey } from '@ton/crypto';
import { TonClient, WalletContractV4, internal, SendMode } from '@ton/ton';
import { Address, Cell, beginCell } from '@ton/core';

/**
 * TON 自动支付工具，封装钱包初始化与转账逻辑。
 */
export class TonPaymentService {
  constructor({ endpoint, apiKey, mnemonic }) {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
    this.mnemonic = mnemonic;
    this.client = null;
    this.walletContext = null;
  }

  get isReady() {
    return Boolean(this.mnemonic && this.endpoint);
  }

  async #createWallet() {
    if (!this.isReady) {
      throw new Error('TON 自动支付未启用，缺少节点地址或助记词。');
    }

    if (!this.walletContext) {
      const words = this.mnemonic.trim().split(/\s+/);
      const keyPair = await mnemonicToPrivateKey(words);
      const wallet = WalletContractV4.create({
        workchain: 0,
        publicKey: keyPair.publicKey,
      });

      this.walletContext = { wallet, keyPair };
    }

    return this.walletContext;
  }

  #getClient() {
    if (!this.isReady) {
      throw new Error('TON 自动支付未启用，缺少节点地址或助记词。');
    }

    if (!this.client) {
      this.client = new TonClient({
        endpoint: this.endpoint,
        apiKey: this.apiKey,
      });
    }

    return this.client;
  }

  async sendTransfer({ toAddress, amountNano, payload }) {
    const { wallet, keyPair } = await this.#createWallet();
    const client = this.#getClient();

    const openedWallet = client.open(wallet);
    const seqno = await openedWallet.getSeqno();

    const body = parsePayload(payload);

    await openedWallet.sendTransfer({
      seqno,
      secretKey: keyPair.secretKey,
      messages: [
        internal({
          to: Address.parse(toAddress),
          value: BigInt(amountNano),
          bounce: false,
          body,
        }),
      ],
      sendMode: SendMode.PAY_GAS_SEPARATELY,
    });

    return { seqno };
  }
}

function parsePayload(payload) {
  if (!payload) return undefined;

  // Fragment 返回的常见格式：BOC Base64 (以 te6 开头)、HEX、或者普通字符串。
  const trimmed = payload.trim();

  if (/^[A-Za-z0-9+/=]+$/.test(trimmed) && trimmed.startsWith('te6')) {
    const cell = Cell.fromBoc(Buffer.from(trimmed, 'base64'))[0];
    return cell;
  }

  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0) {
    const buff = Buffer.from(trimmed, 'hex');
    return beginCell().storeBuffer(buff).endCell();
  }

  return beginCell().storeBuffer(Buffer.from(trimmed, 'utf8')).endCell();
}

