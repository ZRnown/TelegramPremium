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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Recent Orders</CardTitle>
          <CardDescription>Latest payment transactions</CardDescription>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/orders">
            View All
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No orders yet</p>
            <p className="text-sm">Orders will appear here when users make purchases</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.slice(0, 5).map((order) => (
              <div key={order.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                <div className="space-y-1">
                  <p className="font-medium font-mono text-sm">{order.order_no}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>User: {order.telegram_id}</span>
                    <span>•</span>
                    <span className="capitalize">{order.plan_type}</span>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <p className="font-semibold">
                    {order.amount} {order.currency}
                  </p>
                  <Badge variant={getStatusVariant(order.status)} className="text-xs">
                    {order.status}
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
