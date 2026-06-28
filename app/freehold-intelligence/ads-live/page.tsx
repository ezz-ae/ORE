'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Radio, TrendingDown, TrendingUp } from 'lucide-react'
import { financeSummary } from '@/src/features/freehold-intelligence/finance'
import { leadMachineListings } from '@/src/features/freehold-intelligence/lead-machine'
import { PageHeader, StatCard, Section } from '@/components/freehold/ui'
import { useT } from '@/lib/i18n/provider'

// 4-week CPL trend: Meta vs Google
const CPL_TREND = [
  { week: 'W1', meta: 91.2, google: 88.4 },
  { week: 'W2', meta: 87.5, google: 84.0 },
  { week: 'W3', meta: 80.1, google: 81.3 },
  { week: 'W4', meta: 74.3, google: 77.1 },
]
const CPL_MAX = 100
const CPL_W = 320
const CPL_H = 64

function cplPoints(key: 'meta' | 'google') {
  const step = CPL_W / (CPL_TREND.length - 1)
  return CPL_TREND.map((d, i) => {
    const x = i * step
    const y = CPL_H - (d[key] / CPL_MAX) * (CPL_H - 8)
    return `${x},${y}`
  }).join(' ')
}

type Platform = 'All' | 'Meta' | 'Google'

function UtilBar({ pct }: { pct: number }) {
  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
      <div
        className="h-full rounded-full bg-gold"
        style={{ width: `${(pct * 100).toFixed(1)}%` }}
      />
    </div>
  )
}

