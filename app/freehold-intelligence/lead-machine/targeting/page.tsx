'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Target, ArrowUpRight, Zap, Sparkles, Loader2 } from 'lucide-react'
import { UAE_INTERESTS, STRATEGY_LABELS, type TargetingRecommendation } from '@/lib/meta/targeting-catalog'
import { useT } from '@/lib/i18n/provider'
import ReadyBuyers from '@/components/freehold/ready-buyers'

type LoopPerf = {
  id: string; name: string; spendAED: number; cpl: number | null
  crm: { total: number; qualified: number; closed: number; lost: number }
  /** Delivery volume — the basis that separates audiences. `leadsPerMillion`
   *  is worth far more than `cpl` here: impressions outnumber leads by four
   *  orders of magnitude, so it settles differences cost per lead never can. */
  impressions?: number; cpm?: number | null; leadsPerMillion?: number | null
}

/** The significance-tested findings behind the recommendation, computed
 *  server-side. Shown next to the AI's prose so a claim about which audience
 *  wins can be checked rather than taken on trust. */
type LoopEvidence = {
  ranking: {
    headline: string
    comparisons: { sentence: string; established: boolean }[]
    undecided: { id: string; name: string }[]
  } | null
  junk: { id: string; name: string; cpm: number | null; lpm: number | null }[]
}

export default function TargetingPage() {
  const t = useT()

  // The learning loop: what the last campaigns' LEADS actually did, and the
  // AI's recommendation for the next round — same engine as the wizard.
  const [loop, setLoop] = useState<{ recommendation: TargetingRecommendation; performance: LoopPerf[]; evidence: LoopEvidence | null } | null>(null)
  const [loopLoading, setLoopLoading] = useState(false)
  async function fetchLoop() {
    setLoopLoading(true)
    try {
      const res = await fetch('/api/freehold/ai/targeting', { cache: 'no-store' })
      const d = await res.json()
      if (res.ok && d?.recommendation) setLoop({ recommendation: d.recommendation, performance: d.performance ?? [], evidence: d.evidence ?? null })
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
              {bm.estimate && (
                <span className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-[11px] text-slate-200">{fmtK(bm.estimate.lower)}–{fmtK(bm.estimate.upper)} · {t('bm.liveReach')}</span>
              )}
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

            {/* WHAT IS ACTUALLY ESTABLISHED — computed and significance-tested
                on impressions, shown apart from the AI's prose above. Cost per
                lead is built from a handful of leads and rarely separates
                anything; impressions run to the hundreds of thousands and do. */}
            {loop.evidence?.ranking && (
              <div className="rounded-xl border border-line bg-surface p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gold/80">{t('lm.targeting.loop.evidence')}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-200">{loop.evidence.ranking.headline}</p>
                {loop.evidence.ranking.comparisons.filter((c) => c.established).length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {loop.evidence.ranking.comparisons.filter((c) => c.established).slice(0, 5).map((c) => (
                      <li key={c.sentence} className="text-[11px] leading-relaxed text-slate-300">· {c.sentence}</li>
                    ))}
                  </ul>
                )}
                {loop.evidence.ranking.undecided.length > 0 && (
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                    {t('lm.targeting.loop.notSeparated', { names: loop.evidence.ranking.undecided.map((u) => u.name).join(', ') })}
                  </p>
                )}
                {loop.evidence.junk.length > 0 && (
                  <p className="mt-2 text-[11px] leading-relaxed text-amber-200/80">
                    {t('lm.targeting.loop.junk', {
                      names: loop.evidence.junk.map((j) => `${j.name} (CPM ${j.cpm?.toFixed(2) ?? '—'}, ${Math.round(j.lpm ?? 0)}/M)`).join(', '),
                    })}
                  </p>
                )}
              </div>
            )}

            {loop.performance.length > 0 && (
              <div className="divide-y divide-white/[0.05] overflow-hidden rounded-xl border border-line bg-surface">
                {loop.performance.slice(0, 6).map((c) => (
                  <div key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-xs">
                    <span className="min-w-0 flex-1 truncate font-medium text-slate-200">{c.name}</span>
                    {/* Leads per million impressions leads the row: it is the
                        number that separates audiences, and it belongs ahead
                        of the one that usually cannot. */}
                    <span className="shrink-0 text-slate-300">
                      {c.leadsPerMillion !== null && c.leadsPerMillion !== undefined
                        ? t('lm.targeting.loop.perMillion', { n: c.leadsPerMillion })
                        : '—'}
                    </span>
                    <span className="shrink-0 text-slate-500">{c.cpm ? `CPM ${c.cpm}` : '—'}</span>
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
          <span className="text-slate-500">{t('lm.targeting.titleSub2')}</span>
        </h1>
        <p className="mt-5 max-w-xl text-sm leading-[1.65] text-slate-400">
          {t('lm.targeting.desc')}
        </p>
      </section>

      {/* The market list — real audiences with real numbers, not templates.
          Same cards, same kitchen, same numbers as everywhere else. */}
      <div className="mt-8">
        <ReadyBuyers />
      </div>

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
              href="/freehold-intelligence/lead-machine/audiences"
              className="mt-3 inline-flex items-center gap-1 text-xs text-gold/70 transition hover:text-gold"
            >
              {t('lm.targeting.openCreator')} <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </section>


    </div>
  )
}
