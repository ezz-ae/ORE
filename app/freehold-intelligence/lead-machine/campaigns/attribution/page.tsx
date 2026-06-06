'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  BarChart3, Users, Globe, AlertCircle, ChevronRight,
  TrendingDown, TrendingUp, Zap,
} from 'lucide-react'
import { financeSummary } from '@/src/features/freehold-intelligence/finance'
import { crmLeads } from '@/src/features/freehold-intelligence/server-session'
import { leadMachineListings, leadMachineLandings } from '@/src/features/freehold-intelligence/lead-machine'
import { AiPrompt } from '@/components/freehold/ai-prompt'

type PlatformFilter = 'All' | 'Meta' | 'Google'

function urgencyDot(u: string) {
  if (u === 'critical') return 'bg-red-400'
  if (u === 'high')     return 'bg-[#D4AF37]'
  if (u === 'medium')   return 'bg-sky-400'
  return 'bg-white/30'
}

function cplInfo(cpl: number, avg: number) {
  const r = cpl / avg
  if (r <= 0.90) return { color: 'text-emerald-400', icon: TrendingDown, label: `AED ${cpl.toFixed(0)} — below target` }
  if (r <= 1.05) return { color: 'text-[#D4AF37]',   icon: TrendingDown, label: `AED ${cpl.toFixed(0)} — on target`    }
  return              { color: 'text-red-400',         icon: TrendingUp,  label: `AED ${cpl.toFixed(0)} — above target` }
}

function platformStyle(p: string) {
  return p === 'meta'
    ? { label: 'Meta',   cls: 'border-blue-400/25 bg-blue-400/10 text-blue-300'  }
    : { label: 'Google', cls: 'border-[#D4AF37]/25 bg-[#D4AF37]/10 text-[#D4AF37]' }
}

function statusStyle(s: string) {
  if (s === 'Running') return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-400'
  if (s === 'Paused')  return 'border-white/15 bg-slate-800/40 text-slate-500'
  return 'border-red-400/25 bg-red-400/10 text-red-300'
}

function landingStatusStyle(s: string) {
  if (s === 'Approved' || s === 'Landing Active') return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-400'
  if (s === 'Pending Review') return 'border-[#D4AF37]/20 bg-[#D4AF37]/10 text-[#D4AF37]'
  return 'border-white/10 bg-slate-800/40 text-slate-500'
}

