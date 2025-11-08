import PricingTable from "@/components/pricing-table"
import PriceHistoryCard from "@/components/price-history-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

async function getPrices() {
  try {
    const { prisma } = await import('@/lib/prisma')
    const prices = await prisma.price.findMany({
      orderBy: { months: 'asc' }
    })
    
    // 转换为前端需要的格式
    return prices.map((price) => ({
      id: price.id,
      plan_type: 'premium',
      duration_days: price.months * 30,
      months: price.months,
      price: price.price,
      currency: 'USDT',
      is_active: price.isActive,
    }))
  } catch (error) {
    console.error('获取价格失败:', error)
    // 返回默认价格
    return [
      { id: 1, plan_type: "premium", duration_days: 90, months: 3, price: 12.5, currency: "USDT", is_active: true },
      { id: 2, plan_type: "premium", duration_days: 180, months: 6, price: 16.5, currency: "USDT", is_active: true },
      { id: 3, plan_type: "premium", duration_days: 365, months: 12, price: 29.9, currency: "USDT", is_active: true },
    ]
  }
}

async function getPriceHistory() {
  try {
    const { prisma } = await import('@/lib/prisma')
    const history = await prisma.priceHistory.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 50
    })
    return history
  } catch (error) {
    console.error('获取价格历史失败:', error)
    return []
  }
}

export default async function PricingPage() {
  const prices = await getPrices()
  const history = await getPriceHistory()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">价格管理</h1>
        <p className="text-muted-foreground">管理订阅方案和价格</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>当前价格方案</CardTitle>
          <CardDescription>编辑和管理活跃的价格方案。价格更新后，机器人将在 5 分钟内自动同步。</CardDescription>
        </CardHeader>
        <CardContent>
          {prices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>暂无价格方案</p>
              <p className="text-sm mt-2">请先创建价格方案（3 个月、6 个月、12 个月）</p>
            </div>
          ) : (
            <PricingTable prices={prices} />
          )}
        </CardContent>
      </Card>

      <PriceHistoryCard history={history} />
    </div>
  )
}
