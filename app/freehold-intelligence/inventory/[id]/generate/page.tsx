'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Sparkles, Copy, Check, FileText, ChevronRight, ArrowLeft } from 'lucide-react'
import {
  inventoryProperties,
  type InventoryProperty,
} from '@/src/features/freehold-intelligence/inventory'

// ─── Types ──────────────────────────────────────────────────────────────────

type Template = 'investor' | 'luxury' | 'first_home'
type AudienceKey = 'uae_residents' | 'gcc_investors' | 'international_hnw' | 'end_users'
type LeadFieldKey = 'name' | 'phone' | 'email' | 'nationality' | 'budget_range' | 'timeline'

interface FormState {
  template: Template
  audiences: Record<AudienceKey, boolean>
  highlights: [string, string, string, string]
  showHeroImage: boolean
  headline: string
  subheadline: string
  leadFields: Record<LeadFieldKey, boolean>
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildDefaults(prop: InventoryProperty): FormState {
  const roiHighlight = prop.roi !== null ? `ROI up to ${prop.roi.toFixed(1)}%` : 'Strong rental returns'
  const bedroomsHighlight = `${prop.bedrooms} bedroom residences`
  const paymentHighlight = prop.paymentPlan ?? 'Flexible payment options available'
  const locationHighlight = `Prime location in ${prop.area}`

  return {
    template: 'investor',
    audiences: {
      uae_residents: true,
      gcc_investors: true,
      international_hnw: false,
      end_users: false,
    },
    highlights: [roiHighlight, bedroomsHighlight, paymentHighlight, locationHighlight],
    showHeroImage: prop.hasImages,
    headline: `Invest in ${prop.name} — ${prop.area}'s Premier Address`,
    subheadline: `Starting from AED ${prop.startingPriceAED ? (prop.startingPriceAED / 1_000_000).toFixed(1) + 'M' : 'competitive pricing'} · ${prop.developer}`,
    leadFields: {
      name: true,
      phone: true,
      email: true,
      nationality: false,
      budget_range: false,
      timeline: false,
    },
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[12px] font-medium uppercase tracking-[0.22em] text-white/35 mb-4">
      {children}
    </h2>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[20px] border border-white/[0.08] bg-white/[0.03] p-5 ${className}`}>
      {children}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GenerateLandingPage() {
  const { id } = useParams<{ id: string }>()
  const prop = inventoryProperties.find((p) => p.id === id)

  const [form, setForm] = useState<FormState>(() =>
    prop ? buildDefaults(prop) : buildDefaults({
      id: '',
      slug: '',
      name: 'Unknown Property',
      area: '',
      developer: '',
      type: 'apartment',
      status: 'off_plan',
      startingPriceAED: null,
      maxPriceAED: null,
      handoverYear: null,
      paymentPlan: null,
      bedrooms: '1–3',
      totalUnits: null,
      availableUnits: null,
      sizeRange: '',
      roi: null,
      landingStatus: 'missing',
      landingUrl: null,
      hasImages: false,
      imageCount: 0,
      dataQuality: 0,
      adReadiness: 0,
      linkedCampaigns: 0,
      leads30d: 0,
      views30d: 0,
      lastUpdated: '',
      tags: [],
    })
  )

  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!prop) {
    return (
      <div className="mx-auto max-w-3xl px-4 pb-32 pt-20 sm:px-6 text-center">
        <div className="text-[48px] font-semibold text-white/10">404</div>
        <p className="mt-3 text-[16px] text-white/50">Property not found.</p>
        <Link
          href="/freehold-intelligence/inventory"
          className="mt-6 inline-flex items-center gap-1.5 text-[13px] text-[#D4AF37]/70 transition hover:text-[#D4AF37]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Inventory
        </Link>
      </div>
    )
  }

  const generatedUrl = `/lp/${prop.slug}`

  function handleGenerate() {
    setGenerating(true)
    setGenerated(false)
    setTimeout(() => {
      setGenerating(false)
      setGenerated(true)
    }, 1500)
  }

  function handleCopy() {
    navigator.clipboard.writeText(generatedUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function setHighlight(idx: number, value: string) {
    setForm((prev) => {
      const next = [...prev.highlights] as [string, string, string, string]
      next[idx] = value
      return { ...prev, highlights: next }
    })
  }

  function toggleAudience(key: AudienceKey) {
    setForm((prev) => ({
      ...prev,
      audiences: { ...prev.audiences, [key]: !prev.audiences[key] },
    }))
  }

  function toggleLeadField(key: LeadFieldKey) {
    setForm((prev) => ({
      ...prev,
      leadFields: { ...prev.leadFields, [key]: !prev.leadFields[key] },
    }))
  }

  const templates: { id: Template; title: string; description: string; bullets: string[] }[] = [
    {
      id: 'investor',
      title: 'Investor Focus',
      description: 'Optimised for yield-driven buyers',
      bullets: ['ROI & rental yield', 'Payment plan breakdown', 'Capital appreciation data'],
    },
    {
      id: 'luxury',
      title: 'Luxury Lifestyle',
      description: 'Optimised for premium appeal',
      bullets: ['Amenities & finishes', 'Prestige & exclusivity', 'Lifestyle imagery'],
    },
    {
      id: 'first_home',
      title: 'First Home Buyer',
      description: 'Optimised for owner-occupiers',
      bullets: ['Community & schools', 'Value proposition', 'Family-friendly features'],
    },
  ]

  const audiences: { key: AudienceKey; label: string }[] = [
    { key: 'uae_residents', label: 'UAE Residents' },
    { key: 'gcc_investors', label: 'GCC Investors' },
    { key: 'international_hnw', label: 'International HNW' },
    { key: 'end_users', label: 'End Users' },
  ]

  const leadFields: { key: LeadFieldKey; label: string }[] = [
    { key: 'name', label: 'Name' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
    { key: 'nationality', label: 'Nationality' },
    { key: 'budget_range', label: 'Budget Range' },
    { key: 'timeline', label: 'Timeline' },
  ]

  return (
    <div className="mx-auto max-w-4xl px-4 pb-32 pt-10 sm:px-6 sm:pt-14">

      {/* Back link */}
      <Link
        href={`/freehold-intelligence/inventory/${prop.id}`}
        className="inline-flex items-center gap-1.5 text-[12px] text-white/40 transition hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to {prop.name}
      </Link>

      {/* Header */}
      <section className="mt-7">
        <div className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
          <Sparkles className="h-3.5 w-3.5" /> Landing Page Generator
        </div>
        <h1 className="mt-4 text-[32px] font-semibold leading-[1.1] tracking-tight text-white sm:text-[40px]">
          Generate Landing Page
        </h1>
        <p className="mt-2 text-[15px] text-white/50">
          for{' '}
          <span className="text-white/80">{prop.name}</span>
          <span className="mx-2 text-white/20">·</span>
          <span className="text-white/40">{prop.area}</span>
        </p>
      </section>

      {/* Form */}
      <div className="mt-10 space-y-6">

        {/* 1 — Template */}
        <Card>
          <SectionHeading>Template</SectionHeading>
          <div className="grid gap-3 sm:grid-cols-3">
            {templates.map((t) => {
              const active = form.template === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setForm((prev) => ({ ...prev, template: t.id }))}
                  className={[
                    'rounded-[16px] border p-4 text-left transition',
                    active
                      ? 'border-[#D4AF37]/40 bg-[#D4AF37]/[0.07]'
                      : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.14] hover:bg-white/[0.04]',
                  ].join(' ')}
                >
                  <div className={`mb-1 text-[13px] font-semibold ${active ? 'text-[#F8E7AE]' : 'text-white/80'}`}>
                    {t.title}
                  </div>
                  <div className="mb-3 text-[13px] text-white/40">{t.description}</div>
                  <ul className="space-y-1">
                    {t.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-1.5 text-[13px] text-white/50">
                        <ChevronRight className={`mt-0.5 h-3 w-3 shrink-0 ${active ? 'text-[#D4AF37]/70' : 'text-white/25'}`} />
                        {b}
                      </li>
                    ))}
                  </ul>
                </button>
              )
            })}
          </div>
        </Card>

        {/* 2 — Target Audience */}
        <Card>
          <SectionHeading>Target Audience</SectionHeading>
          <div className="flex flex-wrap gap-3">
            {audiences.map(({ key, label }) => {
              const checked = form.audiences[key]
              return (
                <label
                  key={key}
                  className={[
                    'flex cursor-pointer items-center gap-2.5 rounded-full border px-4 py-2 text-[13px] transition select-none',
                    checked
                      ? 'border-[#D4AF37]/35 bg-[#D4AF37]/[0.08] text-[#F8E7AE]'
                      : 'border-white/[0.07] bg-white/[0.02] text-white/55 hover:border-white/[0.14] hover:text-white/80',
                  ].join(' ')}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={() => toggleAudience(key)}
                  />
                  <span
                    className={[
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition',
                      checked
                        ? 'border-[#D4AF37]/60 bg-[#D4AF37]/20'
                        : 'border-white/20 bg-white/[0.03]',
                    ].join(' ')}
                  >
                    {checked && <Check className="h-2.5 w-2.5 text-[#D4AF37]" />}
                  </span>
                  {label}
                </label>
              )
            })}
          </div>
        </Card>

        {/* 3 — Key Highlights */}
        <Card>
          <SectionHeading>Key Highlights</SectionHeading>
          <div className="grid gap-3 sm:grid-cols-2">
            {form.highlights.map((val, idx) => (
              <div key={idx}>
                <label className="mb-1.5 block text-[13px] text-white/40">
                  Highlight {idx + 1}
                </label>
                <input
                  type="text"
                  value={val}
                  onChange={(e) => setHighlight(idx, e.target.value)}
                  className="w-full rounded-[12px] border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-[13px] text-white/85 placeholder:text-white/25 focus:border-[#D4AF37]/35 focus:outline-none"
                />
              </div>
            ))}
          </div>
        </Card>

        {/* 4 — Hero Section */}
        <Card>
          <SectionHeading>Hero Section</SectionHeading>
          <div className="space-y-4">

            {/* Hero image toggle */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13px] text-white/75">Show hero image</div>
                {!prop.hasImages && (
                  <div className="mt-0.5 text-[13px] text-white/55/70">
                    No images available for this property
                  </div>
                )}
              </div>
              <button
                onClick={() => setForm((prev) => ({ ...prev, showHeroImage: !prev.showHeroImage }))}
                disabled={!prop.hasImages}
                className={[
                  'relative h-6 w-11 rounded-full border transition',
                  form.showHeroImage && prop.hasImages
                    ? 'border-[#D4AF37]/40 bg-[#D4AF37]/20'
                    : 'border-white/[0.1] bg-white/[0.04]',
                  !prop.hasImages ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
                ].join(' ')}
                aria-label="Toggle hero image"
              >
                <span
                  className={[
                    'absolute top-0.5 h-5 w-5 rounded-full border transition-all',
                    form.showHeroImage && prop.hasImages
                      ? 'left-5 border-[#D4AF37]/60 bg-[#D4AF37]'
                      : 'left-0.5 border-white/20 bg-white/30',
                  ].join(' ')}
                />
              </button>
            </div>

            {/* Headline */}
            <div>
              <label className="mb-1.5 block text-[13px] text-white/40">Headline</label>
              <input
                type="text"
                value={form.headline}
                onChange={(e) => setForm((prev) => ({ ...prev, headline: e.target.value }))}
                className="w-full rounded-[12px] border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-[13px] text-white/85 placeholder:text-white/25 focus:border-[#D4AF37]/35 focus:outline-none"
              />
            </div>

            {/* Subheadline */}
            <div>
              <label className="mb-1.5 block text-[13px] text-white/40">Subheadline</label>
              <input
                type="text"
                value={form.subheadline}
                onChange={(e) => setForm((prev) => ({ ...prev, subheadline: e.target.value }))}
                className="w-full rounded-[12px] border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-[13px] text-white/85 placeholder:text-white/25 focus:border-[#D4AF37]/35 focus:outline-none"
              />
            </div>
          </div>
        </Card>

        {/* 5 — Lead Form */}
        <Card>
          <SectionHeading>Lead Form</SectionHeading>
          <div className="flex flex-wrap gap-3">
            {leadFields.map(({ key, label }) => {
              const checked = form.leadFields[key]
              return (
                <label
                  key={key}
                  className={[
                    'flex cursor-pointer items-center gap-2.5 rounded-full border px-4 py-2 text-[13px] transition select-none',
                    checked
                      ? 'border-[#D4AF37]/35 bg-[#D4AF37]/[0.08] text-[#F8E7AE]'
                      : 'border-white/[0.07] bg-white/[0.02] text-white/55 hover:border-white/[0.14] hover:text-white/80',
                  ].join(' ')}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={() => toggleLeadField(key)}
                  />
                  <span
                    className={[
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition',
                      checked
                        ? 'border-[#D4AF37]/60 bg-[#D4AF37]/20'
                        : 'border-white/20 bg-white/[0.03]',
                    ].join(' ')}
                  >
                    {checked && <Check className="h-2.5 w-2.5 text-[#D4AF37]" />}
                  </span>
                  {label}
                </label>
              )
            })}
          </div>
        </Card>

      </div>

      {/* Generate button */}
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button
          onClick={handleGenerate}
          disabled={generating}
          className={[
            'inline-flex items-center gap-2 rounded-full px-6 py-3 text-[14px] font-semibold transition',
            generating
              ? 'bg-[#D4AF37]/50 text-[#06080A]/60 cursor-wait'
              : 'bg-[#D4AF37] text-[#06080A] hover:bg-[#F8E7AE]',
          ].join(' ')}
        >
          {generating ? (
            <>
              <Sparkles className="h-4 w-4 animate-pulse" />
              Generating…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate Preview
            </>
          )}
        </button>

        {!generated && !generating && (
          <p className="text-[12px] text-white/30">
            Configure the options above, then generate your landing page.
          </p>
        )}
      </div>

      {/* Success / preview ready */}
      {generated && (
        <div className="mt-6 rounded-[20px] border border-emerald-400/20 bg-[#D4AF37]/[0.05] p-5">
          <div className="flex items-center gap-2 text-[#D4AF37]">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#D4AF37]/15">
              <Check className="h-4 w-4" />
            </div>
            <span className="text-[14px] font-semibold">Preview Ready</span>
          </div>

          <p className="mt-2 text-[12px] text-white/50">
            Your landing page has been generated successfully. Use the URL below to preview or share it.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-[12px] border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5">
              <FileText className="h-3.5 w-3.5 shrink-0 text-white/30" />
              <span className="flex-1 text-[13px] text-white/75 font-mono">
                {generatedUrl}
              </span>
            </div>
            <button
              onClick={handleCopy}
              className={[
                'inline-flex items-center gap-1.5 rounded-[12px] border px-3.5 py-2.5 text-[12px] font-medium transition',
                copied
                  ? 'border-emerald-400/30 bg-[#D4AF37]/10 text-[#D4AF37]'
                  : 'border-white/[0.08] bg-white/[0.03] text-white/60 hover:border-white/20 hover:text-white',
              ].join(' ')}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" /> Copy
                </>
              )}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href={generatedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[12px] text-white/60 transition hover:border-white/20 hover:text-white"
            >
              Open Preview
            </a>
            <button
              onClick={() => setGenerated(false)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/[0.06] px-4 py-2 text-[12px] text-[#D4AF37]/80 transition hover:border-[#D4AF37]/40 hover:text-[#D4AF37]"
            >
              <Sparkles className="h-3.5 w-3.5" /> Regenerate
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
