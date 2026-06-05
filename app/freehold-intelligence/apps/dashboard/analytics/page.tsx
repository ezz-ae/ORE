'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, BarChart3, Clock, TrendingUp, ArrowUpRight } from 'lucide-react'
import { AiPrompt } from '@/components/freehold/ai-prompt'

const FUNNEL = [
  { stage: 'Impressions',    value: 84200, prev: 72000, pct: 100, tone: 'bg-sky-400' },
  { stage: 'Landing visits', value: 3140,  prev: 2600,  pct: 3.7,  tone: 'bg-sky-400' },
  { stage: 'Form submits',   value: 287,   prev: 231,   pct: 9.1,  tone: 'bg-[#D4AF37]' },
  { stage: 'Qualified',      value: 133,   prev: 112,   pct: 46.3, tone: 'bg-[#D4AF37]' },
  { stage: 'Converted',      value: 31,    prev: 26,    pct: 23.3, tone: 'bg-[#D4AF37]' },
]

const SOURCE_BREAKDOWN = [
  { source: 'Meta Ads — investor',  leads: 92,  conv: 24, spend: 'AED 14,200', cpl: 'AED 154', color: 'bg-sky-400' },
  { source: 'WhatsApp inbound',     leads: 47,  conv: 28, spend: '—',          cpl: '—',       color: 'bg-[#D4AF37]' },
  { source: 'Property page form',   leads: 32,  conv: 22, spend: '—',          cpl: '—',       color: 'bg-[#D4AF37]' },
  { source: 'Referral',             leads: 18,  conv: 41, spend: '—',          cpl: '—',       color: 'bg-violet-400' },
  { source: 'Cold outbound',        leads: 12,  conv: 7,  spend: 'AED 2,400',  cpl: 'AED 200', color: 'bg-rose-400' },
]

const MONTHLY = [
  { month: 'Jan', leads: 98,  revenue: 18.4 },
  { month: 'Feb', leads: 114, revenue: 22.1 },
  { month: 'Mar', leads: 107, revenue: 19.7 },
  { month: 'Apr', leads: 128, revenue: 27.5 },
  { month: 'May', leads: 133, revenue: 32.0 },
]

const MAX_LEADS = Math.max(...MONTHLY.map((m) => m.leads))

