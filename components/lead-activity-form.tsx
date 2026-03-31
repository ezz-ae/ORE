"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

const statusOptions = [
  "new",
  "contacted",
  "qualified",
  "viewing",
  "negotiating",
  "closed",
  "lost",
]

export function LeadActivityForm({ leadId }: { leadId: string }) {
  const [note, setNote] = useState("")
  const [status, setStatus] = useState("contacted")
  const [markContacted, setMarkContacted] = useState(true)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setMessage("")
    try {
      const response = await fetch("/api/leads/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          status,
          note: note.trim() || null,
          markContacted,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || "Failed to save update.")
      }
      setNote("")
      setMessage("Update saved.")
      window.location.reload()
    } catch (error: any) {
      setMessage(error?.message || "Failed to save update.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <div className="grid gap-3 md:grid-cols-[160px,1fr]">
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
        >
          {statusOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <Textarea
          placeholder="Add a note about this lead..."
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className="min-h-[90px]"
        />
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={markContacted}
          onChange={(event) => setMarkContacted(event.target.checked)}
        />
        Update last contact timestamp
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" className="ore-gradient" disabled={loading}>
          {loading ? "Saving..." : "Save Update"}
        </Button>
        {message && (
          <span className="text-xs text-muted-foreground">{message}</span>
        )}
      </div>
    </form>
  )
}