export default function AdsLivePage() {
  const t = useT()
  const [platform, setPlatform] = useState<Platform>('All')

  const tabs: Platform[] = ['All', 'Meta', 'Google']
  const tabLabel: Record<Platform, string> = {
    All: t('lm.live.tab.all'),
    Meta: t('lm.live.tab.meta'),
    Google: t('lm.live.tab.google'),
  }

  const campaigns = financeSummary.topSpendCampaigns.filter((c) => {
    if (platform === 'All') return true
    if (platform === 'Meta') return c.platform === 'meta'
    return c.platform === 'google'
  })

  // Compute the live time on the client only — calling new Date() during render
  // produces a server/client hydration mismatch.
  const [now, setNow] = useState<string>('')
  useEffect(() => {
    const fmt = () =>
      new Date().toLocaleTimeString('en-AE', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Dubai',
      })
    setNow(fmt())
    const id = setInterval(() => setNow(fmt()), 60_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      {/* Header */}
      <PageHeader
        eyebrow={t('lm.live.eyebrow')}
        Icon={Radio}
        title={t('lm.live.title')}
        subtitle={t('lm.live.subtitle')}
        actions={
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
            </span>
            {t('lm.live.status', { time: now })}
          </span>
        }
      />

      {/* Platform toggle */}
      <div className="mt-6 flex gap-1 rounded-xl border border-line bg-surface-2 p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setPlatform(tab)}
            className={`rounded-lg px-5 py-2 text-sm font-semibold transition ${
              platform === tab
                ? 'bg-gold text-ink'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tabLabel[tab]}
          </button>
        ))}
      </div>

      {/* Top metrics */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t('lm.live.stat.totalSpend')} value="AED 31,290" hint={t('lm.live.stat.totalSpend.hint')} />
        <StatCard label={t('lm.live.stat.totalLeads')} value={415} hint={t('lm.live.stat.totalLeads.hint')} delta={{ value: '+12%', direction: 'up' }} />
        <StatCard label={t('lm.live.stat.avgCpl')} value="AED 75.4" hint={t('lm.live.stat.avgCpl.hint')} delta={{ value: '−18.5%', direction: 'up' }} />
        <StatCard label={t('lm.live.stat.activeCampaigns')} value={6} hint={t('lm.live.stat.activeCampaigns.hint')} />
      </div>

      {/* Platform split */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">

        {/* Meta column */}
        <div className="rounded-2xl border border-line bg-surface-2 p-6">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#1877F2' }} />
            <span className="text-sm font-semibold" style={{ color: '#1877F2' }}>{t('lm.ads.meta.label')}</span>
          </div>
          <div className="mt-5 space-y-4">
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-slate-400">{t('lm.live.spendThisMonth')}</span>
                <span className="text-sm font-semibold text-white">AED 18,420</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between text-sm text-slate-500">
                <span>{t('lm.live.budget', { amount: 'AED 25,000' })}</span>
                <span>73.7%</span>
              </div>
              <UtilBar pct={financeSummary.budgetUtilizationMeta} />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <div className="text-sm text-slate-400">{t('lm.live.leads')}</div>
                <div className="mt-0.5 text-xl font-semibold text-white">248</div>
              </div>
              <div>
                <div className="text-sm text-slate-400">{t('lm.live.cpl')}</div>
                <div className="mt-0.5 text-xl font-semibold text-white">AED 74.3</div>
              </div>
            </div>
          </div>
          <Link
            href="/freehold-intelligence/ads-live/meta"
            className="mt-5 inline-flex items-center gap-1 text-xs font-medium text-[#1877F2]/70 transition hover:text-[#1877F2]"
          >
            {t('lm.ads.meta.label')} <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Google column */}
        <div className="rounded-2xl border border-line bg-surface-2 p-6">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#4285F4' }} />
            <span className="text-sm font-semibold" style={{ color: '#4285F4' }}>{t('lm.ads.google.label')}</span>
          </div>
          <div className="mt-5 space-y-4">
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-slate-400">{t('lm.live.spendThisMonth')}</span>
                <span className="text-sm font-semibold text-white">AED 12,870</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between text-sm text-slate-500">
                <span>{t('lm.live.budget', { amount: 'AED 18,000' })}</span>
                <span>71.5%</span>
              </div>
              <UtilBar pct={financeSummary.budgetUtilizationGoogle} />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <div className="text-sm text-slate-400">{t('lm.live.leads')}</div>
                <div className="mt-0.5 text-xl font-semibold text-white">167</div>
              </div>
              <div>
                <div className="text-sm text-slate-400">{t('lm.live.cpl')}</div>
                <div className="mt-0.5 text-xl font-semibold text-white">AED 77.1</div>
              </div>
            </div>
          </div>
          <Link
            href="/freehold-intelligence/ads-live/google"
            className="mt-5 inline-flex items-center gap-1 text-xs font-medium text-[#4285F4]/70 transition hover:text-[#4285F4]"
          >
            {t('lm.ads.google.label')} <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Live campaigns */}
      <Section
        className="mt-10"
        title={t('lm.live.section.campaigns')}
        action={
          <span className="flex items-center gap-1.5 text-xs text-gold/70">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-gold" />
            </span>
            {t('lm.live.liveData')}
          </span>
        }
      >

        <div className="overflow-hidden rounded-2xl border border-line bg-surface-2">
          <div className="divide-y divide-line">
            {campaigns.map((c) => {
              const isMeta   = c.platform === 'meta'
              const platClr  = isMeta ? '#1877F2' : '#4285F4'
              const platLbl  = isMeta ? 'Meta' : 'Google'
              const avg      = financeSummary.avgCpl30d
              const below    = c.cpl < avg
              const listing  = c.projectId ? leadMachineListings.find((l) => l.projectId === c.projectId) : null
              const CplIcon  = below ? TrendingDown : TrendingUp
              return (
                <Link
                  key={c.name}
                  href="/freehold-intelligence/lead-machine/campaigns/attribution"
                  className="group flex flex-wrap items-center gap-x-6 gap-y-2 px-6 py-4 transition hover:bg-surface-2"
                >
                  {/* Live / paused indicator */}
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    {c.status === 'Running' && (
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-50" />
                    )}
                    <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${c.status === 'Running' ? 'bg-gold' : 'bg-surface-3'}`} />
                  </span>

                  {/* Name + property */}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-100 group-hover:text-white transition-colors">{c.name}</div>
                    {listing && (
                      <div className="mt-0.5 text-xs text-slate-500">{listing.area} · {listing.developer}</div>
                    )}
                  </div>

                  {/* Platform badge */}
                  <span
                    className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                    style={{ backgroundColor: `${platClr}18`, color: platClr, border: `1px solid ${platClr}30` }}
                  >
                    {platLbl}
                  </span>

                  {/* Stats */}
                  <div className="flex gap-5 text-xs text-slate-400">
                    <span>AED {c.spendAED.toLocaleString()}</span>
                    <span className="font-semibold text-gold">{t('lm.live.leadsCount', { count: String(c.leads) })}</span>
                    <span className={`flex items-center gap-0.5 font-medium ${below ? 'text-emerald-400' : 'text-red-400'}`}>
                      <CplIcon className="h-3 w-3" />
                      AED {c.cpl}
                    </span>
                  </div>

                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-500 opacity-0 group-hover:opacity-100 transition" />
                </Link>
              )
            })}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-end">
          <Link
            href="/freehold-intelligence/lead-machine/campaigns/attribution"
            className="flex items-center gap-1 text-xs text-gold/50 transition hover:text-gold"
          >
            {t('lm.live.fullAttribution')} <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </Section>

      {/* CPL trend chart */}
      <Section className="mt-10" title={t('lm.live.section.cplTrend')}>
        <div className="rounded-2xl border border-line bg-surface-2 p-6">
          <div className="flex items-center gap-6 mb-4 text-xs">
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 rounded-full" style={{ backgroundColor: '#1877F2' }} />Meta</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 rounded-full" style={{ backgroundColor: '#4285F4' }} />Google</span>
          </div>
          <div className="overflow-x-auto">
            <svg viewBox={`0 0 ${CPL_W} ${CPL_H + 24}`} className="w-full min-w-[240px]" preserveAspectRatio="none">
              {/* Week labels */}
              {CPL_TREND.map((d, i) => {
                const x = i * (CPL_W / (CPL_TREND.length - 1))
                return (
                  <text key={d.week} x={x} y={CPL_H + 16} textAnchor="middle" fontSize="9" fill="rgba(148,163,184,0.5)" fontFamily="sans-serif">
                    {d.week}
                  </text>
                )
              })}
              {/* Meta line */}
              <polyline points={cplPoints('meta')} fill="none" stroke="#1877F2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              {/* Google line */}
              <polyline points={cplPoints('google')} fill="none" stroke="#4285F4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 3" />
              {/* End point dots */}
              {(['meta', 'google'] as const).map((key) => {
                const last = CPL_TREND[CPL_TREND.length - 1]
                const x = CPL_W
                const y = CPL_H - (last[key] / CPL_MAX) * (CPL_H - 8)
                return (
                  <g key={key}>
                    <circle cx={x} cy={y} r="3" fill={key === 'meta' ? '#1877F2' : '#4285F4'} />
                    <text x={x - 4} y={y - 6} textAnchor="end" fontSize="9" fill={key === 'meta' ? '#1877F2' : '#4285F4'} fontFamily="sans-serif">
                      AED {last[key]}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
          <p className="mt-2 text-sm text-slate-500">{t('lm.live.cplTrendNote')}</p>
        </div>
      </Section>

      {/* Quick links */}
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/freehold-intelligence/ads-live/meta"
          className="inline-flex items-center gap-2 rounded-2xl border border-line bg-surface-2 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:border-[#1877F2]/30 hover:text-white"
        >
          {t('lm.ads.meta.label')} <ArrowUpRight className="h-3.5 w-3.5 text-[#1877F2]" />
        </Link>
        <Link
          href="/freehold-intelligence/ads-live/google"
          className="inline-flex items-center gap-2 rounded-2xl border border-line bg-surface-2 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:border-[#4285F4]/30 hover:text-white"
        >
          {t('lm.ads.google.label')} <ArrowUpRight className="h-3.5 w-3.5 text-[#4285F4]" />
        </Link>
        <Link
          href="/freehold-intelligence/ads-live/preview"
          className="inline-flex items-center gap-2 rounded-2xl border border-line bg-surface-2 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:border-gold/30 hover:text-white"
        >
          {t('lm.live.adPreview')} <ArrowUpRight className="h-3.5 w-3.5 text-gold" />
        </Link>
      </div>


    </div>
  )
}
