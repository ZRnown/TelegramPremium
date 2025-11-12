import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions/index.js";

/**
 * Telegram 钱包支付服务（使用 iipay 钱包）
 * 通过 GramJS 调用 Telegram 钱包进行支付
 */
export class TelegramWalletService {
  constructor({ apiId, apiHash, sessionString }) {
    if (!apiId || !apiHash) {
      throw new Error('TelegramWalletService 初始化失败：缺少 API ID 或 Hash');
    }
    
    this.apiId = apiId;
    this.apiHash = apiHash;
    this.sessionString = sessionString || "";
    this.client = null;
    this.isConnected = false;
  }

  /**
   * 初始化并连接 Telegram 客户端
   */
  async connect() {
    if (this.isConnected && this.client) {
      return this.client;
    }

    try {
      const stringSession = new StringSession(this.sessionString);
      // 可选 SOCKS5 代理（GramJS 不支持 HTTP 代理）
      const socksHost = process.env.TELEGRAM_SOCKS5_HOST;
      const socksPort = process.env.TELEGRAM_SOCKS5_PORT;
      const socksUser = process.env.TELEGRAM_SOCKS5_USERNAME;
      const socksPass = process.env.TELEGRAM_SOCKS5_PASSWORD;

      /** @type {import('telegram').TelegramClientParams} */
      const clientOptions = {
        connectionRetries: 5,
      };

      if (socksHost && socksPort) {
        clientOptions.proxy = {
          ip: socksHost,
          port: Number(socksPort),
          socksType: 5,
          username: socksUser || undefined,
          password: socksPass || undefined,
          timeout: 30000,
        };
        console.log('🌐 Telegram SOCKS5 代理已启用', {
          host: socksHost,
          port: Number(socksPort),
          auth: Boolean(socksUser || socksPass),
        });
      } else {
        console.log('ℹ️ 未配置 TELEGRAM_SOCKS5_*，将直连 Telegram（可能在你的网络环境下不可达）');
      }

      this.client = new TelegramClient(stringSession, this.apiId, this.apiHash, clientOptions);

      await this.client.connect();

      // 授权校验：StringSession 必须是已登录的用户会话
      try {
        const me = await this.client.getMe();
        if (!me) throw new Error('Unauthorized');
        this.isConnected = true;
        console.log('✅ Telegram 钱包客户端已连接，已授权为：', { id: me?.id?.toString?.(), username: me?.username || null });
        return this.client;
      } catch (authErr) {
        console.error('❌ Telegram 钱包客户端未授权（AUTH_KEY_UNREGISTERED）。需要提供有效的 TELEGRAM_WALLET_SESSION。');
        console.error('💡 生成方法：使用 GramJS 登录一次生成 StringSession，然后填入 .env 的 TELEGRAM_WALLET_SESSION');
        throw authErr;
      }
    } catch (error) {
      console.error('❌ Telegram 钱包客户端连接失败:', error);
      if (!process.env.TELEGRAM_SOCKS5_HOST) {
        console.error('💡 建议：在 .env 中配置 SOCKS5 代理以连接 Telegram，例如:\nTELEGRAM_SOCKS5_HOST=127.0.0.1\nTELEGRAM_SOCKS5_PORT=1080');
      }
      throw error;
    }
  }

  /**
   * 断开连接
   */
  async disconnect() {
    if (this.client && this.isConnected) {
      await this.client.disconnect();
      this.isConnected = false;
      console.log('✅ Telegram 钱包客户端已断开连接');
    }
  }

  /**
   * 获取支付表单并找到 iipay 的 credentials ID
   * @param {Api.InputInvoiceSlug|Api.InputInvoiceMessage} invoice - 发票对象
   * @returns {Promise<string|null>} iipay 的 credentials ID，如果未找到则返回 null
   */
  async findIipayCredentialsId(invoice) {
    try {
      // 获取支付表单
      const paymentForm = await this.client.invoke(
        new Api.payments.GetPaymentForm({
          invoice: invoice,
        })
      );

      console.log('📋 支付表单信息:', {
        formId: paymentForm.formId?.toString(),
        savedCredentials: paymentForm.savedCredentials?.length || 0,
      });

      // 查找 iipay 的 credentials
      if (paymentForm.savedCredentials && paymentForm.savedCredentials.length > 0) {
        // 查找包含 "iipay" 或类型为 iipay 的 credentials
        for (const cred of paymentForm.savedCredentials) {
          if (cred instanceof Api.PaymentSavedCredentialsCard) {
            // 检查是否是 iipay（通常 title 包含 "iipay" 或类似标识）
            const title = cred.title || '';
            if (title.toLowerCase().includes('iipay') || title.toLowerCase().includes('telegram wallet')) {
              console.log('✅ 找到 iipay credentials:', cred.id.toString());
              return cred.id.toString();
            }
          }
        }

        // 如果没有找到明确的 iipay，尝试使用第一个保存的 credentials
        // 通常第一个就是默认的钱包
        const firstCred = paymentForm.savedCredentials[0];
        if (firstCred instanceof Api.PaymentSavedCredentialsCard) {
          console.log('⚠️ 未找到明确的 iipay，使用第一个保存的 credentials:', firstCred.id.toString());
          return firstCred.id.toString();
        }
      }

      console.warn('⚠️ 未找到保存的支付凭据，可能需要先设置 iipay 钱包');
      return null;
    } catch (error) {
      console.error('❌ 获取支付表单失败:', error);
      return null;
    }
  }

