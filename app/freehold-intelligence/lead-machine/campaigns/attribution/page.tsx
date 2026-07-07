'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import {
  BarChart3, Users, AlertCircle, ChevronRight,
  TrendingDown, TrendingUp, PlugZap, ArrowUpRight,
} from 'lucide-react'
import { useLiveLeads } from '@/lib/freehold/use-live-leads'
import { EmptyState } from '@/components/freehold/ui'
import { useT } from '@/lib/i18n/provider'

// Attribution — REAL campaigns from the connected ad accounts, matched to the
// REAL CRM leads they produced. No seed campaigns, no invented CPLs.

type PlatformFilter = 'All' | 'Meta' | 'Google'

interface LiveCampaign {
  id: string
  name: string
  platform: 'meta' | 'google'
  running: boolean
  spendAED: number
  leads: number
  cpl: number
}

function urgencyDot(u: string) {
  if (u === 'critical') return 'bg-red-400'
  if (u === 'high')     return 'bg-gold'
  if (u === 'medium')   return 'bg-teal-400'
  return 'bg-white/30'
}

function platformStyle(p: string) {
  return p === 'meta'
    ? { label: 'Meta',   cls: 'border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-300' }
    : { label: 'Google', cls: 'border-gold/25 bg-gold/10 text-gold' }
}

const metaLeads = (insights?: { actions?: Array<{ action_type: string; value: string }> } | null) =>
  (insights?.actions ?? []).filter((a) => a.action_type.includes('lead')).reduce((s, a) => s + (Number(a.value) || 0), 0)

