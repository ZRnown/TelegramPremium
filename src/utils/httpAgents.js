import http from 'http';
import https from 'https';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { config } from '../config.js';

/**
 * 创建共享的 HTTP/HTTPS 代理 Agent
 * 优化：所有模块共享同一个 agent 实例，减少内存占用
 */
function createAgents() {
  if (config.proxy?.url) {
    return {
      httpAgent: new HttpProxyAgent(config.proxy.url),
      httpsAgent: new HttpsProxyAgent(config.proxy.url),
    };
  }
  return {
    httpAgent: new http.Agent({ 
      keepAlive: true, 
      maxSockets: 50,
      timeout: 30000,
    }),
    httpsAgent: new https.Agent({ 
      keepAlive: true, 
      maxSockets: 50,
      timeout: 30000,
    }),
  };
}

const { httpAgent, httpsAgent } = createAgents();

export { httpAgent, httpsAgent };

