'use client'

import { useState, useMemo, useEffect } from 'react'
import { toast } from 'sonner'
import { FileText, Loader2, ExternalLink, X } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { prettySource, STAGE_ORDER, fmtAed } from '@/lib/freehold/analytics-format'
import { ExpertDepth } from '@/components/freehold/expert-depth'

type LiveLeads = { total: number; last30d: number; last7d: number; closed: number; new: number; closingRate: number }
type LiveData = {
  leads: LiveLeads
  sources: { label: string; count: number }[]
  stages: { stage: string; count: number }[]
  daily: { date: string; leads: number }[]
} | null
type Totals = {
  totalDeals: number; approvedDeals: number; pendingDeals: number
  totalSalesAed: number; totalCommissionAed: number; netCommissionAed: number
  totalPaidAed: number; totalOutstandingAed: number
} | null

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-line bg-white/[0.05] p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</div>
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-400/90">
          <span className="h-1 w-1 rounded-full bg-emerald-400" />
          live
        </span>
      </div>
      <div className="mt-3 text-2xl font-semibold tabular-nums text-slate-100">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{sub}</div>
    </div>
  )
}

// Simple single-series sparkline of daily leads.
function LeadsSparkline({ daily }: { daily: { date: string; leads: number }[] }) {
  const W = 600, H = 90, PAD_B = 4
  const max = Math.max(1, ...daily.map((d) => d.leads))
  const toX = (i: number) => (daily.length <= 1 ? 0 : (i / (daily.length - 1)) * W)
  const toY = (v: number) => H - PAD_B - (v / max) * (H - PAD_B - 6)
  const pts = daily.map((d, i) => `${toX(i)},${toY(d.leads)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" style={{ height: 90 }} aria-hidden="true">
      <line x1="0" y1={H - PAD_B} x2={W} y2={H - PAD_B} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      <polyline points={pts} fill="none" stroke="#D4AF37" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

export default function CompanyAnalyticsPage() {
  const t = useT()
  const [live, setLive] = useState<LiveData>(null)
  const [totals, setTotals] = useState<Totals>(null)

  useEffect(() => {
    fetch('/api/freehold/analytics/leads')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.leads) setLive({ leads: d.leads, sources: d.sources ?? [], stages: d.stages ?? [], daily: d.daily ?? [] }) })
      .catch(() => {})
    fetch('/api/freehold/deals?totals=1')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.totals) setTotals(d.totals) })
      .catch(() => {})
  }, [])

  const liveSources = live?.sources ?? []
  const maxSource = Math.max(1, ...liveSources.map((s) => s.count))

  const stageCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const s of live?.stages ?? []) m[s.stage] = s.count
    return m
  }, [live?.stages])
  const funnel = STAGE_ORDER.map((stage) => ({ stage, count: stageCounts[stage] ?? 0 }))
  const funnelMax = Math.max(1, ...funnel.map((s) => s.count))
  const hasFunnel = funnel.some((s) => s.count > 0)

  const dash = (v: string) => (live ? v : '—')

  const [reporting, setReporting] = useState(false)
  const [report, setReport] = useState<{ id: string; title: string; content: string } | null>(null)
  const [showReport, setShowReport] = useState(false)

  async function generateReport() {
    setReporting(true)
    setReport(null)
    try {
      const res = await fetch('/api/freehold/analytics/report', { method: 'POST' })
      const d = await res.json()
      if (!res.ok || !d?.output) throw new Error(d?.error || 'failed')
      setReport(d.output)
      toast.success(t('analytics.report.ready'))
    } catch {
      toast.error(t('analytics.report.failed'))
    } finally {
      setReporting(false)
    }
  }

  // View the AI report in a sandboxed iframe (no script execution / same-origin
  // access), matching the Notebook viewer — the content is model-generated HTML.
  function openReport() {
    if (report) setShowReport(true)
  }

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100">{t('analytics.tab.company')}</h1>
          <p className="mt-1 text-sm text-slate-400">{t('analytics.company.sub')}</p>
        </div>
        <div className="flex items-center gap-2">
          {report && (
            <button onClick={openReport} className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.12] px-3.5 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-white/[0.25]">
              <ExternalLink className="h-3.5 w-3.5" /> {t('analytics.report.view')}
            </button>
          )}
          <button
            onClick={generateReport}
            disabled={reporting}
            title={t('analytics.report.hint')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gold px-3.5 py-2 text-sm font-semibold text-[#06080A] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {reporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            {reporting ? t('analytics.report.generating') : t('analytics.report.generate')}
          </button>
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 px-3.5 py-2 text-sm font-medium text-slate-300">
            {t('analytics.last30')}
          </div>
        </div>
      </div>

      <ExpertDepth prompts={['expert.depth.analyticsCompany.q1', 'expert.depth.analyticsCompany.q2', 'expert.depth.analyticsCompany.q3']} />

      {/* KPI grid — live lead + deal metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label={t('analytics.kpi.totalLeads')} value={dash((live?.leads.total ?? 0).toLocaleString('en-US'))} sub={t('analytics.kpi.allTime')} />
        <Kpi label={t('analytics.kpi.newLeads')} value={dash((live?.leads.last30d ?? 0).toLocaleString('en-US'))} sub={t('analytics.last30')} />
        <Kpi label={t('analytics.kpi.conversions')} value={dash((live?.leads.closed ?? 0).toLocaleString('en-US'))} sub={t('analytics.kpi.closedLeads')} />
        <Kpi label={t('analytics.kpi.closingRate')} value={dash(`${live?.leads.closingRate ?? 0}%`)} sub={t('analytics.kpi.closedOverTotal')} />
        <Kpi label={t('analytics.kpi.salesVolume')} value={totals ? fmtAed(totals.totalSalesAed) : '—'} sub={t('analytics.kpi.approvedClosed')} />
        <Kpi label={t('analytics.kpi.commission')} value={totals ? fmtAed(totals.totalCommissionAed) : '—'} sub={t('analytics.kpi.approvedClosed')} />
        <Kpi label={t('analytics.kpi.deals')} value={totals ? totals.approvedDeals.toLocaleString('en-US') : '—'} sub={t('analytics.kpi.approvedClosed')} />
        <Kpi label={t('analytics.kpi.pending')} value={totals ? totals.pendingDeals.toLocaleString('en-US') : '—'} sub={t('analytics.kpi.pending')} />
      </div>

      {/* Daily leads */}
      <section>
        <div className="mb-4 text-xs font-medium uppercase tracking-widest text-slate-400">{t('analytics.sec.dailyTraffic')}</div>
        <div className="rounded-xl border border-line bg-white/[0.05] p-5">
          {live && live.daily.length > 0
            ? <LeadsSparkline daily={live.daily} />
            : <p className="py-6 text-center text-sm text-slate-500">{live ? t('analytics.empty.leads') : t('analytics.loading')}</p>}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Leads by source */}
        <section>
          <div className="mb-4 text-xs font-medium uppercase tracking-widest text-slate-400">{t('analytics.sec.leadsBySource')}</div>
          <div className="rounded-xl border border-line bg-white/[0.05] p-5">
            {liveSources.length > 0 ? (
              <div className="space-y-2.5">
                {liveSources.map((src) => (
                  <div key={src.label}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-300 truncate">{prettySource(src.label)}</span>
                      <span className="ml-3 shrink-0 text-xs tabular-nums text-slate-400">{src.count.toLocaleString('en-US')}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                      <div className="h-full rounded-full bg-[#D4AF37]" style={{ width: `${(src.count / maxSource) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-slate-500">{live ? t('analytics.empty.leads') : t('analytics.loading')}</p>
            )}
          </div>
        </section>

        {/* Pipeline funnel */}
        <section>
          <div className="mb-4 text-xs font-medium uppercase tracking-widest text-slate-400">{t('analytics.sec.pipeline')}</div>
          <div className="rounded-xl border border-line bg-white/[0.05] p-5 space-y-4">
            {hasFunnel ? (
              funnel.map((step, i) => (
                <div key={step.stage}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-300">{t(`analytics.stage.${step.stage}`)}</span>
                    <span className="text-xs font-semibold tabular-nums text-slate-100">{step.count.toLocaleString('en-US')}</span>
                  </div>
                  <div className="h-6 w-full overflow-hidden rounded-lg bg-white/[0.05]">
                    <div className={`h-full rounded-lg transition-all ${i === funnel.length - 1 ? 'bg-[#D4AF37]/70' : 'bg-white/[0.12]'}`} style={{ width: `${Math.round((step.count / funnelMax) * 100)}%` }} />
                  </div>
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-sm text-slate-500">{live ? t('analytics.empty.pipeline') : t('analytics.loading')}</p>
            )}
          </div>
        </section>
      </div>

      {/* Report viewer — sandboxed iframe (model-generated HTML, no script/same-origin) */}
      {showReport && report && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4" onClick={() => setShowReport(false)}>
          <div className="relative flex h-[82vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-line bg-[#0B131F]" onClick={(e) => e.stopPropagation()}>
            <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-2.5">
              <span className="truncate text-sm font-semibold text-white">{report.title}</span>
              <button onClick={() => setShowReport(false)} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <iframe
              title={report.title}
              sandbox=""
              srcDoc={`<!doctype html><meta charset="utf-8"><body style="margin:0;background:#0B131F;color:#e2e8f0;font-family:system-ui,sans-serif;padding:24px">${report.content}</body>`}
              className="min-h-0 flex-1 w-full bg-[#0B131F]"
            />
          </div>
        </div>
      )}
    </div>
  )
}
