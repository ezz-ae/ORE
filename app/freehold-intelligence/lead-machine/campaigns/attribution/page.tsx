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

// Static attribution: campaign name → ids + status
const CAMPAIGN_ATTR: Record<string, {
  campaignId: string
  projectId: string | null
  landingId: string | null
  status: 'Running' | 'Paused' | 'Blocked'
}> = {
  'Palm Jumeirah Investor — META': {
    campaignId: 'cmp_palm_q2',
    projectId: 'freehold-palm-jumeirah-0033',
    landingId: 'landing_palm_investor',
    status: 'Running',
  },
  'Dubai Hills Yield — META': {
    campaignId: 'cmp_hills_q2',
    projectId: 'freehold-dubai-hills-0012',
    landingId: 'landing_hills_yield',
    status: 'Running',
  },
  'Golden Visa Buyers — META': {
    campaignId: 'cmp_gv_2026',
    projectId: null,
    landingId: 'landing_golden_visa',
    status: 'Running',
  },
  'Palm Jumeirah Investor — Search': {
    campaignId: 'cmp_palm_search',
    projectId: 'freehold-palm-jumeirah-0033',
    landingId: 'landing_palm_investor',
    status: 'Paused',
  },
  'Dubai Property Investment — PMax': {
    campaignId: 'cmp_pmax_2026',
    projectId: null,
    landingId: null,
    status: 'Running',
  },
  'Off Plan Dubai 2025 — Search': {
    campaignId: 'cmp_offplan_search',
    projectId: null,
    landingId: null,
    status: 'Running',
  },
}

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
  if (s === 'Paused')  return 'border-white/15 bg-white/[0.04] text-white/45'
  return 'border-red-400/25 bg-red-400/10 text-red-300'
}

