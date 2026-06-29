'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Radio, TrendingDown, TrendingUp, PlugZap } from 'lucide-react'
import { PageHeader, StatCard, Section, EmptyState } from '@/components/freehold/ui'
import { useT } from '@/lib/i18n/provider'

type Platform = 'All' | 'Meta' | 'Google'

// Normalized campaign shape across Meta + Google, derived from the live APIs.
interface LiveCampaign {
  name: string
  platform: 'meta' | 'google'
  status: string
  spendAED: number
  leads: number
  cpl: number | null
}

function fmtAed(n: number): string {
  return `AED ${Math.round(n).toLocaleString()}`
}

// Sum Meta lead actions from an insights object.
function metaLeads(insights: unknown): number {
  const actions = (insights as { actions?: { action_type: string; value: string }[] } | null)?.actions
  if (!Array.isArray(actions)) return 0
  return actions
    .filter((a) => /lead/i.test(a.action_type))
    .reduce((s, a) => s + (Number(a.value) || 0), 0)
}

function UtilBar({ pct }: { pct: number }) {
  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
      <div className="h-full rounded-full bg-gold" style={{ width: `${Math.min(100, pct).toFixed(1)}%` }} />
    </div>
  )
}

export default function AdsLivePage() {
  const t = useT()
  const [platform, setPlatform] = useState<Platform>('All')
  const [loading, setLoading] = useState(true)
  // Connection state: a platform is "connected" only when its API does NOT
  // return the demo flag (i.e. real credentials are configured).
  const [metaConnected, setMetaConnected] = useState(false)
  const [googleConnected, setGoogleConnected] = useState(false)
  const [campaigns, setCampaigns] = useState<LiveCampaign[]>([])
  const [now, setNow] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const list: LiveCampaign[] = []
      let metaOk = false
      let googleOk = false

      // Meta
      try {
        const r = await fetch('/api/meta/campaigns', { cache: 'no-store' })
        const d = r.ok ? await r.json() : null
        if (d && !d.demo) {
          metaOk = true
          for (const c of (d.campaigns ?? [])) {
            const spend = Number(c?.insights?.spend) || 0
            const leads = metaLeads(c?.insights)
            list.push({
              name: c.name, platform: 'meta', status: c.status ?? 'PAUSED',
              spendAED: spend, leads, cpl: leads > 0 ? spend / leads : null,
            })
          }
        }
      } catch { /* leave metaOk false */ }

      // Google
      try {
        const r = await fetch('/api/google/campaigns', { cache: 'no-store' })
        const d = r.ok ? await r.json() : null
        if (d && !d.demo) {
          googleOk = true
          for (const c of (d.campaigns ?? [])) {
            const spend = Number(c?.metrics?.costAed ?? c?.metrics?.cost) || 0
            const leads = Number(c?.metrics?.conversions ?? c?.metrics?.leads) || 0
            list.push({
              name: c.name, platform: 'google', status: c.status ?? 'PAUSED',
              spendAED: spend, leads, cpl: leads > 0 ? spend / leads : null,
            })
          }
        }
      } catch { /* leave googleOk false */ }

      if (cancelled) return
      setMetaConnected(metaOk)
      setGoogleConnected(googleOk)
      setCampaigns(list)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const fmt = () => new Date().toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' })
    setNow(fmt())
    const id = setInterval(() => setNow(fmt()), 60_000)
    return () => clearInterval(id)
  }, [])

  const connected = metaConnected || googleConnected

  const tabs: Platform[] = ['All', 'Meta', 'Google']
  const tabLabel: Record<Platform, string> = {
    All: t('lm.live.tab.all'), Meta: t('lm.live.tab.meta'), Google: t('lm.live.tab.google'),
  }

  const shown = campaigns.filter((c) => {
    if (platform === 'All') return true
    if (platform === 'Meta') return c.platform === 'meta'
    return c.platform === 'google'
  })

  // Real aggregates from live campaigns.
  const totalSpend = campaigns.reduce((s, c) => s + c.spendAED, 0)
  const totalLeads = campaigns.reduce((s, c) => s + c.leads, 0)
  const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : null
  const activeCount = campaigns.filter((c) => c.status === 'ACTIVE' || c.status === 'Running').length

  const header = (
    <PageHeader
      eyebrow={t('lm.live.eyebrow')}
      Icon={Radio}
      title={t('lm.live.title')}
      subtitle={t('lm.live.subtitle')}
      actions={connected ? (
        <span className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
          </span>
          {t('lm.live.status', { time: now })}
        </span>
      ) : undefined}
    />
  )

  // Not connected → honest connect state, no fabricated numbers.
  if (!loading && !connected) {
    return (
      <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
        {header}
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
      {header}

      {loading ? (
        <div className="mt-10 flex items-center justify-center gap-3 text-sm text-slate-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/10 border-t-gold" />
          {t('lm.live.loading')}
        </div>
      ) : (
        <>
          {/* Platform toggle */}
          <div className="mt-6 flex gap-1 rounded-xl border border-line bg-surface-2 p-1 w-fit">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setPlatform(tab)}
                className={`rounded-lg px-5 py-2 text-sm font-semibold transition ${
                  platform === tab ? 'bg-gold text-ink' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tabLabel[tab]}
              </button>
            ))}
          </div>

          {/* Real aggregates */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label={t('lm.live.stat.totalSpend')} value={totalSpend > 0 ? fmtAed(totalSpend) : '—'} hint={t('lm.live.stat.totalSpend.hint')} />
            <StatCard label={t('lm.live.stat.totalLeads')} value={totalLeads} hint={t('lm.live.stat.totalLeads.hint')} />
            <StatCard label={t('lm.live.stat.avgCpl')} value={avgCpl !== null ? fmtAed(avgCpl) : '—'} hint={t('lm.live.stat.avgCpl.hint')} />
            <StatCard label={t('lm.live.stat.activeCampaigns')} value={activeCount} hint={t('lm.live.stat.activeCampaigns.hint')} />
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
              {shown.length === 0 ? (
                <EmptyState
                  Icon={Radio}
                  title={t('lm.live.empty.campaigns')}
                  description=""
                  className="rounded-none border-none"
                  action={
                    <Link href="/freehold-intelligence/lead-machine/campaigns/launch" className="text-sm font-medium text-gold/80 hover:text-gold">
                      {t('lm.live.empty.cta')} →
                    </Link>
                  }
                />
              ) : (
                <div className="divide-y divide-line">
                  {shown.map((c) => {
                    const isMeta  = c.platform === 'meta'
                    const platClr = isMeta ? '#1877F2' : '#4285F4'
                    const platLbl = isMeta ? 'Meta' : 'Google'
                    const below   = c.cpl !== null && avgCpl !== null && c.cpl < avgCpl
                    const CplIcon = below ? TrendingDown : TrendingUp
                    const running = c.status === 'ACTIVE' || c.status === 'Running'
                    return (
                      <Link
                        key={`${c.platform}-${c.name}`}
                        href="/freehold-intelligence/lead-machine/campaigns/attribution"
                        className="group flex flex-wrap items-center gap-x-6 gap-y-2 px-6 py-4 transition hover:bg-surface-2"
                      >
                        <span className="relative flex h-1.5 w-1.5 shrink-0">
                          {running && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-50" />}
                          <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${running ? 'bg-gold' : 'bg-surface-3'}`} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-slate-100 group-hover:text-white transition-colors">{c.name}</div>
                        </div>
                        <span
                          className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                          style={{ backgroundColor: `${platClr}18`, color: platClr, border: `1px solid ${platClr}30` }}
                        >
                          {platLbl}
                        </span>
                        <div className="flex gap-5 text-xs text-slate-400">
                          <span>{c.spendAED > 0 ? fmtAed(c.spendAED) : '—'}</span>
                          <span className="font-semibold text-gold">{t('lm.live.leadsCount', { count: String(c.leads) })}</span>
                          <span className={`flex items-center gap-0.5 font-medium ${below ? 'text-emerald-400' : 'text-slate-400'}`}>
                            {c.cpl !== null && <CplIcon className="h-3 w-3" />}
                            {c.cpl !== null ? fmtAed(c.cpl) : '—'}
                          </span>
                        </div>
                        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-500 opacity-0 group-hover:opacity-100 transition" />
                      </Link>
                    )
                  })}
                </div>
              )}
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

          {/* Platform deep links */}
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
        </>
      )}
    </div>
  )
}