export default function CampaignAttributionPage() {
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('All')

  const avg = financeSummary.avgCpl30d
  const allCpl = financeSummary.topSpendCampaigns.map((c) => c.cpl)
  const bestCpl = Math.min(...allCpl)
  const worstCpl = Math.max(...allCpl)
  const cplRange = worstCpl + 5

  const campaigns = useMemo(() => {
    return financeSummary.topSpendCampaigns
      .filter((c) => {
        if (platformFilter === 'Meta')   return c.platform === 'meta'
        if (platformFilter === 'Google') return c.platform === 'google'
        return true
      })
      .map((c) => {
        const listing = c.projectId ? leadMachineListings.find((l) => l.projectId === c.projectId) ?? null : null
        const landing = c.landingId ? leadMachineLandings.find((l) => l.id === c.landingId) ?? null : null
        const leads   = crmLeads.filter((l) => l.campaignId === c.campaignId)
        return { ...c, listing, landing, crmLeads: leads }
      })
  }, [platformFilter])

  const totalSpend  = financeSummary.totalSpend30d
  const totalLeads  = financeSummary.totalLeads30d
  const cplDelta    = avg - 91.3 // vs last month

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      {/* Header */}
      <section>
        <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-[#D4AF37]/85">
          <BarChart3 className="h-3.5 w-3.5" /> Campaign Attribution
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white">
          Performance attribution
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-[1.65] text-slate-400">
          Full chain — campaign to property to landing to CRM lead.{' '}
          <span className="text-white">{financeSummary.topSpendCampaigns.length} campaigns</span> ·{' '}
          AED {totalSpend.toLocaleString()} spent ·{' '}
          {totalLeads} leads this month.
        </p>
      </section>

      {/* Stats */}
      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Active campaigns',  value: financeSummary.topSpendCampaigns.length.toString(), sub: 'Meta + Google' },
          { label: 'Total leads',       value: totalLeads.toLocaleString(),                        sub: 'Last 30 days' },
          { label: 'Best CPL',          value: `AED ${bestCpl.toFixed(0)}`,                       sub: 'Lowest this month', highlight: true },
          { label: 'Avg CPL',           value: `AED ${avg.toFixed(0)}`,                           sub: cplDelta < 0 ? `↓ AED ${Math.abs(cplDelta).toFixed(1)} vs last month` : `↑ AED ${cplDelta.toFixed(1)} vs last month` },
        ].map((s) => (
          <div key={s.label} className={`rounded-[18px] border bg-slate-900 p-4 ${s.highlight ? 'border-emerald-400/20' : 'border-slate-800'}`}>
            <div className={`text-[22px] font-semibold tabular-nums leading-none ${s.highlight ? 'text-emerald-400' : 'text-white'}`}>{s.value}</div>
            <div className="mt-1.5 text-xs text-slate-500">{s.label}</div>
            <div className="mt-1 text-xs text-slate-600">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Platform filter */}
      <div className="mt-8 flex items-center gap-2">
        {(['All', 'Meta', 'Google'] as PlatformFilter[]).map((p) => (
          <button
            key={p}
            onClick={() => setPlatformFilter(p)}
            className={[
              'rounded-full border px-3 py-1 text-sm font-medium transition',
              platformFilter === p
                ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]'
                : 'border-slate-800 bg-slate-800/40 text-slate-500 hover:text-slate-300',
            ].join(' ')}
          >
            {p}
          </button>
        ))}
        <span className="ml-2 text-xs text-slate-600">{campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Campaign cards */}
      <div className="mt-6 space-y-5">
        {campaigns.map((campaign) => {
          const plat    = platformStyle(campaign.platform)
          const info    = cplInfo(campaign.cpl, avg)
          const cplPct  = Math.min(100, (campaign.cpl / cplRange) * 100)
          const avgPct  = Math.min(100, (avg / cplRange) * 100)
          const Icon    = info.icon

          return (
            <article
              key={campaign.name}
              className="overflow-hidden rounded-[28px] border border-slate-800 bg-slate-900 transition hover:border-[#D4AF37]/20"
            >
              <div className="p-6 sm:p-7">

                {/* Top row */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${plat.cls}`}>
                      {plat.label}
                    </span>
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusStyle(campaign.status)}`}>
                      {campaign.status === 'Running' && (
                        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                      )}
                      {campaign.status}
                    </span>
                  </div>
                  <div className={`flex items-center gap-1 text-sm font-medium ${info.color}`}>
                    <Icon className="h-3.5 w-3.5" />
                    {info.label}
                  </div>
                </div>

                <h3 className="mt-3 text-[17px] font-semibold leading-snug text-white">{campaign.name}</h3>

                {/* Property + landing chain */}
                <div className="mt-3 space-y-1.5">
                  {campaign.listing ? (
                    <div className="flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
                      <span>{campaign.listing.area}</span>
                      <span className="text-slate-600">·</span>
                      <span>{campaign.listing.developer}</span>
                      <span className="text-slate-600">·</span>
                      <Link
                        href={`/freehold-intelligence/lead-machine/listings/${campaign.listing.id}`}
                        className="text-[#D4AF37]/65 transition hover:text-[#D4AF37]"
                      >
                        {campaign.listing.projectName}
                      </Link>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500">Multi-project — no single property linked</div>
                  )}

                  {campaign.landing ? (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <Globe className="h-3 w-3 shrink-0" />
                      <span className="font-mono">{campaign.landing.landingUrl}</span>
                      <span className={`rounded-full border px-1.5 py-px text-xs font-medium ${landingStatusStyle(campaign.landing.status)}`}>
                        {campaign.landing.status}
                      </span>
                      <span className="text-slate-600">{campaign.landing.completion}% complete</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                      <Globe className="h-3 w-3 shrink-0" />
                      No landing page linked
                      <Link
                        href="/freehold-intelligence/lead-machine/landings"
                        className="text-[#D4AF37]/50 transition hover:text-[#D4AF37]"
                      >
                        View landings
                      </Link>
                    </div>
                  )}
                </div>

                {/* Metrics row */}
                <div className="mt-5 grid grid-cols-3 gap-3">
                  {[
                    { label: 'Spend',  value: `AED ${campaign.spendAED.toLocaleString()}`, dim: false },
                    { label: 'Leads',  value: campaign.leads.toString(),                   dim: false },
                    { label: 'CPL',    value: `AED ${campaign.cpl.toFixed(0)}`,            dim: true  },
                  ].map((m) => (
                    <div key={m.label} className="rounded-[14px] border border-slate-800 bg-slate-800/40 px-3 py-3">
                      <div className="text-xs font-medium uppercase tracking-[0.15em] text-slate-500">{m.label}</div>
                      <div className={`mt-1.5 text-[20px] font-semibold tabular-nums leading-none ${m.dim ? info.color : 'text-white'}`}>
                        {m.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* CPL bar vs. target */}
                <div className="mt-4">
                  <div className="mb-1.5 flex items-center justify-between text-xs text-slate-600">
                    <span>CPL vs. AED {avg} target</span>
                    <span className={info.color}>{campaign.cpl < avg ? `AED ${(avg - campaign.cpl).toFixed(0)} below` : `AED ${(campaign.cpl - avg).toFixed(0)} above`}</span>
                  </div>
                  <div className="relative h-1.5 overflow-hidden rounded-full bg-slate-800/50">
                    {/* Target marker line */}
                    <div
                      className="absolute top-0 h-full w-px bg-white/20"
                      style={{ left: `${avgPct}%` }}
                    />
                    {/* Campaign CPL bar */}
                    <div
                      className={`h-full rounded-full transition-all ${
                        campaign.cpl < avg ? 'bg-emerald-500' :
                        campaign.cpl < avg * 1.1 ? 'bg-[#D4AF37]' : 'bg-red-500'
                      }`}
                      style={{ width: `${cplPct}%` }}
                    />
                  </div>
                </div>

                {/* CRM attribution */}
                <div className="mt-5 border-t border-slate-800 pt-5">
                  {campaign.crmLeads.length > 0 ? (
                    <>
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                          <Users className="h-3 w-3" />
                          CRM attribution — {campaign.crmLeads.length} lead{campaign.crmLeads.length !== 1 ? 's' : ''}
                        </div>
                        <Link
                          href="/freehold-intelligence/crm"
                          className="flex items-center gap-1 text-xs text-[#D4AF37]/50 transition hover:text-[#D4AF37]"
                        >
                          All leads <ChevronRight className="h-3 w-3" />
                        </Link>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {campaign.crmLeads.map((lead) => (
                          <Link
                            key={lead.id}
                            href={`/freehold-intelligence/crm/leads/${lead.id}`}
                            className="group flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-800/40 px-3 py-1 text-xs text-slate-300 transition hover:border-[#D4AF37]/30 hover:text-white"
                          >
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${urgencyDot(lead.urgency)}`} />
                            {lead.name}
                            <span className="text-slate-600">·</span>
                            <span className={`font-medium tabular-nums ${lead.intentScore >= 85 ? 'text-[#D4AF37]' : 'text-slate-500'}`}>
                              {lead.intentScore}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          {campaign.leads} leads recorded on platform — not yet matched in CRM.
                        </span>
                      </div>
                      <Link
                        href="/freehold-intelligence/crm"
                        className="text-xs text-[#D4AF37]/50 transition hover:text-[#D4AF37]"
                      >
                        Open CRM
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </article>
          )
        })}
      </div>

      {/* AI Prompt */}
      <section className="mt-12">
        <AiPrompt
          placeholder="Ask about campaign performance, attribution gaps, CPL trends…"
          suggestions={[
            'Which campaign has the lowest CPL this month?',
            'Why is Palm Google Search paused?',
            'How much did we spend vs. leads generated per platform?',
            'Which campaigns need a landing page assigned?',
          ]}
        />
      </section>
    </div>
  )
}
