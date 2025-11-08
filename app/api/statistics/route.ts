import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"

export async function GET() {
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ error: "未授权" }, { status: 401 })
  }

  try {
    const { prisma } = await import('@/lib/prisma')
    
    const completedOrders = await prisma.order.findMany({
      where: { status: 'completed' }
    })
    
    const totalRevenue = completedOrders.reduce((sum, order) => sum + order.amount, 0)
    
    const now = new Date()
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    
    const lastMonthRevenue = completedOrders
      .filter(o => o.completedAt && o.completedAt >= lastMonth && o.completedAt < thisMonth)
      .reduce((sum, order) => sum + order.amount, 0)
    
    const thisMonthRevenue = completedOrders
      .filter(o => o.completedAt && o.completedAt >= thisMonth)
      .reduce((sum, order) => sum + order.amount, 0)
    
    const monthlyGrowth = lastMonthRevenue > 0 
      ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue * 100).toFixed(2)
      : 0
    
    const newUsers = await prisma.user.count({
      where: { createdAt: { gte: thisMonth } }
    })
    
    const totalOrders = await prisma.order.count()

    return NextResponse.json({
      totalRevenue,
      monthlyGrowth: Number(monthlyGrowth),
      newUsers,
      totalOrders,
      revenueData: [],
      ordersData: [],
    })
  } catch (error) {
    console.error('获取统计失败:', error)
    return NextResponse.json({ error: "内部服务器错误" }, { status: 500 })
  }
}
