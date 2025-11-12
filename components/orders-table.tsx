"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search } from "lucide-react"

interface Order {
  id: string
  user: { id: string; userId: string; username?: string | null }
  type: string
  status: string
  paymentMethod: string
  amountUsdt?: number | null
  months: number
  targetUsername: string
  createdAt: string
  paidAt?: string | null
}

interface OrdersTableProps {
  orders: Order[]
}

export default function OrdersTable({ orders }: OrdersTableProps) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  const filteredOrders = orders.filter((order) => {
    const s = search.toLowerCase()
    const uid = order.user?.userId || ''
    const uname = order.user?.username || ''
    const matchesSearch = uid.includes(search) || uname.toLowerCase().includes(s) || order.targetUsername.toLowerCase().includes(s)
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
              <TableHead>用户</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>支付方式</TableHead>
              <TableHead>金额（USDT）</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>创建时间</TableHead>
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
                  waiting_user_payment: '待用户付款',
                  processing_payment: '处理中',
                }
                const paymentMap: Record<string, string> = {
                  alipay: '支付宝',
                  usdt: 'USDT',
                }
                return (
                  <TableRow key={order.id}>
                    <TableCell>
                      <div>
                        <div className="font-mono text-sm">{order.user?.userId || '-'}</div>
                        <div className="text-sm text-muted-foreground">@{order.user?.username || order.targetUsername}</div>
                      </div>
                    </TableCell>
                    <TableCell>{order.type === 'recharge' ? '充值' : '礼物'}</TableCell>
                    <TableCell>{paymentMap[order.paymentMethod] || order.paymentMethod}</TableCell>
                    <TableCell>{(order.amountUsdt || 0).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(order.status)}>{statusMap[order.status] || order.status}</Badge>
                    </TableCell>
                    <TableCell>{new Date(order.createdAt).toLocaleString('zh-CN')}</TableCell>
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
