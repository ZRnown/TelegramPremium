import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"

export async function GET() {
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ error: "未授权" }, { status: 401 })
  }

  try {
    const { prisma } = await import('@/lib/prisma')
    const configs = await prisma.config.findMany({
      orderBy: { key: 'asc' }
    })
    
    return NextResponse.json({ configs })
  } catch (error) {
    console.error('获取配置失败:', error)
    return NextResponse.json({ error: "内部服务器错误" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ error: "未授权" }, { status: 401 })
  }

  try {
    const { configs } = await request.json()
    const { prisma } = await import('@/lib/prisma')

    // 批量更新配置
    await Promise.all(
      Object.entries(configs).map(([key, value]) =>
        prisma.config.upsert({
          where: { key },
          update: { value: String(value), updatedAt: new Date() },
          create: { key, value: String(value), type: 'string', updatedAt: new Date() },
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('更新配置失败:', error)
    return NextResponse.json({ error: "内部服务器错误" }, { status: 500 })
  }
}
