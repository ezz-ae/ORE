'use client'

import Link from 'next/link'
import { ArrowUpRight, CheckCircle2, Plus, Palette } from 'lucide-react'

const META_BLUE = '#1877F2'

interface MetaCampaign {
  name: string
  status: 'Active' | 'Paused'
  dailyBudget: number
  spend: number
  impressions: number
  clicks: number
  leads: number
  cpl: number
}

const campaigns: MetaCampaign[] = [
  {
    name: 'Palm Jumeirah Investor | Meta',
    status: 'Active',
    dailyBudget: 500,
    spend: 7820,
    impressions: 148200,
    clicks: 3210,
    leads: 94,
    cpl: 83.2,
  },
  {
    name: 'Dubai Hills Yield | Meta',
    status: 'Active',
    dailyBudget: 350,
    spend: 6140,
    impressions: 124800,
    clicks: 2740,
    leads: 88,
    cpl: 69.8,
  },
  {
    name: 'Golden Visa Buyers | Meta',
    status: 'Active',
    dailyBudget: 250,
    spend: 4460,
    impressions: 89400,
    clicks: 1960,
    leads: 66,
    cpl: 67.6,
  },
  {
    name: 'JVC Investor | Meta',
    status: 'Paused',
    dailyBudget: 200,
    spend: 0,
    impressions: 0,
    clicks: 0,
    leads: 0,
    cpl: 0,
  },
]

const adSets = [
  { name: 'UAE Homebuyers 25–45', budget: 'AED 450/day', status: 'Active',  audience: '2.1M' },
  { name: 'GCC Investors',         budget: 'AED 280/day', status: 'Active',  audience: '840K' },
  { name: 'Expat Professionals',   budget: 'AED 170/day', status: 'Paused', audience: '1.4M' },
]

