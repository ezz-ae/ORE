'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Wand2, Copy, Check, ChevronDown, Sparkles, AlertCircle, ArrowUpRight, Info } from 'lucide-react'
import { leadMachineListings } from '@/src/features/freehold-intelligence/lead-machine'
import type { GeneratedRsaVariant, GenerateRsaPayload } from '@/lib/google/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type RsaAngle = GenerateRsaPayload['angle']
type RsaTone  = GenerateRsaPayload['tone']

// ─── Constants ────────────────────────────────────────────────────────────────

const ANGLES: { value: RsaAngle; label: string; desc: string }[] = [
  { value: 'investor',    label: 'Investor ROI',   desc: 'Net yield, capital appreciation, rental demand' },
  { value: 'yield',       label: 'Yield-first',    desc: 'Specific % return, rental income numbers' },
  { value: 'golden_visa', label: 'Golden Visa',    desc: 'Residency eligibility, 10-year visa benefit' },
  { value: 'end_user',    label: 'End User',       desc: 'Lifestyle, family living, community benefits' },
  { value: 'urgency',     label: 'Urgency / FOMO', desc: 'Limited units, phase close, price lock-in' },
  { value: 'lifestyle',   label: 'Lifestyle',      desc: 'Views, amenities, neighbourhood feel' },
]

const TONES: { value: RsaTone; label: string; desc: string }[] = [
  { value: 'direct',       label: 'Direct',       desc: 'Clear, factual, numbers-first' },
  { value: 'aspirational', label: 'Aspirational', desc: 'Elevated, dream-lifestyle tone' },
  { value: 'premium',      label: 'Premium',      desc: 'Luxury, exclusivity, discretion' },
]

// Google RSA character limits
const HEADLINE_LIMIT    = 30
const HEADLINE_WARN     = 28
const DESCRIPTION_LIMIT = 90
const DESCRIPTION_WARN  = 85

