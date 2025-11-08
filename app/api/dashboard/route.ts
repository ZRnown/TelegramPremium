import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"

export async function GET() {
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ error: "未授权" }, { status: 401 })
  }

  try {
    const { prisma } = await import('@/lib/prisma')
    
    const totalUsers = await prisma.user.count()
    const activeOrders = await prisma.order.count({
      where: { 
        status: { 
          in: ['pending', 'processing_payment', 'waiting_user_payment'] 
        }
      }
    })
    
    const completedOrders = await prisma.order.findMany({
      where: { status: 'completed' }
    })
    const revenue = completedOrders.reduce((sum, order) => sum + order.amount, 0)
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayRevenue = completedOrders
      .filter(o => o.completedAt && o.completedAt >= today)
      .reduce((sum, order) => sum + order.amount, 0)
    const todayOrders = await prisma.order.count({
      where: { createdAt: { gte: today } }
    })
    const activeUsers = await prisma.user.count({
      where: { lastActiveAt: { gte: today } }
    })

    return NextResponse.json({
      stats: {
        totalUsers,
        activeOrders,
        revenue,
        growth: 0,
      },
      userGrowthData: [],
      recentOrders: await prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { user: true }
      }),
      quickStats: {
        todayRevenue,
        todayOrders,
        activeUsers,
      },
    })
  } catch (error) {
    console.error('获取仪表盘数据失败:', error)
    return NextResponse.json({ error: "内部服务器错误" }, { status: 500 })
  }
}
