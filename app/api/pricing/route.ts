import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"

export async function GET() {
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ error: "未授权" }, { status: 401 })
  }

  try {
    const { prisma } = await import('@/lib/prisma')
    const prices = await prisma.price.findMany({
      where: { isActive: true },
      orderBy: { months: 'asc' }
    })
    const history = await prisma.priceHistory.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 50
    })
    return NextResponse.json({ prices, history })
  } catch (error) {
    console.error('获取价格失败:', error)
    return NextResponse.json({ error: "内部服务器错误" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ error: "未授权" }, { status: 401 })
  }

  try {
    const priceData = await request.json()
    const { prisma } = await import('@/lib/prisma')

    // 更新价格并记录历史
    const oldPrice = await prisma.price.findUnique({
      where: { months: priceData.months }
    })

        await prisma.price.upsert({
          where: { months: priceData.months },
          update: { 
            price: priceData.price,
            isActive: true,
            updatedAt: new Date()
          },
          create: {
            months: priceData.months,
            price: priceData.price,
            isActive: true
          }
        })

    if (oldPrice && oldPrice.price !== priceData.price) {
      await prisma.priceHistory.create({
        data: {
          months: priceData.months,
          oldPrice: oldPrice.price,
          newPrice: priceData.price
        }
      })
    }

    return NextResponse.json({ 
      success: true, 
      message: "价格已更新，机器人将在 5 分钟内自动同步最新价格" 
    })
  } catch (error) {
    console.error('更新价格失败:', error)
    return NextResponse.json({ error: "内部服务器错误" }, { status: 500 })
  }
}
