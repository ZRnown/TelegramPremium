import { launchBot, stopBot } from './bot.js';
import { launchCallbackServer } from './callbackServer.js';

const server = launchCallbackServer();

await launchBot();

process.once('SIGINT', () => {
  stopBot();
  if (server) {
    server.close();
  }
});

process.once('SIGTERM', () => {
  stopBot();
  if (server) {
    server.close();
  }
});

