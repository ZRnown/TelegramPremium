"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { LayoutDashboard, Users, ShoppingCart, DollarSign, Settings, BarChart3 } from "lucide-react"

const navigation = [
  { name: "总览", href: "/dashboard", icon: LayoutDashboard },
  { name: "用户管理", href: "/dashboard/users", icon: Users },
  { name: "订单管理", href: "/dashboard/orders", icon: ShoppingCart },
  { name: "价格管理", href: "/dashboard/pricing", icon: DollarSign },
  { name: "数据统计", href: "/dashboard/statistics", icon: BarChart3 },
  { name: "系统配置", href: "/dashboard/config", icon: Settings },
]

export default function DashboardSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 border-r bg-card">
      <div className="flex h-16 items-center border-b px-6">
        <h1 className="text-xl font-bold">Telegram Premium Bot</h1>
      </div>
      <nav className="space-y-1 p-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
