import { mnemonicToPrivateKey } from '@ton/crypto';
import { TonClient, WalletContractV4, internal, SendMode } from '@ton/ton';
import { Address, Cell, beginCell } from '@ton/core';

/**
 * TON 自动支付工具
 * 
 * 支付流程（根据 @gd801 提供的信息）：
 * 1. 从 getGiftPremiumLink 获取 address, payload, amount
 * 2. 使用 TON SDK 发送交易（类似波场 API）
 * 3. 使用 checkReq 检查支付状态
 * 
 * TON 支付链接格式：
 * ton://transfer/{address}?bin={payload}&amount={amount_nano}
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
      try {
        console.log('[TON] Wallet created', {
          address: wallet.address.toString(),
          workchain: 0,
          version: 'v4',
        });
      } catch {}
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
      console.log('[TON] TonClient initialized', {
        endpoint: this.endpoint,
        apiKeyPresent: Boolean(this.apiKey),
      });
    }

    return this.client;
  }

  /**
   * 发送 TON 转账（用于 Fragment Premium 支付）
   * 
   * 根据 @gd801 提供的方法：
   * - 使用助记词（= 私钥）进行自动支付
   * - 类似波场 API 的实现方式
   * - 必须包含 payload（bin 参数），否则 Fragment 无法识别支付
   * 
   * @param {string} toAddress - 收款地址（从 getGiftPremiumLink 获取）
   * @param {string|bigint} amountNano - 金额（nano TON，从 getGiftPremiumLink 获取）
   * @param {string} payload - Base64 编码的 payload（从 getGiftPremiumLink 获取，作为 bin 参数）
   */
  async sendTransfer({ toAddress, amountNano, payload }) {
    console.log('💰 开始 TON 自动支付（类似波场 API）');
    console.log('   收款地址:', toAddress);
    console.log('   金额:', typeof amountNano === 'bigint' ? amountNano.toString() : amountNano, 'nano TON');
    console.log('   Payload (bin):', payload.substring(0, 30) + '...');
    const { wallet, keyPair } = await this.#createWallet();
    const client = this.#getClient();

    const openedWallet = client.open(wallet);
    const seqno = await openedWallet.getSeqno();
    if (seqno === 0) {
      console.warn('[TON] 钱包 seqno 为 0：看起来钱包尚未在链上部署（首次使用）。如报错 Failed to unpack account state，请先部署钱包或在首次交易包含 StateInit。');
    }

    // 解析 payload（Base64 BOC 格式，作为 bin 参数）
    // Fragment 返回的 payload 格式：te6ccgEBAgEANgABTg... (以 te6 开头)
    const body = parsePayload(payload);
    
    if (!body) {
      throw new Error('Payload 解析失败，无法发送支付');
    }

    console.log('✅ Payload 解析成功，准备发送交易...');
    console.log('   当前 Seqno:', seqno);
    console.log('   钱包地址:', wallet.address.toString());

    // 发送交易（必须包含 payload，否则 Fragment 无法识别）
    try {
      await openedWallet.sendTransfer({
        seqno,
        secretKey: keyPair.secretKey,
        messages: [
          internal({
            to: Address.parse(toAddress),
            value: BigInt(amountNano),
            bounce: false,
            body, // 必须包含 payload（bin），Fragment 通过此识别订单
          }),
        ],
        sendMode: SendMode.PAY_GAS_SEPARATELY,
      });
    } catch (err) {
      const serverMsg = err?.response?.data || err?.response || err?.message;
      console.error('[TON] 发送交易失败', {
        endpoint: this.endpoint,
        status: err?.response?.status,
        error: err?.message,
        server: serverMsg,
      });
      // 识别常见错误并输出可读原因
      const text = typeof serverMsg === 'string' ? serverMsg : JSON.stringify(serverMsg);
      if (text?.includes('Failed to unpack account state') || text?.includes('cannot apply external message')) {
        console.error('[TON] 可能原因：钱包未部署（seqno=0）或消息缺少 StateInit。请先向钱包地址转入少量 TON 并进行首次部署，或在第一次交易时包含 StateInit。');
      }
      throw err;
    }

    console.log('✅ 交易已发送，Seqno:', seqno);
    console.log('⏳ 等待链上确认，然后使用 checkReq 检查支付状态...');

    return { seqno };
  }
}

/**
 * 解析 payload
 * Fragment 返回的 payload 是 Base64 编码的 BOC (Bag of Cells) 格式
 * 格式：te6ccgEBAgEANgABTg... (以 te6 开头)
 */
function parsePayload(payload) {
  if (!payload) return undefined;

  const trimmed = payload.trim();

  // Fragment 返回的 payload 格式：BOC Base64 (以 te6 开头)
  if (/^[A-Za-z0-9+/=]+$/.test(trimmed) && trimmed.startsWith('te6')) {
    try {
      const cell = Cell.fromBoc(Buffer.from(trimmed, 'base64'))[0];
      console.log('✅ Payload 解析成功（BOC 格式）');
      return cell;
    } catch (error) {
      console.error('❌ Payload 解析失败:', error.message);
      throw new Error(`Payload 解析失败: ${error.message}`);
    }
  }

  // HEX 格式（备用）
  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0) {
    const buff = Buffer.from(trimmed, 'hex');
    return beginCell().storeBuffer(buff).endCell();
  }

  // 普通字符串（备用）
  return beginCell().storeBuffer(Buffer.from(trimmed, 'utf8')).endCell();
}

