import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

interface Order {
  id: number
  order_no: string
  telegram_id: string
  plan_type: string
  amount: number
  currency: string
  status: string
  created_at: string
}

interface RecentOrdersProps {
  orders: Order[]
}

export default function RecentOrders({ orders }: RecentOrdersProps) {
  const getStatusVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "default"
      case "pending":
        return "secondary"
      case "failed":
        return "destructive"
      default:
        return "outline"
    }
  }

  const statusMap: Record<string, string> = {
    completed: '已完成',
    pending: '待处理',
    failed: '失败',
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>最近订单</CardTitle>
          <CardDescription>最新支付交易记录</CardDescription>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/orders">
            查看全部
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>暂无订单</p>
            <p className="text-sm">当用户购买时，订单将显示在这里</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.slice(0, 5).map((order) => (
              <div key={order.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                <div className="space-y-1">
                  <p className="font-medium font-mono text-sm">{order.order_no}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>用户: {order.telegram_id}</span>
                    <span>•</span>
                    <span>{order.plan_type === 'premium' ? '会员' : order.plan_type}</span>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <p className="font-semibold">
                    {order.amount} {order.currency}
                  </p>
                  <Badge variant={getStatusVariant(order.status)} className="text-xs">
                    {statusMap[order.status] || order.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
