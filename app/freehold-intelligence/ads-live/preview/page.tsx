'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Copy, ChevronDown } from 'lucide-react'

type Property = 'Palm Jumeirah' | 'Dubai Hills' | 'JVC Investor' | 'Sobha Hartland'
type AdFormat = 'Meta Feed' | 'Meta Story' | 'Google Search' | 'Google Display'

const META_BLUE = '#1877F2'
const GOOGLE_BLUE = '#4285F4'

const properties: Property[] = ['Palm Jumeirah', 'Dubai Hills', 'JVC Investor', 'Sobha Hartland']

const formats: AdFormat[] = ['Meta Feed', 'Meta Story', 'Google Search', 'Google Display']

const adCopyByProperty: Record<Property, { headline: string; description: string; url: string }> = {
  'Palm Jumeirah': {
    headline: 'Palm Jumeirah Apartments from AED 2.8M',
    description: 'Beachfront residences with panoramic sea views. 100% foreign ownership. Golden Visa eligible. Register interest today.',
    url: 'freeholdproperty.ae/palm-jumeirah',
  },
  'Dubai Hills': {
    headline: 'Dubai Hills Estate — High Yield Investments',
    description: 'Premium golf-course apartments offering 7–9% net yield. Off-plan from AED 1.2M. Limited units available.',
    url: 'freeholdproperty.ae/dubai-hills',
  },
  'JVC Investor': {
    headline: 'JVC Apartments — Starting AED 650K',
    description: 'Affordable luxury in Jumeirah Village Circle. 8% projected ROI. Handover Q4 2025. 0% agent fees.',
    url: 'freeholdproperty.ae/jvc-investor',
  },
  'Sobha Hartland': {
    headline: 'Sobha Hartland II Villas & Mansions',
    description: 'Waterfront living at Mohammed Bin Rashid City. Ultra-luxury 4–6 bed villas from AED 5.2M. Book a private tour.',
    url: 'freeholdproperty.ae/sobha-hartland',
  },
}

function MetaFeedPreview({ property, headline, description }: { property: Property; headline: string; description: string }) {
  return (
    <div className="mx-auto w-full max-w-[380px] overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl">
      {/* Page row */}
      <div className="flex items-center gap-2.5 bg-white px-4 py-3">
        <div className="h-8 w-8 rounded-full bg-[#1877F2] flex items-center justify-center">
          <span className="text-[11px] font-bold text-white">FP</span>
        </div>
        <div>
          <div className="text-[12px] font-semibold text-gray-900">Freehold Property Dubai</div>
          <div className="flex items-center gap-1 text-[10px] text-gray-400">
            Sponsored ·
            <svg className="h-2.5 w-2.5" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8z"/><path d="M8 4a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 018 4zm0 8a1 1 0 100-2 1 1 0 000 2z"/></svg>
          </div>
        </div>
        <div className="ml-auto text-gray-400">
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 16 16">
            <circle cx="2" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="14" cy="8" r="1.5"/>
          </svg>
        </div>
      </div>
      {/* Headline copy */}
      <div className="bg-white px-4 pb-2 text-[13px] text-gray-800">{headline}</div>
      {/* Image placeholder */}
      <div className="flex h-52 items-center justify-center bg-gradient-to-br from-[#06080A] via-[#0d1117] to-[#1a1f2e]">
        <div className="text-center">
          <div className="mx-auto mb-1 h-10 w-10 rounded-xl bg-[#D4AF37]/20 flex items-center justify-center">
            <svg className="h-5 w-5 text-[#D4AF37]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4-4 4 4 4-6 4 6" />
              <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={1.5}/>
            </svg>
          </div>
          <span className="text-[11px] text-white/50">{property} · Image</span>
        </div>
      </div>
      {/* Ad footer */}
      <div className="flex items-center justify-between bg-gray-50 px-4 py-3">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-gray-400">freeholdproperty.ae</div>
          <div className="text-[12px] font-bold text-gray-900 leading-tight">{headline.slice(0, 40)}{headline.length > 40 ? '…' : ''}</div>
          <div className="text-[10px] text-gray-500 leading-tight mt-0.5">{description.slice(0, 60)}…</div>
        </div>
        <button className="ml-3 shrink-0 rounded-md bg-[#1877F2] px-3 py-1.5 text-[11px] font-semibold text-white">
          Learn More
        </button>
      </div>
    </div>
  )
}