export default function MetaAdsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-10 sm:px-6 sm:pt-14">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <section>
          <div
            className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em]"
            style={{ color: `${META_BLUE}CC` }}
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill={META_BLUE}>
              <path d="M12 2.04c-5.5 0-9.96 4.46-9.96 9.96 0 4.41 2.87 8.16 6.84 9.49v-6.71H6.9v-2.78h1.98V9.84c0-1.95 1.17-3.03 2.94-3.03.85 0 1.74.15 1.74.15v1.92h-.98c-.97 0-1.27.6-1.27 1.21v1.46h2.16l-.34 2.78h-1.82V21.5c3.97-1.33 6.84-5.08 6.84-9.5 0-5.5-4.46-9.96-9.96-9.96z" />
            </svg>
            Meta Ads
          </div>
          <h1 className="mt-4 text-[36px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[48px]">
            Meta campaigns<br />
            <span className="text-white/35">Freehold Property Dubai.</span>
          </h1>
        </section>

        <div className="mt-7 flex flex-col items-end gap-2 sm:mt-10">
          {/* Connected badge */}
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/[0.08] px-3 py-1.5 text-[11px] font-medium text-emerald-300">
            <CheckCircle2 className="h-3 w-3" />
            Connected
          </span>
          {/* Manage external link */}
          <button className="inline-flex items-center gap-1 text-[12px] text-white/35 transition hover:text-white/60">
            Manage in Meta <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Account status */}
      <div className="mt-6 flex items-center gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.03] px-5 py-4">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${META_BLUE}18`, border: `1px solid ${META_BLUE}30` }}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill={META_BLUE}>
            <path d="M12 2.04c-5.5 0-9.96 4.46-9.96 9.96 0 4.41 2.87 8.16 6.84 9.49v-6.71H6.9v-2.78h1.98V9.84c0-1.95 1.17-3.03 2.94-3.03.85 0 1.74.15 1.74.15v1.92h-.98c-.97 0-1.27.6-1.27 1.21v1.46h2.16l-.34 2.78h-1.82V21.5c3.97-1.33 6.84-5.08 6.84-9.5 0-5.5-4.46-9.96-9.96-9.96z" />
          </svg>
        </div>
        <div>
          <div className="text-[13px] font-semibold text-white">Freehold Property Dubai</div>
          <div className="text-[11px] text-white/40">Facebook Page · Business Account connected</div>
        </div>
      </div>

      {/* KPI row */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'Spend',        value: 'AED 18,420' },
          { label: 'Reach',        value: '142,000' },
          { label: 'Impressions',  value: '380,000' },
          { label: 'Leads',        value: '248',       color: 'text-emerald-300' },
          { label: 'CPL',          value: 'AED 74.3' },
          { label: 'CTR',          value: '2.1%' },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-4">
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/40">{k.label}</div>
            <div className={`mt-2 text-[20px] font-semibold leading-none ${k.color ?? 'text-white'}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Campaigns table */}
      <section className="mt-10">
        <div className="mb-4 text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">Active Campaigns</div>
        <div className="overflow-x-auto">
          <div className="min-w-[700px] overflow-hidden rounded-2xl border border-white/[0.05] bg-white/[0.03]">
            {/* Table header */}
            <div className="grid grid-cols-[2fr_80px_100px_80px_90px_70px_60px_70px] gap-4 border-b border-white/[0.05] px-5 py-3">
              {['Campaign', 'Status', 'Daily Bdgt', 'Spend', 'Impr.', 'Clicks', 'Leads', 'CPL'].map((h) => (
                <div key={h} className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/30">{h}</div>
              ))}
            </div>
            {/* Rows */}
            <div className="divide-y divide-white/[0.04]">
              {campaigns.map((c) => (
                <div
                  key={c.name}
                  className="grid grid-cols-[2fr_80px_100px_80px_90px_70px_60px_70px] gap-4 items-center px-5 py-4"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${c.status === 'Active' ? 'bg-emerald-400' : 'bg-[#D4AF37]'}`} />
                    <span className="truncate text-[13px] font-semibold text-white/90">{c.name}</span>
                  </div>
                  <div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        c.status === 'Active'
                          ? 'border border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                          : 'border border-[#D4AF37]/20 bg-[#D4AF37]/10 text-[#D4AF37]'
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>
                  <div className="text-[12px] text-white/70">
                    {c.dailyBudget > 0 ? `AED ${c.dailyBudget}/d` : '—'}
                  </div>
                  <div className="text-[12px] text-white/70">
                    {c.spend > 0 ? `AED ${c.spend.toLocaleString()}` : '—'}
                  </div>
                  <div className="text-[12px] text-white/60">
                    {c.impressions > 0 ? c.impressions.toLocaleString() : '—'}
                  </div>
                  <div className="text-[12px] text-white/60">
                    {c.clicks > 0 ? c.clicks.toLocaleString() : '—'}
                  </div>
                  <div className={`text-[13px] font-semibold ${c.leads > 0 ? 'text-emerald-300' : 'text-white/30'}`}>
                    {c.leads > 0 ? c.leads : '—'}
                  </div>
                  <div className="text-[12px] text-white/70">
                    {c.cpl > 0 ? `AED ${c.cpl}` : '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Ad sets */}
      <section className="mt-10">
        <div className="mb-4 text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">Ad Sets</div>
        <div className="grid gap-3 sm:grid-cols-3">
          {adSets.map((s) => (
            <div
              key={s.name}
              className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold text-white/90">{s.name}</span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    s.status === 'Active'
                      ? 'border border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                      : 'border border-[#D4AF37]/20 bg-[#D4AF37]/10 text-[#D4AF37]'
                  }`}
                >
                  {s.status}
                </span>
              </div>
              <div className="mt-3 space-y-1.5 text-[12px] text-white/50">
                <div>Budget <span className="text-white/75">{s.budget}</span></div>
                <div>Audience size <span className="text-white/75">{s.audience}</span></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Quick actions */}
      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/freehold-intelligence/lead-machine/campaigns/new"
          className="inline-flex items-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-5 py-3 text-[13px] font-semibold text-white/80 transition hover:border-[#D4AF37]/30 hover:text-white"
        >
          <Plus className="h-4 w-4 text-[#D4AF37]" /> Create Campaign
        </Link>
        <Link
          href="/freehold-intelligence/lead-machine/creatives"
          className="inline-flex items-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-5 py-3 text-[13px] font-semibold text-white/80 transition hover:border-[#D4AF37]/30 hover:text-white"
        >
          <Palette className="h-4 w-4 text-[#D4AF37]" /> View Creatives
        </Link>
      </div>

    </div>
  )
}
