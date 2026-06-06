'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Wand2, Copy, Check, ChevronDown, Sparkles } from 'lucide-react'
import { leadMachineListings } from '@/src/features/freehold-intelligence/lead-machine'
import type { CreativeAngle, CreativeTone, GeneratedCreativeVariant } from '@/lib/meta/types'
import type { MetaCta } from '@/lib/meta/types'

const ANGLES: { value: CreativeAngle; label: string; desc: string }[] = [
  { value: 'investor',    label: 'Investor ROI',    desc: 'Net yield, capital appreciation, rental demand' },
  { value: 'yield',       label: 'Yield-first',     desc: 'Specific % return, rental income numbers' },
  { value: 'golden_visa', label: 'Golden Visa',      desc: 'Residency eligibility, 10-year visa benefit' },
  { value: 'end_user',    label: 'End User',         desc: 'Lifestyle, family living, community benefits' },
  { value: 'urgency',     label: 'Urgency / FOMO',   desc: 'Limited units, phase close, price lock-in' },
  { value: 'lifestyle',   label: 'Lifestyle',        desc: 'Views, amenities, neighbourhood feel' },
]

const TONES: { value: CreativeTone; label: string; desc: string }[] = [
  { value: 'direct',       label: 'Direct',       desc: 'Clear, factual, numbers-first' },
  { value: 'aspirational', label: 'Aspirational', desc: 'Elevated, dream-lifestyle tone' },
  { value: 'premium',      label: 'Premium',      desc: 'Luxury, exclusivity, discretion' },
]

