import ConfigForm from "@/components/config-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

async function getConfigs() {
  // Placeholder - will fetch from database
  return [
    { id: 1, config_key: "bot_token", config_value: "", description: "Telegram Bot Token" },
    { id: 2, config_key: "bot_username", config_value: "", description: "Telegram Bot Username" },
    { id: 3, config_key: "admin_telegram_id", config_value: "", description: "Admin Telegram ID" },
    { id: 4, config_key: "ton_wallet_address", config_value: "", description: "TON Wallet Address" },
    { id: 5, config_key: "ton_mnemonic", config_value: "", description: "TON Wallet Mnemonic (encrypted)" },
    { id: 6, config_key: "epusdt_api_key", config_value: "", description: "Epusdt API Key" },
    { id: 7, config_key: "epusdt_api_secret", config_value: "", description: "Epusdt API Secret (encrypted)" },
    { id: 8, config_key: "alipay_app_id", config_value: "", description: "Alipay App ID" },
    { id: 9, config_key: "alipay_private_key", config_value: "", description: "Alipay Private Key (encrypted)" },
    { id: 10, config_key: "server_url", config_value: "", description: "Server URL for webhook" },
    {
      id: 11,
      config_key: "welcome_message",
      config_value: "欢迎使用 Telegram Premium Bot！",
      description: "Welcome Message",
    },
  ]
}

export default async function ConfigPage() {
  const configs = await getConfigs()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">系统配置</h1>
        <p className="text-muted-foreground">管理机器人设置和支付集成</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>机器人设置</CardTitle>
            <CardDescription>配置您的 Telegram 机器人凭据</CardDescription>
          </CardHeader>
          <CardContent>
            <ConfigForm
              configs={configs.filter((c) =>
                ["bot_token", "bot_username", "admin_telegram_id", "server_url", "welcome_message"].includes(
                  c.config_key,
                ),
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>TON 支付</CardTitle>
            <CardDescription>配置 TON 加密货币支付</CardDescription>
          </CardHeader>
          <CardContent>
            <ConfigForm
              configs={configs.filter((c) => ["ton_wallet_address", "ton_mnemonic"].includes(c.config_key))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>USDT 支付 (Epusdt)</CardTitle>
            <CardDescription>配置 USDT 支付网关</CardDescription>
          </CardHeader>
          <CardContent>
            <ConfigForm
              configs={configs.filter((c) => ["epusdt_api_key", "epusdt_api_secret"].includes(c.config_key))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>支付宝支付</CardTitle>
            <CardDescription>配置支付宝支付集成</CardDescription>
          </CardHeader>
          <CardContent>
            <ConfigForm
              configs={configs.filter((c) => ["alipay_app_id", "alipay_private_key"].includes(c.config_key))}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
