"use client"

import { useState, useEffect } from "react"
import PricingTable from "@/components/pricing-table"
import CreatePriceForm from "@/components/create-price-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface Price {
  id: number
  plan_type: string
  duration_days: number
  months?: number
  price: number
  currency: string
  is_active: boolean
}

interface PricingManagerProps {
  initialPrices: Price[]
}

export default function PricingManager({ initialPrices }: PricingManagerProps) {
  const [prices, setPrices] = useState<Price[]>(initialPrices)

  const handleSuccess = () => {
    // 刷新页面以获取最新数据
    window.location.reload()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">价格管理</h1>
        <p className="text-muted-foreground">管理订阅方案和价格</p>
      </div>

      {prices.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>设置价格方案</CardTitle>
            <CardDescription>设置 3 个月、6 个月和 12 个月的会员价格</CardDescription>
          </CardHeader>
          <CardContent>
            <CreatePriceForm onSuccess={handleSuccess} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>当前价格方案</CardTitle>
            <CardDescription>编辑和管理价格方案。价格更新后，机器人将在 5 分钟内自动同步。</CardDescription>
          </CardHeader>
          <CardContent>
            <PricingTable prices={prices} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