function landingStatusStyle(s: string) {
  if (s === 'Approved' || s === 'Landing Active') return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-400'
  if (s === 'Pending Review') return 'border-[#D4AF37]/20 bg-[#D4AF37]/10 text-[#D4AF37]'
  return 'border-white/10 bg-white/[0.04] text-white/40'
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
        const attr    = CAMPAIGN_ATTR[c.name] ?? { campaignId: '', projectId: null, landingId: null, status: 'Running' as const }
        const listing = attr.projectId ? leadMachineListings.find((l) => l.projectId === attr.projectId) ?? null : null
        const landing = attr.landingId ? leadMachineLandings.find((l) => l.id === attr.landingId) ?? null : null
        const leads   = attr.campaignId ? crmLeads.filter((l) => l.campaignId === attr.campaignId) : []
        return { ...c, attr, listing, landing, crmLeads: leads }
      })
  }, [platformFilter])

  const totalSpend  = financeSummary.totalSpend30d
  const totalLeads  = financeSummary.totalLeads30d
  const cplDelta    = avg - 91.3 // vs last month

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      {/* Header */}
      <section>
        <div className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-wider text-[#D4AF37]/85">
          <BarChart3 className="h-3.5 w-3.5" /> Campaign Attribution
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white/90">
          Performance attribution
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-[1.65] text-white/55">
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
          <div key={s.label} className={`rounded-[18px] border bg-[#131B2B] p-4 ${s.highlight ? 'border-emerald-400/20' : 'border-white/[0.08]'}`}>
            <div className={`text-[22px] font-semibold tabular-nums leading-none ${s.highlight ? 'text-emerald-400' : 'text-white'}`}>{s.value}</div>
            <div className="mt-1.5 text-[12px] text-white/40">{s.label}</div>
            <div className="mt-1 text-[11px] text-white/25">{s.sub}</div>
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
              'rounded-full border px-3 py-1 text-[13px] font-medium transition',
              platformFilter === p
                ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]'
                : 'border-white/[0.08] bg-white/[0.03] text-white/45 hover:text-white/65',
            ].join(' ')}
          >
            {p}
          </button>
        ))}
        <span className="ml-2 text-[12px] text-white/25">{campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}</span>
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
              className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#131B2B] transition hover:border-[#D4AF37]/20"
            >
              <div className="p-6 sm:p-7">

                {/* Top row */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${plat.cls}`}>
                      {plat.label}
                    </span>
                    <span className={`rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${statusStyle(campaign.attr.status)}`}>
                      {campaign.attr.status === 'Running' && (
                        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                      )}
                      {campaign.attr.status}
                    </span>
                  </div>
                  <div className={`flex items-center gap-1 text-[13px] font-medium ${info.color}`}>
                    <Icon className="h-3.5 w-3.5" />
                    {info.label}
                  </div>
                </div>

                <h3 className="mt-3 text-[17px] font-semibold leading-snug text-white">{campaign.name}</h3>

                {/* Property + landing chain */}
                <div className="mt-3 space-y-1.5">
                  {campaign.listing ? (
                    <div className="flex flex-wrap items-center gap-1.5 text-[13px] text-white/45">
                      <span>{campaign.listing.area}</span>
                      <span className="text-white/20">·</span>
                      <span>{campaign.listing.developer}</span>
                      <span className="text-white/20">·</span>
                      <Link
                        href={`/freehold-intelligence/lead-machine/listings/${campaign.listing.id}`}
                        className="text-[#D4AF37]/65 transition hover:text-[#D4AF37]"
                      >
                        {campaign.listing.projectName}
                      </Link>
                    </div>
                  ) : (
                    <div className="text-[13px] text-white/30">Multi-project — no single property linked</div>
                  )}

                  {campaign.landing ? (
                    <div className="flex flex-wrap items-center gap-2 text-[12px] text-white/30">
                      <Globe className="h-3 w-3 shrink-0" />
                      <span className="font-mono">{campaign.landing.landingUrl}</span>
                      <span className={`rounded-full border px-1.5 py-px text-[11px] font-medium ${landingStatusStyle(campaign.landing.status)}`}>
                        {campaign.landing.status}
                      </span>
                      <span className="text-white/20">{campaign.landing.completion}% complete</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[12px] text-white/25">
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
                    <div key={m.label} className="rounded-[14px] border border-white/[0.06] bg-white/[0.025] px-3 py-3">
                      <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-white/30">{m.label}</div>
                      <div className={`mt-1.5 text-[20px] font-semibold tabular-nums leading-none ${m.dim ? info.color : 'text-white'}`}>
                        {m.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* CPL bar vs. target */}
                <div className="mt-4">
                  <div className="mb-1.5 flex items-center justify-between text-[11px] text-white/25">
                    <span>CPL vs. AED {avg} target</span>
                    <span className={info.color}>{campaign.cpl < avg ? `AED ${(avg - campaign.cpl).toFixed(0)} below` : `AED ${(campaign.cpl - avg).toFixed(0)} above`}</span>
                  </div>
                  <div className="relative h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
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
                <div className="mt-5 border-t border-white/[0.06] pt-5">
                  {campaign.crmLeads.length > 0 ? (
                    <>
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-[0.18em] text-white/30">
                          <Users className="h-3 w-3" />
                          CRM attribution — {campaign.crmLeads.length} lead{campaign.crmLeads.length !== 1 ? 's' : ''}
                        </div>
                        <Link
                          href="/freehold-intelligence/crm"
                          className="flex items-center gap-1 text-[12px] text-[#D4AF37]/50 transition hover:text-[#D4AF37]"
                        >
                          All leads <ChevronRight className="h-3 w-3" />
                        </Link>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {campaign.crmLeads.map((lead) => (
                          <Link
                            key={lead.id}
                            href={`/freehold-intelligence/crm/leads/${lead.id}`}
                            className="group flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1 text-[12px] text-white/65 transition hover:border-[#D4AF37]/30 hover:text-white"
                          >
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${urgencyDot(lead.urgency)}`} />
                            {lead.name}
                            <span className="text-white/25">·</span>
                            <span className={`font-medium tabular-nums ${lead.intentScore >= 85 ? 'text-[#D4AF37]' : 'text-white/45'}`}>
                              {lead.intentScore}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2 text-[12px] text-white/25">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          {campaign.leads} leads recorded on platform — not yet matched in CRM.
                        </span>
                      </div>
                      <Link
                        href="/freehold-intelligence/crm"
                        className="text-[12px] text-[#D4AF37]/50 transition hover:text-[#D4AF37]"
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
