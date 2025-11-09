import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, ShoppingCart, DollarSign, TrendingUp } from "lucide-react"
import UserGrowthChart from "@/components/user-growth-chart"
import RecentOrders from "@/components/recent-orders"
import QuickStats from "@/components/quick-stats"

async function getDashboardData() {
  // Placeholder - will fetch from database
  return {
    stats: {
      totalUsers: 0,
      activeOrders: 0,
      revenue: 0,
      growth: 0,
    },
    userGrowthData: [],
    recentOrders: [],
    quickStats: {
      todayRevenue: 0,
      todayOrders: 0,
      activeUsers: 0,
    },
  }
}

export default async function DashboardPage() {
  const data = await getDashboardData()

  const mainStats = [
    {
      title: "总用户数",
      value: data.stats.totalUsers.toString(),
      description: "注册用户",
      icon: Users,
      trend: "+0%",
    },
    {
      title: "进行中订单",
      value: data.stats.activeOrders.toString(),
      description: "待处理订单",
      icon: ShoppingCart,
      trend: "+0%",
    },
    {
      title: "总收入",
      value: `¥${data.stats.revenue.toFixed(2)}`,
      description: "累计收益",
      icon: DollarSign,
      trend: "+0%",
    },
    {
      title: "增长率",
      value: `${data.stats.growth}%`,
      description: "较上月",
      icon: TrendingUp,
      trend: "+0%",
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">总览</h1>
        <p className="text-muted-foreground">欢迎回来！以下是您的机器人运行情况。</p>
      </div>

      {/* Main Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {mainStats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">
                  {stat.description}
                  <span className="ml-2 text-green-600">{stat.trend}</span>
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Charts and Activity */}
      <div className="grid gap-6 md:grid-cols-2">
        <UserGrowthChart data={data.userGrowthData} />
        <QuickStats stats={data.quickStats} />
      </div>

      {/* Recent Orders */}
      <RecentOrders orders={data.recentOrders} />
    </div>
  )
}
