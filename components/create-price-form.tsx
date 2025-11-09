"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Plus } from "lucide-react"

export default function CreatePriceForm({ onSuccess }: { onSuccess: () => void }) {
  const [prices, setPrices] = useState({
    months3: "",
    months6: "",
    months12: "",
  })
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const priceList = [
        { months: 3, price: Number.parseFloat(prices.months3) },
        { months: 6, price: Number.parseFloat(prices.months6) },
        { months: 12, price: Number.parseFloat(prices.months12) },
      ]

      // 验证输入
      for (const item of priceList) {
        if (!item.price || item.price <= 0) {
          throw new Error(`请输入有效的 ${item.months} 个月价格`)
        }
      }

      // 批量创建价格
      const promises = priceList.map((item) =>
        fetch("/api/pricing", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            months: item.months,
            price: item.price,
          }),
        })
      )

      const results = await Promise.all(promises)
      const errors = results.filter((r) => !r.ok)

      if (errors.length > 0) {
        throw new Error("创建价格失败，请重试")
      }

      toast({
        title: "成功",
        description: "价格方案已创建，机器人将在 5 分钟内自动同步",
      })

      // 重置表单
      setPrices({ months3: "", months6: "", months12: "" })
      onSuccess()
    } catch (error) {
      toast({
        title: "错误",
        description: error instanceof Error ? error.message : "创建价格失败",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="months3">3 个月价格 (USDT)</Label>
        <Input
          id="months3"
          type="number"
          step="0.01"
          min="0"
          value={prices.months3}
          onChange={(e) => setPrices({ ...prices, months3: e.target.value })}
          placeholder="例如：12.5"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="months6">6 个月价格 (USDT)</Label>
        <Input
          id="months6"
          type="number"
          step="0.01"
          min="0"
          value={prices.months6}
          onChange={(e) => setPrices({ ...prices, months6: e.target.value })}
          placeholder="例如：16.5"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="months12">12 个月价格 (USDT)</Label>
        <Input
          id="months12"
          type="number"
          step="0.01"
          min="0"
          value={prices.months12}
          onChange={(e) => setPrices({ ...prices, months12: e.target.value })}
          placeholder="例如：29.9"
          required
        />
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        <Plus className="mr-2 h-4 w-4" />
        {loading ? "创建中..." : "创建价格方案"}
      </Button>
    </form>
  )
}

