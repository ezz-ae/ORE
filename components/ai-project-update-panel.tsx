"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import type { AiProjectUpdateRecord } from "@/lib/ai-project-updates"

const CUSTOM_PROJECT_VALUE = "__custom_project__"

export type ProjectOption = {
  slug: string
  name: string
  area?: string | null
}

interface AiProjectUpdatePanelProps {
  projects: ProjectOption[]
  updates: AiProjectUpdateRecord[]
}

export function AiProjectUpdatePanel({ projects, updates }: AiProjectUpdatePanelProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [projectSlug, setProjectSlug] = useState(projects[0]?.slug || CUSTOM_PROJECT_VALUE)
  const [customProject, setCustomProject] = useState("")
  const [updateType, setUpdateType] = useState("status")
  const [targetStatus, setTargetStatus] = useState("expired")
  const [notes, setNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const projectName =
    customProject.trim() ||
    (projectSlug === CUSTOM_PROJECT_VALUE ? "" : projects.find((project) => project.slug === projectSlug)?.name || "")
  const resolvedProjectSlug = projectSlug === CUSTOM_PROJECT_VALUE ? "" : projectSlug

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!resolvedProjectSlug && !projectName) {
      toast({ title: "Select or name a project" , variant: "destructive"})
      return
    }
    if (!notes.trim()) {
      toast({ title: "Notes are required", variant: "destructive" })
      return
    }
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/admin/projects/ai-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectSlug: resolvedProjectSlug || projectName,
          projectName,
          updateType,
          targetStatus: targetStatus || null,
          notes: notes.trim(),
        }),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(error?.message || "Unable to log update")
      }
      toast({ title: "Update logged for Gemini" })
      setNotes("")
      setIsSubmitting(false)
      router.refresh()
    } catch (error) {
      setIsSubmitting(false)
      toast({ title: "Failed to log update", description: String(error), variant: "destructive" })
    }
  }

  return (
    <div className="space-y-10">
      <Card className="rounded-[2rem] border-border shadow-md overflow-hidden bg-card/50 backdrop-blur-sm">
        <CardHeader className="p-8 border-b border-border/50 bg-muted/20">
          <div className="space-y-1">
            <CardTitle className="font-serif text-2xl font-bold">Project Intelligence Patch</CardTitle>
            <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
              Hotfix model data for specific developments
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-8">
          <form className="grid gap-8" onSubmit={handleSubmit}>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="project-select" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Project Authority</Label>
                <Select value={projectSlug} onValueChange={(value) => setProjectSlug(value)}>
                  <SelectTrigger className="h-12 rounded-xl bg-muted/30 border-border">
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CUSTOM_PROJECT_VALUE}>None (custom)</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.slug} value={project.slug}>
                        {project.name} {project.area ? `· ${project.area}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="custom-project" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Custom Identifier</Label>
                <Input
                  id="custom-project"
                  placeholder="New development name"
                  value={customProject}
                  onChange={(event) => setCustomProject(event.target.value)}
                  className="h-12 rounded-xl bg-muted/30 border-border"
                />
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="update-type" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Update Protocol</Label>
                <Select value={updateType} onValueChange={(value) => setUpdateType(value)}>
                  <SelectTrigger className="h-12 rounded-xl bg-muted/30 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expired">Mark Expired</SelectItem>
                    <SelectItem value="status">Change Status</SelectItem>
                    <SelectItem value="update">Update Details</SelectItem>
                    <SelectItem value="new">Add New Project</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="target-status" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">New Lifecycle Status</Label>
                <Input
                  id="target-status"
                  value={targetStatus}
                  onChange={(event) => setTargetStatus(event.target.value)}
                  placeholder="e.g. selling, completed"
                  className="h-12 rounded-xl bg-muted/30 border-border"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="update-notes" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Intelligence Briefing</Label>
              <Textarea
                id="update-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Share the precise data that Gemini should present to users."
                className="min-h-[140px] rounded-2xl bg-muted/30 border-border p-4 shadow-inner"
              />
            </div>

            <Button type="submit" className="ore-gradient h-12 rounded-xl font-bold shadow-lg shadow-primary/20" disabled={isSubmitting}>
              {isSubmitting ? "Deploying Intelligence…" : "Patch Gemini Knowledge"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <h4 className="font-serif text-lg font-bold px-2">Deployed Intelligence Patches</h4>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {updates.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground bg-muted/10 col-span-full">
              No intelligence patches deployed yet.
            </div>
          ) : (
            updates.map((update) => (
              <div key={update.id} className="rounded-[1.5rem] border border-border/60 bg-card p-5 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-3 mb-3">
                  <div className="min-w-0">
                    <div className="font-serif text-base font-bold truncate">
                      {update.project_name || update.project_slug}
                    </div>
                    <div className="text-[9px] uppercase font-bold tracking-tighter text-muted-foreground">
                      {update.update_type} protocol
                    </div>
                  </div>
                  <Badge variant="outline" className="rounded-full text-[9px] h-5 bg-muted/50 border-border/60">{update.target_status ?? "active"}</Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed italic">
                  &ldquo;{update.notes}&rdquo;
                </p>
                <div className="mt-3 text-[9px] text-muted-foreground/60 font-medium text-right">
                  Deployed {new Date(update.created_at).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
