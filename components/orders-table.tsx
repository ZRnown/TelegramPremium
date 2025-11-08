"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search } from "lucide-react"

interface Order {
  id: number
  order_no: string
  telegram_id: string
  payment_method: string
  amount: number
  currency: string
  status: string
  plan_type: string
  duration_days: number
  created_at: string
  paid_at?: string
}

interface OrdersTableProps {
  orders: Order[]
}

export default function OrdersTable({ orders }: OrdersTableProps) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.order_no.toLowerCase().includes(search.toLowerCase()) || order.telegram_id.includes(search)
    const matchesStatus = statusFilter === "all" || order.status === statusFilter
    return matchesSearch && matchesStatus
  })

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
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索订单..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="筛选状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="pending">待处理</SelectItem>
            <SelectItem value="completed">已完成</SelectItem>
            <SelectItem value="failed">失败</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>订单号</TableHead>
              <TableHead>用户 ID</TableHead>
              <TableHead>方案</TableHead>
              <TableHead>支付方式</TableHead>
              <TableHead>金额</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>日期</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  未找到订单
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((order) => {
                const statusMap: Record<string, string> = {
                  completed: '已完成',
                  pending: '待处理',
                  failed: '失败',
                }
                const paymentMap: Record<string, string> = {
                  alipay: '支付宝',
                  usdt: 'TRC20 USDT',
                }
                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-sm">{order.order_no}</TableCell>
                    <TableCell>{order.telegram_id}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{order.plan_type}</div>
                        <div className="text-sm text-muted-foreground">{order.duration_days} 天</div>
                      </div>
                    </TableCell>
                    <TableCell>{paymentMap[order.payment_method] || order.payment_method}</TableCell>
                    <TableCell>
                      {order.amount} {order.currency}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(order.status)}>{statusMap[order.status] || order.status}</Badge>
                    </TableCell>
                    <TableCell>{new Date(order.created_at).toLocaleDateString('zh-CN')}</TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
