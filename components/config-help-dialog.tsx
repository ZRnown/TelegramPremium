"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { InfoIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { HelpCircle } from "lucide-react"

export default function ConfigHelpDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <HelpCircle className="mr-2 h-4 w-4" />
          配置说明
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>配置说明</DialogTitle>
          <DialogDescription>详细说明如何配置机器人的各项参数</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <Alert>
            <InfoIcon className="h-4 w-4" />
            <AlertTitle>重要提示</AlertTitle>
            <AlertDescription>
              所有敏感信息（如助记词、私钥）都会加密存储，请妥善保管。配置完成后，请重启机器人以使配置生效。
            </AlertDescription>
          </Alert>

          {/* 机器人设置 */}
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">机器人设置</h3>
            <div className="space-y-3 text-sm">
              <div>
                <h4 className="font-medium mb-1">Telegram 机器人 Token</h4>
                <p className="text-muted-foreground">
                  从 <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-primary underline">@BotFather</a> 获取您的机器人 Token。
                  步骤：1. 在 Telegram 中搜索 @BotFather 2. 发送 /newbot 创建新机器人 3. 按提示设置机器人名称和用户名 4. 复制返回的 Token
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">Telegram 机器人用户名</h4>
                <p className="text-muted-foreground">
                  机器人的用户名（不包含 @ 符号），例如：my_premium_bot
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">服务器 URL（用于回调）</h4>
                <p className="text-muted-foreground">
                  您的服务器公网地址，用于接收支付回调。格式：https://yourdomain.com 或 http://your-ip:port
                </p>
              </div>
            </div>
          </div>

          {/* TON 支付 */}
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">TON 支付配置</h3>
            <div className="space-y-3 text-sm">
              <div>
                <h4 className="font-medium mb-1">TON 钱包地址</h4>
                <p className="text-muted-foreground">
                  用于接收 TON 支付的钱包地址。格式：EQxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">TON 钱包助记词</h4>
                <p className="text-muted-foreground">
                  用于自动发送 TON 支付的助记词（24 个单词，用空格分隔）。
                  <strong className="text-destructive block mt-1">⚠️ 安全警告：</strong>助记词具有完全控制钱包的权限，请妥善保管，不要泄露给任何人。
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">TON API 端点（可选）</h4>
                <p className="text-muted-foreground">
                  默认使用：https://toncenter.com/api/v2/jsonRPC。如需使用其他节点，请在环境变量中设置 TON_ENDPOINT
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">TON API 密钥（可选）</h4>
                <p className="text-muted-foreground">
                  如果使用 TON Center API，需要设置 API 密钥。可在环境变量中设置 TON_API_KEY
                </p>
              </div>
            </div>
          </div>

          {/* USDT 支付 */}
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">USDT 支付配置（Epusdt）</h3>
            <div className="space-y-3 text-sm">
              <div>
                <h4 className="font-medium mb-1">Epusdt API 密钥</h4>
                <p className="text-muted-foreground">
                  从您的 Epusdt 支付网关获取的 API 密钥
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">Epusdt API 密钥</h4>
                <p className="text-muted-foreground">
                  Epusdt 支付网关的 API 密钥，用于签名验证
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">Epusdt 基础 URL（可选）</h4>
                <p className="text-muted-foreground">
                  默认：https://api.epusdt.com。如果使用自建 Epusdt 服务，请在环境变量中设置 EPUSDT_BASE_URL
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">回调地址（可选）</h4>
                <p className="text-muted-foreground">
                  支付成功后的回调地址。格式：{`${typeof window !== 'undefined' ? window.location.origin : 'https://yourdomain.com'}/api/epusdt/callback`}
                </p>
              </div>
            </div>
          </div>

          {/* 支付宝支付 */}
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">支付宝支付配置</h3>
            <div className="space-y-3 text-sm">
              <div>
                <h4 className="font-medium mb-1">支付宝应用 ID</h4>
                <p className="text-muted-foreground">
                  从支付宝开放平台获取的应用 ID（AppID）
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">支付宝私钥</h4>
                <p className="text-muted-foreground">
                  支付宝应用的私钥，用于签名验证。请确保私钥格式正确
                </p>
              </div>

              <Alert>
                <InfoIcon className="h-4 w-4" />
                <AlertTitle>功能开发中</AlertTitle>
                <AlertDescription>
                  支付宝支付功能目前正在开发中，配置后暂不可用。
                </AlertDescription>
              </Alert>
            </div>
          </div>

          {/* 其他配置 */}
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">其他配置</h3>
            <div className="space-y-3 text-sm">
              <div>
                <h4 className="font-medium mb-1">代理设置（可选）</h4>
                <p className="text-muted-foreground mb-2">
                  如果您的服务器需要代理才能访问外部 API，可在环境变量中设置：
                </p>
                <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
                  HTTP_PROXY=http://127.0.0.1:7897
                </pre>
              </div>

              <div>
                <h4 className="font-medium mb-1">Fragment API Cookie（自动获取）</h4>
                <p className="text-muted-foreground">
                  系统会自动从 fragment.com 获取 Cookie，无需手动配置。如果自动获取失败，可在环境变量中手动设置 FRAGMENT_COOKIE 和 FRAGMENT_HASH
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">数据库配置</h4>
                <p className="text-muted-foreground">
                  默认使用 SQLite 数据库，数据库文件位于：prisma/dev.db。如需使用其他数据库，请在环境变量中设置 DATABASE_URL
                </p>
              </div>
            </div>
          </div>

          {/* 配置步骤 */}
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">配置步骤</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>在 Telegram 中创建机器人并获取 Token，填写到"机器人设置"</li>
              <li>（可选）配置 TON 支付：填写 TON 钱包地址和助记词</li>
              <li>（可选）配置 USDT 支付：填写 Epusdt API 密钥和密钥</li>
              <li>（可选）配置支付宝支付：填写支付宝应用 ID 和私钥</li>
              <li>在"价格管理"页面设置会员价格</li>
              <li>重启机器人使配置生效</li>
            </ol>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

