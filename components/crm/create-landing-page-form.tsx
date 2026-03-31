"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type ProjectOption = {
  slug: string
  name: string
  area: string
}

interface CreateLandingPageFormProps {
  projects: ProjectOption[]
}

export function CreateLandingPageForm({ projects }: CreateLandingPageFormProps) {
  const params = useSearchParams()
  const router = useRouter()
  const preselectedProject = params.get("projectSlug") || ""

  const [projectSlug, setProjectSlug] = useState(preselectedProject || projects[0]?.slug || "")
  const [campaignName, setCampaignName] = useState("Campaign")
  const [customSlug, setCustomSlug] = useState("")
  const [headline, setHeadline] = useState("")
  const [status, setStatus] = useState("draft")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<{ slug: string; url: string } | null>(null)
  const [error, setError] = useState("")

  const selectedProject = useMemo(
    () => projects.find((project) => project.slug === projectSlug) || null,
    [projects, projectSlug],
  )

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    setResult(null)
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/crm/landing-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectSlug,
          campaignName,
          slug: customSlug,
          headline,
          status,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || "Failed to create landing page")
      }
      setResult({ slug: data.slug, url: data.url })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to create landing page")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 pb-12">
      <Card>
        <CardHeader>
          <CardTitle>Create Campaign Landing Page</CardTitle>
          <p className="text-sm text-muted-foreground">
            New pages now inherit a smarter structure from the listing: AI market read, positioning blocks, and AI concierge prompts.
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="projectSlug">Project (from inventory)</Label>
              <select
                id="projectSlug"
                value={projectSlug}
                onChange={(event) => setProjectSlug(event.target.value)}
                className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm touch-manipulation"
                required
              >
                {projects.map((project) => (
                  <option key={project.slug} value={project.slug}>
                    {project.name} · {project.area}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="campaignName">Campaign Name</Label>
                <Input
                  id="campaignName"
                  value={campaignName}
                  onChange={(event) => setCampaignName(event.target.value)}
                  placeholder="e.g. Ramadan Push"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customSlug">Custom LP Slug (optional)</Label>
                <Input
                  id="customSlug"
                  value={customSlug}
                  onChange={(event) => setCustomSlug(event.target.value)}
                  placeholder="e.g. avarra-ramadan-2026"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="headline">Headline (optional)</Label>
                <Input
                  id="headline"
                  value={headline}
                  onChange={(event) => setHeadline(event.target.value)}
                  placeholder={selectedProject ? `${selectedProject.name} | Campaign` : "Campaign headline"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Initial Status</Label>
                <select
                  id="status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="submit" className="ore-gradient sm:min-w-[220px]" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Landing Page"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push("/crm/inventory")}>
                Back to Inventory
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {result && (
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <p className="text-sm text-emerald-700">Landing page created: <strong>/lp/{result.slug}</strong></p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" asChild>
                <a href={result.url} target="_blank" rel="noreferrer">Open LP</a>
              </Button>
              <Button size="sm" asChild>
                <Link href="/crm/landing-pages">Open CRM LP List</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