// ─── CopyButton component ─────────────────────────────────────────────────────

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <button
      onClick={copy}
      className={
        className ??
        'inline-flex items-center gap-1 text-[13px] text-white/25 transition hover:text-white/60'
      }
    >
      {copied
        ? <Check className="h-3 w-3 text-[#D4AF37]" />
        : <Copy className="h-3 w-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

// ─── Char limit badge ─────────────────────────────────────────────────────────

function CharBadge({ text, limit, warn }: { text: string; limit: number; warn: number }) {
  const len = text.length
  if (len > limit) {
    return (
      <span className="ml-1.5 rounded px-1.5 py-0.5 text-[12px] font-medium bg-red-400/[0.12] text-red-400">
        {len}/{limit}
      </span>
    )
  }
  if (len > warn) {
    return (
      <span className="ml-1.5 rounded px-1.5 py-0.5 text-[12px] font-medium bg-orange-400/[0.12] text-orange-300">
        {len}/{limit}
      </span>
    )
  }
  return (
    <span className="ml-1.5 rounded px-1.5 py-0.5 text-[12px] text-white/20">
      {len}/{limit}
    </span>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function GenerateRsaPage() {
  const [listingId, setListingId] = useState<string>(leadMachineListings[0]?.id ?? '')
  const [angle, setAngle]         = useState<RsaAngle>('investor')
  const [tone, setTone]           = useState<RsaTone>('direct')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [configErr, setConfigErr] = useState(false)
  const [variants, setVariants]   = useState<GeneratedRsaVariant[]>([])

  // Pick up any copy that was sent from the Marketing Expert sidebar
  useEffect(() => {
    const raw = sessionStorage.getItem('rsa-prefill')
    if (!raw) return
    sessionStorage.removeItem('rsa-prefill')
    try {
      const { headlines, descriptions } = JSON.parse(raw) as {
        headlines: string[]
        descriptions: string[]
      }
      if (headlines?.length || descriptions?.length) {
        setVariants([{
          id:           'agent-suggestion',
          headlines:    headlines ?? [],
          descriptions: descriptions ?? [],
          note:         'From Marketing Expert — review and refine before uploading to Google Ads.',
        }])
      }
    } catch { /* ignore malformed prefill */ }
  }, [])

  const listing = leadMachineListings.find((l) => l.id === listingId)

  // ── Generate ────────────────────────────────────────────────────────────────

  async function generate() {
    if (!listing) return
    setLoading(true)
    setError(null)
    setConfigErr(false)
    setVariants([])

    const payload: GenerateRsaPayload = {
      listingId:    listing.id,
      listingName:  listing.projectName,
      area:         listing.area,
      developer:    listing.developer,
      startingPrice: listing.startingPrice,
      paymentPlan:  listing.paymentPlan,
      angle,
      tone,
    }

    try {
      const res  = await fetch('/api/google/ads/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      const json = await res.json()

      if (json.type === 'config') {
        setConfigErr(true)
        setError(json.error ?? 'Google Ads is not connected.')
        return
      }
      if (!res.ok || json.error) {
        throw new Error(json.error ?? 'Generation failed.')
      }
      setVariants(json.variants ?? [])
    } catch (e) {
      if (!configErr) {
        setError(e instanceof Error ? e.message : 'Unexpected error.')
      }
    } finally {
      setLoading(false)
    }
  }

  // ── Copy all for a variant ───────────────────────────────────────────────────

  function buildCopyAll(v: GeneratedRsaVariant): string {
    const lines: string[] = []
    v.headlines.forEach((h, i) => lines.push(`HEADLINE ${i + 1}: ${h}`))
    v.descriptions.forEach((d, i) => lines.push(`DESCRIPTION ${i + 1}: ${d}`))
    return lines.join('\n')
  }

  // ── Char limit warning summary ───────────────────────────────────────────────

  function getWarnings(v: GeneratedRsaVariant): { type: 'headline' | 'description'; index: number; len: number; limit: number }[] {
    const warnings: { type: 'headline' | 'description'; index: number; len: number; limit: number }[] = []
    v.headlines.forEach((h, i) => {
      if (h.length > HEADLINE_LIMIT) warnings.push({ type: 'headline', index: i + 1, len: h.length, limit: HEADLINE_LIMIT })
    })
    v.descriptions.forEach((d, i) => {
      if (d.length > DESCRIPTION_LIMIT) warnings.push({ type: 'description', index: i + 1, len: d.length, limit: DESCRIPTION_LIMIT })
    })
    return warnings
  }

  const angleConfig = ANGLES.find((a) => a.value === angle)!

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      {/* Back link */}
      <Link
        href="/freehold-intelligence/lead-machine/google/ads"
        className="inline-flex items-center gap-1.5 text-[12px] text-white/40 transition hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Google Ads
      </Link>

      {/* Header */}
      <section className="mt-7">
        <div className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-wider text-[#4285F4]/85">
          <Wand2 className="h-3.5 w-3.5" /> RSA Generator
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white/90">
          Generate RSA copy<br />
          <span className="text-white/35">headlines + descriptions.</span>
        </h1>
      </section>

      {/* Two-column layout */}
      <div className="mt-10 grid gap-8 lg:grid-cols-[360px_1fr]">

        {/* ── LEFT: Controls ──────────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Listing select */}
          <div>
            <label className="mb-2 block text-[13px] font-medium uppercase tracking-[0.18em] text-white/40">
              Listing
            </label>
            <div className="relative">
              <select
                value={listingId}
                onChange={(e) => setListingId(e.target.value)}
                className="w-full appearance-none rounded-[14px] border border-white/[0.08] bg-[#131B2B] px-4 py-3 pr-10 text-[13px] text-white focus:border-[#4285F4]/40 focus:outline-none"
              >
                {leadMachineListings.map((l) => (
                  <option key={l.id} value={l.id}>{l.projectName}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-white/30" />
            </div>
            {listing && (
              <div className="mt-1.5 text-[13px] text-white/30">
                {listing.area} · {listing.developer}
                {listing.startingPrice != null && (
                  <> · AED {(listing.startingPrice / 1_000_000).toFixed(1)}M from</>
                )}
              </div>
            )}
          </div>

          {/* Angle grid */}
          <div>
            <label className="mb-2 block text-[13px] font-medium uppercase tracking-[0.18em] text-white/40">
              Ad angle
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ANGLES.map((a) => (
                <button
                  key={a.value}
                  onClick={() => setAngle(a.value)}
                  className={[
                    'rounded-[12px] border p-3 text-left transition',
                    angle === a.value
                      ? 'border-[#4285F4]/40 bg-[#4285F4]/[0.08] text-white'
                      : 'border-white/[0.07] bg-[#131B2B] text-white/50 hover:border-white/20 hover:text-white/70',
                  ].join(' ')}
                >
                  <div className="text-[12px] font-semibold">{a.label}</div>
                  <div className="mt-0.5 text-[12px] leading-tight opacity-60">{a.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Tone row */}
          <div>
            <label className="mb-2 block text-[13px] font-medium uppercase tracking-[0.18em] text-white/40">
              Tone
            </label>
            <div className="flex gap-2">
              {TONES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTone(t.value)}
                  className={[
                    'flex-1 rounded-[12px] border py-2.5 text-[12px] font-medium transition',
                    tone === t.value
                      ? 'border-[#4285F4]/40 bg-[#4285F4]/[0.08] text-white'
                      : 'border-white/[0.07] bg-[#131B2B] text-white/45 hover:border-white/20 hover:text-white/70',
                  ].join(' ')}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={generate}
            disabled={loading || !listing}
            className="w-full rounded-full bg-[#4285F4] px-5 py-3 text-[14px] font-semibold text-white transition hover:bg-[#5A97F5] disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Sparkles className="h-4 w-4 animate-pulse" /> Generating…
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Wand2 className="h-4 w-4" /> Generate RSA variants
              </span>
            )}
          </button>

          {/* Config error */}
          {configErr && error && (
            <div className="rounded-[14px] border border-red-400/20 bg-red-400/[0.05] px-4 py-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                <div>
                  <p className="text-[12px] text-white/60">{error}</p>
                  <Link
                    href="/freehold-intelligence/integrations/google"
                    className="mt-1.5 inline-flex items-center gap-1 text-[13px] text-[#4285F4]/80 transition hover:text-[#4285F4]"
                  >
                    Set up Google Ads integration <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* General error */}
          {error && !configErr && (
            <div className="rounded-[14px] border border-red-400/20 bg-red-400/[0.05] px-4 py-3">
              <p className="text-[12px] text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* ── RIGHT: Results ──────────────────────────────────────────────── */}
        <div>

          {/* Empty placeholder */}
          {variants.length === 0 && !loading && (
            <div className="flex min-h-[400px] flex-col items-center justify-center rounded-[22px] border border-dashed border-white/[0.07] px-8 text-center">
              <Wand2 className="mb-4 h-8 w-8 text-white/15" />
              <div className="text-[14px] text-white/30">RSA copy will appear here</div>
              <div className="mt-4 max-w-xs rounded-[14px] border border-white/[0.08] bg-white/[0.02] px-4 py-4 text-left">
                <div className="mb-2 text-[12px] font-medium uppercase tracking-[0.18em] text-white/30">RSA format</div>
                <div className="space-y-1.5 text-[13px] text-white/40">
                  <div>
                    <span className="text-white/60 font-medium">Headlines</span> — up to 15, max 30 chars each
                  </div>
                  <div>
                    <span className="text-white/60 font-medium">Descriptions</span> — up to 4, max 90 chars each
                  </div>
                  <div className="pt-1 text-white/30">
                    Google automatically tests combinations and serves top-performing sets to each searcher.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
              <Sparkles className="h-6 w-6 animate-pulse text-[#4285F4]/60" />
              <div className="text-[13px] text-white/35">
                Building RSA variants — {angleConfig.label} · {tone}…
              </div>
            </div>
          )}

          {/* Variant cards */}
          {variants.length > 0 && (
            <div className="space-y-5">
              <div className="text-[13px] font-medium uppercase tracking-[0.18em] text-white/40">
                {variants.length} variant{variants.length !== 1 ? 's' : ''} — {angleConfig.label} · {tone}
              </div>

              {variants.map((v, i) => {
                const warnings = getWarnings(v)
                const copyAllText = buildCopyAll(v)

                return (
                  <div
                    key={v.id}
                    className="rounded-[22px] border border-white/[0.07] bg-[#131B2B] p-5"
                  >
                    {/* Variant header */}
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <span className="rounded-full bg-[#4285F4]/15 border border-[#4285F4]/25 px-2.5 py-1 text-[13px] font-semibold text-[#4285F4]">
                          Variant {i + 1}
                        </span>
                        {v.note && (
                          <p className="mt-2 text-[13px] leading-relaxed text-white/35">{v.note}</p>
                        )}
                      </div>
                      <CopyButton
                        text={copyAllText}
                        className="shrink-0 inline-flex items-center gap-1.5 rounded-[10px] border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[13px] font-medium text-white/45 transition hover:border-[#4285F4]/30 hover:text-white/80"
                      />
                    </div>

                    {/* Headlines section */}
                    <div className="mb-4">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-[12px] font-medium uppercase tracking-[0.16em] text-white/30">
                          Headlines
                        </span>
                        <span className="text-[12px] text-white/20">
                          {v.headlines.length}/15 max · 30 char limit
                        </span>
                      </div>
                      <div className="space-y-2">
                        {v.headlines.map((headline, hIdx) => (
                          <div
                            key={hIdx}
                            className="flex items-start justify-between gap-3 rounded-[10px] border border-white/[0.05] bg-white/[0.02] px-3 py-2.5"
                          >
                            <div className="flex items-baseline gap-2 min-w-0">
                              <span className="shrink-0 text-[12px] text-white/20 w-4">{hIdx + 1}.</span>
                              <span className="text-[13px] font-medium text-white/85 leading-snug break-words">
                                {headline}
                              </span>
                              <CharBadge
                                text={headline}
                                limit={HEADLINE_LIMIT}
                                warn={HEADLINE_WARN}
                              />
                            </div>
                            <CopyButton text={headline} />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Descriptions section */}
                    <div className="mb-4">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-[12px] font-medium uppercase tracking-[0.16em] text-white/30">
                          Descriptions
                        </span>
                        <span className="text-[12px] text-white/20">
                          {v.descriptions.length}/4 max · 90 char limit
                        </span>
                      </div>
                      <div className="space-y-2">
                        {v.descriptions.map((desc, dIdx) => (
                          <div
                            key={dIdx}
                            className="flex items-start justify-between gap-3 rounded-[10px] border border-white/[0.05] bg-white/[0.02] px-3 py-2.5"
                          >
                            <div className="flex items-baseline gap-2 min-w-0">
                              <span className="shrink-0 text-[12px] text-white/20 w-4">{dIdx + 1}.</span>
                              <span className="text-[12px] text-white/70 leading-snug break-words">
                                {desc}
                              </span>
                              <CharBadge
                                text={desc}
                                limit={DESCRIPTION_LIMIT}
                                warn={DESCRIPTION_WARN}
                              />
                            </div>
                            <CopyButton text={desc} />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Copy all for Google Ads button */}
                    <div className="border-t border-white/[0.05] pt-4">
                      <CopyButton
                        text={copyAllText}
                        className="inline-flex items-center gap-2 rounded-full bg-[#4285F4] px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-[#5A97F5]"
                      />
                      <span className="ml-2 text-[13px] text-white/25">
                        Copy all for Google Ads
                      </span>
                    </div>

                    {/* Char limit warning summary */}
                    {warnings.length > 0 && (
                      <div className="mt-3 rounded-[10px] border border-red-400/15 bg-red-400/[0.04] px-3 py-2.5">
                        <div className="mb-1 flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-[0.14em] text-red-400/70">
                          <AlertCircle className="h-3 w-3" /> Character limit exceeded
                        </div>
                        <div className="space-y-0.5">
                          {warnings.map((w, wIdx) => (
                            <div key={wIdx} className="text-[13px] text-red-400/70">
                              {w.type === 'headline' ? `Headline ${w.index}` : `Description ${w.index}`}: {w.len} chars (limit {w.limit})
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* RSA Best Practices info box */}
      <div className="mt-12 rounded-[20px] border border-[#4285F4]/15 bg-[#4285F4]/[0.04] p-5">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#4285F4]/60" />
          <div>
            <div className="mb-1.5 text-[13px] font-semibold uppercase tracking-[0.18em] text-[#4285F4]/70">
              RSA Best Practices
            </div>
            <p className="text-[12px] leading-relaxed text-white/45">
              Use 3+ unique themes across headlines, pin <code className="rounded bg-white/[0.06] px-1 py-0.5 text-[12px] font-mono text-white/60">HEADLINE_1</code> for brand or listing name,
              and ensure no redundant phrasing across pinned slots. Google requires at least 3 headlines
              and 2 descriptions. Strong RSAs with 15 headlines and 4 unique descriptions typically
              achieve &ldquo;Good&rdquo; or &ldquo;Excellent&rdquo; Ad Strength, which correlates with lower CPCs
              and higher impression share in the auction.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
