'use client'

import { useState, useEffect, useMemo } from 'react'
import { Sparkles, Loader2, Bot, BarChart3, CheckCircle2 } from 'lucide-react'
import { getInventoryStats, type InventoryProperty } from '@/src/features/freehold-intelligence/inventory'
import { useT } from '@/lib/i18n/provider'

// ─── content performance: real per-kind content counts ──────────────────────────
type WcItem = { kind: string; status: string }
const CONTENT_KINDS: { kind: string; labelKey: string }[] = [
  { kind: 'listing',   labelKey: 'pins.content.listings' },
  { kind: 'area',      labelKey: 'pins.content.areas' },
  { kind: 'developer', labelKey: 'pins.content.developers' },
  { kind: 'page',      labelKey: 'pins.content.pages' },
  { kind: 'topic',     labelKey: 'pins.content.blog' },
]

// ─── page ──────────────────────────────────────────────────────────────────────
export default function InsightsPage() {
  const t = useT()
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated]   = useState(false)
  const [report, setReport]         = useState<string | null>(null)
  const [liveLeads30d, setLiveLeads30d]   = useState<number | null>(null)
  const [liveSpend30d, setLiveSpend30d]   = useState<number | null>(null)
  // Live inventory drives the readiness/landing KPIs (no seed catalog).
  const [properties, setProperties]       = useState<InventoryProperty[]>([])
  const [wcItems, setWcItems]             = useState<WcItem[]>([])
  const stats = getInventoryStats(properties)

  const contentRows = useMemo(() => CONTENT_KINDS.map((c) => {
    const rows = wcItems.filter((i) => i.kind === c.kind)
    const published = rows.filter((i) => i.status === 'published').length
    return { labelKey: c.labelKey, items: rows.length, published }
  }), [wcItems])

  useEffect(() => {
    let cancelled = false
    fetch('/api/freehold/analytics/leads')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && d?.last30d != null) setLiveLeads30d(d.last30d) })
      .catch(() => {})
    fetch('/api/freehold/finance/summary')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && d?.last30dSpendAED != null) setLiveSpend30d(d.last30dSpendAED) })
      .catch(() => {})
    fetch('/api/freehold/inventory')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && Array.isArray(d?.properties)) setProperties(d.properties) })
      .catch(() => {})
    fetch('/api/freehold/web-content', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && Array.isArray(d?.items)) setWcItems(d.items) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Live cost-per-lead from real spend ÷ real leads (no seed benchmark).
  const liveCpl = liveSpend30d != null && liveLeads30d != null && liveLeads30d > 0
    ? Math.round(liveSpend30d / liveLeads30d)
    : null

  const kpiCards = [
    {
      label: t('pins.kpi.spend.label'),
      value: liveSpend30d != null ? `AED ${liveSpend30d.toLocaleString()}` : '—',
      sub: t('pins.kpi.spend.sub'),
    },
    {
      label: t('pins.kpi.cpl.label'),
      value: liveCpl != null ? `AED ${liveCpl.toLocaleString()}` : '—',
      sub: t('pins.kpi.cpl.sub'),
    },
    {
      label: t('pins.kpi.leads.label'),
      value: liveLeads30d != null ? liveLeads30d.toLocaleString() : '—',
      sub: t('pins.kpi.leads.sub'),
    },
    {
      label: t('pins.kpi.visitors.label'),
      value: stats.totalViews30d > 0 ? stats.totalViews30d.toLocaleString() : '—',
      sub: t('pins.kpi.visitors.sub'),
    },
    {
      label: t('pins.kpi.adReady.label'),
      value: `${stats.adReady} / ${stats.total}`,
      sub: t('pins.kpi.adReady.sub'),
    },
    {
      label: t('pins.kpi.landing.label'),
      value: String(stats.live),
      sub: t('pins.kpi.landing.sub', { n: stats.missingLanding }),
    },
  ]

  // Generate a real executive report from the live KPIs via the AI endpoint.
  async function handleGenerate() {
    if (generating) return
    setGenerating(true)
    setGenerated(false)
    const spend = liveSpend30d ?? 0
    const leads = liveLeads30d ?? 0
    const res = await fetch('/api/freehold/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: `Write a concise executive insight report (4-5 bullet points) for a Dubai real-estate operation. Last-30-day data: ad spend AED ${spend}, leads ${leads}, ad-ready properties ${stats.adReady}/${stats.total}, live landing pages ${stats.live}, missing landing pages ${stats.missingLanding}. Give specific, actionable recommendations grounded in these numbers.`,
      }),
    }).catch(() => null)
    setGenerating(false)
    if (!res || !res.ok) { setReport(t('pins.genFailed')); setGenerated(true); return }
    const data = await res.json().catch(() => null) as { text?: string } | null
    setReport(data?.text?.trim() || t('pins.noContent'))
    setGenerated(true)
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-slate-400">
        <Bot className="h-3.5 w-3.5" />
        {t('pins.eyebrow')}
      </div>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100">
            {t('pins.title')}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-slate-400">
            {t('pins.subtitle')}
          </p>
        </div>

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="mt-1 flex shrink-0 items-center gap-2 self-start rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-rose-500/20 disabled:opacity-60"
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('pins.generating')}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              {generated ? t('pins.reportReady') : t('pins.generateReport')}
            </>
          )}
        </button>
      </div>

      {generated && report && (
        <div className="mt-4 rounded-xl border border-gold/20 bg-gold/[0.06] px-5 py-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gold">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {t('pins.reportBanner')}
          </div>
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-300">{report}</p>
        </div>
      )}

      {/* ── Section 1: System Snapshot ─────────────────────────────────────── */}
      <section className="mt-10">
        <div className="flex items-center gap-2 mb-5">
          <BarChart3 className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-100 uppercase tracking-wider">{t('pins.section.snapshot')}</h2>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {kpiCards.map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-line bg-surface-2 p-5"
            >
              <div className="text-xs font-medium uppercase tracking-widest text-slate-500">
                {card.label}
              </div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-white">
                {card.value}
              </div>
              <div className="mt-1 text-xs text-slate-400">{card.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Section 2: Content Performance by Section (real counts) ────────── */}
      <section className="mt-12">
        <div className="flex items-center gap-2 mb-5">
          <BarChart3 className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-100 uppercase tracking-wider">{t('pins.section.content')}</h2>
        </div>

        <div className="overflow-hidden rounded-2xl border border-line bg-surface-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                {[
                  { key: 'section', label: t('pins.th.section') },
                  { key: 'items', label: t('pins.th.items') },
                  { key: 'published', label: t('pins.th.published') },
                  { key: 'status', label: t('pins.th.status') },
                ].map((h) => (
                  <th
                    key={h.key}
                    className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-widest text-slate-500"
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contentRows.map((row, i) => {
                const complete = row.items > 0 && row.published === row.items
                const badge = complete
                  ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-300'
                  : row.items > 0 ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                  : 'bg-surface-2 border border-line-strong text-slate-400'
                const statusLabel = row.items === 0 ? t('pins.status.empty') : complete ? t('pins.status.good') : t('pins.status.inProgress')
                return (
                  <tr
                    key={row.labelKey}
                    className={['transition hover:bg-surface-2', i !== contentRows.length - 1 ? 'border-b border-line' : ''].join(' ')}
                  >
                    <td className="px-5 py-4 font-medium text-slate-300">{t(row.labelKey)}</td>
                    <td className="px-5 py-4 text-slate-400">{row.items}</td>
                    <td className="px-5 py-4 text-slate-400">{row.published}</td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2.5 py-0.5 text-sm font-medium ${badge}`}>{statusLabel}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  )
}
