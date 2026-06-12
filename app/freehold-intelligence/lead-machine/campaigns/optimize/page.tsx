'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Sparkles, TrendingDown, TrendingUp, CheckCircle2,
  ArrowUpRight, Zap, BarChart3, ChevronRight,
} from 'lucide-react'
import { financeSummary } from '@/src/features/freehold-intelligence/finance'

const AVG = financeSummary.avgCpl30d

type RecoType = 'Scale' | 'Pause' | 'Optimise' | 'Test'

interface Recommendation {
  id: string
  type: RecoType
  campaignName: string
  platform: 'meta' | 'google'
  currentCpl: number
  rationale: string
  action: string
  projectedLeadDelta: number
  projectedSpendDelta: number
}

const RECOMMENDATIONS: Recommendation[] = [
  {
    id: 'r1',
    type: 'Scale',
    campaignName: 'Dubai Hills Yield — META',
    platform: 'meta',
    currentCpl: 69.8,
    rationale: 'Best-performing Meta campaign — AED 5.6 below target CPL with strong lead volume.',
    action: 'Increase daily budget by AED 500',
    projectedLeadDelta: +12,
    projectedSpendDelta: +1_500,
  },
  {
    id: 'r2',
    type: 'Scale',
    campaignName: 'Golden Visa Buyers — META',
    platform: 'meta',
    currentCpl: 67.6,
    rationale: 'Highest efficiency across all campaigns — AED 7.8 below target CPL. Budget too conservative.',
    action: 'Increase daily budget by AED 300',
    projectedLeadDelta: +8,
    projectedSpendDelta: +900,
  },
  {
    id: 'r3',
    type: 'Pause',
    campaignName: 'Palm Jumeirah Investor — Search',
    platform: 'google',
    currentCpl: 84.0,
    rationale: 'Highest CPL across all campaigns — AED 8.6 above target. Already paused; remove budget to reallocate.',
    action: 'Remove remaining budget allocation',
    projectedLeadDelta: -0,
    projectedSpendDelta: -5_210,
  },
  {
    id: 'r4',
    type: 'Optimise',
    campaignName: 'Dubai Property Investment — PMax',
    platform: 'google',
    currentCpl: 75.5,
    rationale: 'Running at target CPL. Add audience exclusions and negative keywords to push below AED 70.',
    action: 'Add exclusions: competitor brand, job seekers',
    projectedLeadDelta: +5,
    projectedSpendDelta: -200,
  },
  {
    id: 'r5',
    type: 'Test',
    campaignName: 'Off Plan Dubai 2025 — Search',
    platform: 'google',
    currentCpl: 69.8,
    rationale: 'Solid CPL on limited spend. Untested at higher volume — worth a 2-week scale test.',
    action: 'Increase daily budget by AED 200 for 2 weeks',
    projectedLeadDelta: +6,
    projectedSpendDelta: +400,
  },
]

