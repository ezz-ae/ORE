'use client'

import { useState, useEffect } from 'react'
import { Sparkles, Loader2, Bot, TrendingDown, AlertTriangle, TrendingUp, MessageCircle, Gauge, Home, BarChart3, CheckCircle2 } from 'lucide-react'
import { getInventoryStats, type InventoryProperty } from '@/src/features/freehold-intelligence/inventory'
import { useT } from '@/lib/i18n/provider'

// ─── insight types ─────────────────────────────────────────────────────────────
type Priority = 'Critical' | 'High' | 'Opportunity' | 'Info'

interface Insight {
  icon: React.ElementType
  titleKey: string
  detailKey: string
  priority: Priority
  timeKey: string
}

const insights: Insight[] = [
  {
    icon: TrendingDown,
    titleKey: 'pins.insight.cpl.title',
    detailKey: 'pins.insight.cpl.detail',
    priority: 'Opportunity',
    timeKey: 'pins.time.2h',
  },
  {
    icon: AlertTriangle,
    titleKey: 'pins.insight.marina.title',
    detailKey: 'pins.insight.marina.detail',
    priority: 'Critical',
    timeKey: 'pins.time.3h',
  },
  {
    icon: TrendingUp,
    titleKey: 'pins.insight.jvc.title',
    detailKey: 'pins.insight.jvc.detail',
    priority: 'Opportunity',
    timeKey: 'pins.time.5h',
  },
  {
    icon: MessageCircle,
    titleKey: 'pins.insight.whatsapp.title',
    detailKey: 'pins.insight.whatsapp.detail',
    priority: 'High',
    timeKey: 'pins.time.6h',
  },
  {
    icon: Gauge,
    titleKey: 'pins.insight.budget.title',
    detailKey: 'pins.insight.budget.detail',
    priority: 'Info',
    timeKey: 'pins.time.8h',
  },
  {
    icon: Home,
    titleKey: 'pins.insight.landing.title',
    detailKey: 'pins.insight.landing.detail',
    priority: 'High',
    timeKey: 'pins.time.12h',
  },
]

const priorityConfig: Record<Priority, { labelKey: string; className: string }> = {
  Critical:    { labelKey: 'pins.priority.Critical',    className: 'bg-red-500/10 border border-red-500/25 text-red-400' },
  High:        { labelKey: 'pins.priority.High',        className: 'bg-amber-500/10 border border-amber-500/25 text-amber-400' },
  Opportunity: { labelKey: 'pins.priority.Opportunity', className: 'bg-gold/10 border border-emerald-500/25 text-gold' },
  Info:        { labelKey: 'pins.priority.Info',        className: 'bg-teal-500/10 border border-teal-500/25 text-slate-400' },
}

// ─── content performance table ─────────────────────────────────────────────────
const contentRows = [
  { sectionKey: 'pins.content.listings',   items: 8,  published: 4, avgSeo: 81, status: 'Good',       statusKey: 'pins.status.good' },
  { sectionKey: 'pins.content.areas',      items: 12, published: 7, avgSeo: 75, status: 'Needs work', statusKey: 'pins.status.needsWork' },
  { sectionKey: 'pins.content.developers', items: 10, published: 6, avgSeo: 74, status: 'Needs work', statusKey: 'pins.status.needsWork' },
  { sectionKey: 'pins.content.pages',      items: 10, published: 7, avgSeo: 70, status: 'Review',     statusKey: 'pins.status.review' },
  { sectionKey: 'pins.content.blog',       items: 12, published: 3, avgSeo: 77, status: 'Good',       statusKey: 'pins.status.good' },
]

function seoColor(score: number) {
  if (score >= 80) return 'text-gold'
  if (score >= 60) return 'text-gold'
  return 'text-red-400'
}

function statusBadge(status: string) {
  if (status === 'Good')       return 'bg-gold/10 border border-gold/20 text-gold'
  if (status === 'Needs work') return 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
  return 'bg-surface-2 border border-line-strong text-slate-400'
}

// ─── recommended actions ───────────────────────────────────────────────────────
const actions = [
  {
    n: 1,
    titleKey: 'pins.action.creek.title',
    detailKey: 'pins.action.creek.detail',
  },
  {
    n: 2,
    titleKey: 'pins.action.marina.title',
    detailKey: 'pins.action.marina.detail',
  },
  {
    n: 3,
    titleKey: 'pins.action.jvc.title',
    detailKey: 'pins.action.jvc.detail',
  },
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
  const stats = getInventoryStats(properties)

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

      {/* ── Section 2: AI Insights Feed ────────────────────────────────────── */}
      <section className="mt-12">
        <div className="flex items-center gap-2 mb-5">
          <Sparkles className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-100 uppercase tracking-wider">{t('pins.section.feed')}</h2>
        </div>

        <div className="flex flex-col gap-3">
          {insights.map((insight) => {
            const Icon   = insight.icon
            const badge  = priorityConfig[insight.priority]
            return (
              <div
                key={insight.titleKey}
                className="rounded-2xl border border-line bg-surface-2 p-5"
              >
                <div className="flex items-start gap-4">
                  {/* rose sparkles icon */}
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10">
                    <Sparkles className="h-4 w-4 text-slate-400" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-100">{t(insight.titleKey)}</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${badge.className}`}>
                        {t(badge.labelKey)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{t(insight.detailKey)}</p>
                    <p className="mt-2 text-sm text-slate-500">{t(insight.timeKey)}</p>
                  </div>

                  {/* contextual insight icon */}
                  <div className="hidden shrink-0 sm:block">
                    <Icon className="h-4 w-4 text-slate-500" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Section 3: Content Performance by Section ──────────────────────── */}
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
                  { key: 'avgSeo', label: t('pins.th.avgSeo') },
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
              {contentRows.map((row, i) => (
                <tr
                  key={row.sectionKey}
                  className={[
                    'transition hover:bg-surface-2',
                    i !== contentRows.length - 1 ? 'border-b border-line' : '',
                  ].join(' ')}
                >
                  <td className="px-5 py-4 font-medium text-slate-300">{t(row.sectionKey)}</td>
                  <td className="px-5 py-4 text-slate-400">{row.items}</td>
                  <td className="px-5 py-4 text-slate-400">{row.published}</td>
                  <td className={`px-5 py-4 font-semibold ${seoColor(row.avgSeo)}`}>
                    {row.avgSeo}/100
                  </td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-2.5 py-0.5 text-sm font-medium ${statusBadge(row.status)}`}>
                      {t(row.statusKey)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Section 4: Recommended Actions ────────────────────────────────── */}
      <section className="mt-12">
        <div className="flex items-center gap-2 mb-5">
          <CheckCircle2 className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-100 uppercase tracking-wider">{t('pins.section.actions')}</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {actions.map((action) => (
            <div
              key={action.n}
              className="flex flex-col gap-4 rounded-2xl border border-line bg-surface-2 p-5"
            >
              {/* number badge */}
              <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-sm font-bold text-slate-400">
                {action.n}
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-100">{t(action.titleKey)}</div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{t(action.detailKey)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}
