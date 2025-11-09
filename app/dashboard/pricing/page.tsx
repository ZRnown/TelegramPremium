import PricingManager from "@/components/pricing-manager"

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
    // 返回空数组，让客户端组件处理
    return []
  }
}

export default async function PricingPage() {
  const prices = await getPrices()

  return <PricingManager initialPrices={prices} />
}
