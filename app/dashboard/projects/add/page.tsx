"use client"

import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { UploadCloud, Download } from "lucide-react"

export default function DashboardAddProjectPage() {
  const [brochure, setBrochure] = useState<File | null>(null)
  const [form, setForm] = useState({
    name: "",
    slug: "",
    area: "",
    developer: "",
    priceFrom: "",
    priceTo: "",
    roi: "",
    paymentPlan: "",
    handoverDate: "",
    description: "",
    highlights: "",
    amenities: "",
  })

  const handleChange = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }))
  }

  const previewPayload = useMemo(() => {
    return {
      name: form.name,
      slug: form.slug,
      area: form.area,
      developer: form.developer,
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

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border bg-gradient-to-b from-background to-muted/70 p-6">
        <Badge className="mb-3 ore-gradient" variant="secondary">
          Add Project
        </Badge>
        <h1 className="font-serif text-3xl font-bold">AI-Assisted Project Intake</h1>
        <p className="text-sm text-muted-foreground">
          Upload a brochure to start, then fill in any missing fields before publishing.
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
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            <UploadCloud className="h-5 w-5 text-primary" />
            <span>{brochure ? brochure.name : "Drop or select a PDF brochure"}</span>
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(event) => setBrochure(event.target.files?.[0] || null)}
            />
          </label>
          {brochure && (
            <div className="text-xs text-muted-foreground">
              File size: {(brochure.size / (1024 * 1024)).toFixed(2)} MB
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
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
              <Input placeholder="Price From (AED)" value={form.priceFrom} onChange={handleChange("priceFrom")} />
              <Input placeholder="Price To (AED)" value={form.priceTo} onChange={handleChange("priceTo")} />
              <Input placeholder="Expected ROI (%)" value={form.roi} onChange={handleChange("roi")} />
              <Input placeholder="Handover Date (YYYY-MM)" value={form.handoverDate} onChange={handleChange("handoverDate")} />
            </div>
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
            <pre className="max-h-[420px] overflow-auto rounded-lg border border-border bg-background/70 p-3 text-xs">
              {JSON.stringify(previewPayload, null, 2)}
            </pre>
            <Button className="w-full ore-gradient" onClick={downloadJson}>
              <Download className="mr-2 h-4 w-4" />
              Download Draft JSON
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
