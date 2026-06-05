'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Radio } from 'lucide-react'
import { financeSummary } from '@/src/features/freehold-intelligence/finance'

type Platform = 'All' | 'Meta' | 'Google'

function UtilBar({ pct }: { pct: number }) {
  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
      <div
        className="h-full rounded-full bg-[#D4AF37]"
        style={{ width: `${(pct * 100).toFixed(1)}%` }}
      />
    </div>
  )
}

export default function AdsLivePage() {
  const [platform, setPlatform] = useState<Platform>('All')

  const tabs: Platform[] = ['All', 'Meta', 'Google']

  const campaigns = financeSummary.topSpendCampaigns.filter((c) => {
    if (platform === 'All') return true
    if (platform === 'Meta') return c.platform === 'meta'
    return c.platform === 'google'
  })

  const now = new Date().toLocaleTimeString('en-AE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Dubai',
  })

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-10 sm:px-6 sm:pt-14">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <section>
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
            <Radio className="h-3.5 w-3.5" /> Ads Live
          </div>
          <h1 className="mt-4 text-[36px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[48px]">
            Ads dashboard<br />
            <span className="text-white/35">all platforms.</span>
          </h1>
        </section>

        <div className="mt-7 flex items-center gap-3 sm:mt-10">
          <span className="flex items-center gap-1.5 text-[12px] text-white/40">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Live · {now} GST
          </span>
        </div>
      </div>

      {/* Platform toggle */}
      <div className="mt-8 flex gap-1 rounded-[14px] border border-white/[0.07] bg-white/[0.03] p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setPlatform(t)}
            className={`rounded-[10px] px-5 py-2 text-[13px] font-semibold transition ${
              platform === t
                ? 'bg-[#D4AF37] text-[#06080A]'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Top metrics */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Spend 30d', value: 'AED 31,290', sub: 'Both platforms' },
          { label: 'Total Leads',     value: '415',         sub: '30-day window' },
          { label: 'Avg CPL',         value: 'AED 75.4',   sub: 'Blended average' },
          { label: 'Active Campaigns', value: '6',          sub: 'Meta + Google' },
        ].map((m) => (
          <div key={m.label} className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-5">
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/40">{m.label}</div>
            <div className="mt-2 text-[28px] font-semibold leading-none text-white">{m.value}</div>
            <div className="mt-1.5 text-[11px] text-white/35">{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Platform split */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">

        {/* Meta column */}
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-6">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#1877F2' }} />
            <span className="text-[13px] font-semibold" style={{ color: '#1877F2' }}>Meta Ads</span>
          </div>
          <div className="mt-5 space-y-4">
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-[12px] text-white/50">Spend this month</span>
                <span className="text-[15px] font-semibold text-white">AED 18,420</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between text-[11px] text-white/35">
                <span>Budget AED 25,000</span>
                <span>73.7%</span>
              </div>
              <UtilBar pct={financeSummary.budgetUtilizationMeta} />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <div className="text-[11px] text-white/40">Leads</div>
                <div className="mt-0.5 text-[20px] font-semibold text-white">248</div>
              </div>
              <div>
                <div className="text-[11px] text-white/40">CPL</div>
                <div className="mt-0.5 text-[20px] font-semibold text-white">AED 74.3</div>
              </div>
            </div>
          </div>
          <Link
            href="/freehold-intelligence/ads-live/meta"
            className="mt-5 inline-flex items-center gap-1 text-[12px] font-medium text-[#1877F2]/70 transition hover:text-[#1877F2]"
          >
            Meta Ads <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Google column */}
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-6">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#4285F4' }} />
            <span className="text-[13px] font-semibold" style={{ color: '#4285F4' }}>Google Ads</span>
          </div>
          <div className="mt-5 space-y-4">
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-[12px] text-white/50">Spend this month</span>
                <span className="text-[15px] font-semibold text-white">AED 12,870</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between text-[11px] text-white/35">
                <span>Budget AED 18,000</span>
                <span>71.5%</span>
              </div>
              <UtilBar pct={financeSummary.budgetUtilizationGoogle} />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <div className="text-[11px] text-white/40">Leads</div>
                <div className="mt-0.5 text-[20px] font-semibold text-white">167</div>
              </div>
              <div>
                <div className="text-[11px] text-white/40">CPL</div>
                <div className="mt-0.5 text-[20px] font-semibold text-white">AED 77.1</div>
              </div>
            </div>
          </div>
          <Link
            href="/freehold-intelligence/ads-live/google"
            className="mt-5 inline-flex items-center gap-1 text-[12px] font-medium text-[#4285F4]/70 transition hover:text-[#4285F4]"
          >
            Google Ads <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Live campaigns */}
      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">
            Live Campaigns
          </div>
          <span className="flex items-center gap-1.5 text-[11px] text-emerald-400/70">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            Live data
          </span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/[0.05] bg-white/[0.03]">
          <div className="divide-y divide-white/[0.04]">
            {campaigns.map((c) => {
              const isMeta = c.platform === 'meta'
              const platformColor = isMeta ? '#1877F2' : '#4285F4'
              const platformLabel = isMeta ? 'Meta' : 'Google'
              return (
                <div
                  key={c.name}
                  className="flex flex-wrap items-center gap-x-6 gap-y-2 px-6 py-4"
                >
                  {/* Live indicator */}
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  </span>

                  {/* Name */}
                  <div className="min-w-0 flex-1">
                    <span className="truncate text-[13px] font-semibold text-white/90">{c.name}</span>
                  </div>

                  {/* Platform badge */}
                  <span
                    className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                    style={{
                      backgroundColor: `${platformColor}18`,
                      color: platformColor,
                      border: `1px solid ${platformColor}30`,
                    }}
                  >
                    {platformLabel}
                  </span>

                  {/* Stats */}
                  <div className="flex gap-5 text-[12px] text-white/50">
                    <span>
                      Spend{' '}
                      <span className="text-white/80">
                        AED {c.spendAED.toLocaleString()}
                      </span>
                    </span>
                    <span>
                      Leads <span className="font-semibold text-emerald-300">{c.leads}</span>
                    </span>
                    <span>
                      CPL <span className="text-white/80">AED {c.cpl}</span>
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Quick links */}
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/freehold-intelligence/ads-live/meta"
          className="inline-flex items-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-5 py-3 text-[13px] font-semibold text-white/80 transition hover:border-[#1877F2]/30 hover:text-white"
        >
          Meta Ads <ArrowUpRight className="h-3.5 w-3.5 text-[#1877F2]" />
        </Link>
        <Link
          href="/freehold-intelligence/ads-live/google"
          className="inline-flex items-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-5 py-3 text-[13px] font-semibold text-white/80 transition hover:border-[#4285F4]/30 hover:text-white"
        >
          Google Ads <ArrowUpRight className="h-3.5 w-3.5 text-[#4285F4]" />
        </Link>
        <Link
          href="/freehold-intelligence/ads-live/preview"
          className="inline-flex items-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-5 py-3 text-[13px] font-semibold text-white/80 transition hover:border-[#D4AF37]/30 hover:text-white"
        >
          Ad Preview <ArrowUpRight className="h-3.5 w-3.5 text-[#D4AF37]" />
        </Link>
      </div>

    </div>
  )
}
