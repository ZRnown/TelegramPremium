"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { Edit2, Save, X } from "lucide-react"

interface Price {
  id: number
  plan_type: string
  duration_days: number
  months?: number
  price: number
  currency: string
  is_active: boolean
}

interface PricingTableProps {
  prices: Price[]
}

export default function PricingTable({ prices }: PricingTableProps) {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValues, setEditValues] = useState<Partial<Price>>({})
  const { toast } = useToast()

  const handleEdit = (price: Price) => {
    setEditingId(price.id)
    setEditValues(price)
  }

  const handleSave = async () => {
    try {
      // 计算月数（如果只有 duration_days，转换为 months）
      const months = editValues.months || Math.floor((editValues.duration_days || 0) / 30)
      
      const response = await fetch("/api/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          months,
          price: editValues.price,
        }),
      })

      if (response.ok) {
        toast({
          title: "成功",
          description: "价格已成功更新，机器人将在 5 分钟内自动同步",
        })
        setEditingId(null)
        // 刷新页面以显示最新数据
        window.location.reload()
      } else {
        const error = await response.json()
        throw new Error(error.error || '更新失败')
      }
    } catch (error) {
      toast({
        title: "错误",
        description: error.message || "更新价格失败",
        variant: "destructive",
      })
    }
  }

  const handleCancel = () => {
    setEditingId(null)
    setEditValues({})
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>方案类型</TableHead>
            <TableHead>时长</TableHead>
            <TableHead>价格</TableHead>
            <TableHead>货币</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {prices.map((price) => {
            const isEditing = editingId === price.id

            return (
              <TableRow key={price.id}>
                <TableCell className="font-medium">会员</TableCell>
                <TableCell>{price.months ? `${price.months} 个月` : `${price.duration_days} 天`}</TableCell>
                <TableCell>
                  {isEditing ? (
                    <Input
                      type="number"
                      step="0.01"
                      value={editValues.price}
                      onChange={(e) => setEditValues({ ...editValues, price: Number.parseFloat(e.target.value) })}
                      className="w-24"
                    />
                  ) : (
                    price.price.toFixed(2)
                  )}
                </TableCell>
                <TableCell>{price.currency}</TableCell>
                <TableCell className="text-right">
                  {isEditing ? (
                    <div className="flex justify-end gap-2">
                      <Button size="sm" onClick={handleSave}>
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleCancel}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => handleEdit(price)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
