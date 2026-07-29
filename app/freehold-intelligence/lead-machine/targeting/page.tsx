'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { Target, Users, Globe, ArrowUpRight, Zap, MapPin, Sliders, Search, X, Sparkles, Loader2 } from 'lucide-react'
import { UAE_INTERESTS, STRATEGY_LABELS, type TargetingRecommendation } from '@/lib/meta/targeting-catalog'
import { TARGETING_TEMPLATES } from '@/lib/meta/targeting-templates'
import type { TargetingUseCase } from '@/lib/meta/types'
import { useT } from '@/lib/i18n/provider'

const USE_CASE_BADGE: Record<TargetingUseCase, { color: string; badge: string }> = {
  investor:       { color: 'text-gold',        badge: 'border-gold/25 bg-gold/10 text-gold-bright'   },
  end_user:       { color: 'text-gold',        badge: 'border-gold/20 bg-gold/10 text-gold'         },
  golden_visa:    { color: 'text-slate-400',   badge: 'border-teal-400/20 bg-teal-400/10 text-teal-200' },
  secondary:      { color: 'text-slate-400',   badge: 'border-violet-400/20 bg-violet-400/10 text-slate-400' },
  international:  { color: 'text-slate-400',   badge: 'border-rose-400/20 bg-rose-400/10 text-rose-200' },
  custom:         { color: 'text-slate-400',   badge: 'border-white/10 bg-surface-2 text-slate-400' },
}

const UAE_CITIES = [
  { key: '2562407', name: 'Dubai'        },
  { key: '2563573', name: 'Abu Dhabi'    },
  { key: '2565040', name: 'Sharjah'      },
  { key: '2559677', name: 'Ajman'        },
  { key: '2566793', name: 'Ras Al Khaimah' },
]

function cityName(key: string): string {
  return UAE_CITIES.find((c) => c.key === key)?.name ?? key
}

function countryName(code: string): string {
  const map: Record<string, string> = { AE: 'UAE', SA: 'Saudi Arabia', KW: 'Kuwait', QA: 'Qatar', BH: 'Bahrain', OM: 'Oman', GB: 'UK', DE: 'Germany', IN: 'India' }
  return map[code] ?? code
}

type UseCaseFilter = 'All' | 'investor' | 'end_user' | 'golden_visa' | 'secondary' | 'international' | 'custom'

type LoopPerf = { id: string; name: string; spendAED: number; cpl: number | null; crm: { total: number; qualified: number; closed: number; lost: number } }

