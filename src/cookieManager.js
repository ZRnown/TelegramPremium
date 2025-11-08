import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { httpAgent, httpsAgent } from './utils/httpAgents.js';
import { config } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const COOKIE_FILE = path.join(__dirname, '../.cookie.json');

class CookieManager {
  constructor() {
    this.cookie = null;
    this.hash = null;
    this.lastUpdated = null;
    this.expiresAt = null;
  }

  async load() {
    try {
      const data = await fs.readFile(COOKIE_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      this.cookie = parsed.cookie;
      this.hash = parsed.hash;
      this.lastUpdated = parsed.lastUpdated || Date.now();
      this.expiresAt = parsed.expiresAt || this.lastUpdated + 30 * 24 * 60 * 60 * 1000;

      if (this.isExpired()) {
        console.warn('Cookie 已过期，需要更新');
        return false;
      }

      console.log('Cookie 已从文件加载');
      return true;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('加载 Cookie 文件失败：', error);
      }
      return false;
    }
  }

  async save() {
    try {
      const data = {
        cookie: this.cookie,
        hash: this.hash,
        lastUpdated: this.lastUpdated || Date.now(),
        expiresAt: this.expiresAt || Date.now() + 30 * 24 * 60 * 60 * 1000,
      };
      await fs.writeFile(COOKIE_FILE, JSON.stringify(data, null, 2), 'utf-8');
      console.log('Cookie 已保存到文件');
    } catch (error) {
      console.error('保存 Cookie 文件失败：', error);
    }
  }

  setCookie(cookie, hash) {
    this.cookie = cookie;
    this.hash = hash;
    this.lastUpdated = Date.now();
    this.expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    this.save();
  }

  getCookie() {
    return this.cookie;
  }

  getHash() {
    return this.hash;
  }

  isExpired() {
    if (!this.expiresAt) return true;
    const now = Date.now();
    const bufferTime = 7 * 24 * 60 * 60 * 1000;
    return now >= this.expiresAt - bufferTime;
  }