const RECO_STYLE: Record<RecoType, { cls: string; dotCls: string }> = {
  Scale:    { cls: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-400', dotCls: 'bg-emerald-400' },
  Pause:    { cls: 'border-red-400/25 bg-red-400/10 text-red-400',             dotCls: 'bg-red-400'     },
  Optimise: { cls: 'border-gold/25 bg-gold/10 text-gold',      dotCls: 'bg-gold'  },
  Test:     { cls: 'border-sky-400/25 bg-sky-400/10 text-sky-300',             dotCls: 'bg-sky-400'     },
}

function platformLabel(p: 'meta' | 'google') {
  return p === 'meta'
    ? { label: 'Meta',   cls: 'border-blue-400/25 bg-blue-400/10 text-blue-300'    }
    : { label: 'Google', cls: 'border-gold/25 bg-gold/10 text-gold' }
}

function cplStyle(cpl: number) {
  const r = cpl / AVG
  if (r <= 0.92) return { color: 'text-emerald-400', Icon: TrendingDown }
  if (r <= 1.05) return { color: 'text-gold',   Icon: TrendingDown }
  return              { color: 'text-red-400',         Icon: TrendingUp  }
}

export default function CampaignOptimizePage() {
  const [applied, setApplied] = useState<Set<string>>(new Set())

  function apply(id: string) {
    setApplied((prev) => new Set([...prev, id]))
  }

  const appliedRecos    = RECOMMENDATIONS.filter((r) => applied.has(r.id))
  const projLeadDelta   = appliedRecos.reduce((s, r) => s + r.projectedLeadDelta, 0)
  const projSpendDelta  = appliedRecos.reduce((s, r) => s + r.projectedSpendDelta, 0)
  const projNewLeads    = financeSummary.totalLeads30d + projLeadDelta
  const projNewSpend    = financeSummary.totalSpend30d + projSpendDelta
  const projNewCpl      = projNewLeads > 0 ? projNewSpend / projNewLeads : AVG
  const hasApplied      = appliedRecos.length > 0

  const sorted = [...financeSummary.topSpendCampaigns].sort((a, b) => a.cpl - b.cpl)

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      {/* Header */}
      <section>
        <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-gold/85">
          <Sparkles className="h-3.5 w-3.5" /> AI Budget Optimizer
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white">
          Budget optimizer
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-[1.65] text-slate-400">
          AI-ranked recommendations based on CPL performance, budget utilization, and lead volume.
          Current target: <span className="text-white">AED {AVG} avg CPL</span> across both platforms.
        </p>
      </section>

      {/* Budget utilization */}
      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        {[
          { label: 'Meta Ads',   spend: financeSummary.currentMonthSpendMeta,   budget: financeSummary.metaBudgetAED,   util: financeSummary.budgetUtilizationMeta,   platColor: '#1877F2' },
          { label: 'Google Ads', spend: financeSummary.currentMonthSpendGoogle, budget: financeSummary.googleBudgetAED, util: financeSummary.budgetUtilizationGoogle, platColor: '#4285F4' },
        ].map((p) => {
          const pct = Math.round(p.util * 100)
          const underSpent = pct < 85
          return (
            <div key={p.label} className="rounded-[20px] border border-line bg-surface p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.platColor }} />
                  <span className="text-sm font-semibold text-white">{p.label}</span>
                </div>
                {underSpent && (
                  <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-xs font-medium text-amber-300">
                    Under-utilised
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[22px] font-semibold tabular-nums text-white">AED {p.spend.toLocaleString()}</span>
                <span className="text-sm text-slate-500">/ {p.budget.toLocaleString()}</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div
                  className={`h-full rounded-full transition-all ${pct < 70 ? 'bg-amber-500' : 'bg-gold'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-1.5 text-xs text-slate-500">{pct}% utilised this month</div>
            </div>
          )
        })}
      </div>

      {/* Campaign efficiency ranking */}
      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
            <BarChart3 className="h-3 w-3" /> Campaign Efficiency Rank
          </div>
          <Link
            href="/freehold-intelligence/lead-machine/campaigns/attribution"
            className="flex items-center gap-1 text-xs text-gold/50 transition hover:text-gold"
          >
            Full attribution <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="overflow-hidden rounded-[20px] border border-line bg-surface">
          <div className="divide-y divide-white/[0.05]">
            {sorted.map((c, i) => {
              const info = cplStyle(c.cpl)
              const plat = platformLabel(c.platform)
              const Icon = info.Icon
              const gap = c.cpl - AVG
              return (
                <div key={c.name} className="flex items-center gap-4 px-5 py-3.5">
                  <span className="w-5 shrink-0 text-center text-sm font-semibold text-slate-600">#{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-100">{c.name}</div>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-px text-xs font-medium ${plat.cls}`}>
                    {plat.label}
                  </span>
                  <div className={`flex shrink-0 items-center gap-0.5 text-sm font-semibold tabular-nums ${info.color}`}>
                    <Icon className="h-3 w-3" />
                    AED {c.cpl.toFixed(0)}
                  </div>
                  <div className="w-[72px] shrink-0 text-right text-xs text-slate-500">
                    {gap < 0 ? `${Math.abs(gap).toFixed(1)} below` : `${gap.toFixed(1)} above`}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* AI Recommendations */}
      <section className="mt-10">
        <div className="mb-5 flex items-center gap-2 text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
          <Sparkles className="h-3 w-3 text-gold/60" /> AI Recommendations
        </div>
        <div className="space-y-4">
          {RECOMMENDATIONS.map((r) => {
            const isApplied = applied.has(r.id)
            const style = RECO_STYLE[r.type]
            const plat  = platformLabel(r.platform)
            return (
              <div
                key={r.id}
                className={`overflow-hidden rounded-[22px] border bg-surface transition ${
                  isApplied ? 'border-emerald-400/20' : 'border-line'
                }`}
              >
                <div className="p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style.cls}`}>
                        {r.type}
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${plat.cls}`}>
                        {plat.label}
                      </span>
                    </div>
                    {isApplied ? (
                      <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Applied
                      </div>
                    ) : null}
                  </div>

                  <h3 className="mt-3 text-sm font-semibold text-white">{r.campaignName}</h3>
                  <p className="mt-1.5 text-sm leading-[1.55] text-slate-400">{r.rationale}</p>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <div className="rounded-[12px] border border-line bg-surface-2 px-3 py-2">
                      <div className="text-xs text-slate-500 uppercase tracking-[0.15em]">Action</div>
                      <div className="mt-0.5 text-sm font-medium text-slate-100">{r.action}</div>
                    </div>
                    <div className="rounded-[12px] border border-line bg-surface-2 px-3 py-2">
                      <div className="text-xs text-slate-500 uppercase tracking-[0.15em]">Est. leads</div>
                      <div className={`mt-0.5 text-sm font-semibold ${r.projectedLeadDelta > 0 ? 'text-emerald-400' : r.projectedLeadDelta < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                        {r.projectedLeadDelta > 0 ? `+${r.projectedLeadDelta}` : r.projectedLeadDelta === 0 ? 'No change' : r.projectedLeadDelta}/mo
                      </div>
                    </div>
                    <div className="rounded-[12px] border border-line bg-surface-2 px-3 py-2">
                      <div className="text-xs text-slate-500 uppercase tracking-[0.15em]">Spend Δ</div>
                      <div className={`mt-0.5 text-sm font-semibold ${r.projectedSpendDelta < 0 ? 'text-emerald-400' : 'text-slate-100'}`}>
                        {r.projectedSpendDelta < 0
                          ? `–AED ${Math.abs(r.projectedSpendDelta).toLocaleString()}`
                          : `+AED ${r.projectedSpendDelta.toLocaleString()}`}
                        /mo
                      </div>
                    </div>
                  </div>

                  {!isApplied && (
                    <button
                      onClick={() => apply(r.id)}
                      className="mt-4 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-semibold text-gold transition hover:bg-gold/15"
                    >
                      <Zap className="h-3.5 w-3.5" /> Apply recommendation
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Projected impact summary */}
      {hasApplied && (
        <section className="mt-8">
          <div className="rounded-[24px] border border-emerald-400/20 bg-emerald-400/[0.04] p-6">
            <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.18em] text-emerald-400/80">
              <CheckCircle2 className="h-3.5 w-3.5" /> Projected impact — {appliedRecos.length} recommendation{appliedRecos.length !== 1 ? 's' : ''} applied
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'New leads/mo',    value: projNewLeads.toLocaleString(),              good: projLeadDelta > 0 },
                { label: 'Spend/mo',        value: `AED ${projNewSpend.toLocaleString()}`,     good: projSpendDelta <= 0 },
                { label: 'Projected CPL',   value: `AED ${projNewCpl.toFixed(0)}`,             good: projNewCpl < AVG },
                { label: 'CPL saving',      value: `AED ${Math.max(0, AVG - projNewCpl).toFixed(0)}`, good: true },
              ].map((m) => (
                <div key={m.label} className="rounded-[14px] border border-line bg-surface-2 px-3 py-3">
                  <div className="text-xs text-slate-500 uppercase tracking-[0.15em]">{m.label}</div>
                  <div className={`mt-1.5 text-[20px] font-semibold tabular-nums leading-none ${m.good ? 'text-emerald-400' : 'text-slate-100'}`}>
                    {m.value}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 text-xs text-slate-500">
              Estimates based on current CPL trends. Actual results may vary within ±15%.
            </div>
          </div>
        </section>
      )}

      {/* Quick links */}
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/freehold-intelligence/lead-machine/campaigns/attribution"
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-4 py-2 text-sm text-slate-400 transition hover:border-gold/30 hover:text-white"
        >
          Attribution report <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
        <Link
          href="/freehold-intelligence/lead-machine/campaigns/launch"
          className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-semibold text-gold transition hover:bg-gold/15"
        >
          <Zap className="h-3.5 w-3.5" /> Launch new campaign
        </Link>
      </div>

    </div>
  )
}
