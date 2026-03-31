"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { UploadCloud, Download } from "lucide-react"

export default function DashboardAddProjectPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editSlug = searchParams.get("slug")
  const [brochure, setBrochure] = useState<File | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [isLoadingProject, setIsLoadingProject] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [parseError, setParseError] = useState("")
  const [saveMessage, setSaveMessage] = useState("")
  const [form, setForm] = useState({
    name: "",
    slug: "",
    area: "",
    developer: "",
    status: "selling",
    priceFrom: "",
    priceTo: "",
    roi: "",
    paymentPlan: "",
    handoverDate: "",
    description: "",
    highlights: "",
    amenities: "",
    heroImage: "",
  })

  const handleChange = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }))
  }

  const slugify = (value: string) =>
    `gc-${value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "")}`

  useEffect(() => {
    if (!editSlug) return
    let cancelled = false

    const loadProject = async () => {
      setIsLoadingProject(true)
      setSaveMessage("")
      try {
        const response = await fetch(`/api/crm/projects/${encodeURIComponent(editSlug)}`)
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data?.error || "Failed to load project.")
        }
        if (cancelled) return
        const project = data.project
        setForm({
          name: project.name || "",
          slug: project.slug || "",
          area: project.area || "",
          developer: project.developer || "",
          status: project.status || "selling",
          priceFrom: project.priceFrom ? String(project.priceFrom) : "",
          priceTo: project.priceTo ? String(project.priceTo) : "",
          roi: project.roi ? String(project.roi) : "",
          paymentPlan: project.paymentPlan || "",
          handoverDate: project.handoverDate || "",
          description: project.description || "",
          highlights: Array.isArray(project.highlights) ? project.highlights.join("\n") : "",
          amenities: Array.isArray(project.amenities) ? project.amenities.join("\n") : "",
          heroImage: project.heroImage || "",
        })
      } catch (error: any) {
        if (!cancelled) {
          setSaveMessage(error?.message || "Failed to load project.")
        }
      } finally {
        if (!cancelled) {
          setIsLoadingProject(false)
        }
      }
    }

    loadProject()
    return () => {
      cancelled = true
    }
  }, [editSlug])

  const handleBrochureChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null
    setBrochure(file)
    if (!file) return

    setIsParsing(true)
    setParseError("")
    try {
      const formData = new FormData()
      formData.append("file", file)
      const response = await fetch("/api/dashboard/projects/parse-brochure", {
        method: "POST",
        body: formData,
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || "Failed to parse brochure.")
      }

      const extracted = data?.data || {}
      const derivedSlug =
        extracted.slug || (extracted.name ? slugify(extracted.name) : "")
      setForm((prev) => ({
        ...prev,
        name: extracted.name || prev.name,
        slug: derivedSlug || prev.slug,
        area: extracted.area || prev.area,
        developer: extracted.developer || prev.developer,
        status: prev.status || "selling",
        priceFrom: extracted.priceFrom ? String(extracted.priceFrom) : prev.priceFrom,
        priceTo: extracted.priceTo ? String(extracted.priceTo) : prev.priceTo,
        roi: extracted.roi ? String(extracted.roi) : prev.roi,
        paymentPlan: extracted.paymentPlan || prev.paymentPlan,
        handoverDate: extracted.handoverDate || prev.handoverDate,
        description: extracted.description || prev.description,
        highlights: Array.isArray(extracted.highlights)
          ? extracted.highlights.join("\n")
          : prev.highlights,
        amenities: Array.isArray(extracted.amenities)
          ? extracted.amenities.join("\n")
          : prev.amenities,
      }))
    } catch (error: any) {
      setParseError(error?.message || "Failed to parse brochure.")
    } finally {
      setIsParsing(false)
    }
  }

  const previewPayload = useMemo(() => {
    return {
      name: form.name,
      slug: form.slug,
      area: form.area,
      developer: form.developer,
      status: form.status,
      priceFrom: form.priceFrom ? Number(form.priceFrom) : null,
      priceTo: form.priceTo ? Number(form.priceTo) : null,
      expectedROI: form.roi ? Number(form.roi) : null,
      paymentPlan: form.paymentPlan,
      handoverDate: form.handoverDate,
      description: form.description,
      highlights: form.highlights
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
      amenities: form.amenities
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
      heroImage: form.heroImage || null,
    }
  }, [form])

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(previewPayload, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${form.slug || "project"}-draft.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleSaveProject = async () => {
    if (!form.name.trim() || !form.slug.trim()) {
      setSaveMessage("Project name and slug are required.")
      return
    }

    setIsSaving(true)
    setSaveMessage("")
    try {
      const response = await fetch("/api/crm/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(previewPayload),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || "Failed to save project.")
      }
      setSaveMessage(editSlug ? "Project updated in CRM." : "Project created in CRM.")
      router.replace(`/crm/projects/add?slug=${encodeURIComponent(data.project.slug)}`)
      router.refresh()
    } catch (error: any) {
      setSaveMessage(error?.message || "Failed to save project.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-8 pb-24">
      <section className="rounded-2xl border border-border bg-gradient-to-b from-background to-muted/70 p-6">
        <Badge className="mb-3 ore-gradient" variant="secondary">
          {editSlug ? "Edit Project" : "Add Project"}
        </Badge>
        <h1 className="font-serif text-3xl font-bold">
          {editSlug ? "Update Project Listing" : "AI-Assisted Project Intake"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Upload a brochure to start, then fill in any missing fields before saving directly to CRM.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Brochure Upload</CardTitle>
          <p className="text-xs text-muted-foreground">
            Upload a PDF to extract details and populate the form (manual review required).
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex min-h-[88px] cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground touch-manipulation">
            <UploadCloud className="h-5 w-5 text-primary" />
            <span>
              {brochure ? brochure.name : "Drop or select a PDF brochure"}
            </span>
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleBrochureChange}
            />
          </label>
          {brochure && (
            <div className="text-xs text-muted-foreground">
              File size: {(brochure.size / (1024 * 1024)).toFixed(2)} MB
              {isParsing ? " · Parsing brochure..." : ""}
            </div>
          )}
          {parseError && (
            <div className="text-xs text-destructive">{parseError}</div>
          )}
          {isLoadingProject && (
            <div className="text-xs text-muted-foreground">Loading project details...</div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
            <p className="text-xs text-muted-foreground">Complete the essentials below.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Input placeholder="Project Name" value={form.name} onChange={handleChange("name")} />
              <Input placeholder="Slug (gc-project-name)" value={form.slug} onChange={handleChange("slug")} />
              <Input placeholder="Area" value={form.area} onChange={handleChange("area")} />
              <Input placeholder="Developer" value={form.developer} onChange={handleChange("developer")} />
              <Input placeholder="Status" value={form.status} onChange={handleChange("status")} />
              <Input placeholder="Price From (AED)" value={form.priceFrom} onChange={handleChange("priceFrom")} />
              <Input placeholder="Price To (AED)" value={form.priceTo} onChange={handleChange("priceTo")} />
              <Input placeholder="Expected ROI (%)" value={form.roi} onChange={handleChange("roi")} />
              <Input placeholder="Handover Date (YYYY-MM)" value={form.handoverDate} onChange={handleChange("handoverDate")} />
            </div>
            <Input
              placeholder="Hero image URL"
              value={form.heroImage}
              onChange={handleChange("heroImage")}
            />
            <Textarea
              placeholder="Payment plan summary"
              value={form.paymentPlan}
              onChange={handleChange("paymentPlan")}
              className="min-h-[90px]"
            />
            <Textarea
              placeholder="Project description"
              value={form.description}
              onChange={handleChange("description")}
              className="min-h-[120px]"
            />
            <div className="grid gap-4 md:grid-cols-2">
              <Textarea
                placeholder="Highlights (one per line)"
                value={form.highlights}
                onChange={handleChange("highlights")}
                className="min-h-[120px]"
              />
              <Textarea
                placeholder="Amenities (one per line)"
                value={form.amenities}
                onChange={handleChange("amenities")}
                className="min-h-[120px]"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Draft Preview</CardTitle>
            <p className="text-xs text-muted-foreground">
              Download JSON to send to the data team for ingestion.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <pre className="max-h-[320px] overflow-auto rounded-lg border border-border bg-background/70 p-3 text-[11px] md:max-h-[420px] md:text-xs">
              {JSON.stringify(previewPayload, null, 2)}
            </pre>
            <div className="grid gap-2">
              <Button className="w-full ore-gradient" onClick={handleSaveProject} disabled={isSaving || isLoadingProject}>
                {isSaving ? "Saving..." : editSlug ? "Update Project in CRM" : "Create Project in CRM"}
              </Button>
              <Button className="w-full" variant="outline" onClick={downloadJson}>
                <Download className="mr-2 h-4 w-4" />
                Download Draft JSON
              </Button>
            </div>
            {saveMessage && (
              <div className={`text-xs ${saveMessage.toLowerCase().includes("failed") || saveMessage.toLowerCase().includes("required") ? "text-destructive" : "text-muted-foreground"}`}>
                {saveMessage}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="sticky bottom-4 z-20 rounded-2xl border border-border/70 bg-background/95 p-3 shadow-xl backdrop-blur lg:hidden">
        <div className="grid gap-2">
          <Button className="w-full ore-gradient" onClick={handleSaveProject} disabled={isSaving || isLoadingProject}>
            {isSaving ? "Saving..." : editSlug ? "Update Project in CRM" : "Create Project in CRM"}
          </Button>
          <Button className="w-full" variant="outline" onClick={downloadJson}>
            <Download className="mr-2 h-4 w-4" />
            Download Draft JSON
          </Button>
        </div>
      </div>
    </div>
  )
}
