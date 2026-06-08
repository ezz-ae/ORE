'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, BarChart3, Clock, TrendingUp, ArrowUpRight } from 'lucide-react'

type RangeFunnel = { stage: string; value: number; prev: number; pct: number; tone: string }
type SourceRow = { source: string; leads: number; conv: number; spend: string; cpl: string; color: string }
type KpiSet = { label: string; value: string; delta: string; tone: string }[]
type MonthBar = { month: string; leads: number; revenue: number }

const RANGE_DATA: Record<'mtd' | '30d' | '90d', {
  kpis: KpiSet
  funnel: RangeFunnel[]
  sources: SourceRow[]
  monthly: MonthBar[]
}> = {
  mtd: {
    kpis: [
      { label: 'Leads MTD',   value: '133',       delta: '+18%',   tone: 'text-gold' },
      { label: 'Conversion',  value: '23.3%',     delta: '+4.1pp', tone: 'text-gold' },
      { label: 'Avg deal',    value: 'AED 2.4M',  delta: '+12%',   tone: 'text-gold' },
      { label: 'Revenue MTD', value: 'AED 32M',   delta: '+16%',   tone: 'text-gold' },
    ],
    funnel: [
      { stage: 'Impressions',    value: 84200, prev: 72000, pct: 100, tone: 'bg-sky-400' },
      { stage: 'Landing visits', value: 3140,  prev: 2600,  pct: 3.7,  tone: 'bg-sky-400' },
      { stage: 'Form submits',   value: 287,   prev: 231,   pct: 9.1,  tone: 'bg-gold' },
      { stage: 'Qualified',      value: 133,   prev: 112,   pct: 46.3, tone: 'bg-gold' },
      { stage: 'Converted',      value: 31,    prev: 26,    pct: 23.3, tone: 'bg-gold' },
    ],
    sources: [
      { source: 'Meta Ads — investor',  leads: 92,  conv: 24, spend: 'AED 14,200', cpl: 'AED 154', color: 'bg-sky-400' },
      { source: 'WhatsApp inbound',     leads: 47,  conv: 28, spend: '—',          cpl: '—',       color: 'bg-gold' },
      { source: 'Property page form',   leads: 32,  conv: 22, spend: '—',          cpl: '—',       color: 'bg-gold' },
      { source: 'Referral',             leads: 18,  conv: 41, spend: '—',          cpl: '—',       color: 'bg-violet-400' },
      { source: 'Cold outbound',        leads: 12,  conv: 7,  spend: 'AED 2,400',  cpl: 'AED 200', color: 'bg-rose-400' },
    ],
    monthly: [
      { month: 'Jan', leads: 98,  revenue: 18.4 },
      { month: 'Feb', leads: 114, revenue: 22.1 },
      { month: 'Mar', leads: 107, revenue: 19.7 },
      { month: 'Apr', leads: 128, revenue: 27.5 },
      { month: 'May', leads: 133, revenue: 32.0 },
    ],
  },
  '30d': {
    kpis: [
      { label: 'Leads 30d',   value: '148',       delta: '+21%',   tone: 'text-gold' },
      { label: 'Conversion',  value: '22.8%',     delta: '+3.2pp', tone: 'text-gold' },
      { label: 'Avg deal',    value: 'AED 2.3M',  delta: '+9%',    tone: 'text-gold' },
      { label: 'Revenue 30d', value: 'AED 35.7M', delta: '+19%',   tone: 'text-gold' },
    ],
    funnel: [
      { stage: 'Impressions',    value: 96400,  prev: 84200, pct: 100, tone: 'bg-sky-400' },
      { stage: 'Landing visits', value: 3610,   prev: 3140,  pct: 3.7,  tone: 'bg-sky-400' },
      { stage: 'Form submits',   value: 318,    prev: 287,   pct: 8.8,  tone: 'bg-gold' },
      { stage: 'Qualified',      value: 148,    prev: 133,   pct: 46.5, tone: 'bg-gold' },
      { stage: 'Converted',      value: 34,     prev: 31,    pct: 23.0, tone: 'bg-gold' },
    ],
    sources: [
      { source: 'Meta Ads — investor',  leads: 104, conv: 25, spend: 'AED 16,800', cpl: 'AED 161', color: 'bg-sky-400' },
      { source: 'WhatsApp inbound',     leads: 52,  conv: 29, spend: '—',          cpl: '—',       color: 'bg-gold' },
      { source: 'Property page form',   leads: 36,  conv: 24, spend: '—',          cpl: '—',       color: 'bg-gold' },
      { source: 'Referral',             leads: 22,  conv: 43, spend: '—',          cpl: '—',       color: 'bg-violet-400' },
      { source: 'Cold outbound',        leads: 14,  conv: 8,  spend: 'AED 2,800',  cpl: 'AED 200', color: 'bg-rose-400' },
    ],
    monthly: [
      { month: 'Feb', leads: 114, revenue: 22.1 },
      { month: 'Mar', leads: 107, revenue: 19.7 },
      { month: 'Apr', leads: 128, revenue: 27.5 },
      { month: 'May', leads: 133, revenue: 32.0 },
      { month: 'Jun',  leads: 43,  revenue: 10.4 },
    ],
  },
  '90d': {
    kpis: [
      { label: 'Leads 90d',   value: '368',       delta: '+24%',   tone: 'text-gold' },
      { label: 'Conversion',  value: '22.1%',     delta: '+5.8pp', tone: 'text-gold' },
      { label: 'Avg deal',    value: 'AED 2.2M',  delta: '+7%',    tone: 'text-gold' },
      { label: 'Revenue 90d', value: 'AED 79.2M', delta: '+22%',   tone: 'text-gold' },
    ],
    funnel: [
      { stage: 'Impressions',    value: 248000, prev: 191000, pct: 100, tone: 'bg-sky-400' },
      { stage: 'Landing visits', value: 9120,   prev: 7400,   pct: 3.7,  tone: 'bg-sky-400' },
      { stage: 'Form submits',   value: 821,    prev: 634,    pct: 9.0,  tone: 'bg-gold' },
      { stage: 'Qualified',      value: 368,    prev: 302,    pct: 44.8, tone: 'bg-gold' },
      { stage: 'Converted',      value: 81,     prev: 66,     pct: 22.0, tone: 'bg-gold' },
    ],
    sources: [
      { source: 'Meta Ads — investor',  leads: 248, conv: 23, spend: 'AED 41,200', cpl: 'AED 166', color: 'bg-sky-400' },
      { source: 'WhatsApp inbound',     leads: 127, conv: 27, spend: '—',          cpl: '—',       color: 'bg-gold' },
      { source: 'Property page form',   leads: 82,  conv: 21, spend: '—',          cpl: '—',       color: 'bg-gold' },
      { source: 'Referral',             leads: 51,  conv: 39, spend: '—',          cpl: '—',       color: 'bg-violet-400' },
      { source: 'Cold outbound',        leads: 31,  conv: 6,  spend: 'AED 7,400',  cpl: 'AED 239', color: 'bg-rose-400' },
    ],
    monthly: [
      { month: 'Mar', leads: 107, revenue: 19.7 },
      { month: 'Apr', leads: 128, revenue: 27.5 },
      { month: 'May', leads: 133, revenue: 32.0 },
    ],
  },
}