const CTAS: { value: MetaCta; label: string }[] = [
  { value: 'LEARN_MORE',  label: 'Learn More'  },
  { value: 'GET_QUOTE',   label: 'Get Quote'   },
  { value: 'SIGN_UP',     label: 'Sign Up'     },
  { value: 'CONTACT_US',  label: 'Contact Us'  },
  { value: 'BOOK_NOW',    label: 'Book Now'    },
  { value: 'APPLY_NOW',   label: 'Apply Now'   },
]

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1 text-sm text-slate-600 transition hover:text-slate-400"
    >
      {copied ? <Check className="h-3 w-3 text-[#D4AF37]" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

export default function GenerateCreativePage() {
  const [listingId, setListingId] = useState(leadMachineListings[0]?.id ?? '')
  const [angle, setAngle]         = useState<CreativeAngle>('investor')
  const [tone, setTone]           = useState<CreativeTone>('direct')
  const [cta, setCta]             = useState<MetaCta>('LEARN_MORE')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [variants, setVariants]   = useState<GeneratedCreativeVariant[]>([])

  const listing = leadMachineListings.find((l) => l.id === listingId)

  async function generate() {
    if (!listing) return
    setLoading(true)
    setError(null)
    setVariants([])
    try {
      const res  = await fetch('/api/meta/creatives/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          listingId:    listing.id,
          listingName:  listing.projectName,
          area:         listing.area,
          developer:    listing.developer,
          startingPrice: listing.startingPrice,
          paymentPlan:  listing.paymentPlan,
          angle,
          tone,
          cta,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Generation failed')
      setVariants(json.variants ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unexpected error')
    } finally {
      setLoading(false)
    }
  }

  const angleConfig    = ANGLES.find((a) => a.value === angle)!
  const campaignNewUrl = `/freehold-intelligence/lead-machine/campaigns/new?listingId=${listingId}`

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      <Link
        href="/freehold-intelligence/lead-machine/creatives"
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Creative library
      </Link>

      {/* Header */}
      <section className="mt-7">
        <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-[#D4AF37]/85">
          <Wand2 className="h-3.5 w-3.5" /> AI Copy Generator
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
          Generate ad copy<br />
          <span className="text-slate-500">angle + tone → variants.</span>
        </h1>
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-[380px_1fr]">

        {/* Controls */}
        <div className="space-y-5">

          {/* Listing */}
          <div>
            <label className="mb-2 block text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
              Listing
            </label>
            <div className="relative">
              <select
                value={listingId}
                onChange={(e) => setListingId(e.target.value)}
                className="w-full appearance-none rounded-[14px] border border-slate-800 bg-slate-900 px-4 py-3 pr-10 text-sm text-white focus:border-[#D4AF37]/40 focus:outline-none"
              >
                {leadMachineListings.map((l) => (
                  <option key={l.id} value={l.id}>{l.projectName}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-500" />
            </div>
            {listing && (
              <div className="mt-1.5 text-sm text-slate-500">
                {listing.area} · {listing.developer}
                {listing.startingPrice && (
                  <> · AED {(listing.startingPrice / 1_000_000).toFixed(1)}M from</>
                )}
              </div>
            )}
          </div>

          {/* Angle */}
          <div>
            <label className="mb-2 block text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
              Creative angle
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ANGLES.map((a) => (
                <button
                  key={a.value}
                  onClick={() => setAngle(a.value)}
                  className={[
                    'rounded-[12px] border p-3 text-left transition',
                    angle === a.value
                      ? 'border-[#D4AF37]/40 bg-[#D4AF37]/[0.07] text-white'
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-white/20 hover:text-slate-300',
                  ].join(' ')}
                >
                  <div className="text-xs font-semibold">{a.label}</div>
                  <div className="mt-0.5 text-xs leading-tight opacity-60">{a.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Tone */}
          <div>
            <label className="mb-2 block text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
              Tone
            </label>
            <div className="flex gap-2">
              {TONES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTone(t.value)}
                  className={[
                    'flex-1 rounded-[12px] border py-2.5 text-xs font-medium transition',
                    tone === t.value
                      ? 'border-[#D4AF37]/40 bg-[#D4AF37]/[0.07] text-white'
                      : 'border-slate-800 bg-slate-900 text-slate-500 hover:text-slate-300',
                  ].join(' ')}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div>
            <label className="mb-2 block text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
              Call to action
            </label>
            <div className="relative">
              <select
                value={cta}
                onChange={(e) => setCta(e.target.value as MetaCta)}
                className="w-full appearance-none rounded-[14px] border border-slate-800 bg-slate-900 px-4 py-3 pr-10 text-sm text-white focus:border-[#D4AF37]/40 focus:outline-none"
              >
                {CTAS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-500" />
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={generate}
            disabled={loading || !listing}
            className="w-full rounded-full bg-[#D4AF37] px-5 py-3 text-[14px] font-semibold text-[#0D1117] transition hover:bg-[#F8E7AE] disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Sparkles className="h-4 w-4 animate-pulse" /> Generating…
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Wand2 className="h-4 w-4" /> Generate variants
              </span>
            )}
          </button>

          {error && (
            <p className="rounded-[12px] border border-red-400/20 bg-red-400/[0.05] px-4 py-3 text-xs text-red-400">
              {error}
            </p>
          )}
        </div>

        {/* Variants */}
        <div>
          {variants.length === 0 && !loading && (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-800 text-center">
              <Wand2 className="mx-auto h-8 w-8 text-slate-600 mb-3" />
              <div className="text-[14px] text-slate-500">Configure options and generate</div>
              <p className="mt-1 text-xs text-slate-600">
                {ANGLES.length} angles × {TONES.length} tones — up to 12 variants per run
              </p>
            </div>
          )}

          {loading && (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3">
              <Sparkles className="h-6 w-6 animate-pulse text-[#D4AF37]/60" />
              <div className="text-sm text-slate-500">Building copy variants…</div>
            </div>
          )}

          {variants.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
                    {variants.length} variant{variants.length !== 1 ? 's' : ''} — {angleConfig.label} · {tone}
                  </div>
                </div>
                <Link
                  href={campaignNewUrl}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#D4AF37] px-4 py-1.5 text-xs font-semibold text-[#0D1117] transition hover:bg-[#F8E7AE]"
                >
                  Use in campaign
                </Link>
              </div>

              {variants.map((v, i) => (
                <div key={v.id} className="rounded-[20px] border border-slate-800 bg-slate-900 p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-600">
                      Variant {i + 1}
                    </span>
                    <span className="rounded-full border border-slate-800 px-2.5 py-0.5 text-xs text-slate-500">
                      {v.cta.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <div className="text-xs text-slate-500 uppercase tracking-[0.14em]">Headline</div>
                        <CopyButton text={v.headline} />
                      </div>
                      <p className="text-sm font-semibold text-white leading-snug">{v.headline}</p>
                    </div>

                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <div className="text-xs text-slate-500 uppercase tracking-[0.14em]">Primary text</div>
                        <CopyButton text={v.primaryText} />
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed">{v.primaryText}</p>
                    </div>

                    {v.description && (
                      <div>
                        <div className="mb-1 flex items-center justify-between">
                          <div className="text-xs text-slate-500 uppercase tracking-[0.14em]">Description</div>
                          <CopyButton text={v.description} />
                        </div>
                        <p className="text-xs text-slate-500">{v.description}</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 border-t border-slate-800 pt-3 flex justify-between items-center">
                    <code className="text-xs font-mono text-slate-600">{v.id}</code>
                    <button
                      onClick={() => {
                        const full = `HEADLINE:\n${v.headline}\n\nPRIMARY TEXT:\n${v.primaryText}\n\nDESCRIPTION:\n${v.description}\n\nCTA: ${v.cta}`
                        navigator.clipboard.writeText(full)
                      }}
                      className="text-sm text-slate-600 transition hover:text-slate-400"
                    >
                      Copy all
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
