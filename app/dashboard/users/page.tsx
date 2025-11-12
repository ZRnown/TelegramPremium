import UsersTable from "@/components/users-table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { UsersIcon } from "lucide-react"

export default async function UsersPage() {
  const { prisma } = await import('@/lib/prisma')
  const rawUsers = await prisma.user.findMany({
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

  const users = rawUsers.map(u => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
    lastActiveAt: u.lastActiveAt.toISOString(),
  }))

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const stats = {
    total: await prisma.user.count(),
    active: await prisma.user.count({ where: { lastActiveAt: { gte: today } } }),
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">用户管理</h1>
        <p className="text-muted-foreground">管理和监控您的 Telegram 机器人用户</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总用户数</CardTitle>
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">今日活跃</CardTitle>
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>所有用户</CardTitle>
          <CardDescription>查看和管理注册用户</CardDescription>
        </CardHeader>
        <CardContent>
          <UsersTable users={users} />
        </CardContent>
      </Card>
    </div>
  )
}
