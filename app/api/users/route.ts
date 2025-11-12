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
      take: 200,
      select: {
        id: true,
        userId: true,
        username: true,
        firstName: true,
        lastName: true,
        balance: true,
        createdAt: true,
        lastActiveAt: true,
      }
    })

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const stats = {
      total: await prisma.user.count(),
      active: await prisma.user.count({ where: { lastActiveAt: { gte: today } } }),
    }

    return NextResponse.json({ users, stats })
  } catch (error) {
    console.error('获取用户失败:', error)
    return NextResponse.json({ error: "内部服务器错误" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "未授权" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { id, delta, balance } = body || {}
    if (!id || (typeof delta !== 'number' && typeof balance !== 'number')) {
      return NextResponse.json({ error: '参数无效：需要 id，且需要 delta 或 balance 其一为数字' }, { status: 400 })
    }

    const { prisma } = await import('@/lib/prisma')

    let data: any = {}
    if (typeof balance === 'number') {
      data.balance = balance
    } else if (typeof delta === 'number') {
      data = { balance: { increment: delta } }
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        userId: true,
        username: true,
        firstName: true,
        lastName: true,
        balance: true,
        createdAt: true,
        lastActiveAt: true,
      }
    })

    return NextResponse.json({ user: updated })
  } catch (error) {
    console.error('更新用户余额失败:', error)
    return NextResponse.json({ error: '内部服务器错误' }, { status: 500 })
  }
}
