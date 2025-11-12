import ConfigForm from "@/components/config-form"
import ConfigHelpDialog from "@/components/config-help-dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

async function getConfigs() {
  try {
    const { prisma } = await import('@/lib/prisma')
    const configs = await prisma.config.findMany({
      orderBy: { key: 'asc' }
    })
    
    // 定义所有可配置项
    const configDefinitions = [
      { key: "bot_token", description: "Telegram 机器人 Token" },
      { key: "fragment_hash", description: "Fragment Hash" },
      { key: "fragment_poll_hash", description: "Fragment Poll Hash（可选）" },
      { key: "fragment_base_url", description: "Fragment API 基础 URL（默认：https://fragment.com/api）" },
      { key: "ton_mnemonic", description: "TON 钱包助记词（加密存储）" },
      { key: "server_url", description: "服务器 URL（用于回调）" },
      { key: "customer_service", description: "客服联系方式（支持多行文本，支持 Markdown）" },
    ]
    
    // 合并数据库中的配置和定义
    const configMap = new Map(configs.map(c => [c.key, c]))
    
    return configDefinitions.map((def, index) => {
      const existing = configMap.get(def.key)
      return {
        id: existing?.id || `temp_${index}`,
        config_key: def.key,
        config_value: existing?.value || "",
        description: def.description,
      }
    })
  } catch (error) {
    console.error('获取配置失败:', error)
    // 返回默认配置列表
    const configDefinitions = [
      { key: "bot_token", description: "Telegram 机器人 Token" },
      { key: "fragment_hash", description: "Fragment Hash" },
      { key: "ton_mnemonic", description: "TON 钱包助记词（加密存储）" },
      { key: "server_url", description: "服务器 URL（用于回调）" },
    ]
    return configDefinitions.map((def, index) => ({
      id: index + 1,
      config_key: def.key,
      config_value: "",
      description: def.description,
    }))
  }
}

export default async function ConfigPage() {
  const configs = await getConfigs()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">系统配置</h1>
          <p className="text-muted-foreground">管理机器人设置和支付集成</p>
        </div>
        <ConfigHelpDialog />
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
                ["bot_token", "server_url"].includes(
                  c.config_key,
                ),
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fragment API 设置</CardTitle>
            <CardDescription>配置 Fragment API（Cookie 会自动获取）</CardDescription>
          </CardHeader>
          <CardContent>
            <ConfigForm
              configs={configs.filter((c) => 
                ["fragment_hash", "fragment_poll_hash", "fragment_base_url"].includes(c.config_key)
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
              configs={configs.filter((c) => 
                ["ton_mnemonic"].includes(c.config_key)
              )}
            />
          </CardContent>
        </Card>

        

        <Card>
          <CardHeader>
            <CardTitle>客服设置</CardTitle>
            <CardDescription>配置客服联系方式，用户点击"联系客服"时会显示此信息</CardDescription>
          </CardHeader>
          <CardContent>
            <ConfigForm
              configs={configs.filter((c) => 
                ["customer_service"].includes(c.config_key)
              )}
            />
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
