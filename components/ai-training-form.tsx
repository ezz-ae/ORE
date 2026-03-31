"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"

export type TrainingProject = {
  slug: string
  name: string
  area?: string | null
}

interface AiTrainingFormProps {
  projects: TrainingProject[]
}

export function AiTrainingForm({ projects }: AiTrainingFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [projectSlug, setProjectSlug] = useState(projects[0]?.slug || "")
  const [customProject, setCustomProject] = useState("")
  const [notes, setNotes] = useState("")
  const [tags, setTags] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const selectedProject = projects.find((project) => project.slug === projectSlug)
  const projectName = customProject.trim() || selectedProject?.name || ""

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!notes.trim()) {
      toast({ title: "Notes are required", variant: "destructive" })
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/ai-training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectSlug: projectSlug || null,
          projectName: projectName || null,
          notes: notes.trim(),
          tags: tags.trim(),
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(error?.message || "Unable to submit training request")
      }

      setNotes("")
      setTags("")
      setIsSubmitting(false)
      toast({ title: "Training request submitted", variant: "default" })
      router.refresh()
    } catch (error) {
      setIsSubmitting(false)
      toast({ title: "Failed to submit", description: String(error), variant: "destructive" })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="ai-project">Project</Label>
        <select
          id="ai-project"
          className="w-full rounded-2xl border border-border bg-background/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/70"
          value={projectSlug}
          onChange={(event) => setProjectSlug(event.target.value)}
        >
          <option value="">Select project</option>
          {projects.map((project) => (
            <option key={project.slug} value={project.slug}>
              {project.name} {project.area ? `· ${project.area}` : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="custom-project">Custom project name</Label>
        <Input
          id="custom-project"
          placeholder="Enter project or topic name"
          value={customProject}
          onChange={(event) => setCustomProject(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="training-notes">Training notes</Label>
        <Textarea
          id="training-notes"
          placeholder="Share copy, highlights, market nuance, or what the AI should learn."
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="min-h-[120px]"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="training-tags">Tags</Label>
        <Input
          id="training-tags"
          placeholder="comma-separated, e.g. luxury, marina, high yield"
          value={tags}
          onChange={(event) => setTags(event.target.value)}
        />
      </div>

      <Button type="submit" className="w-full ore-gradient" disabled={isSubmitting}>
        {isSubmitting ? "Submitting…" : "Log Training Asset"}
      </Button>
    </form>
  )
}
