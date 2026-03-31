"use client"

import { useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import type { CampaignPixelIds } from "@/lib/landing-pages"

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
    gtag?: (...args: unknown[]) => void
    ttq?: {
      track: (event: string, payload?: Record<string, unknown>) => void
    }
  }
}

interface LeadCaptureFormProps {
  landingSlug: string
  projectSlug: string
  pixels: CampaignPixelIds
  ctaText: string
  formId?: string
  cardClassName?: string
}

export function LeadCaptureForm({
  landingSlug,
  projectSlug,
  pixels,
  ctaText,
  formId = "lead-form",
  cardClassName,
}: LeadCaptureFormProps) {
  const params = useSearchParams()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
  })

  const utm = useMemo(
    () => ({
      source: params.get("utm_source") || "",
      medium: params.get("utm_medium") || "",
      campaign: params.get("utm_campaign") || "",
      term: params.get("utm_term") || "",
      content: params.get("utm_content") || "",
      id: params.get("utm_id") || "",
    }),
    [params],
  )

  const trackConversion = () => {
    if (typeof window === "undefined") return

    if (pixels.metaPixelId && typeof window.fbq === "function") {
      window.fbq("track", "Lead", {
        content_name: projectSlug,
        content_category: "landing_page",
      })
    }

    if (pixels.googleTagId && typeof window.gtag === "function") {
      window.gtag("event", "conversion", {
        send_to: pixels.googleConversionId || pixels.googleTagId,
        value: 1,
        currency: "AED",
      })
    }

    if (pixels.tiktokPixelId && window.ttq?.track) {
      window.ttq.track("SubmitForm", {
        content_type: "property",
        content_id: projectSlug,
      })
    }
  }

  const onChange = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }))

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          landingSlug,
          projectSlug,
          source: `lp:${landingSlug}`,
          utm,
          referrer: document.referrer || "",
          device: {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            screen: `${window.screen.width}x${window.screen.height}`,
          },
          pixelIds: pixels,
        }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to submit enquiry")
      }

      trackConversion()
      setSubmitted(true)
      setForm({ name: "", phone: "", email: "" })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Submission failed")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card id={formId} className={cn("border-primary/20 shadow-lg", cardClassName)}>
      <CardContent className="p-6 md:p-8">
        {submitted ? (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-5 text-emerald-300">
            <p className="font-semibold">Thanks. Your request was sent successfully.</p>
            <p className="mt-1 text-sm text-emerald-200/90">
              A ORE consultant will contact you shortly with live availability and pricing.
            </p>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="lead-name">Full name</Label>
                <Input
                  id="lead-name"
                  required
                  value={form.name}
                  onChange={(e) => onChange("name", e.target.value)}
                  placeholder="Your full name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-phone">Phone number</Label>
                <Input
                  id="lead-phone"
                  required
                  value={form.phone}
                  onChange={(e) => onChange("phone", e.target.value)}
                  placeholder="+971..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lead-email">Email</Label>
              <Input
                id="lead-email"
                type="email"
                value={form.email}
                onChange={(e) => onChange("email", e.target.value)}
                placeholder="you@example.com"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="ore-gradient w-full" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : ctaText}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