  /**
   * 支付 Premium 订单（方便调用的接口）
   * @param {Object} params - 支付参数
   * @param {string|BigInt} params.formId - 支付表单 ID（从 Fragment API 的 getGiftPremiumLink 获取）
   * @param {Object|string} params.invoice - 发票对象或 reqId（从 Fragment API 获取）
   * @param {string} params.comment - 支付备注（可选）
   * @returns {Promise<Object>} 支付结果
   */
  async payPremiumOrder({ formId, invoice, comment = "" }) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      // 确保 formId 是 BigInt
      const formIdBigInt = typeof formId === 'string' ? BigInt(formId) : formId;

      // 构建 invoice 对象
      let invoiceObj = invoice;
      
      // 如果 invoice 是字符串（reqId），转换为 InputInvoiceSlug
      if (typeof invoice === 'string') {
        invoiceObj = new Api.InputInvoiceSlug({
          slug: invoice,
        });
      } else if (invoice && typeof invoice === 'object' && !(invoice instanceof Api.InputInvoiceMessage) && !(invoice instanceof Api.InputInvoiceSlug)) {
        // 如果 invoice 是普通对象，尝试转换为 API 对象
        if (invoice.peer && invoice.msgId !== undefined) {
          invoiceObj = new Api.InputInvoiceMessage({
            peer: invoice.peer,
            msgId: invoice.msgId,
          });
        } else if (invoice.slug) {
          invoiceObj = new Api.InputInvoiceSlug({
            slug: invoice.slug,
          });
        } else {
          throw new Error('无法解析 invoice 参数，需要提供 slug 或 {peer, msgId}');
        }
      }

      // 获取 iipay 的 credentials ID
      const credentialsId = await this.findIipayCredentialsId(invoiceObj);
      
      if (!credentialsId) {
        throw new Error('未找到 iipay 支付凭据，请确保已在 Telegram 中设置并保存 iipay 钱包');
      }

      console.log('💰 使用 iipay 进行支付:', {
        formId: formIdBigInt.toString(),
        credentialsId,
        invoice: invoiceObj instanceof Api.InputInvoiceSlug ? invoiceObj.slug : 'message',
      });

      // 调用 Telegram 钱包支付 API
      const result = await this.client.invoke(
        new Api.payments.SendPaymentForm({
          formId: formIdBigInt,
          invoice: invoiceObj,
          requestedInfoId: undefined,
          shippingOptionId: undefined,
          credentials: new Api.InputPaymentCredentialsSaved({
            id: credentialsId,
            tmpPassword: undefined,
          }),
          tipAmount: BigInt(0),
        })
      );

      console.log('✅ iipay 支付成功:', {
        result: result.constructor.name,
        updates: result.updates?.length || 0,
      });

