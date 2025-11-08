import { type NextRequest, NextResponse } from "next/server"
import { createSession } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    const session = await createSession(username, password)

    if (session) {
      return NextResponse.json({ success: true, user: session.user })
    } else {
      return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 })
    }
  } catch (error) {
    console.error('登录失败:', error)
    return NextResponse.json({ error: "内部服务器错误" }, { status: 500 })
  }
}
