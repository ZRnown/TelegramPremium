import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"

export async function GET() {
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ error: "未授权" }, { status: 401 })
  }

  try {
    const { prisma } = await import('@/lib/prisma')
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100
    })
    
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    const stats = {
      total: await prisma.user.count(),
      premium: await prisma.user.count({ 
        where: { 
          orders: { 
            some: { 
              status: 'completed',
              completedAt: { not: null }
            }
          }
        }
      }),
      active: await prisma.user.count({
        where: {
          lastActiveAt: { gte: today }
        }
      })
    }

    return NextResponse.json({ users, stats })
  } catch (error) {
    console.error('获取用户失败:', error)
    return NextResponse.json({ error: "内部服务器错误" }, { status: 500 })
  }
}
