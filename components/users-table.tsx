"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

interface User {
  id: string
  userId: string
  username?: string | null
  firstName?: string | null
  lastName?: string | null
  balance: number
  createdAt: string
  lastActiveAt: string
}

interface UsersTableProps {
  users: User[]
}

export default function UsersTable({ users }: UsersTableProps) {
  const [search, setSearch] = useState("")

  const filteredUsers = users.filter((user) => {
    const s = search.toLowerCase()
    return (
      (user.username || '').toLowerCase().includes(s) ||
      user.userId.includes(search) ||
      (user.firstName || '').toLowerCase().includes(s)
    )
  })

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="搜索用户..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>用户</TableHead>
              <TableHead>Telegram ID</TableHead>
              <TableHead>余额（USDT）</TableHead>
              <TableHead>最近活跃</TableHead>
              <TableHead>加入时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  未找到用户
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {(user.firstName || '') + ' ' + (user.lastName || '')}
                      </div>
                      {user.username && <div className="text-sm text-muted-foreground">@{user.username}</div>}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono">{user.userId}</TableCell>
                  <TableCell>{user.balance?.toFixed(2)}</TableCell>
                  <TableCell>{new Date(user.lastActiveAt).toLocaleString('zh-CN')}</TableCell>
                  <TableCell>{new Date(user.createdAt).toLocaleDateString('zh-CN')}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