export default function CampaignAttributionPage() {
  const t = useT()
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('All')
  const { leads: liveLeads } = useLiveLeads()

  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const [allCampaigns, setAllCampaigns] = useState<LiveCampaign[]>([])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/api/meta/campaigns', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/google/campaigns', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([meta, google]) => {
      if (cancelled) return
      const rows: LiveCampaign[] = []
      if (meta && !meta.demo) {
        for (const c of meta.campaigns ?? []) {
          const spend = Number(c?.insights?.spend) || 0
          const leads = metaLeads(c?.insights)
          rows.push({ id: c.id, name: c.name, platform: 'meta', running: c.status === 'ACTIVE', spendAED: spend, leads, cpl: leads > 0 ? spend / leads : 0 })
        }
      }
      if (google && !google.demo) {
        for (const c of google.campaigns ?? []) {
          const spend = Number(c?.metrics?.costAed ?? c?.metrics?.cost) || 0
          const leads = Number(c?.metrics?.conversions ?? c?.metrics?.leads) || 0
          rows.push({ id: c.id, name: c.name, platform: 'google', running: /enabled|active|running/i.test(String(c.status ?? '')), spendAED: spend, leads, cpl: leads > 0 ? spend / leads : 0 })
        }
      }
      setConnected(Boolean((meta && !meta.demo) || (google && !google.demo)))
      setAllCampaigns(rows.sort((a, b) => b.spendAED - a.spendAED))
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  const totalSpend = allCampaigns.reduce((s, c) => s + c.spendAED, 0)
  const totalLeads = allCampaigns.reduce((s, c) => s + c.leads, 0)
  const avg = totalLeads > 0 ? totalSpend / totalLeads : 0
  const cplValues = allCampaigns.filter((c) => c.cpl > 0).map((c) => c.cpl)
  const bestCpl = cplValues.length ? Math.min(...cplValues) : 0
  const worstCpl = cplValues.length ? Math.max(...cplValues) : 0
  const cplRange = Math.max(worstCpl, avg, 1) + 5

  const campaigns = useMemo(() => {
    return allCampaigns
      .filter((c) => {
        if (platformFilter === 'Meta')   return c.platform === 'meta'
        if (platformFilter === 'Google') return c.platform === 'google'
        return true
      })
      .map((c) => ({ ...c, crmLeads: liveLeads.filter((l) => l.campaignId === c.id) }))
  }, [allCampaigns, platformFilter, liveLeads])

  function cplInfo(cpl: number) {
    if (cpl <= 0 || avg <= 0) return { color: 'text-slate-400', icon: TrendingDown, label: cpl > 0 ? `AED ${cpl.toFixed(0)}` : '—' }
    const r = cpl / avg
    if (r <= 0.90) return { color: 'text-emerald-400', icon: TrendingDown, label: `AED ${cpl.toFixed(0)} — ${t('lm.attribution.belowTarget')}` }
    if (r <= 1.05) return { color: 'text-gold',        icon: TrendingDown, label: `AED ${cpl.toFixed(0)} — ${t('lm.attribution.onTarget')}` }
    return               { color: 'text-red-400',      icon: TrendingUp,  label: `AED ${cpl.toFixed(0)} — ${t('lm.attribution.aboveTarget')}` }
  }

  const stats = [
    { labelKey: 'lm.attribution.stat.activeCampaigns', value: String(allCampaigns.length), subKey: 'lm.attribution.stat.activeCampaignsSub', highlight: false },
    { labelKey: 'lm.attribution.stat.totalLeads',      value: totalLeads.toLocaleString(),  subKey: 'lm.attribution.stat.last30Days',        highlight: false },
    { labelKey: 'lm.attribution.stat.bestCpl',         value: bestCpl > 0 ? `AED ${bestCpl.toFixed(0)}` : '—', subKey: 'lm.attribution.stat.lowestThisMonth', highlight: bestCpl > 0 },
    { labelKey: 'lm.attribution.stat.avgCpl',          value: avg > 0 ? `AED ${avg.toFixed(0)}` : '—',        subKey: 'lm.attribution.stat.last30Days',       highlight: false },
  ]

  // No connected ad accounts → honest connect state (never sample campaigns).
  if (!loading && !connected) {
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
      </section>

      {/* Stats */}
      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.labelKey} className={`rounded-[18px] border bg-surface p-4 ${s.highlight ? 'border-emerald-400/20' : 'border-line'}`}>
            <div className={`text-[22px] font-semibold tabular-nums leading-none ${s.highlight ? 'text-emerald-400' : 'text-white'}`}>{s.value}</div>
            <div className="mt-1.5 text-xs text-slate-500">{t(s.labelKey)}</div>
            <div className="mt-1 text-xs text-slate-600">{t(s.subKey)}</div>
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

      {/* Campaign cards — live campaigns matched to the CRM leads they produced */}
      {campaigns.length === 0 && !loading ? (
        <div className="mt-6 rounded-2xl border border-line bg-surface px-6 py-10 text-center">
          <p className="text-sm text-slate-400">{t('lm.live.empty.campaigns')}</p>
          <Link href="/freehold-intelligence/lead-machine/campaigns/new" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-gold hover:opacity-80">
            {t('lm.live.empty.cta')} <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
      <div className="mt-6 space-y-5">
        {campaigns.map((campaign) => {
          const plat    = platformStyle(campaign.platform)
          const info    = cplInfo(campaign.cpl)
          const cplPct  = Math.min(100, (campaign.cpl / cplRange) * 100)
          const avgPct  = Math.min(100, (avg / cplRange) * 100)
          const Icon    = info.icon

          return (
            <article
              key={campaign.id}
              className="overflow-hidden rounded-[28px] border border-line bg-surface transition hover:border-gold/20"
            >
              <div className="p-6 sm:p-7">

                {/* Top row */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${plat.cls}`}>
                      {plat.label}
                    </span>
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${campaign.running ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-400' : 'border-white/15 bg-surface-2 text-slate-500'}`}>
                      {campaign.running && (
                        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                      )}
                      {campaign.running ? t('lm.meta.status.active') : t('lm.meta.status.paused')}
                    </span>
                  </div>
                  <div className={`flex items-center gap-1 text-sm font-medium ${info.color}`}>
                    <Icon className="h-3.5 w-3.5" />
                    {info.label}
                  </div>
                </div>

                <h3 className="mt-3 text-[17px] font-semibold leading-snug text-white">{campaign.name}</h3>

                {/* Metrics row */}
                <div className="mt-5 grid grid-cols-3 gap-3">
                  {[
                    { labelKey: 'lm.attribution.col.spend', value: campaign.spendAED > 0 ? `AED ${campaign.spendAED.toLocaleString()}` : '—', dim: false },
                    { labelKey: 'lm.attribution.col.leads', value: campaign.leads.toString(),                                                  dim: false },
                    { labelKey: 'lm.attribution.col.cpl',   value: campaign.cpl > 0 ? `AED ${campaign.cpl.toFixed(0)}` : '—',                 dim: true  },
                  ].map((m) => (
                    <div key={m.labelKey} className="rounded-[14px] border border-line bg-surface-2 px-3 py-3">
                      <div className="text-xs font-medium uppercase tracking-[0.15em] text-slate-500">{t(m.labelKey)}</div>
                      <div className={`mt-1.5 text-[20px] font-semibold tabular-nums leading-none ${m.dim ? info.color : 'text-white'}`}>
                        {m.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* CPL bar vs. blended average */}
                {campaign.cpl > 0 && avg > 0 && (
                  <div className="mt-4">
                    <div className="mb-1.5 flex items-center justify-between text-xs text-slate-600">
                      <span>{t('lm.attribution.cplTarget', { avg: avg.toFixed(0) })}</span>
                      <span className={info.color}>{campaign.cpl < avg ? `AED ${(avg - campaign.cpl).toFixed(0)} below` : `AED ${(campaign.cpl - avg).toFixed(0)} above`}</span>
                    </div>
                    <div className="relative h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div className="absolute top-0 h-full w-px bg-white/20" style={{ left: `${avgPct}%` }} />
                      <div
                        className={`h-full rounded-full transition-all ${
                          campaign.cpl < avg ? 'bg-emerald-500' :
                          campaign.cpl < avg * 1.1 ? 'bg-gold' : 'bg-red-500'
                        }`}
                        style={{ width: `${cplPct}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* CRM attribution — the actual leads this campaign captured */}
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
      )}

    </div>
  )
}
