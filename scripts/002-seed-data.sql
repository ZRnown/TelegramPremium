-- Insert default configurations
INSERT OR IGNORE INTO configs (config_key, config_value, config_type, description) VALUES
  ('bot_token', '', 'string', 'Telegram Bot Token'),
  ('bot_username', '', 'string', 'Telegram Bot Username'),
  ('admin_telegram_id', '', 'string', 'Admin Telegram ID'),
  ('ton_wallet_address', '', 'string', 'TON Wallet Address'),
  ('ton_mnemonic', '', 'string', 'TON Wallet Mnemonic (encrypted)'),
  ('epusdt_api_key', '', 'string', 'Epusdt API Key'),
  ('epusdt_api_secret', '', 'string', 'Epusdt API Secret (encrypted)'),
  ('alipay_app_id', '', 'string', 'Alipay App ID'),
  ('alipay_private_key', '', 'string', 'Alipay Private Key (encrypted)'),
  ('server_url', '', 'string', 'Server URL for webhook'),
  ('welcome_message', '欢迎使用 Telegram Premium Bot！', 'string', 'Welcome Message');

-- Insert default pricing plans
INSERT OR IGNORE INTO prices (plan_type, duration_days, price, currency) VALUES
  ('basic', 30, 9.99, 'USD'),
  ('basic', 90, 24.99, 'USD'),
  ('basic', 180, 44.99, 'USD'),
  ('basic', 365, 79.99, 'USD'),
  ('premium', 30, 19.99, 'USD'),
  ('premium', 90, 49.99, 'USD'),
  ('premium', 180, 89.99, 'USD'),
  ('premium', 365, 149.99, 'USD');