export default function DashboardAnalyticsPage() {
  type Range = 'mtd' | '30d' | '90d'
  type SourceFilter = 'all' | 'paid' | 'organic'

  const [range, setRange]               = useState<Range>('mtd')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')

  const filteredSources = sourceFilter === 'all'
    ? SOURCE_BREAKDOWN
    : sourceFilter === 'paid'
      ? SOURCE_BREAKDOWN.filter((s) => s.spend !== '—')
      : SOURCE_BREAKDOWN.filter((s) => s.spend === '—')

  const MAX_SRC = Math.max(...filteredSources.map((s) => s.leads), 1)

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      <Link href="/freehold-intelligence/apps/dashboard" className="inline-flex items-center gap-1.5 text-[12px] text-white/40 transition hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> Dashboard App
      </Link>

      <section className="mt-7">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-[13px] font-medium uppercase tracking-wider text-[#D4AF37]/85 flex items-center gap-2">
            <BarChart3 className="h-3.5 w-3.5" /> Analytics
          </div>
          <span className="rounded-full border border-sky-400/25 bg-sky-400/10 px-2.5 py-0.5 text-[12px] font-medium text-white/55">
            In progress — live data coming in V1.1
          </span>
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white/90">
          Business performance<br /><span className="text-white/35">channel by channel.</span>
        </h1>
        <p className="mt-5 max-w-xl text-[17px] leading-[1.65] text-white/60">
          Traffic, lead quality, source attribution and revenue — currently seeded with representative data.
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
                'rounded-full border px-3 py-1 text-[13px] font-medium uppercase tracking-[0.1em] transition',
                range === r
                  ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]'
                  : 'border-white/[0.08] bg-white/[0.02] text-white/40 hover:text-white/65',
              ].join(' ')}
            >
              {r === 'mtd' ? 'MTD' : r === '30d' ? 'Last 30d' : 'Last 90d'}
            </button>
          ))}
        </div>
        <div className="h-3.5 w-px bg-white/10" />
        <div className="flex items-center gap-1.5">
          {(['all', 'paid', 'organic'] as SourceFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setSourceFilter(f)}
              className={[
                'rounded-full border px-3 py-1 text-[13px] font-medium capitalize transition',
                sourceFilter === f
                  ? 'border-white/20 bg-white/[0.06] text-white/80'
                  : 'border-white/[0.07] bg-transparent text-white/35 hover:text-white/55',
              ].join(' ')}
            >
              {f === 'all' ? 'All sources' : f}
            </button>
          ))}
        </div>
        {range !== 'mtd' && (
          <span className="text-[13px] text-white/30 italic">Showing MTD data · {range} view coming in V1.1</span>
        )}
      </div>

      {/* KPIs */}
      <section className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Leads MTD',   value: '133',       delta: '+18%',  tone: 'text-[#D4AF37]' },
          { label: 'Conversion',  value: '23.3%',     delta: '+4.1pp', tone: 'text-[#D4AF37]' },
          { label: 'Avg deal',    value: 'AED 2.4M',  delta: '+12%',  tone: 'text-[#D4AF37]' },
          { label: 'Revenue MTD', value: 'AED 32M',   delta: '+16%',  tone: 'text-[#D4AF37]' },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-[18px] border border-white/[0.08] bg-[#131B2B] p-5">
            <div className="text-[12px] font-medium uppercase tracking-[0.18em] text-white/35">{kpi.label}</div>
            <div className="mt-3 text-[28px] font-semibold text-white">{kpi.value}</div>
            <div className={`mt-1 text-[12px] ${kpi.tone}`}>{kpi.delta} vs last month</div>
          </div>
        ))}
      </section>

      {/* Funnel */}
      <section className="mt-14">
        <div className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-wider text-white/40">
          <TrendingUp className="h-3.5 w-3.5" /> Conversion funnel
        </div>
        <h2 className="mt-2 text-xl font-semibold text-white">Lead pipeline</h2>
        <div className="mt-5 space-y-2.5">
          {FUNNEL.map((stage, i) => {
            const delta = i === 0 ? null : Math.round(((stage.value - stage.prev) / stage.prev) * 100)
            return (
              <div key={stage.stage} className="rounded-[18px] border border-white/[0.08] bg-[#131B2B] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="text-[13px] text-white/30 w-4 tabular-nums">{i + 1}</span>
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-white/80">{stage.stage}</div>
                      {delta !== null && (
                        <div className={`text-[13px] ${delta >= 0 ? 'text-[#D4AF37]' : 'text-red-300'}`}>
                          {delta >= 0 ? '+' : ''}{delta}% vs prev month
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-28 overflow-hidden rounded-full bg-white/[0.04]">
                      <div className={`h-2 ${stage.tone}`} style={{ width: `${stage.pct}%` }} />
                    </div>
                    <span className="w-12 text-right text-[15px] font-semibold tabular-nums text-white">{stage.value.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Source breakdown */}
      <section className="mt-14">
        <div className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-wider text-white/40">
          <BarChart3 className="h-3.5 w-3.5" /> Source attribution
        </div>
        <h2 className="mt-2 flex items-baseline text-xl font-semibold text-white">
          Channel performance
          {sourceFilter !== 'all' && (
            <span className="ml-3 text-[12px] text-white/35">({filteredSources.length} of {SOURCE_BREAKDOWN.length} sources)</span>
          )}
        </h2>
        <div className="mt-5 overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#131B2B]">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-white/[0.05]">
                <th className="px-6 py-3 text-left text-[12px] font-medium uppercase tracking-[0.18em] text-white/30">Source</th>
                <th className="px-4 py-3 text-right text-[12px] font-medium uppercase tracking-[0.18em] text-white/30">Leads</th>
                <th className="hidden px-4 py-3 text-right text-[12px] font-medium uppercase tracking-[0.18em] text-white/30 sm:table-cell">Conv %</th>
                <th className="hidden px-6 py-3 text-right text-[12px] font-medium uppercase tracking-[0.18em] text-white/30 md:table-cell">CPL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {filteredSources.map((src) => (
                <tr key={src.source} className="transition hover:bg-white/[0.02]">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${src.color}`} />
                      <div>
                        <div className="font-medium text-white/85">{src.source}</div>
                        <div className="mt-1 h-1 w-28 overflow-hidden rounded-full bg-white/[0.04]">
                          <div className={`h-full ${src.color}`} style={{ width: `${(src.leads / MAX_SRC) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right font-medium tabular-nums text-white/80">{src.leads}</td>
                  <td className="hidden px-4 py-4 text-right text-[#D4AF37] sm:table-cell">{src.conv}%</td>
                  <td className="hidden px-6 py-4 text-right text-white/45 md:table-cell">{src.cpl}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Monthly trend */}
      <section className="mt-14">
        <div className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-wider text-white/40">
          <Clock className="h-3.5 w-3.5" /> Monthly trend
        </div>
        <h2 className="mt-2 text-xl font-semibold text-white">Leads & revenue</h2>
        <div className="mt-5 rounded-[22px] border border-white/[0.08] bg-[#131B2B] p-6 sm:p-8">
          <div className="grid grid-cols-5 gap-3 sm:gap-5">
            {MONTHLY.map((m) => (
              <div key={m.month} className="flex flex-col items-center gap-3">
                <div className="flex h-28 w-full items-end overflow-hidden rounded-lg bg-white/[0.03]">
                  <div
                    className="w-full rounded-lg bg-gradient-to-t from-[#D4AF37]/70 to-[#D4AF37]/20"
                    style={{ height: `${(m.leads / MAX_LEADS) * 100}%` }}
                  />
                </div>
                <div className="text-center">
                  <div className="text-[13px] font-semibold text-white">{m.leads}</div>
                  <div className="text-[12px] uppercase tracking-[0.14em] text-white/35">{m.month}</div>
                  <div className="mt-0.5 text-[13px] text-white/40">AED {m.revenue}M</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-12">
        <AiPrompt
          placeholder="Ask about performance, channels, conversions…"
          suggestions={[
            'Which source has the best conversion rate?',
            'How does this month compare to last month?',
            'What is our cost per lead from Meta?',
          ]}
        />
      </section>

      <section className="mt-6 flex flex-wrap gap-3">
        {[
          { label: 'CRM Reports', href: '/freehold-intelligence/crm/reports' },
          { label: 'Lead Machine', href: '/freehold-intelligence/lead-machine' },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-white/[0.08] bg-white/[0.025] px-4 py-2 text-[13px] text-white/60 transition hover:border-[#D4AF37]/30 hover:text-white"
          >
            {link.label} <ArrowUpRight className="h-3 w-3" />
          </Link>
        ))}
      </section>

    </div>
  )
}
