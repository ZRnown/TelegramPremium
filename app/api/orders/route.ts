import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"

export async function GET() {
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ error: "未授权" }, { status: 401 })
  }

  try {
    const { prisma } = await import('@/lib/prisma')
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { user: { select: { id: true, userId: true, username: true } } }
    })

    const total = await prisma.order.count()
    const pending = await prisma.order.count({ where: { status: 'pending' } })
    const completed = await prisma.order.count({ where: { status: 'completed' } })
    const failed = await prisma.order.count({ where: { status: 'failed' } })
    const completedOrders = await prisma.order.findMany({ where: { status: 'completed' }, select: { amountUsdt: true } })
    const revenueUsdt = completedOrders.reduce((s, o) => s + (o.amountUsdt || 0), 0)

    return NextResponse.json({ orders, stats: { total, pending, completed, failed, revenueUsdt } })
  } catch (error) {
    console.error('获取订单失败:', error)
    return NextResponse.json({ error: "内部服务器错误" }, { status: 500 })
  }
}
