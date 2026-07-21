'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, Wand2, Copy, Check, ChevronDown, Sparkles, Building2 } from 'lucide-react'
import { useLiveProjects } from '@/lib/freehold/use-live-projects'
import type { CreativeAngle, CreativeTone, GeneratedCreativeVariant } from '@/lib/meta/types'
import type { MetaCta } from '@/lib/meta/types'
import { useT } from '@/lib/i18n/provider'
import { BRAND } from '@/lib/freehold/brand'

// Labels/descriptions live in i18n (lm.creatives.generate.angle|tone|cta.*) so
// the option list is fully trilingual; the array carries the stable value keys.
const ANGLES: { value: CreativeAngle; labelKey: string; descKey: string }[] = [
  { value: 'investor',    labelKey: 'lm.creatives.generate.angle.investor.label',    descKey: 'lm.creatives.generate.angle.investor.desc' },
  { value: 'yield',       labelKey: 'lm.creatives.generate.angle.yield.label',       descKey: 'lm.creatives.generate.angle.yield.desc' },
  { value: 'golden_visa', labelKey: 'lm.creatives.generate.angle.golden_visa.label', descKey: 'lm.creatives.generate.angle.golden_visa.desc' },
  { value: 'end_user',    labelKey: 'lm.creatives.generate.angle.end_user.label',    descKey: 'lm.creatives.generate.angle.end_user.desc' },
  { value: 'urgency',     labelKey: 'lm.creatives.generate.angle.urgency.label',     descKey: 'lm.creatives.generate.angle.urgency.desc' },
  { value: 'lifestyle',   labelKey: 'lm.creatives.generate.angle.lifestyle.label',   descKey: 'lm.creatives.generate.angle.lifestyle.desc' },
]

const TONES: { value: CreativeTone; labelKey: string; descKey: string }[] = [
  { value: 'direct',       labelKey: 'lm.creatives.generate.tone.direct.label',       descKey: 'lm.creatives.generate.tone.direct.desc' },
  { value: 'aspirational', labelKey: 'lm.creatives.generate.tone.aspirational.label', descKey: 'lm.creatives.generate.tone.aspirational.desc' },
  { value: 'premium',      labelKey: 'lm.creatives.generate.tone.premium.label',      descKey: 'lm.creatives.generate.tone.premium.desc' },
]

const CTAS: { value: MetaCta; labelKey: string }[] = [
  { value: 'LEARN_MORE',  labelKey: 'lm.creatives.generate.cta.LEARN_MORE'  },
  { value: 'GET_QUOTE',   labelKey: 'lm.creatives.generate.cta.GET_QUOTE'   },
  { value: 'SIGN_UP',     labelKey: 'lm.creatives.generate.cta.SIGN_UP'     },
  { value: 'CONTACT_US',  labelKey: 'lm.creatives.generate.cta.CONTACT_US'  },
  { value: 'BOOK_NOW',    labelKey: 'lm.creatives.generate.cta.BOOK_NOW'    },
  { value: 'APPLY_NOW',   labelKey: 'lm.creatives.generate.cta.APPLY_NOW'   },
]

function CopyButton({ text }: { text: string }) {
  const t = useT()
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
      {copied ? <Check className="h-3 w-3 text-gold" /> : <Copy className="h-3 w-3" />}
      {copied ? t('lm.creatives.generate.copied') : t('lm.creatives.generate.copy')}
    </button>
  )
}