export default function DashboardAnalyticsPage() {
  type Range = 'mtd' | '30d' | '90d'
  type SourceFilter = 'all' | 'paid' | 'organic'

  const [range, setRange]               = useState<Range>('mtd')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')

  const { kpis, funnel, sources: allSources, monthly } = RANGE_DATA[range]
  const MAX_LEADS = Math.max(...monthly.map((m) => m.leads))

  const filteredSources = sourceFilter === 'all'
    ? allSources
    : sourceFilter === 'paid'
      ? allSources.filter((s) => s.spend !== '—')
      : allSources.filter((s) => s.spend === '—')

  const MAX_SRC = Math.max(...filteredSources.map((s) => s.leads), 1)

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      <Link href="/freehold-intelligence/apps/dashboard" className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> Dashboard App
      </Link>

      <section className="mt-7">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold/85">
          <BarChart3 className="h-3.5 w-3.5" /> Analytics
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
          Business performance<br /><span className="text-slate-500">channel by channel.</span>
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-[1.65] text-slate-300">
          Traffic, lead quality, source attribution and revenue across all active channels.
        </p>
      </section>

      {/* Range + Source filter bar */}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          {(['mtd', '30d', '90d'] as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={[
                'rounded-full border px-3 py-1 text-sm font-medium uppercase tracking-[0.1em] transition',
                range === r
                  ? 'border-gold/40 bg-gold/10 text-gold'
                  : 'border-line bg-surface-2 text-slate-500 hover:text-slate-300',
              ].join(' ')}
            >
              {r === 'mtd' ? 'MTD' : r === '30d' ? 'Last 30d' : 'Last 90d'}
            </button>
          ))}
        </div>
        <div className="h-3.5 w-px bg-surface-2" />
        <div className="flex items-center gap-1.5">
          {(['all', 'paid', 'organic'] as SourceFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setSourceFilter(f)}
              className={[
                'rounded-full border px-3 py-1 text-sm font-medium capitalize transition',
                sourceFilter === f
                  ? 'border-line-strong bg-surface-2 text-slate-200'
                  : 'border-line bg-transparent text-slate-500 hover:text-slate-400',
              ].join(' ')}
            >
              {f === 'all' ? 'All sources' : f}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <section className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-[18px] border border-line bg-surface p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{kpi.label}</div>
            <div className="mt-3 text-[28px] font-semibold text-white">{kpi.value}</div>
            <div className={`mt-1 text-xs ${kpi.tone}`}>{kpi.delta} vs last month</div>
          </div>
        ))}
      </section>

      {/* Funnel */}
      <section className="mt-14">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <TrendingUp className="h-3.5 w-3.5" /> Conversion funnel
        </div>
        <h2 className="mt-2 text-xl font-semibold text-white">Lead pipeline</h2>
        <div className="mt-5 space-y-2.5">
          {funnel.map((stage, i) => {
            const delta = i === 0 ? null : Math.round(((stage.value - stage.prev) / stage.prev) * 100)
            return (
              <div key={stage.stage} className="rounded-[18px] border border-line bg-surface p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="text-sm text-slate-500 w-4 tabular-nums">{i + 1}</span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-200">{stage.stage}</div>
                      {delta !== null && (
                        <div className={`text-sm ${delta >= 0 ? 'text-gold' : 'text-red-300'}`}>
                          {delta >= 0 ? '+' : ''}{delta}% vs prev month
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-28 overflow-hidden rounded-full bg-surface-2">
                      <div className={`h-2 ${stage.tone}`} style={{ width: `${stage.pct}%` }} />
                    </div>
                    <span className="w-12 text-right text-base font-semibold tabular-nums text-white">{stage.value.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Source breakdown */}
      <section className="mt-14">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <BarChart3 className="h-3.5 w-3.5" /> Source attribution
        </div>
        <h2 className="mt-2 flex items-baseline text-xl font-semibold text-white">
          Channel performance
          {sourceFilter !== 'all' && (
            <span className="ml-3 text-xs text-slate-500">({filteredSources.length} of {allSources.length} sources)</span>
          )}
        </h2>
        <div className="mt-5 overflow-hidden rounded-[22px] border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Source</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Leads</th>
                <th className="hidden px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 sm:table-cell">Conv %</th>
                <th className="hidden px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 md:table-cell">CPL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredSources.map((src) => (
                <tr key={src.source} className="transition hover:bg-surface-2">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${src.color}`} />
                      <div>
                        <div className="font-medium text-slate-100">{src.source}</div>
                        <div className="mt-1 h-1 w-28 overflow-hidden rounded-full bg-surface-2">
                          <div className={`h-full ${src.color}`} style={{ width: `${(src.leads / MAX_SRC) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right font-medium tabular-nums text-slate-200">{src.leads}</td>
                  <td className="hidden px-4 py-4 text-right text-gold sm:table-cell">{src.conv}%</td>
                  <td className="hidden px-6 py-4 text-right text-slate-400 md:table-cell">{src.cpl}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Monthly trend */}
      <section className="mt-14">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <Clock className="h-3.5 w-3.5" /> Monthly trend
        </div>
        <h2 className="mt-2 text-xl font-semibold text-white">Leads & revenue</h2>
        <div className="mt-5 rounded-[22px] border border-line bg-surface p-6 sm:p-8">
          <div className="grid gap-3 sm:gap-5" style={{ gridTemplateColumns: `repeat(${monthly.length}, minmax(0, 1fr))` }}>
            {monthly.map((m) => (
              <div key={m.month} className="flex flex-col items-center gap-3">
                <div className="flex h-28 w-full items-end overflow-hidden rounded-lg bg-surface-2">
                  <div
                    className="w-full rounded-lg bg-gradient-to-t from-gold/70 to-gold/20"
                    style={{ height: `${(m.leads / MAX_LEADS) * 100}%` }}
                  />
                </div>
                <div className="text-center">
                  <div className="text-sm font-semibold text-white">{m.leads}</div>
                  <div className="text-xs uppercase tracking-wider text-slate-500">{m.month}</div>
                  <div className="mt-0.5 text-sm text-slate-400">AED {m.revenue}M</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 flex flex-wrap gap-3">
        {[
          { label: 'CRM Reports', href: '/freehold-intelligence/crm/reports' },
          { label: 'Lead Machine', href: '/freehold-intelligence/lead-machine' },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-line bg-surface-2 px-4 py-2 text-sm text-slate-400 transition hover:border-gold/30 hover:text-white"
          >
            {link.label} <ArrowUpRight className="h-3 w-3" />
          </Link>
        ))}
      </section>

    </div>
  )
}
