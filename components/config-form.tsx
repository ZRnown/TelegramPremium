"use client"

import type React from "react"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Save } from "lucide-react"

interface Config {
  id: string | number
  config_key: string
  config_value: string
  description: string
}

interface ConfigFormProps {
  configs: Config[]
}

type WalletVersionInfo = {
  walletType: string
  addressRaw: string | null
  addressBounceable: string | null
  addressNonBounceable: string | null
  address: string | null
  error?: string
}

type TonWalletInfo = {
  address: string
  addressBounceable: string
  addressNonBounceable: string
  addressRaw: string
  workchain: number
  walletId: number
  walletType: string
  publicKeyHex: string
  mnemonicWords: number
  seqno: number | null
  balanceNano: string | null
  balanceTon: string | null
  state: string
  lastTransactionLt: string | null
  lastTransactionHash: string | null
  endpoint: string
  hasApiKey: boolean
  allVersions?: WalletVersionInfo[]
}

export default function ConfigForm({ configs }: ConfigFormProps) {
  const [values, setValues] = useState<Record<string, string>>(
    configs.reduce(
      (acc, config) => ({
        ...acc,
        [config.config_key]: config.config_value,
      }),
      {},
    ),
  )
  const [loading, setLoading] = useState(false)
  const [walletInfo, setWalletInfo] = useState<TonWalletInfo | null>(null)
  const [walletWarnings, setWalletWarnings] = useState<string[]>([])
  const [walletError, setWalletError] = useState<string | null>(null)
  const [walletLoading, setWalletLoading] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configs: values }),
      })

      if (response.ok) {
        toast({
          title: "成功",
          description: "配置已成功更新",
        })
      } else {
        throw new Error("更新失败")
      }
    } catch (error) {
      toast({
        title: "错误",
        description: "更新配置失败",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const hasTonMnemonicField = useMemo(
    () => configs.some((config) => config.config_key === "ton_mnemonic"),
    [configs],
  )

  const tonMnemonicValue = values["ton_mnemonic"] ?? ""

  useEffect(() => {
    if (!hasTonMnemonicField) {
      return
    }

    const trimmed = tonMnemonicValue.trim()

    if (!trimmed) {
      setWalletInfo(null)
      setWalletWarnings([])
      setWalletError(null)
      setWalletLoading(false)
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setWalletLoading(true)
      setWalletError(null)

      try {
        const response = await fetch("/api/ton/wallet-info", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mnemonic: trimmed }),
          signal: controller.signal,
        })

        const data = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(
            typeof data?.error === "string" ? data.error : "无法获取钱包信息，请稍后重试。",
          )
        }

        setWalletInfo(data.wallet ?? null)
        setWalletWarnings(Array.isArray(data.warnings) ? data.warnings : [])
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return
        }
        const message =
          error instanceof Error ? error.message : "无法获取钱包信息，请稍后重试。"
        setWalletError(message)
        setWalletInfo(null)
        setWalletWarnings([])
      } finally {
        setWalletLoading(false)
      }
    }, 600)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [tonMnemonicValue, hasTonMnemonicField])

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {configs.map((config) => {
        const isLongText =
          config.config_key.includes("message") ||
          config.config_key.includes("mnemonic") ||
          config.config_key.includes("private_key") ||
          config.config_key.includes("customer_service")
        const isSecret =
          config.config_key.includes("secret") ||
          config.config_key.includes("token") ||
          config.config_key.includes("mnemonic") ||
          config.config_key.includes("private_key")

        return (
          <div key={config.id} className="space-y-2">
            <Label htmlFor={config.config_key}>{config.description}</Label>
            {isLongText ? (
              <Textarea
                id={config.config_key}
                value={values[config.config_key] || ""}
                onChange={(e) => setValues({ ...values, [config.config_key]: e.target.value })}
                placeholder={`请输入${config.description}`}
                className="font-mono text-sm"
              />
            ) : (
              <Input
                id={config.config_key}
                type={isSecret ? "password" : "text"}
                value={values[config.config_key] || ""}
                onChange={(e) => setValues({ ...values, [config.config_key]: e.target.value })}
                placeholder={`请输入${config.description}`}
              />
            )}
          </div>
        )
      })}

      {hasTonMnemonicField && (
        <div className="rounded-md border border-dashed bg-muted/40 p-4 text-sm">
          <p className="mb-2 font-medium">助记词解析结果</p>
          {walletLoading ? (
            <p className="text-muted-foreground">正在加载钱包信息...</p>
          ) : walletError ? (
            <p className="text-destructive">{walletError}</p>
          ) : walletInfo ? (
            <div className="space-y-3 font-mono text-xs sm:text-sm">
              <div>
                <span className="text-muted-foreground">钱包地址（Bounceable）</span>
                <div className="break-all">{walletInfo.addressBounceable}</div>
              </div>
              <div>
                <span className="text-muted-foreground">钱包地址（Non-Bounceable）</span>
                <div className="break-all">{walletInfo.addressNonBounceable}</div>
              </div>
              <div>
                <span className="text-muted-foreground">原始地址</span>
                <div className="break-all">{walletInfo.addressRaw}</div>
              </div>
              <div className="grid gap-1 sm:grid-cols-2">
                <div>
                  <span className="text-muted-foreground">Workchain</span>
                  <div>{walletInfo.workchain}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">钱包类型</span>
                  <div>{walletInfo.walletType} (ID {walletInfo.walletId})</div>
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">公钥 (hex)</span>
                <div className="break-all">{walletInfo.publicKeyHex}</div>
              </div>
              <div className="grid gap-1 sm:grid-cols-2">
                <div>
                  <span className="text-muted-foreground">余额</span>
                  <div>{walletInfo.balanceTon ? `${walletInfo.balanceTon} TON` : "未知"}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Seqno</span>
                  <div>{walletInfo.seqno ?? "未激活"}</div>
                </div>
              </div>
              <div className="grid gap-1 sm:grid-cols-2">
                <div>
                  <span className="text-muted-foreground">钱包状态</span>
                  <div>{walletInfo.state}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">助记词单词数</span>
                  <div>{walletInfo.mnemonicWords}</div>
                </div>
              </div>
              <div className="grid gap-1 sm:grid-cols-2">
                <div>
                  <span className="text-muted-foreground">最后交易 LT</span>
                  <div className="break-all">{walletInfo.lastTransactionLt ?? "未知"}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">最后交易哈希</span>
                  <div className="break-all">
                    {walletInfo.lastTransactionHash ?? "未知"}
                  </div>
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">节点</span>
                <div>{walletInfo.endpoint}</div>
              </div>
              <div>
                <span className="text-muted-foreground">API Key</span>
                <div>{walletInfo.hasApiKey ? "已配置" : "未配置"}</div>
              </div>
              
              {walletInfo.allVersions && walletInfo.allVersions.length > 0 && (
                <div className="mt-4 space-y-3 border-t pt-3">
                  <p className="font-medium">所有钱包版本的地址</p>
                  {walletInfo.allVersions.map((version, index) => (
                    <div key={index} className="rounded border bg-background/50 p-3 space-y-2">
                      <div className="font-semibold text-sm">
                        {version.walletType.toUpperCase()}
                        {version.walletType === walletInfo.walletType && (
                          <span className="ml-2 text-xs text-primary">(当前使用)</span>
                        )}
                      </div>
                      {version.error ? (
                        <div className="text-xs text-destructive">错误: {version.error}</div>
                      ) : (
                        <div className="space-y-1.5 text-xs">
                          <div>
                            <span className="text-muted-foreground">原始地址:</span>
                            <div className="break-all font-mono">{version.addressRaw}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">弹性地址 (Bounceable):</span>
                            <div className="break-all font-mono">{version.addressBounceable}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">非弹性地址 (Non-Bounceable):</span>
                            <div className="break-all font-mono">{version.addressNonBounceable}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">请输入助记词以解析钱包信息。</p>
          )}

          {walletWarnings.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-amber-600 dark:text-amber-400 sm:text-sm">
              {walletWarnings.map((warning, index) => (
                <li key={index}>⚠️ {warning}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Button type="submit" disabled={loading}>
        <Save className="mr-2 h-4 w-4" />
        {loading ? "保存中..." : "保存更改"}
      </Button>
    </form>
  )
}
