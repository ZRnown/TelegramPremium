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

      {/* 快速开始指南 */}
      <Card>
        <CardHeader>
          <CardTitle>快速开始</CardTitle>
          <CardDescription>通过配置机器人设置开始使用</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                1
              </div>
              <div>
                <p className="font-medium">配置机器人设置</p>
                <p className="text-sm text-muted-foreground">
                  在配置页面设置您的机器人 Token 和支付方式
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                2
              </div>
              <div>
                <p className="font-medium">设置价格方案</p>
                <p className="text-sm text-muted-foreground">
                  在价格管理页面配置您的订阅方案和价格
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                3
              </div>
              <div>
                <p className="font-medium">监控活动</p>
                <p className="text-sm text-muted-foreground">跟踪用户、订单和收入情况</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
