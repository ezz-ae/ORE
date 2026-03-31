"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import type { UserAccessRecord } from "@/lib/ore"

interface AdminUserAccessPanelProps {
  users: UserAccessRecord[]
}

export function AdminUserAccessPanel({ users }: AdminUserAccessPanelProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const handleToggle = async (user: UserAccessRecord, enable: boolean) => {
    setLoadingId(user.id)
    try {
      const response = await fetch("/api/admin/users/ai-access", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, aiAccess: enable }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(error?.message || "Unable to update access")
      }

      toast({ title: `${user.name || user.email} ${enable ? "granted" : "revoked"} AI access` })
      router.refresh()
    } catch (error) {
      toast({ title: "Update failed", description: String(error), variant: "destructive" })
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="space-y-3">
      {users.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          No team members yet.
        </div>
      ) : (
        users.map((user) => (
          <div key={user.id} className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-background/60 px-4 py-3">
            <div>
              <div className="font-semibold">{user.name || "Unnamed user"}</div>
              <div className="text-xs text-muted-foreground">
                {user.email} · {user.role}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={Boolean(user.ai_access)}
                onCheckedChange={(checked) => handleToggle(user, Boolean(checked))}
                disabled={loadingId === user.id}
              />
              <span className="text-xs text-muted-foreground">
                AI Access
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
