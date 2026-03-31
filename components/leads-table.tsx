"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { LeadRecord } from "@/lib/entrestate"

interface LeadsTableProps {
  leads: LeadRecord[]
  isAdmin: boolean
  teamMembers?: Array<{
    id: string
    name: string
    email: string
    title?: string | null
  }>
}

const statusOptions = ["new", "contacted", "qualified", "viewing", "negotiating", "closed", "lost"]

export function LeadsTable({ leads, isAdmin, teamMembers = [] }: LeadsTableProps) {
  const router = useRouter()
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [statusDrafts, setStatusDrafts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")

  const formatDate = (value?: string | null) => {
    if (!value) return "—"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "—"
    return date.toLocaleDateString()
  }

  const statusClass = (status?: string | null) => {
    switch (status) {
      case "new":
        return "border-blue-500/30 bg-blue-500/10 text-blue-500"
      case "contacted":
        return "border-amber-500/30 bg-amber-500/10 text-amber-500"
      case "qualified":
        return "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
      case "viewing":
        return "border-violet-500/30 bg-violet-500/10 text-violet-500"
      case "negotiating":
        return "border-orange-500/30 bg-orange-500/10 text-orange-500"
      case "closed":
        return "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
      case "lost":
        return "border-rose-500/30 bg-rose-500/10 text-rose-500"
      default:
        return "border-muted-foreground/30 bg-muted/40 text-muted-foreground"
    }
  }

  const priorityClass = (priority?: string | null) => {
    switch (priority) {
      case "hot":
        return "border-rose-500/30 bg-rose-500/10 text-rose-500"
      case "warm":
        return "border-amber-500/30 bg-amber-500/10 text-amber-500"
      default:
        return "border-muted-foreground/30 bg-muted/40 text-muted-foreground"
    }
  }

  const handleAssign = async (lead: LeadRecord) => {
    const brokerId = assignments[lead.id] ?? lead.assigned_broker_id ?? ""
    if (!brokerId) return

    setLoading(`assign:${lead.id}`)
    try {
      const response = await fetch("/api/leads/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id, brokerId }),
      })
      if (!response.ok) {
        throw new Error("Failed to save assignment.")
      }
      router.refresh()
    } finally {
      setLoading(null)
    }
  }

  const handleStatusUpdate = async (lead: LeadRecord) => {
    const nextStatus = statusDrafts[lead.id] ?? lead.status ?? "new"
    if (nextStatus === (lead.status || "new")) return

    setLoading(`status:${lead.id}`)
    try {
      const response = await fetch("/api/leads/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          status: nextStatus,
          markContacted: nextStatus !== "new",
          activityType: "status_update",
        }),
      })
      if (!response.ok) {
        throw new Error("Failed to update lead status.")
      }
      router.refresh()
    } finally {
      setLoading(null)
    }
  }

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const search = query.trim().toLowerCase()
      const matchesQuery =
        !search ||
        lead.name.toLowerCase().includes(search) ||
        String(lead.phone || "").toLowerCase().includes(search) ||
        String(lead.email || "").toLowerCase().includes(search) ||
        String(lead.project_slug || "").toLowerCase().includes(search)
      const matchesStatus = statusFilter === "all" || (lead.status || "new") === statusFilter
      const matchesPriority = priorityFilter === "all" || (lead.priority || "cold") === priorityFilter
      return matchesQuery && matchesStatus && matchesPriority
    })
  }, [leads, priorityFilter, query, statusFilter])

  if (leads.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
        No leads yet.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm md:grid-cols-[1.2fr,0.4fr,0.4fr]">
        <Input
          placeholder="Search by name, phone, email, or project..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full"
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="all">All statuses</option>
          {statusOptions.map((option) => (
            <option key={option} value={option}>
              {option.charAt(0).toUpperCase() + option.slice(1)}
            </option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(event) => setPriorityFilter(event.target.value)}
          className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="all">All priority</option>
          <option value="hot">Hot</option>
          <option value="warm">Warm</option>
          <option value="cold">Cold</option>
        </select>
      </div>

      <div className="grid gap-3 md:hidden">
        {filteredLeads.map((lead) => (
          <div key={lead.id} className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{lead.name}</div>
                <div className="text-xs text-muted-foreground">{lead.email || "No email"}</div>
              </div>
              <Badge
                variant="outline"
                className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-tight", priorityClass(lead.priority))}
              >
                {lead.priority || "cold"}
              </Badge>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-muted-foreground">Phone</div>
                <div className="font-medium">{lead.phone || "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Project</div>
                <div className="font-medium">{lead.project_slug || "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Status</div>
                <div className="font-medium capitalize">{lead.status || "new"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Source</div>
                <div className="font-medium">{lead.source || "Web"}</div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <select
                value={statusDrafts[lead.id] ?? (lead.status || "new")}
                onChange={(event) => setStatusDrafts((prev) => ({ ...prev, [lead.id]: event.target.value }))}
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
              >
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </option>
                ))}
              </select>

              {isAdmin ? (
                <select
                  value={assignments[lead.id] ?? lead.assigned_broker_id ?? ""}
                  onChange={(event) => setAssignments((prev) => ({ ...prev, [lead.id]: event.target.value }))}
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                >
                  <option value="">Assign to broker or manager</option>
                  {teamMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} {member.title ? `· ${member.title}` : ""}
                    </option>
                  ))}
                </select>
              ) : null}

              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="flex-1" asChild>
                  <Link href={`/crm/leads/${lead.id}`}>Open Lead</Link>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={loading === `status:${lead.id}`}
                  onClick={() => handleStatusUpdate(lead)}
                >
                  {loading === `status:${lead.id}` ? "Saving..." : "Save Status"}
                </Button>
              </div>

              {isAdmin ? (
                <Button
                  size="sm"
                  className="w-full ore-gradient"
                  disabled={loading === `assign:${lead.id}` || !(assignments[lead.id] ?? lead.assigned_broker_id)}
                  onClick={() => handleAssign(lead)}
                >
                  {loading === `assign:${lead.id}` ? "Saving..." : "Save Assignment"}
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm md:block">
        <div className="overflow-x-auto overscroll-x-contain">
          <div className="grid min-w-[1220px] grid-cols-10 gap-4 border-b border-border/60 bg-muted/30 px-6 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
            <div className="col-span-2">Lead Information</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-1">Priority</div>
            <div className="col-span-1 text-center">Project</div>
            <div className="col-span-1 text-center">Source</div>
            <div className="col-span-1 text-center">Assigned</div>
            <div className="col-span-1 text-right">Activity</div>
            <div className="col-span-2 text-right">Management</div>
          </div>

          {filteredLeads.map((lead) => (
            <div
              key={lead.id}
              className="grid min-w-[1220px] grid-cols-10 gap-4 border-b border-border/40 px-6 py-5 text-sm transition-colors last:border-b-0 hover:bg-muted/10"
            >
              <div className="col-span-2">
                <div className="font-serif text-base font-bold text-foreground">{lead.name}</div>
                <div className="mt-0.5 text-[10px] font-medium text-muted-foreground">{lead.email || "No email"}</div>
              </div>

              <div className="col-span-1">
                <Badge
                  variant="outline"
                  className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-tight", statusClass(lead.status))}
                >
                  {lead.status || "new"}
                </Badge>
              </div>

              <div className="col-span-1">
                <Badge
                  variant="outline"
                  className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-tight", priorityClass(lead.priority))}
                >
                  {lead.priority || "cold"}
                </Badge>
              </div>

              <div className="col-span-1 truncate text-center text-xs font-medium" title={lead.project_slug || ""}>
                {lead.project_slug || "—"}
              </div>

              <div className="col-span-1 text-center text-xs text-muted-foreground">
                {lead.source || "Web"}
              </div>

              <div className="col-span-1">
                <select
                  value={assignments[lead.id] ?? lead.assigned_broker_id ?? ""}
                  onChange={(event) => setAssignments((prev) => ({ ...prev, [lead.id]: event.target.value }))}
                  className="h-8 w-full rounded-md border border-border bg-background px-2 text-[10px] font-medium"
                  disabled={!isAdmin}
                >
                  <option value="">{isAdmin ? "Unassigned" : "Open"}</option>
                  {teamMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-1 whitespace-nowrap text-right text-xs text-muted-foreground">
                {formatDate(lead.last_contact_at || lead.created_at)}
              </div>

              <div className="col-span-2 flex items-center justify-end gap-2">
                <select
                  value={statusDrafts[lead.id] ?? (lead.status || "new")}
                  onChange={(event) => setStatusDrafts((prev) => ({ ...prev, [lead.id]: event.target.value }))}
                  className="h-8 rounded-md border border-border bg-background px-2 text-[10px] font-medium"
                >
                  {statusOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>

                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-[10px] font-bold uppercase tracking-wider"
                  disabled={loading === `status:${lead.id}`}
                  onClick={() => handleStatusUpdate(lead)}
                >
                  {loading === `status:${lead.id}` ? "Saving..." : "Update"}
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-[10px] font-bold uppercase tracking-wider hover:bg-primary/5 hover:text-primary"
                  asChild
                >
                  <Link href={`/crm/leads/${lead.id}`}>View Details</Link>
                </Button>

                {isAdmin ? (
                  <Button
                    size="sm"
                    className="h-8 ore-gradient px-3 text-[10px] font-bold shadow-sm"
                    disabled={loading === `assign:${lead.id}` || !(assignments[lead.id] ?? lead.assigned_broker_id)}
                    onClick={() => handleAssign(lead)}
                  >
                    {loading === `assign:${lead.id}` ? "Saving..." : "Assign"}
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      {filteredLeads.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
          No leads match the current filters.
        </div>
      ) : null}
    </div>
  )
}