function MetaStoryPreview({ property, headline, description }: { property: Property; headline: string; description: string }) {
  return (
    <div className="mx-auto w-full max-w-[240px] overflow-hidden rounded-2xl border border-white/10 shadow-2xl" style={{ aspectRatio: '9/16', position: 'relative' }}>
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#06080A] via-[#0d1117] to-[#1a1f2e]" />
      {/* Image placeholder icon */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-2 h-14 w-14 rounded-2xl bg-[#D4AF37]/15 flex items-center justify-center">
            <svg className="h-7 w-7 text-[#D4AF37]/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4-4 4 4 4-6 4 6" />
              <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={1.5}/>
            </svg>
          </div>
          <span className="text-[10px] text-white/30">{property}</span>
        </div>
      </div>
      {/* Top bar */}
      <div className="absolute left-0 right-0 top-0 flex items-center gap-2 px-3 pt-3">
        <div className="h-5 w-5 rounded-full bg-[#1877F2] flex items-center justify-center">
          <span className="text-[7px] font-bold text-white">FP</span>
        </div>
        <span className="text-[10px] font-semibold text-white/90">Freehold Property Dubai</span>
        <span className="ml-0.5 text-[9px] text-white/50">· Sponsored</span>
      </div>
      {/* Progress bar */}
      <div className="absolute left-3 right-3 top-10 h-0.5 rounded-full bg-white/20">
        <div className="h-full w-3/5 rounded-full bg-white/70" />
      </div>
      {/* Overlay copy */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-8 pt-10">
        <div className="text-[13px] font-bold leading-tight text-white">{headline}</div>
        <div className="mt-1.5 text-[10px] leading-relaxed text-white/70">{description.slice(0, 70)}…</div>
        <button className="mt-3 w-full rounded-xl bg-white py-2 text-[11px] font-bold text-gray-900">
          Learn More
        </button>
      </div>
    </div>
  )
}

function GoogleSearchPreview({ headline, description, url }: { headline: string; description: string; url: string }) {
  const parts = headline.split('|').map((s) => s.trim()).filter(Boolean)
  const h1 = parts[0] ?? headline.slice(0, 30)
  const h2 = parts[1] ?? 'Freehold Property Dubai'
  const h3 = parts[2] ?? 'Enquire Today'

  return (
    <div className="mx-auto w-full max-w-[540px] rounded-2xl border border-white/[0.05] bg-white/[0.03] p-6">
      {/* Search bar mock */}
      <div className="mb-5 flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.04] px-4 py-2.5">
        <svg className="h-4 w-4 shrink-0 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
        </svg>
        <span className="text-[12px] text-white/40">buy apartment dubai</span>
      </div>
      {/* Ad card */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="rounded border border-[#4285F4]/40 px-1.5 py-0.5 text-[9px] font-semibold text-[#4285F4] tracking-wide">Ad</span>
          <span className="text-[11px] text-white/50">{url}</span>
        </div>
        <div className="text-[16px] font-medium leading-snug" style={{ color: GOOGLE_BLUE }}>
          {h1}
          <span className="text-white/20 mx-1.5">|</span>
          {h2}
          <span className="text-white/20 mx-1.5">|</span>
          {h3}
        </div>
        <div className="mt-2 text-[12px] leading-relaxed text-white/60">
          {description.slice(0, 90)}{description.length > 90 ? '…' : ''}
        </div>
        <div className="mt-1.5 text-[12px] text-white/40">
          {description.slice(90, 160)}{description.length > 160 ? '…' : ''}
        </div>
      </div>
    </div>
  )
}

function GoogleDisplayPreview({ property, headline, description }: { property: Property; headline: string; description: string }) {
  return (
    <div className="mx-auto w-full max-w-[480px] overflow-hidden rounded-2xl border border-white/[0.07] shadow-2xl" style={{ aspectRatio: '1.91/1' }}>
      <div className="flex h-full">
        {/* Image placeholder */}
        <div className="w-1/2 flex items-center justify-center bg-gradient-to-br from-[#06080A] via-[#0d1117] to-[#1a1f2e]">
          <div className="text-center">
            <div className="mx-auto mb-1 h-10 w-10 rounded-xl bg-[#D4AF37]/15 flex items-center justify-center">
              <svg className="h-5 w-5 text-[#D4AF37]/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4-4 4 4 4-6 4 6" />
                <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={1.5}/>
              </svg>
            </div>
            <span className="text-[9px] text-white/30">{property}</span>
          </div>
        </div>
        {/* Copy side */}
        <div className="w-1/2 flex flex-col justify-between bg-white p-4">
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-1">freeholdproperty.ae</div>
            <div className="text-[13px] font-bold leading-snug text-gray-900">{headline.slice(0, 50)}{headline.length > 50 ? '…' : ''}</div>
            <div className="mt-1.5 text-[10px] leading-relaxed text-gray-500">{description.slice(0, 80)}…</div>
          </div>
          <button
            className="mt-3 w-full rounded-lg py-1.5 text-[11px] font-bold text-white"
            style={{ backgroundColor: GOOGLE_BLUE }}
          >
            Learn More
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdPreviewPage() {
  const [property, setProperty] = useState<Property>('Palm Jumeirah')
  const [format, setFormat] = useState<AdFormat>('Meta Feed')
  const [showDropdown, setShowDropdown] = useState(false)

  const copy = adCopyByProperty[property]
  const [headline, setHeadline] = useState(copy.headline)
  const [description, setDescription] = useState(copy.description)

  const handlePropertyChange = (p: Property) => {
    setProperty(p)
    setShowDropdown(false)
    const c = adCopyByProperty[p]
    setHeadline(c.headline)
    setDescription(c.description)
  }

  const isMetaFormat = format === 'Meta Feed' || format === 'Meta Story'

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-10 sm:px-6 sm:pt-14">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <section>
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.07A1 1 0 0121 8.85v6.298a1 1 0 01-1.447.9L15 14M4 8h11a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2V10a2 2 0 012-2z" />
            </svg>
            Ad Preview
          </div>
          <h1 className="mt-4 text-[36px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[48px]">
            Ad preview<br />
            <span className="text-white/35">across formats.</span>
          </h1>
        </section>
      </div>

      {/* Controls row */}
      <div className="mt-8 flex flex-wrap items-center gap-4">

        {/* Property dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown((v) => !v)}
            className="flex min-w-[200px] items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-5 py-3 text-[13px] font-semibold text-white/80 transition hover:border-white/10 hover:bg-white/[0.05]"
          >
            {property}
            <ChevronDown className={`h-4 w-4 text-white/40 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
          </button>
          {showDropdown && (
            <div className="absolute left-0 top-full z-20 mt-1.5 w-full overflow-hidden rounded-xl border border-white/[0.07] bg-[#0d1117] shadow-xl">
              {properties.map((p) => (
                <button
                  key={p}
                  onClick={() => handlePropertyChange(p)}
                  className={`block w-full px-4 py-2.5 text-left text-[13px] transition hover:bg-white/[0.06] ${
                    property === p ? 'text-[#D4AF37]' : 'text-white/70'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Format toggle pills */}
        <div className="flex flex-wrap gap-1 rounded-[14px] border border-white/[0.07] bg-white/[0.03] p-1">
          {formats.map((f) => {
            const isMeta = f.startsWith('Meta')
            const accentColor = isMeta ? META_BLUE : GOOGLE_BLUE
            const isActive = format === f
            return (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className="rounded-[10px] px-4 py-2 text-[12px] font-semibold transition"
                style={
                  isActive
                    ? { backgroundColor: accentColor, color: '#ffffff' }
                    : { color: 'rgba(255,255,255,0.45)' }
                }
              >
                {f}
              </button>
            )
          })}
        </div>
      </div>

      {/* Preview area */}
      <div className="mt-8 min-h-[360px] flex items-center justify-center rounded-2xl border border-white/[0.05] bg-white/[0.02] py-10 px-4">
        {format === 'Meta Feed' && (
          <MetaFeedPreview property={property} headline={headline} description={description} />
        )}
        {format === 'Meta Story' && (
          <MetaStoryPreview property={property} headline={headline} description={description} />
        )}
        {format === 'Google Search' && (
          <GoogleSearchPreview headline={headline} description={description} url={copy.url} />
        )}
        {format === 'Google Display' && (
          <GoogleDisplayPreview property={property} headline={headline} description={description} />
        )}
      </div>

      {/* Ad copy editor */}
      <section className="mt-8">
        <div className="mb-4 text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">Ad Copy</div>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[12px] text-white/50">Headline</label>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-[13px] text-white/90 placeholder-white/25 outline-none focus:border-[#D4AF37]/40 focus:ring-1 focus:ring-[#D4AF37]/20 transition"
              placeholder="Ad headline…"
            />
            <div className="mt-1 flex justify-end text-[10px] text-white/30">
              {headline.length} chars
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] text-white/50">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-[13px] text-white/90 placeholder-white/25 outline-none focus:border-[#D4AF37]/40 focus:ring-1 focus:ring-[#D4AF37]/20 transition"
              placeholder="Ad description…"
            />
            <div className="mt-1 flex justify-end text-[10px] text-white/30">
              {description.length} chars
            </div>
          </div>
        </div>
      </section>

      {/* Copy buttons */}
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={() => {
            const text = `[Meta Ad — ${property}]\nHeadline: ${headline}\nDescription: ${description}`
            navigator.clipboard.writeText(text).catch(() => {})
          }}
          className="inline-flex items-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-5 py-3 text-[13px] font-semibold text-white/80 transition hover:border-[#1877F2]/30 hover:text-white"
        >
          <Copy className="h-3.5 w-3.5" style={{ color: META_BLUE }} />
          Copy for Meta
        </button>
        <button
          onClick={() => {
            const text = `[Google Ad — ${property}]\nHeadline: ${headline}\nDescription: ${description}`
            navigator.clipboard.writeText(text).catch(() => {})
          }}
          className="inline-flex items-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-5 py-3 text-[13px] font-semibold text-white/80 transition hover:border-[#4285F4]/30 hover:text-white"
        >
          <Copy className="h-3.5 w-3.5" style={{ color: GOOGLE_BLUE }} />
          Copy for Google
        </button>
      </div>

    </div>
  )
}
