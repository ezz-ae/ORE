import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LeadCaptureForm } from "@/components/lp/lead-capture-form"
import { Shield, Eye, Flame } from "lucide-react"
import type { CampaignPixelIds } from "@/lib/landing-pages"

interface HeroSectionProps {
  data: Record<string, unknown>
  fallbackTitle: string
  fallbackSubtitle: string
  heroImage: string
  ctaText: string
  landingSlug: string
  projectSlug: string
  pixels: CampaignPixelIds
}

export function HeroSection({
  data,
  fallbackTitle,
  fallbackSubtitle,
  heroImage,
  ctaText,
  landingSlug,
  projectSlug,
  pixels,
}: HeroSectionProps) {
  const title = (typeof data.title === "string" && data.title) || fallbackTitle
  const subtitle = (typeof data.subtitle === "string" && data.subtitle) || fallbackSubtitle
  const eyebrow = (typeof data.eyebrow === "string" && data.eyebrow) || "Exclusive Investment Opportunity"
  const chips = Array.isArray(data.chips)
    ? data.chips.map((item) => (typeof item === "string" ? item : "")).filter(Boolean)
    : []
  const urgencyText =
    typeof data.urgencyText === "string" && data.urgencyText
      ? data.urgencyText
      : "Limited availability — contact a broker today"
  const viewerCount =
    typeof data.viewerCount === "number" && data.viewerCount > 0 ? data.viewerCount : null
  const chatQuery = encodeURIComponent(
    `Tell me about ${projectSlug} and whether it fits my investment goals.`,
  )

  return (
    <section className="relative overflow-hidden border-b">
      {/* Background */}
      <div className="absolute inset-0">
        <Image src={heroImage} alt={title} fill className="object-cover" priority />
        <div className="absolute inset-0 bg-gradient-to-br from-black/85 via-black/65 to-black/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
      </div>

      {/* Urgency ribbon */}
      <div className="relative z-10 border-b border-white/10 bg-black/40 backdrop-blur-sm">
        <div className="container flex items-center justify-between gap-4 py-2.5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-400">
            <Flame className="h-3.5 w-3.5" />
            <span>{urgencyText}</span>
          </div>
          {viewerCount ? (
            <div className="flex items-center gap-1.5 text-xs text-white/55">
              <Eye className="h-3 w-3" />
              <span>{viewerCount} investors viewing today</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Main content */}
      <div className="container relative z-10 py-16 md:py-24">
        <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">

          {/* Left: copy */}
          <div className="max-w-2xl space-y-7 text-white">
            <Badge className="ore-gradient border-none px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]">
              {eyebrow}
            </Badge>

            <div className="space-y-4">
              <h1 className="font-serif text-4xl font-bold leading-[1.1] md:text-5xl lg:text-[3.75rem]">
                {title}
              </h1>
              <p className="max-w-xl text-lg font-light leading-relaxed text-white/75 md:text-xl">
                {subtitle}
              </p>
            </div>

            {/* Investment chips */}
            {chips.length ? (
              <div className="flex flex-wrap gap-2">
                {chips.map((chip) => (
                  <div
                    key={chip}
                    className="rounded-full border border-[#C9A961]/40 bg-[#C9A961]/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-[#C9A961]"
                  >
                    {chip}
                  </div>
                ))}
              </div>
            ) : null}

            {/* Trust bar */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3.5 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-sm text-white/75">
                <Shield className="h-4 w-4 shrink-0 text-[#C9A961]" />
                <span>Verified Project Data</span>
              </div>
              <div className="hidden h-4 w-px bg-white/20 sm:block" />
              <div className="text-sm text-white/75">ORE Brokerage · Dubai</div>
              <div className="hidden h-4 w-px bg-white/20 sm:block" />
              <div className="text-sm text-white/75">RERA Registered</div>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap gap-3 pt-1">
              <Button
                asChild
                size="lg"
                className="ore-gradient rounded-xl px-8 font-bold shadow-lg shadow-primary/30 text-primary-foreground"
              >
                <a href="#lead-form-section">{ctaText}</a>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-xl border-white/25 bg-white/8 text-white backdrop-blur-sm hover:bg-white/15"
              >
                <Link href="#download-brochure">Download Brochure</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-xl border-white/25 bg-white/8 text-white backdrop-blur-sm hover:bg-white/15"
              >
                <Link
                  href={`/chat?q=${chatQuery}&source=lp&landing=${landingSlug}&project=${projectSlug}`}
                >
                  Ask AI
                </Link>
              </Button>
            </div>
          </div>

          {/* Right: lead form */}
          <div className="rounded-3xl border border-white/15 bg-black/50 shadow-2xl backdrop-blur-md">
            <div className="p-5">
              <div className="mb-4 rounded-xl border border-[#C9A961]/25 bg-[#C9A961]/8 px-4 py-3 text-center">
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#C9A961]">
                  Request Exclusive Access
                </p>
                <p className="mt-1 text-xs text-white/45">
                  A specialist will call you within 2 hours
                </p>
              </div>
              <LeadCaptureForm
                landingSlug={landingSlug}
                projectSlug={projectSlug}
                pixels={pixels}
                ctaText="Send My Request"
                formId="hero-lead-form"
                cardClassName="border-white/10 bg-black/20 text-white shadow-none [&_label]:text-white/75 [&_input]:bg-white/8 [&_input]:border-white/15 [&_input]:text-white [&_input::placeholder]:text-white/30"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