export default function TargetingPage() {
  const t = useT()
  const [useCaseFilter, setUseCaseFilter] = useState<UseCaseFilter>('All')
  const [query, setQuery] = useState('')

  // The learning loop: what the last campaigns' LEADS actually did, and the
  // AI's recommendation for the next round — same engine as the wizard.
  const [loop, setLoop] = useState<{ recommendation: TargetingRecommendation; performance: LoopPerf[] } | null>(null)
  const [loopLoading, setLoopLoading] = useState(false)
  async function fetchLoop() {
    setLoopLoading(true)
    try {
      const res = await fetch('/api/freehold/ai/targeting', { cache: 'no-store' })
      const d = await res.json()
      if (res.ok && d?.recommendation) setLoop({ recommendation: d.recommendation, performance: d.performance ?? [] })
    } catch { /* panel stays collapsed */ }
    finally { setLoopLoading(false) }
  }

  // Real per-listing Buyer Match — pick a listing, see who actually buys it
  // (from our own deals) + a live Meta reach estimate. Same engine as the wizard.
  type BM = {
    band: { label: string }
    buyers: { deals: number; avgValue: number; closeRate: number | null; topSources: { source: string; count: number }[]; hasData: boolean }
    recommendation: { ageMin: number; ageMax: number; interestNames: string[] }
    estimate: { lower: number; upper: number } | null
    metaConnected: boolean
  }
  const [listings, setListings] = useState<{ id: string; name: string; area: string }[]>([])
  const [pickedId, setPickedId] = useState('')
  const [bm, setBm] = useState<BM | null>(null)
  const [bmLoading, setBmLoading] = useState(false)
  useEffect(() => {
    fetch('/api/freehold/inventory')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setListings((d?.properties || []).map((p: Record<string, unknown>) => ({ id: String(p.slug || ''), name: String(p.name || ''), area: String(p.area || '') })).filter((l: { id: string; name: string }) => l.id && l.name)))
      .catch(() => {})
  }, [])
  async function runBM(id: string) {
    setPickedId(id)
    if (!id) { setBm(null); return }
    setBmLoading(true); setBm(null)
    try {
      const res = await fetch('/api/freehold/ads/buyer-match', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listingSlug: id }) })
      const d = await res.json()
      if (!d.error) setBm(d as BM)
    } catch { /* keep empty */ }
    finally { setBmLoading(false) }
  }
  const fmtK = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n))

  const filtered = useMemo(() => {
    let items = TARGETING_TEMPLATES
    if (useCaseFilter !== 'All') {
      items = items.filter((tmpl) => tmpl.useCase === useCaseFilter)
    }
    if (query.trim()) {
      const q = query.toLowerCase()
      items = items.filter((tmpl) =>
        tmpl.name.toLowerCase().includes(q) ||
        tmpl.description.toLowerCase().includes(q)
      )
    }
    return items
  }, [useCaseFilter, query])

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      {/* Buyer Match — the real tool: who actually buys THIS listing, + live reach */}
      <section className="mb-8 rounded-2xl border border-gold/25 bg-gradient-to-br from-gold/[0.08] via-gold/[0.02] to-transparent p-5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold"><Target className="h-4 w-4" /> {t('bm.title')}</div>
        <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-slate-400">{t('lm.targeting.bmHint')}</p>
        <select value={pickedId} onChange={(e) => runBM(e.target.value)}
          className="mt-3 w-full max-w-md rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-white outline-none focus:border-gold/40">
          <option value="">{t('lm.targeting.bmPick')}</option>
          {listings.map((l) => <option key={l.id} value={l.id}>{l.name}{l.area ? ` · ${l.area}` : ''}</option>)}
        </select>

        {bmLoading ? (
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> {t('bm.loading')}</div>
        ) : bm ? (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-[11px] font-semibold text-gold">{bm.band.label}</span>
              {bm.estimate
                ? <span className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-[11px] text-slate-200">{fmtK(bm.estimate.lower)}–{fmtK(bm.estimate.upper)} · {t('bm.liveReach')}</span>
                : <span className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-[11px] text-slate-400">{bm.metaConnected ? t('bm.reachWarming') : t('bm.connectMeta')}</span>}
            </div>
            {bm.buyers.hasData ? (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl border border-line bg-surface p-2.5"><div className="text-[17px] font-semibold text-gold">{bm.buyers.deals}</div><div className="text-[10px] text-slate-500">{t('bm.closedDeals')}</div></div>
                <div className="rounded-xl border border-line bg-surface p-2.5"><div className="text-[17px] font-semibold text-white">{bm.buyers.avgValue >= 1e6 ? `${(bm.buyers.avgValue / 1e6).toFixed(1)}M` : bm.buyers.avgValue ? `${Math.round(bm.buyers.avgValue / 1000)}K` : '—'}</div><div className="text-[10px] text-slate-500">{t('bm.avgValue')}</div></div>
                <div className="rounded-xl border border-line bg-surface p-2.5"><div className="text-[17px] font-semibold text-emerald-400">{bm.buyers.closeRate != null ? `${bm.buyers.closeRate}%` : '—'}</div><div className="text-[10px] text-slate-500">{t('bm.closeRate')}</div></div>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-line bg-surface/40 p-3 text-xs leading-relaxed text-slate-400">{t('bm.noData')}</p>
            )}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="text-slate-500">{t('bm.recommended')}:</span>
              <span className="text-slate-200">{bm.recommendation.ageMin}–{bm.recommendation.ageMax}</span>
              {bm.recommendation.interestNames.map((n) => <span key={n} className="rounded-full border border-gold/25 bg-gold/10 px-2 py-0.5 text-gold">{n}</span>)}
            </div>
            <Link href={`/freehold-intelligence/lead-machine/campaigns/new?project=${pickedId}`} className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-xs font-semibold text-ink transition hover:opacity-90">
              {t('lm.targeting.bmUse')} <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
            <p className="text-[10px] text-slate-600">{t('bm.provenance')}</p>
          </div>
        ) : null}
      </section>

      {/* Learning loop — leads → analysis → better targeting every round */}
      <section className="mb-8 rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/[0.08] via-gold/[0.02] to-transparent p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold">
            <Sparkles className="h-4 w-4" /> {t('lm.targeting.loop.title')}
          </div>
          <button
            onClick={fetchLoop}
            disabled={loopLoading}
            className="rounded-full bg-gold px-3.5 py-1.5 text-xs font-semibold text-ink transition hover:opacity-90 disabled:opacity-60"
          >
            {loopLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : loop ? t('lm.targeting.loop.refresh') : t('lm.targeting.loop.run')}
          </button>
        </div>
        {!loop && !loopLoading && (
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-slate-400">{t('lm.targeting.loop.hint')}</p>
        )}
        {loop && (
          <div className="mt-3 space-y-3">
            <p className="text-sm leading-relaxed text-slate-200">{loop.recommendation.analysis}</p>
            {loop.recommendation.signalPlan && (
              <p className="text-xs leading-relaxed text-slate-400">{loop.recommendation.signalPlan}</p>
            )}
            {loop.recommendation.creativeAngle && (
              <p className="text-xs leading-relaxed text-slate-400">{loop.recommendation.creativeAngle}</p>
            )}
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-full border border-gold/40 bg-gold/15 px-2.5 py-0.5 text-[11px] font-semibold text-gold">
                {STRATEGY_LABELS[loop.recommendation.strategy]}
              </span>
              {UAE_INTERESTS.filter((i) => loop.recommendation.interestIds.includes(i.id)).map((i) => (
                <span key={i.id} className="rounded-full border border-gold/25 bg-gold/10 px-2 py-0.5 text-[11px] text-gold">{i.name}</span>
              ))}
              <span className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[11px] text-slate-300">{loop.recommendation.ageMin}–{loop.recommendation.ageMax}</span>
              <span className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[11px] text-slate-300">AED {loop.recommendation.dailyBudgetAED}/d</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-400">{loop.recommendation.rationale}</p>
            {loop.performance.length > 0 && (
              <div className="divide-y divide-white/[0.05] overflow-hidden rounded-xl border border-line bg-surface">
                {loop.performance.slice(0, 6).map((c) => (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                    <span className="min-w-0 flex-1 truncate font-medium text-slate-200">{c.name}</span>
                    <span className="shrink-0 text-slate-500">{c.cpl ? `AED ${c.cpl}/lead` : '—'}</span>
                    <span className="shrink-0 text-gold">{c.crm.qualified} {t('lm.targeting.loop.qualified')}</span>
                    <span className="shrink-0 text-red-300">{c.crm.lost} {t('lm.targeting.loop.lost')}</span>
                  </div>
                ))}
              </div>
            )}
            <Link
              href="/freehold-intelligence/lead-machine/campaigns/new"
              className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-xs font-semibold text-ink transition hover:opacity-90"
            >
              {t('lm.targeting.loop.useIt')} <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </section>

      {/* Header */}
      <section>
        <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-gold/85">
          <Target className="h-3.5 w-3.5" /> {t('lm.targeting.eyebrow')}
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
          {t('lm.targeting.title')}<br />
          <span className="text-slate-500">{t('lm.targeting.titleSub', { n: String(TARGETING_TEMPLATES.length) })}</span>
        </h1>
        <p className="mt-5 max-w-xl text-sm leading-[1.65] text-slate-400">
          {t('lm.targeting.desc')}
        </p>
      </section>

      {/* How targeting works */}
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {[
          { icon: Users,   titleKey: 'lm.targeting.info.behaviour',  bodyKey: 'lm.targeting.info.behaviourBody' },
          { icon: MapPin,  titleKey: 'lm.targeting.info.geo',         bodyKey: 'lm.targeting.info.geoBody' },
          { icon: Sliders, titleKey: 'lm.targeting.info.editable',    bodyKey: 'lm.targeting.info.editableBody' },
        ].map(({ icon: Icon, titleKey, bodyKey }) => (
          <div key={titleKey} className="rounded-[18px] border border-line bg-surface p-5">
            <Icon className="h-4 w-4 text-gold/60 mb-2" />
            <div className="text-sm font-semibold text-white">{t(titleKey)}</div>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">{t(bodyKey)}</p>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="mt-8">
        {/* Search bar */}
        <div className="relative">
          <Search className="pointer-events-none absolute start-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('lm.targeting.searchPlaceholder')}
            className="w-full rounded-xl border border-line bg-surface-2 py-2.5 ps-9 pe-9 text-sm text-slate-100 placeholder:text-slate-600 focus:border-gold/40 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute end-3.5 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-400"
              aria-label={t('lm.targeting.clearSearch')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Use-case filter pills */}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => setUseCaseFilter('All')}
            className={`rounded-full border px-3 py-1 text-sm font-medium transition ${
              useCaseFilter === 'All'
                ? 'border-gold/40 bg-gold/10 text-gold'
                : 'border-line bg-surface-2 text-slate-500 hover:text-slate-300'
            }`}
          >
            {t('lm.requests.filter.all')}
          </button>
          {(Object.keys(USE_CASE_BADGE) as TargetingUseCase[]).map((key) => (
            <button
              key={key}
              onClick={() => setUseCaseFilter(key)}
              className={`rounded-full border px-3 py-1 text-sm font-medium transition ${
                useCaseFilter === key
                  ? USE_CASE_BADGE[key].badge
                  : 'border-line bg-surface-2 text-slate-500 hover:text-slate-300'
              }`}
            >
              {t(`lm.targeting.useCase.${key}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Templates */}
      <section className="mt-12">
        <div className="text-sm font-medium uppercase tracking-wider text-slate-500">
          {t('lm.targeting.sectionHeader', { n: String(filtered.length), total: String(TARGETING_TEMPLATES.length) })}
        </div>

        {filtered.length === 0 ? (
          <div className="mt-8 flex flex-col items-center gap-4 py-16 text-center">
            <p className="text-sm text-slate-500">{t('lm.targeting.noMatch')}</p>
            <button
              onClick={() => { setUseCaseFilter('All'); setQuery('') }}
              className="rounded-full border border-line bg-surface-2 px-4 py-1.5 text-xs font-medium text-slate-400 transition hover:text-slate-100"
            >
              {t('lm.targeting.clearFilters')}
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {filtered.map((tmpl) => {
              const uc = USE_CASE_BADGE[tmpl.useCase]
              const campaignUrl = `/freehold-intelligence/lead-machine/campaigns/new?template=${tmpl.id}`

              return (
                <div key={tmpl.id} className="rounded-[24px] border border-line bg-surface p-6">
                  {/* Top */}
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="text-[17px] font-semibold text-white">{tmpl.name}</h3>
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${uc.badge}`}>{t(`lm.targeting.useCase.${tmpl.useCase}`)}</span>
                      </div>
                      <p className="mt-1.5 text-sm text-slate-400">{tmpl.description}</p>
                    </div>
                    <Link
                      href={campaignUrl}
                      className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-xs font-semibold text-ink transition hover:bg-gold-bright shrink-0"
                    >
                      {t('lm.targeting.useTemplate')} <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  </div>

                  {/* Params grid */}
                  <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 mb-2">{t('lm.targeting.param.ageRange')}</div>
                      <div className="text-[14px] font-semibold text-white">{tmpl.targeting.ageMin}–{tmpl.targeting.ageMax}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 mb-2">{t('lm.targeting.param.countries')}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {tmpl.targeting.countries.map((c) => (
                          <span key={c} className="rounded bg-surface-2 px-1.5 py-0.5 text-xs font-medium text-slate-400">
                            {countryName(c)}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 mb-2">{t('lm.targeting.param.cities')}</div>
                      <div className="text-sm text-slate-400">
                        {tmpl.targeting.cityKeys.length > 0
                          ? tmpl.targeting.cityKeys.map((k) => cityName(k)).join(', ')
                          : t('lm.targeting.allCities')
                        }
                      </div>
                    </div>
                  </div>

                  {/* Interests */}
                  <div className="mt-4">
                    <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 mb-2">{t('lm.targeting.param.interests')}</div>
                    <div className="flex flex-wrap gap-2">
                      {tmpl.targeting.interests.map((interest) => (
                        <span key={interest.id} className="rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-sm text-slate-400">
                          {interest.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Platforms */}
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                    <Globe className="h-3 w-3" />
                    {tmpl.targeting.publisherPlatforms.join(' + ')}
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-500">{tmpl.audience}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Custom targeting note */}
      <section className="mt-10 rounded-[22px] border border-gold/10 bg-gold/[0.03] p-6">
        <div className="flex items-start gap-3">
          <Zap className="mt-0.5 h-4 w-4 shrink-0 text-gold/70" />
          <div>
            <div className="text-[14px] font-semibold text-white">{t('lm.targeting.customTitle')}</div>
            <p className="mt-1 text-sm text-slate-400">
              {t('lm.targeting.customBody')}
            </p>
            <Link
              href="/freehold-intelligence/lead-machine/campaigns/new"
              className="mt-3 inline-flex items-center gap-1 text-xs text-gold/70 transition hover:text-gold"
            >
              {t('lm.targeting.launchNew')} <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </section>


    </div>
  )
}
