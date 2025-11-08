"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface PriceHistory {
  id: string
  months: number
  oldPrice: number
  newPrice: number
  updatedAt: string | Date
}

interface PriceHistoryCardProps {
  history: PriceHistory[]
}

export default function PriceHistoryCard({ history }: PriceHistoryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>价格历史</CardTitle>
        <CardDescription>查看价格变更历史记录</CardDescription>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">暂无价格变更记录</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>时长</TableHead>
                  <TableHead>变更时间</TableHead>
                  <TableHead>原价格</TableHead>
                  <TableHead>新价格</TableHead>
                  <TableHead>变化</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((item) => {
                  const change = item.newPrice - item.oldPrice
                  const changePercent = ((change / item.oldPrice) * 100).toFixed(1)
                  return (
                    <TableRow key={item.id}>
                      <TableCell>{item.months} 个月</TableCell>
                      <TableCell>{new Date(item.updatedAt).toLocaleString('zh-CN')}</TableCell>
                      <TableCell>{item.oldPrice.toFixed(2)} USDT</TableCell>
                      <TableCell>{item.newPrice.toFixed(2)} USDT</TableCell>
                      <TableCell className={change >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {change >= 0 ? '+' : ''}{change.toFixed(2)} ({changePercent}%)
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
