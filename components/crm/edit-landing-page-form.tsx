"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Sparkles, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { LandingPageEditorData } from "@/lib/landing-pages"

export function EditLandingPageForm({ landingPage }: { landingPage: LandingPageEditorData }) {
  const router = useRouter()
  const [form, setForm] = useState(landingPage)
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [message, setMessage] = useState("")
  const [aiAudience, setAiAudience] = useState<"investor" | "luxury" | "end_user" | "generic">("investor")
  const [aiStatus, setAiStatus] = useState<"idle" | "generating" | "done" | "error">("idle")
  const [aiMessage, setAiMessage] = useState("")

  const handleAiGenerate = async () => {
    if (!form.projectSlug) {
      setAiMessage("No project slug — cannot generate.")
      setAiStatus("error")
      return
    }
    setAiStatus("generating")
    setAiMessage("")
    try {
      const res = await fetch("/api/crm/landing-pages/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectSlug: form.projectSlug,
          audience: aiAudience,
          slug: form.slug,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Generation failed")
      if (data.headline) setForm((f) => ({ ...f, headline: data.headline, subheadline: data.subheadline || f.subheadline, ctaText: data.ctaText || f.ctaText }))
      setAiStatus("done")
      setAiMessage(`AI generated ${data.sections?.length || 0} sections for "${aiAudience}" audience. Headline updated. Save to confirm.`)
      router.refresh()
    } catch (err) {
      setAiStatus("error")
      setAiMessage(err instanceof Error ? err.message : "Generation failed.")
    }
  }

  const handleChange =
    (key: keyof LandingPageEditorData) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((current) => ({ ...current, [key]: event.target.value }))
    }

  const handleSave = async () => {
    setStatus("saving")
    setMessage("")
    try {
      const response = await fetch(`/api/crm/landing-pages/${encodeURIComponent(form.slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headline: form.headline,
          subheadline: form.subheadline,
          heroImage: form.heroImage,
          ctaText: form.ctaText,
          status: form.status,
          publishFrom: form.publishFrom,
          publishTo: form.publishTo,
          seoTitle: form.seoTitle,
          seoDescription: form.seoDescription,
          ogImage: form.ogImage,
          metaPixelId: form.metaPixelId,
          googleTagId: form.googleTagId,
          googleConversionId: form.googleConversionId,
          tiktokPixelId: form.tiktokPixelId,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || "Failed to save landing page.")
      }

      setForm(data.landingPage)
      setStatus("saved")
      setMessage("Landing page updated.")
      router.refresh()
    } catch (error) {
      setStatus("error")
      setMessage(error instanceof Error ? error.message : "Failed to save landing page.")
    }
  }

  return (
    <div className="space-y-6 pb-16">
      <Card>
        <CardHeader>
          <CardTitle>Campaign Settings</CardTitle>
          <p className="text-sm text-muted-foreground">
            Update publishing status, schedule, headline, and tracking without recreating the page.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lp-headline">Headline</Label>
              <Input id="lp-headline" value={form.headline} onChange={handleChange("headline")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lp-cta">CTA Text</Label>
              <Input id="lp-cta" value={form.ctaText} onChange={handleChange("ctaText")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lp-subheadline">Subheadline</Label>
            <Textarea
              id="lp-subheadline"
              value={form.subheadline}
              onChange={handleChange("subheadline")}
              className="min-h-[110px]"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lp-status">Status</Label>
              <select
                id="lp-status"
                value={form.status}
                onChange={handleChange("status")}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lp-project">Project</Label>
              <Input id="lp-project" value={form.projectSlug} disabled />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lp-publish-from">Publish From</Label>
              <Input
                id="lp-publish-from"
                type="datetime-local"
                value={form.publishFrom}
                onChange={handleChange("publishFrom")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lp-publish-to">Publish To</Label>
              <Input
                id="lp-publish-to"
                type="datetime-local"
                value={form.publishTo}
                onChange={handleChange("publishTo")}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lp-hero">Hero Image URL</Label>
              <Input id="lp-hero" value={form.heroImage} onChange={handleChange("heroImage")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lp-og">Open Graph Image URL</Label>
              <Input id="lp-og" value={form.ogImage} onChange={handleChange("ogImage")} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-purple-500/20 bg-purple-500/[0.02]">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-400" />
            <CardTitle>AI Content Generation</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Let AI write unique, artful landing page copy for this property — headlines, proof points, FAQs, and more.
            Choose the audience, generate, then preview the public page.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ai-audience">Target Audience</Label>
              <select
                id="ai-audience"
                value={aiAudience}
                onChange={(e) => setAiAudience(e.target.value as typeof aiAudience)}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="investor">Investor — yield, ROI, Golden Visa</option>
                <option value="luxury">Luxury — prestige, exclusivity, lifestyle</option>
                <option value="end_user">End User — family, community, move-in</option>
                <option value="generic">Generic — balanced mix of all angles</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button
                className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-white"
                disabled={aiStatus === "generating"}
                onClick={handleAiGenerate}
              >
                {aiStatus === "generating" ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
                ) : (
                  <><Sparkles className="h-4 w-4" /> Generate with AI</>
                )}
              </Button>
            </div>
          </div>

          {aiMessage && (
            <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
              aiStatus === "error"
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-purple-500/30 bg-purple-500/10 text-purple-300"
            }`}>
              {aiStatus === "done" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-purple-400" />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              {aiMessage}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Sections stored in the database are immediately visible at <span className="font-medium">/lp/{form.slug}</span> — no deploy needed.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Search & Tracking</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="lp-seo-title">SEO Title</Label>
            <Input id="lp-seo-title" value={form.seoTitle} onChange={handleChange("seoTitle")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lp-seo-description">SEO Description</Label>
            <Textarea
              id="lp-seo-description"
              value={form.seoDescription}
              onChange={handleChange("seoDescription")}
              className="min-h-[110px]"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lp-meta-pixel">Meta Pixel ID</Label>
              <Input id="lp-meta-pixel" value={form.metaPixelId} onChange={handleChange("metaPixelId")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lp-google-tag">Google Tag ID</Label>
              <Input id="lp-google-tag" value={form.googleTagId} onChange={handleChange("googleTagId")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lp-google-conversion">Google Conversion ID</Label>
              <Input
                id="lp-google-conversion"
                value={form.googleConversionId}
                onChange={handleChange("googleConversionId")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lp-tiktok-pixel">TikTok Pixel ID</Label>
              <Input id="lp-tiktok-pixel" value={form.tiktokPixelId} onChange={handleChange("tiktokPixelId")} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-muted-foreground">
            Public URL: <span className="font-medium text-foreground">/lp/{form.slug}</span>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="outline" asChild>
              <Link href="/crm/landing-pages">Back to Landing Pages</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/lp/${form.slug}`} target="_blank">Preview Landing Page</Link>
            </Button>
            <Button className="ore-gradient" disabled={status === "saving"} onClick={handleSave}>
              {status === "saving" ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {message ? (
        <div className={`text-sm ${status === "error" ? "text-destructive" : "text-muted-foreground"}`}>
          {message}
        </div>
      ) : null}
    </div>
  )
}
