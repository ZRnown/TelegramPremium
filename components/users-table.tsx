"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

interface User {
  id: number
  telegram_id: string
  username?: string
  first_name?: string
  last_name?: string
  is_premium: boolean
  premium_expires_at?: string
  created_at: string
}

interface UsersTableProps {
  users: User[]
}

export default function UsersTable({ users }: UsersTableProps) {
  const [search, setSearch] = useState("")

  const filteredUsers = users.filter(
    (user) =>
      user.username?.toLowerCase().includes(search.toLowerCase()) ||
      user.telegram_id.includes(search) ||
      user.first_name?.toLowerCase().includes(search.toLowerCase()),
  )

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
              <TableHead>状态</TableHead>
              <TableHead>到期时间</TableHead>
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
                        {user.first_name} {user.last_name}
                      </div>
                      {user.username && <div className="text-sm text-muted-foreground">@{user.username}</div>}
                    </div>
                  </TableCell>
                  <TableCell>{user.telegram_id}</TableCell>
                  <TableCell>
                    <Badge variant={user.is_premium ? "default" : "secondary"}>
                      {user.is_premium ? "会员" : "免费"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.premium_expires_at ? new Date(user.premium_expires_at).toLocaleDateString('zh-CN') : "-"}
                  </TableCell>
                  <TableCell>{new Date(user.created_at).toLocaleDateString('zh-CN')}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
