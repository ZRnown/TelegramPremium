import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { InfoIcon } from "lucide-react"

export default function ConfigHelpPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">配置说明</h1>
        <p className="text-muted-foreground">详细说明如何配置机器人的各项参数</p>
      </div>

      <Alert>
        <InfoIcon className="h-4 w-4" />
        <AlertTitle>重要提示</AlertTitle>
        <AlertDescription>
          所有敏感信息（如助记词、私钥）都会加密存储，请妥善保管。配置完成后，请重启机器人以使配置生效。
        </AlertDescription>
      </Alert>

      {/* 机器人设置 */}
      <Card>
        <CardHeader>
          <CardTitle>机器人设置</CardTitle>
          <CardDescription>Telegram 机器人基础配置</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Telegram 机器人 Token</h3>
            <p className="text-sm text-muted-foreground mb-2">
              从 <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-primary underline">@BotFather</a> 获取您的机器人 Token。
            </p>
            <p className="text-sm text-muted-foreground">
              步骤：1. 在 Telegram 中搜索 @BotFather 2. 发送 /newbot 创建新机器人 3. 按提示设置机器人名称和用户名 4. 复制返回的 Token
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Telegram 机器人用户名</h3>
            <p className="text-sm text-muted-foreground">
              机器人的用户名（不包含 @ 符号），例如：my_premium_bot
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">服务器 URL（用于回调）</h3>
            <p className="text-sm text-muted-foreground">
              您的服务器公网地址，用于接收支付回调。格式：https://yourdomain.com 或 http://your-ip:port
            </p>
          </div>
        </CardContent>
      </Card>

      {/* TON 支付 */}
      <Card>
        <CardHeader>
          <CardTitle>TON 支付配置</CardTitle>
          <CardDescription>配置 TON 区块链自动支付</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">TON 钱包地址</h3>
            <p className="text-sm text-muted-foreground">
              用于接收 TON 支付的钱包地址。格式：EQxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">TON 钱包助记词</h3>
            <p className="text-sm text-muted-foreground mb-2">
              用于自动发送 TON 支付的助记词（24 个单词，用空格分隔）。
            </p>
            <p className="text-sm text-muted-foreground">
              <strong className="text-destructive">⚠️ 安全警告：</strong>助记词具有完全控制钱包的权限，请妥善保管，不要泄露给任何人。
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">TON API 端点（可选）</h3>
            <p className="text-sm text-muted-foreground">
              默认使用：https://toncenter.com/api/v2/jsonRPC。如需使用其他节点，请在环境变量中设置 TON_ENDPOINT
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">TON API 密钥（可选）</h3>
            <p className="text-sm text-muted-foreground">
              如果使用 TON Center API，需要设置 API 密钥。可在环境变量中设置 TON_API_KEY
            </p>
          </div>
        </CardContent>
      </Card>

      {/* USDT 支付 */}
      <Card>
        <CardHeader>
          <CardTitle>USDT 支付配置（Epusdt）</CardTitle>
          <CardDescription>配置 TRC20 USDT 支付网关</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Epusdt API 密钥</h3>
            <p className="text-sm text-muted-foreground">
              从您的 Epusdt 支付网关获取的 API 密钥
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Epusdt API 密钥</h3>
            <p className="text-sm text-muted-foreground">
              Epusdt 支付网关的 API 密钥，用于签名验证
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Epusdt 基础 URL（可选）</h3>
            <p className="text-sm text-muted-foreground">
              默认：https://api.epusdt.com。如果使用自建 Epusdt 服务，请在环境变量中设置 EPUSDT_BASE_URL
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">回调地址（可选）</h3>
            <p className="text-sm text-muted-foreground">
              支付成功后的回调地址。格式：{`${process.env.NEXT_PUBLIC_SERVER_URL || 'https://yourdomain.com'}/api/epusdt/callback`}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 其他配置 */}
      <Card>
        <CardHeader>
          <CardTitle>其他配置</CardTitle>
          <CardDescription>环境变量和高级配置</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">代理设置（可选）</h3>
            <p className="text-sm text-muted-foreground mb-2">
              如果您的服务器需要代理才能访问外部 API，可在环境变量中设置：
            </p>
            <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
              HTTP_PROXY=http://127.0.0.1:7897
            </pre>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Fragment API Cookie（自动获取）</h3>
            <p className="text-sm text-muted-foreground">
              系统会自动从 fragment.com 获取 Cookie，无需手动配置。如果自动获取失败，可在环境变量中手动设置 FRAGMENT_COOKIE 和 FRAGMENT_HASH
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">数据库配置</h3>
            <p className="text-sm text-muted-foreground mb-2">
              默认使用 SQLite 数据库，数据库文件位于：prisma/dev.db
            </p>
            <p className="text-sm text-muted-foreground">
              如需使用其他数据库，请在环境变量中设置 DATABASE_URL
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 配置步骤 */}
      <Card>
        <CardHeader>
          <CardTitle>配置步骤</CardTitle>
          <CardDescription>按照以下步骤完成配置</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-3 text-sm">
            <li>在 Telegram 中创建机器人并获取 Token，填写到"机器人设置"</li>
            <li>（可选）配置 TON 支付：填写 TON 钱包地址和助记词</li>
            <li>（可选）配置 USDT 支付：填写 Epusdt API 密钥和密钥</li>
            <li>在"价格管理"页面设置会员价格</li>
            <li>重启机器人使配置生效</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}

