'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import {
  BarChart3, Users, Globe, AlertCircle, ChevronRight,
  TrendingDown, TrendingUp, Zap, PlugZap, ArrowUpRight,
} from 'lucide-react'
import { financeSummary } from '@/src/features/freehold-intelligence/finance'
import { leadMachineListings, leadMachineLandings } from '@/src/features/freehold-intelligence/lead-machine'
import { useLiveLeads } from '@/lib/freehold/use-live-leads'
import { EmptyState } from '@/components/freehold/ui'
import { useT } from '@/lib/i18n/provider'

type PlatformFilter = 'All' | 'Meta' | 'Google'

function urgencyDot(u: string) {
  if (u === 'critical') return 'bg-red-400'
  if (u === 'high')     return 'bg-gold'
  if (u === 'medium')   return 'bg-teal-400'
  return 'bg-white/30'
}

function platformStyle(p: string) {
  return p === 'meta'
    ? { label: 'Meta',   cls: 'border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-300'  }
    : { label: 'Google', cls: 'border-gold/25 bg-gold/10 text-gold' }
}

function statusStyle(s: string) {
  if (s === 'Running') return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-400'
  if (s === 'Paused')  return 'border-white/15 bg-surface-2 text-slate-500'
  return 'border-red-400/25 bg-red-400/10 text-red-300'
}

function landingStatusStyle(s: string) {
  if (s === 'Approved' || s === 'Landing Active') return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-400'
  if (s === 'Pending Review') return 'border-gold/20 bg-gold/10 text-gold'
  return 'border-white/10 bg-surface-2 text-slate-500'
}

