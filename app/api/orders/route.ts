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
      take: 100,
      include: { user: true }
    })
    
    const stats = {
      total: await prisma.order.count(),
      pending: await prisma.order.count({ where: { status: 'pending' } }),
      completed: await prisma.order.count({ where: { status: 'completed' } }),
      failed: await prisma.order.count({ where: { status: 'failed' } }),
    }

    return NextResponse.json({ orders, stats })
  } catch (error) {
    console.error('获取订单失败:', error)
    return NextResponse.json({ error: "内部服务器错误" }, { status: 500 })
  }
}