export default function GenerateCreativePage() {
  const t = useT()
  const { projects, loading: projectsLoading } = useLiveProjects()
  const [listingId, setListingId] = useState('')
  // Default to the first LIVE project once inventory loads.
  useEffect(() => {
    if (!listingId && projects.length) setListingId(projects[0].id)
  }, [projects, listingId])
  const [angle, setAngle]         = useState<CreativeAngle>('investor')
  const [tone, setTone]           = useState<CreativeTone>('direct')
  const [cta, setCta]             = useState<MetaCta>('LEARN_MORE')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [variants, setVariants]   = useState<GeneratedCreativeVariant[]>([])
  const [savedIds, setSavedIds]   = useState<Set<string>>(new Set())

  // Save a generated creative to the Library (AI Suite → Library → Creatives).
  async function saveToLibrary(v: GeneratedCreativeVariant) {
    try {
      const res = await fetch('/api/freehold/library', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'creative',
          title: `${listing?.name ?? override?.name ?? 'Creative'} — ${v.headline}`.slice(0, 180),
          content: `Headline: ${v.headline}\n\nPrimary text:\n${v.primaryText}\n\nDescription: ${v.description}\nCTA: ${v.cta}`,
        }),
      })
      if (!res.ok) throw new Error('save failed')
      setSavedIds((prev) => new Set([...prev, v.id]))
      toast.success(t('lm.creatives.generate.saveOk'))
    } catch { toast.error(t('lm.creatives.generate.saveFailed')) }
  }
  // Real-project override: arriving with ?project=&name=&area=&price= from a
  // project page pre-fills the generator without waiting for the picker.
  const [override, setOverride] = useState<{ slug: string; name: string; area: string; developer: string; price: number } | null>(null)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const name = p.get('name'); const slug = p.get('project')
    if (!name && !slug) return
    setOverride({
      slug: slug || '',
      name: name || slug || '',
      area: p.get('area') || '',
      developer: p.get('developer') || '',
      price: Number(p.get('price')) || 0,
    })
  }, [])

  const listing = projects.find((l) => l.id === listingId)

  async function generate() {
    // Override (real project) takes precedence over the selected seed listing.
    const ctx = override
      ? { id: override.slug || override.name, name: override.name, area: override.area, developer: override.developer, price: override.price, paymentPlan: '' }
      : listing
        // The API requires a non-empty developer — '' made EVERY picker-path
        // generation fail with a 400. Fall back to the brand when unknown.
        ? { id: listing.id, name: listing.name, area: listing.area, developer: BRAND.company, price: listing.priceAED ?? 0, paymentPlan: listing.paymentPlan ?? '' }
        : null
    if (!ctx) return
    setLoading(true)
    setError(null)
    setVariants([])
    try {
      const res  = await fetch('/api/meta/creatives/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          listingId:    ctx.id,
          listingName:  ctx.name,
          area:         ctx.area,
          developer:    ctx.developer,
          startingPrice: ctx.price,
          paymentPlan:  ctx.paymentPlan,
          angle,
          tone,
          cta,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error('generation failed')
      setVariants(json.variants ?? [])
    } catch {
      setError(t('lm.creatives.generate.failed'))
    } finally {
      setLoading(false)
    }
  }

  const angleConfig    = ANGLES.find((a) => a.value === angle)!
  // In override mode the campaign link must carry the OVERRIDDEN project —
  // not the picker's default — or "Use in campaign" targets the wrong listing.
  const campaignNewUrl = override
    ? `/freehold-intelligence/lead-machine/campaigns/new?project=${encodeURIComponent(override.slug || override.name)}&name=${encodeURIComponent(override.name)}${override.price ? `&price=${override.price}` : ''}`
    : `/freehold-intelligence/lead-machine/campaigns/new?listingId=${listingId}`

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      <Link
        href="/freehold-intelligence/lead-machine/creatives"
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {t('lm.creatives.generate.back')}
      </Link>

      {/* Header */}
      <section className="mt-7">
        <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-gold/85">
          <Wand2 className="h-3.5 w-3.5" /> {t('lm.creatives.generate.eyebrow')}
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
          {t('lm.creatives.generate.title')}<br />
          <span className="text-slate-500">{t('lm.creatives.generate.titleSub')}</span>
        </h1>
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-[380px_1fr]">

        {/* Controls */}
        <div className="space-y-5">

          {/* Listing */}
          <div>
            <label className="mb-2 block text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
              {t('lm.creatives.generate.label.listing')}
            </label>
            {override ? (
              <div className="rounded-[14px] border border-gold/30 bg-gold/[0.05] px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Building2 className="h-4 w-4 text-gold" /> {override.name}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  {[override.area, override.developer].filter(Boolean).join(' · ')}
                  {override.price > 0 && <> · AED {(override.price / 1_000_000).toFixed(1)}M from</>}
                </div>
              </div>
            ) : (
              <>
                <div className="relative">
                  <select
                    value={listingId}
                    onChange={(e) => setListingId(e.target.value)}
                    className="w-full appearance-none rounded-[14px] border border-line bg-surface px-4 py-3 pe-10 text-sm text-white focus:border-gold/40 focus:outline-none"
                  >
                    {projectsLoading && <option value="">…</option>}
                    {projects.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute end-3 top-3.5 h-4 w-4 text-slate-500" />
                </div>
                {listing && (
                  <div className="mt-1.5 text-sm text-slate-500">
                    {listing.area}
                    {listing.priceAED && (
                      <> · AED {(listing.priceAED / 1_000_000).toFixed(1)}M from</>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Angle */}
          <div>
            <label className="mb-2 block text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
              {t('lm.creatives.generate.label.angle')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ANGLES.map((a) => (
                <button
                  key={a.value}
                  onClick={() => setAngle(a.value)}
                  className={[
                    'rounded-[12px] border p-3 text-left transition',
                    angle === a.value
                      ? 'border-gold/40 bg-gold/[0.07] text-white'
                      : 'border-line bg-surface text-slate-400 hover:border-white/20 hover:text-slate-300',
                  ].join(' ')}
                >
                  <div className="text-xs font-semibold">{t(a.labelKey)}</div>
                  <div className="mt-0.5 text-xs leading-tight opacity-60">{t(a.descKey)}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Tone */}
          <div>
            <label className="mb-2 block text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
              {t('lm.creatives.generate.label.tone')}
            </label>
            <div className="flex gap-2">
              {TONES.map((tn) => (
                <button
                  key={tn.value}
                  onClick={() => setTone(tn.value)}
                  className={[
                    'flex-1 rounded-[12px] border py-2.5 text-xs font-medium transition',
                    tone === tn.value
                      ? 'border-gold/40 bg-gold/[0.07] text-white'
                      : 'border-line bg-surface text-slate-500 hover:text-slate-300',
                  ].join(' ')}
                >
                  {t(tn.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div>
            <label className="mb-2 block text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
              {t('lm.creatives.generate.label.cta')}
            </label>
            <div className="relative">
              <select
                value={cta}
                onChange={(e) => setCta(e.target.value as MetaCta)}
                className="w-full appearance-none rounded-[14px] border border-line bg-surface px-4 py-3 pe-10 text-sm text-white focus:border-gold/40 focus:outline-none"
              >
                {CTAS.map((c) => (
                  <option key={c.value} value={c.value}>{t(c.labelKey)}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute end-3 top-3.5 h-4 w-4 text-slate-500" />
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={generate}
            disabled={loading || !listing}
            className="w-full rounded-full bg-gold px-5 py-3 text-[14px] font-semibold text-ink transition hover:bg-[#F8E7AE] disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Sparkles className="h-4 w-4 animate-pulse" /> {t('lm.creatives.generate.generating')}
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Wand2 className="h-4 w-4" /> {t('lm.creatives.generate.generateBtn')}
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
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-[24px] border border-dashed border-line text-center">
              <Wand2 className="mx-auto h-8 w-8 text-slate-600 mb-3" />
              <div className="text-[14px] text-slate-500">{t('lm.creatives.generate.emptyTitle')}</div>
              <p className="mt-1 text-xs text-slate-600">
                {t('lm.creatives.generate.emptyNote', { angles: String(ANGLES.length), tones: String(TONES.length) })}
              </p>
            </div>
          )}

          {loading && (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3">
              <Sparkles className="h-6 w-6 animate-pulse text-gold/60" />
              <div className="text-sm text-slate-500">{t('lm.creatives.generate.building')}</div>
            </div>
          )}

          {variants.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
                    {t('lm.creatives.generate.variantLabel', {
                      n: String(variants.length),
                      plural: variants.length !== 1 ? 's' : '',
                      angle: t(angleConfig.labelKey),
                      tone: t(TONES.find((tn) => tn.value === tone)!.labelKey),
                    })}
                  </div>
                </div>
                <Link
                  href={campaignNewUrl}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-1.5 text-xs font-semibold text-ink transition hover:bg-[#F8E7AE]"
                >
                  {t('lm.creatives.generate.useInCampaign')}
                </Link>
              </div>

              {variants.map((v, i) => (
                <div key={v.id} className="rounded-[20px] border border-line bg-surface p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-600">
                      {t('lm.creatives.generate.variantNum', { n: String(i + 1) })}
                    </span>
                    <span className="flex items-center gap-2">
                      <button
                        onClick={() => saveToLibrary(v)}
                        className="rounded-full border border-gold/25 bg-gold/[0.06] px-2.5 py-0.5 text-xs font-medium text-gold transition hover:bg-gold/[0.14]"
                      >
                        {savedIds.has(v.id) ? t('lm.creatives.generate.savedLib') : t('lm.creatives.generate.saveLib')}
                      </button>
                      <span className="rounded-full border border-line px-2.5 py-0.5 text-xs text-slate-500">
                        {v.cta.replace(/_/g, ' ')}
                      </span>
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <div className="text-xs text-slate-500 uppercase tracking-[0.14em]">{t('lm.creatives.generate.field.headline')}</div>
                        <CopyButton text={v.headline} />
                      </div>
                      <p className="text-sm font-semibold text-white leading-snug">{v.headline}</p>
                    </div>

                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <div className="text-xs text-slate-500 uppercase tracking-[0.14em]">{t('lm.creatives.generate.field.primaryText')}</div>
                        <CopyButton text={v.primaryText} />
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed">{v.primaryText}</p>
                    </div>

                    {v.description && (
                      <div>
                        <div className="mb-1 flex items-center justify-between">
                          <div className="text-xs text-slate-500 uppercase tracking-[0.14em]">{t('lm.creatives.generate.field.description')}</div>
                          <CopyButton text={v.description} />
                        </div>
                        <p className="text-xs text-slate-500">{v.description}</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 border-t border-line pt-3 flex justify-between items-center">
                    <button
                      onClick={() => {
                        const full = `HEADLINE:\n${v.headline}\n\nPRIMARY TEXT:\n${v.primaryText}\n\nDESCRIPTION:\n${v.description}\n\nCTA: ${v.cta}`
                        navigator.clipboard.writeText(full)
                      }}
                      className="text-sm text-slate-600 transition hover:text-slate-400"
                    >
                      {t('lm.creatives.generate.copyAll')}
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
