import { type NextRequest, NextResponse } from "next/server"
import { createSession } from "@/lib/auth"

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password } = body

    if (!username || !password) {
      return NextResponse.json({ error: "用户名和密码不能为空" }, { status: 400 })
    }

    const session = await createSession(username, password)

    if (session) {
      return NextResponse.json({ success: true, user: session.user })
    } else {
      return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 })
    }
  } catch (error) {
    console.error('登录失败:', error)
    return NextResponse.json({ 
      error: "内部服务器错误",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