export default function CampaignAttributionPage() {
  const t = useT()
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('All')
  const { leads: liveLeads } = useLiveLeads()

  // Campaign attribution requires connected ad accounts. A platform counts as
  // connected only when its API does not return the demo flag. Until then we
  // show an honest connect state rather than seed campaign performance.
  const [adsConnected, setAdsConnected] = useState<boolean | null>(null)
  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/api/meta/campaigns', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/google/campaigns', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([meta, google]) => {
      if (cancelled) return
      setAdsConnected(Boolean((meta && !meta.demo) || (google && !google.demo)))
    })
    return () => { cancelled = true }
  }, [])

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
        const leads   = liveLeads.filter((l) => l.campaignId === c.campaignId)
        return { ...c, listing, landing, crmLeads: leads }
      })
  }, [platformFilter, liveLeads])

  const totalSpend  = financeSummary.totalSpend30d
  const totalLeads  = financeSummary.totalLeads30d
  const cplDelta    = avg - 91.3

  function cplInfo(cpl: number) {
    const r = cpl / avg
    if (r <= 0.90) return { color: 'text-emerald-400', icon: TrendingDown, label: `AED ${cpl.toFixed(0)} — ${t('lm.attribution.belowTarget')}` }
    if (r <= 1.05) return { color: 'text-gold',   icon: TrendingDown, label: `AED ${cpl.toFixed(0)} — ${t('lm.attribution.onTarget')}`    }
    return              { color: 'text-red-400',         icon: TrendingUp,  label: `AED ${cpl.toFixed(0)} — ${t('lm.attribution.aboveTarget')}` }
  }

  const stats = [
    { labelKey: 'lm.attribution.stat.activeCampaigns', value: financeSummary.topSpendCampaigns.length.toString(), subKey: 'lm.attribution.stat.activeCampaignsSub', highlight: false },
    { labelKey: 'lm.attribution.stat.totalLeads',       value: totalLeads.toLocaleString(),                        subKey: 'lm.attribution.stat.last30Days',         highlight: false },
    { labelKey: 'lm.attribution.stat.bestCpl',          value: `AED ${bestCpl.toFixed(0)}`,                       subKey: 'lm.attribution.stat.lowestThisMonth',    highlight: true  },
    { labelKey: 'lm.attribution.stat.avgCpl',           value: `AED ${avg.toFixed(0)}`,                           sub: cplDelta < 0 ? `↓ AED ${Math.abs(cplDelta).toFixed(1)} vs last month` : `↑ AED ${cplDelta.toFixed(1)} vs last month`, highlight: false },
  ]

  // No connected ad accounts → honest connect state (no seed campaign data).
  if (adsConnected === false) {
    return (
      <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
        <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-gold/85">
          <BarChart3 className="h-3.5 w-3.5" /> {t('lm.attribution.eyebrow')}
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white">{t('lm.attribution.title')}</h1>
        <div className="mt-8">
          <EmptyState
            Icon={PlugZap}
            title={t('lm.live.connect.title')}
            description={t('lm.live.connect.desc')}
            action={
              <Link
                href="/freehold-intelligence/integrations"
                className="inline-flex items-center gap-2 rounded-xl border border-gold/35 bg-gold/10 px-4 py-2.5 text-sm font-semibold text-gold transition hover:bg-gold/20"
              >
                {t('lm.live.connect.cta')} <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      {/* Header */}
      <section>
        <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-gold/85">
          <BarChart3 className="h-3.5 w-3.5" /> {t('lm.attribution.eyebrow')}
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white">
          {t('lm.attribution.title')}
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
        {stats.map((s) => (
          <div key={s.labelKey} className={`rounded-[18px] border bg-surface p-4 ${s.highlight ? 'border-emerald-400/20' : 'border-line'}`}>
            <div className={`text-[22px] font-semibold tabular-nums leading-none ${s.highlight ? 'text-emerald-400' : 'text-white'}`}>{s.value}</div>
            <div className="mt-1.5 text-xs text-slate-500">{t(s.labelKey)}</div>
            <div className="mt-1 text-xs text-slate-600">{'subKey' in s ? t(s.subKey as string) : s.sub}</div>
          </div>
        ))}
      </div>

      {/* Platform filter */}
      <div className="mt-8 flex items-center gap-2">
        {([
          { value: 'All' as PlatformFilter,    labelKey: 'lm.attribution.filter.all'    },
          { value: 'Meta' as PlatformFilter,   labelKey: 'lm.attribution.filter.meta'   },
          { value: 'Google' as PlatformFilter, labelKey: 'lm.attribution.filter.google' },
        ]).map(({ value, labelKey }) => (
          <button
            key={value}
            onClick={() => setPlatformFilter(value)}
            className={[
              'rounded-full border px-3 py-1 text-sm font-medium transition',
              platformFilter === value
                ? 'border-gold/40 bg-gold/10 text-gold'
                : 'border-line bg-surface-2 text-slate-500 hover:text-slate-300',
            ].join(' ')}
          >
            {t(labelKey)}
          </button>
        ))}
        <span className="ml-2 text-xs text-slate-600">{campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Campaign cards */}
      <div className="mt-6 space-y-5">
        {campaigns.map((campaign) => {
          const plat    = platformStyle(campaign.platform)
          const info    = cplInfo(campaign.cpl)
          const cplPct  = Math.min(100, (campaign.cpl / cplRange) * 100)
          const avgPct  = Math.min(100, (avg / cplRange) * 100)
          const Icon    = info.icon

          return (
            <article
              key={campaign.name}
              className="overflow-hidden rounded-[28px] border border-line bg-surface transition hover:border-gold/20"
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
                        className="text-gold/65 transition hover:text-gold"
                      >
                        {campaign.listing.projectName}
                      </Link>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500">{t('lm.attribution.multiProject')}</div>
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
                      {t('lm.attribution.noLanding')}
                      <Link
                        href="/freehold-intelligence/lead-machine/landings"
                        className="text-gold/50 transition hover:text-gold"
                      >
                        {t('lm.attribution.viewLandings')}
                      </Link>
                    </div>
                  )}
                </div>

                {/* Metrics row */}
                <div className="mt-5 grid grid-cols-3 gap-3">
                  {[
                    { labelKey: 'lm.attribution.col.spend', value: `AED ${campaign.spendAED.toLocaleString()}`, dim: false },
                    { labelKey: 'lm.attribution.col.leads', value: campaign.leads.toString(),                   dim: false },
                    { labelKey: 'lm.attribution.col.cpl',   value: `AED ${campaign.cpl.toFixed(0)}`,            dim: true  },
                  ].map((m) => (
                    <div key={m.labelKey} className="rounded-[14px] border border-line bg-surface-2 px-3 py-3">
                      <div className="text-xs font-medium uppercase tracking-[0.15em] text-slate-500">{t(m.labelKey)}</div>
                      <div className={`mt-1.5 text-[20px] font-semibold tabular-nums leading-none ${m.dim ? info.color : 'text-white'}`}>
                        {m.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* CPL bar vs. target */}
                <div className="mt-4">
                  <div className="mb-1.5 flex items-center justify-between text-xs text-slate-600">
                    <span>{t('lm.attribution.cplTarget', { avg: String(avg) })}</span>
                    <span className={info.color}>{campaign.cpl < avg ? `AED ${(avg - campaign.cpl).toFixed(0)} below` : `AED ${(campaign.cpl - avg).toFixed(0)} above`}</span>
                  </div>
                  <div className="relative h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="absolute top-0 h-full w-px bg-white/20"
                      style={{ left: `${avgPct}%` }}
                    />
                    <div
                      className={`h-full rounded-full transition-all ${
                        campaign.cpl < avg ? 'bg-emerald-500' :
                        campaign.cpl < avg * 1.1 ? 'bg-gold' : 'bg-red-500'
                      }`}
                      style={{ width: `${cplPct}%` }}
                    />
                  </div>
                </div>

                {/* CRM attribution */}
                <div className="mt-5 border-t border-line pt-5">
                  {campaign.crmLeads.length > 0 ? (
                    <>
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                          <Users className="h-3 w-3" />
                          {t('lm.attribution.crmAttribution')} — {campaign.crmLeads.length} lead{campaign.crmLeads.length !== 1 ? 's' : ''}
                        </div>
                        <Link
                          href="/freehold-intelligence/crm"
                          className="flex items-center gap-1 text-xs text-gold/50 transition hover:text-gold"
                        >
                          {t('lm.attribution.allLeads')} <ChevronRight className="h-3 w-3" />
                        </Link>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {campaign.crmLeads.map((lead) => (
                          <Link
                            key={lead.id}
                            href={`/freehold-intelligence/crm/leads/${lead.id}`}
                            className="group flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1 text-xs text-slate-300 transition hover:border-gold/30 hover:text-white"
                          >
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${urgencyDot(lead.urgency)}`} />
                            {lead.name}
                            <span className="text-slate-600">·</span>
                            <span className={`font-medium tabular-nums ${lead.intentScore >= 85 ? 'text-gold' : 'text-slate-500'}`}>
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
                          {campaign.leads} {t('lm.attribution.notMatched')}
                        </span>
                      </div>
                      <Link
                        href="/freehold-intelligence/crm"
                        className="text-xs text-gold/50 transition hover:text-gold"
                      >
                        {t('lm.attribution.openCrm')}
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </article>
          )
        })}
      </div>

    </div>
  )
}
