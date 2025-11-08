"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Save } from "lucide-react"

interface Config {
  id: number
  config_key: string
  config_value: string
  description: string
}

interface ConfigFormProps {
  configs: Config[]
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {configs.map((config) => {
        const isLongText =
          config.config_key.includes("message") ||
          config.config_key.includes("mnemonic") ||
          config.config_key.includes("private_key")
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
                placeholder={`Enter ${config.description.toLowerCase()}`}
                className="font-mono text-sm"
              />
            ) : (
              <Input
                id={config.config_key}
                type={isSecret ? "password" : "text"}
                value={values[config.config_key] || ""}
                onChange={(e) => setValues({ ...values, [config.config_key]: e.target.value })}
                placeholder={`Enter ${config.description.toLowerCase()}`}
              />
            )}
          </div>
        )
      })}
      <Button type="submit" disabled={loading}>
        <Save className="mr-2 h-4 w-4" />
        {loading ? "保存中..." : "保存更改"}
      </Button>
    </form>
  )
}
