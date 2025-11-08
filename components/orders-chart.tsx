"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

interface OrdersChartProps {
  data: Array<{ date: string; orders: number }>
}

export default function OrdersChart({ data }: OrdersChartProps) {
  // Placeholder data for display
  const chartData =
    data.length > 0
      ? data
      : [
          { date: "Mon", orders: 0 },
          { date: "Tue", orders: 0 },
          { date: "Wed", orders: 0 },
          { date: "Thu", orders: 0 },
          { date: "Fri", orders: 0 },
          { date: "Sat", orders: 0 },
          { date: "Sun", orders: 0 },
        ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Orders Overview</CardTitle>
        <CardDescription>Daily orders this week</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
              <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
