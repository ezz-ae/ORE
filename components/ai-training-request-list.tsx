"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import type { AiTrainingRequest } from "@/lib/ai-training"

interface AiTrainingRequestListProps {
  requests: AiTrainingRequest[]
}

export function AiTrainingRequestList({ requests }: AiTrainingRequestListProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const handleMarkTrained = async (id: string) => {
    setLoadingId(id)
    try {
      const response = await fetch("/api/ai-training", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(error?.message || "Unable to mark trained")
      }

      toast({ title: "Marked as trained" })
      router.refresh()
    } catch (error) {
      toast({ title: "Update failed", description: String(error), variant: "destructive" })
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="space-y-3">
      {requests.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          No AI training requests yet.
        </div>
      ) : (
        requests.map((request) => (
          <div
            key={request.id}
            className="space-y-2 rounded-2xl border border-border/80 bg-background/60 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-semibold">
                  {request.project_name || request.project_slug || "Custom training"}
                </div>
                <div className="text-xs text-muted-foreground">
                  Logged {new Date(request.created_at).toLocaleDateString()} by {request.created_by || "Broker"}
                </div>
              </div>
              <Badge
                variant={request.status === "trained" ? "secondary" : "destructive"}
                className="uppercase text-[11px] tracking-widest"
              >
                {request.status}
              </Badge>
            </div>
            {request.notes && (
              <p className="text-sm text-muted-foreground line-clamp-3">{request.notes}</p>
            )}
            {request.tags && request.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {request.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
            {request.status === "pending" && (
              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs font-semibold tracking-widest"
                onClick={() => handleMarkTrained(request.id)}
                disabled={loadingId === request.id}
              >
                {loadingId === request.id ? "Updating…" : "Mark as Trained"}
              </Button>
            )}
          </div>
        ))
      )}
    </div>
  )
}
