"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { UserAccessRecord } from "@/lib/entrestate"

interface TeamAccountsPanelProps {
  users: UserAccessRecord[]
  currentUserId?: string
  canDeleteUsers?: boolean
}

export function TeamAccountsPanel({ users, currentUserId, canDeleteUsers = false }: TeamAccountsPanelProps) {
  const router = useRouter()
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "Broker",
    phone: "",
    password: "",
  })
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [message, setMessage] = useState("")

  const handleChange =
    (key: keyof typeof form) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [key]: event.target.value }))
    }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setStatus("saving")
    setMessage("")
    try {
      const response = await fetch("/api/dashboard/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || "Failed to create account.")
      }
      setStatus("saved")
      setMessage(`Account ready for ${data.profile.email}.`)
      setForm({
        name: "",
        email: "",
        role: "Broker",
        phone: "",
        password: "",
      })
      router.refresh()
    } catch (error: any) {
      setStatus("error")
      setMessage(error?.message || "Failed to create account.")
    }
  }

  const handleDelete = async (user: UserAccessRecord) => {
    if (!canDeleteUsers) return
    setDeletingId(user.id)
    setMessage("")
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || "Failed to delete account.")
      }
      setMessage(`Deleted ${user.email}.`)
      router.refresh()
    } catch (error: any) {
      setMessage(error?.message || "Failed to delete account.")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Accounts</CardTitle>
        <p className="text-xs text-muted-foreground">
          Create access for brokers, managers, and office staff.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <form className="grid gap-3 md:grid-cols-2" onSubmit={handleSubmit}>
          <Input placeholder="Full name" value={form.name} onChange={handleChange("name")} required />
          <Input placeholder="Email" type="email" value={form.email} onChange={handleChange("email")} required />
          <select
            value={form.role}
            onChange={handleChange("role")}
            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="CEO">CEO</option>
            <option value="General Manager">General Manager</option>
            <option value="Admin">Admin</option>
            <option value="Sales Manager">Sales Manager</option>
            <option value="Broker">Broker</option>
          </select>
          <Input placeholder="Phone" value={form.phone} onChange={handleChange("phone")} />
          <Input
            className="md:col-span-2"
            placeholder="Temporary password"
            type="password"
            value={form.password}
            onChange={handleChange("password")}
            required
          />
          <div className="md:col-span-2 flex items-center gap-3">
            <Button type="submit" className="ore-gradient" disabled={status === "saving"}>
              {status === "saving" ? "Creating..." : "Create Account"}
            </Button>
            {message ? (
              <span className={`text-xs ${status === "error" ? "text-destructive" : "text-muted-foreground"}`}>
                {message}
              </span>
            ) : null}
          </div>
        </form>

        <div className="space-y-3">
          {users.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              No CRM accounts yet.
            </div>
          ) : (
            users.map((user) => (
              <div key={user.id} className="rounded-xl border border-border/60 bg-background/60 px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="font-medium">{user.name || "Unnamed user"}</div>
                    <div className="text-xs text-muted-foreground">
                      {user.email} · {user.org_title || user.role}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Last login: {user.last_login_at ? new Date(user.last_login_at).toLocaleString() : "Never"}
                    </div>
                  </div>
                  {canDeleteUsers && user.id !== currentUserId ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={deletingId === user.id}
                      onClick={() => handleDelete(user)}
                    >
                      {deletingId === user.id ? "Deleting..." : "Delete User"}
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
