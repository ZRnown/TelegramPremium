import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, ShoppingCart, Users } from "lucide-react"

interface QuickStatsProps {
  stats: {
    todayRevenue: number
    todayOrders: number
    activeUsers: number
  }
}

export default function QuickStats({ stats }: QuickStatsProps) {
  const items = [
    {
      label: "今日收入",
      value: `¥${stats.todayRevenue.toFixed(2)}`,
      icon: DollarSign,
      color: "text-green-600",
    },
    {
      label: "今日订单",
      value: stats.todayOrders.toString(),
      icon: ShoppingCart,
      color: "text-blue-600",
    },
    {
      label: "活跃用户",
      value: stats.activeUsers.toString(),
      icon: Users,
      color: "text-purple-600",
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>今日活动</CardTitle>
        <CardDescription>今日实时统计数据</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <div key={item.label} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`rounded-full bg-muted p-2 ${item.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className="font-medium">{item.label}</span>
              </div>
              <span className="text-2xl font-bold">{item.value}</span>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
