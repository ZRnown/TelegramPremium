import { NextRequest, NextResponse } from "next/server"

/**
 * Webhook API：通知机器人刷新价格缓存
 * 注意：由于机器人和网站是分离的进程，此接口主要用于未来可能的集成
 * 目前机器人会定期（每 5 分钟）自动刷新价格缓存
 */
export async function POST(request: NextRequest) {
  try {
    // 这里可以添加通知机器人的逻辑
    // 例如通过 HTTP 请求通知机器人刷新缓存
    // 或者使用消息队列、Redis 等
    
    return NextResponse.json({ 
      success: true, 
      message: "价格更新通知已发送（机器人会定期自动同步）" 
    })
  } catch (error) {
    console.error('发送价格更新通知失败:', error)
    return NextResponse.json({ error: "内部服务器错误" }, { status: 500 })
  }
}