      return {
        success: true,
        result,
      };
    } catch (error) {
      console.error('❌ iipay 钱包支付失败:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // 提供更详细的错误信息
      if (errorMessage.includes('PAYMENT_PROVIDER_INVALID') || errorMessage.includes('credentials')) {
        return {
          success: false,
          error: `支付凭据无效：${errorMessage}。请确保已在 Telegram 中设置并保存 iipay 钱包。`,
        };
      }
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * 使用 iipay 钱包支付（通用接口）
   * @param {Object} params - 支付参数
   * @param {string|BigInt} params.formId - 支付表单 ID
   * @param {Object} params.invoice - 发票对象
   * @param {string} params.comment - 支付备注（可选）
   * @returns {Promise<Object>} 支付结果
   */
  async payWithIipay({ formId, invoice, comment = "" }) {
    return this.payPremiumOrder({ formId, invoice, comment });
  }

  /**
   * 发送支付请求（简化接口，兼容旧代码）
   * @param {Object} params - 支付参数
   * @param {string} params.recipient - 接收方（已废弃，使用 invoice）
   * @param {number} params.amount - 金额（已废弃，使用 invoice）
   * @param {string} params.comment - 备注
   * @param {string|BigInt} params.formId - 支付表单 ID（必需）
   * @param {Object} params.invoice - 发票对象（必需）
   * @returns {Promise<Object>} 支付结果
   */
  async sendPayment({ formId, invoice, comment = "", recipient, amount }) {
    if (!formId || !invoice) {
      return {
        success: false,
        error: '缺少 formId 或 invoice 参数',
      };
    }
    return this.payPremiumOrder({ formId, invoice, comment });
  }

  /**
   * 获取钱包余额（通过 Telegram 钱包 API）
   * @returns {Promise<{balance: number, currency: string}|null>} 余额信息，如果获取失败则返回 null
   */
  async getBalance() {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      // 尝试获取钱包信息
      // 注意：Telegram API 可能不直接提供余额查询，这里返回 null 表示不支持
      // 实际余额需要通过其他方式获取（如 TON 区块链查询）
      console.log('⚠️ Telegram 钱包 API 不直接支持余额查询，请使用 TON 区块链查询');
      return null;
    } catch (error) {
      console.error('❌ 获取钱包余额失败:', error);
      return null;
    }
  }

  async requestUserPayment({ userId, username, amount }) {
    if (!this.client || !this.isConnected) {
      await this.connect();
    }
    if (!amount || Number(amount) <= 0) {
      throw new Error('requestUserPayment: 金额无效');
    }
    const peer = username && username.trim().length > 0
      ? (username.startsWith('@') ? username : `@${username}`)
      : String(userId);
    const rounded = Number(amount).toFixed(2).replace(/\.00$/, '');
    const query = `-${rounded}`;
    console.log('💬 [Wallet] 通过 Inline 模式发起收款请求', { peer, query });

    try {
      // 解析对话与机器人实体
      const peerEntity = await this.client.getInputEntity(peer);
      const botEntity = await this.client.getInputEntity('iipay');

      // 第一步：获取 inline 结果
      const botResults = await this.client.invoke(
        new Api.messages.GetInlineBotResults({
          bot: botEntity,
          peer: peerEntity,
          query,
          offset: '',
        })
      );

      const results = botResults?.results || [];
      if (!results.length) {
        console.warn('⚠️ [Wallet] 未获取到 @iipay 的 Inline 结果，将回退为直接发送文本提示');
        const fallback = await this.client.sendMessage(peer, { message: `@iipay ${query}` });
        return { success: true, mode: 'fallback_text', result: fallback };
      }

      // 查找“USDT”选项（优先匹配标题/描述，退化到 sendMessage 文案）
      const pickUSDT = (item) => {
        const title = (item.title || '').toUpperCase();
        const desc = (item.description || '').toUpperCase();
        const msg = (item.sendMessage?.message || '').toUpperCase();
        return title.includes('USDT') || desc.includes('USDT') || msg.includes('USDT');
      };
      const target = results.find(pickUSDT) || results[0];
      if (!target?.id) {
        console.warn('⚠️ [Wallet] 未找到可用 Inline 结果，将回退为直接发送文本提示');
        const fallback = await this.client.sendMessage(peer, { message: `@iipay ${query}` });
        return { success: true, mode: 'fallback_text', result: fallback };
      }

      // 第二步：发送所选 Inline 结果到目标对话（相当于点击“收款 USDT”）
      const randomId = BigInt(Math.floor(Math.random() * 2 ** 53));
      const sent = await this.client.invoke(
        new Api.messages.SendInlineBotResult({
          peer: peerEntity,
          queryId: botResults.queryId,
          id: target.id,
          randomId,
        })
      );

      console.log('✅ [Wallet] 已选择并发送 Inline 结果（收款 USDT）', {
        chosenId: target.id,
        updates: sent?.updates?.length || 0,
      });
      return { success: true, mode: 'inline', result: sent };
    } catch (err) {
      console.error('❌ [Wallet] Inline 收款流程失败，将回退为直接发送文本提示:', err?.message || err);
      const fallback = await this.client.sendMessage(peer, { message: `@iipay ${query}` });
      return { success: true, mode: 'fallback_text', result: fallback };
    }
  }

  /**
   * 检查客户端连接状态
   * @returns {boolean} 是否已连接
   */
  isClientConnected() {
    return this.isConnected && this.client !== null;
  }

  /**
   * 获取客户端实例（用于高级操作）
   * @returns {TelegramClient|null} 客户端实例
   */
  getClient() {
    return this.client;
  }
}