  async validateCookie() {
    if (!this.cookie) return false;

    try {
      const response = await axios.get('https://fragment.com/api/searchPremiumGiftRecipient', {
        params: { hash: this.hash, query: 'test', months: 1 },
        headers: {
          Cookie: this.cookie,
          'User-Agent': 'PremiumBot/1.0 (+https://fragment.com)',
        },
        timeout: 10_000,
        httpAgent,
        httpsAgent,
        validateStatus: () => true,
      });

      if (response.status === 200 || response.status === 400) {
        return true;
      }

      if (response.status === 401 || response.status === 403) {
        console.warn('Cookie 验证失败，可能已过期');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Cookie 验证请求失败：', error.message);
      return false;
    }
  }

  async refreshCookie() {
    console.log('尝试刷新 Cookie...');
    const manualCookie = process.env.FRAGMENT_COOKIE;
    const manualHash = process.env.FRAGMENT_HASH;

    if (manualCookie && manualHash) {
      console.log('使用环境变量中的 Cookie');
      this.setCookie(manualCookie, manualHash);
      const isValid = await this.validateCookie();
      if (isValid) {
        return true;
      }
      console.warn('环境变量中的 Cookie 验证失败');
    }

    if (this.cookie && this.hash) {
      const isValid = await this.validateCookie();
      if (isValid) {
        this.lastUpdated = Date.now();
        this.expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
        await this.save();
        return true;
      }
    }

    console.warn('无法自动刷新 Cookie，请手动设置 FRAGMENT_COOKIE 和 FRAGMENT_HASH');
    return false;
  }

  async autoFetchCookie() {
    try {
      const response = await axios.get('https://fragment.com/', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        timeout: 15_000,
        httpAgent,
        httpsAgent,
        maxRedirects: 5,
        validateStatus: () => true,
      });

      const html = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      
      const hashPatterns = [
        /hash["\s:=]+([a-f0-9]{20,})/i,
        /"hash"\s*:\s*"([a-f0-9]{20,})"/i,
        /hash=([a-f0-9]{20,})/i,
      ];
      
      let hash = null;
      for (const pattern of hashPatterns) {
        const match = html.match(pattern);
        if (match) {
          hash = match[1];
          break;
        }
      }

      if (!hash) {
        return {
          success: false,
          error: '无法从 Fragment 网站提取 hash。\n\n请手动获取：\n1. 访问 https://fragment.com\n2. 打开浏览器开发者工具 (F12)\n3. 在 Console 中输入：window.__INITIAL_STATE__ 查看 hash\n4. 或从网络请求中查找 hash 参数',
        };
      }

      const allCookies = response.headers['set-cookie'] || [];
      const cookieMap = {};
      
      allCookies.forEach((cookieStr) => {
        const parts = cookieStr.split(';')[0].split('=');
        if (parts.length >= 2) {
          cookieMap[parts[0].trim()] = parts.slice(1).join('=');
        }
      });

      const stelKeys = ['stel_ssid', 'stel_dt', 'stel_token'];
      const stelCookies = stelKeys
        .map((key) => (cookieMap[key] ? `${key}=${cookieMap[key]}` : null))
        .filter(Boolean);

      if (stelCookies.length === 0) {
        const manualCookie = process.env.FRAGMENT_COOKIE;
        if (manualCookie) {
          this.setCookie(manualCookie, hash);
          const isValid = await this.validateCookie();
          if (isValid) {
            return {
              success: true,
              cookie: manualCookie,
              hash,
            };
          }
        }
        
        return {
          success: false,
          error: '无法自动获取 Telegram session cookie。\n\n请按以下步骤操作：\n1. 在浏览器中访问 https://web.telegram.org 并登录\n2. 打开开发者工具 (F12) > Application > Cookies\n3. 复制 stel_ssid, stel_dt, stel_token 的值\n4. 格式：stel_ssid=xxx; stel_dt=xxx; stel_token=xxx\n5. 设置为环境变量 FRAGMENT_COOKIE',
        };
      }

      const cookie = stelCookies.join('; ');
      this.setCookie(cookie, hash);

      const isValid = await this.validateCookie();
      if (!isValid) {
        return {
          success: false,
          error: '获取的 Cookie 验证失败。\n\n可能原因：\n1. Cookie 已过期\n2. 需要先登录 Telegram Web (https://web.telegram.org)\n3. 网络或代理问题\n\n请手动设置 FRAGMENT_COOKIE 环境变量',
        };
      }

      return {
        success: true,
        cookie,
        hash,
      };
    } catch (error) {
      console.error('自动获取 Cookie 失败：', error);
      return {
        success: false,
        error: `网络请求失败：${error.message}\n\n请检查：\n1. 网络连接是否正常\n2. 代理设置是否正确 (HTTP_PROXY)\n3. 或手动设置 FRAGMENT_COOKIE 和 FRAGMENT_HASH`,
      };
    }
  }

  async ensureValid() {
    if (!this.cookie || !this.hash) {
      const loaded = await this.load();
      if (!loaded) {
        const refreshed = await this.refreshCookie();
        if (!refreshed) {
          if (!this.cookie) {
            const autoResult = await this.autoFetchCookie();
            if (autoResult.success) {
              return true;
            }
          }
          return false;
        }
      }
    }

    if (this.isExpired()) {
      console.log('Cookie 即将过期，尝试刷新...');
      const refreshed = await this.refreshCookie();
      if (!refreshed) {
        const autoResult = await this.autoFetchCookie();
        if (autoResult.success) {
          return true;
        }
        if (!this.cookie) {
          return false;
        }
      }
    }

    const isValid = await this.validateCookie();
    if (!isValid) {
      console.log('Cookie 验证失败，尝试刷新...');
      const refreshed = await this.refreshCookie();
      if (!refreshed) {
        const autoResult = await this.autoFetchCookie();
        if (autoResult.success) {
          return true;
        }
        if (!this.cookie) {
          return false;
        }
        console.warn('Cookie 验证失败，但将继续使用现有 Cookie');
      }
    }

    return true;
  }
}

export const cookieManager = new CookieManager();

if (config.fragment.autoRefresh) {
  setInterval(async () => {
    try {
      if (cookieManager.isExpired()) {
        console.log('定期检查：Cookie 即将过期，尝试刷新...');
        await cookieManager.refreshCookie();
      } else {
        const isValid = await cookieManager.validateCookie();
        if (!isValid) {
          console.log('定期检查：Cookie 验证失败，尝试刷新...');
          await cookieManager.refreshCookie();
        }
      }
    } catch (error) {
      console.error('定期 Cookie 检查失败：', error.message);
    }
  }, 60 * 60 * 1000).unref();
}

