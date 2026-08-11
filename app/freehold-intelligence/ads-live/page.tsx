'use client'

import { useState, useEffect, useCallback } from 'react'
import { metaLeadCount } from '@/lib/meta/lead-count'
import Link from 'next/link'
import { ArrowUpRight, Radio, PlugZap } from 'lucide-react'
import { PageHeader, StatCard, Section, EmptyState } from '@/components/freehold/ui'
import { useT } from '@/lib/i18n/provider'
import LiveRow, { type LiveRowData } from '@/components/freehold/live-row'
import { signalsFor, dataFreshness } from '@/lib/freehold/live-signals'

type Platform = 'All' | 'Meta' | 'Google'

/** Today, in Dubai, as yyyy-mm-dd — the day the freshness rule reads against.
 *  The account is in GST and Meta reports in the ad account's timezone, so a
 *  browser in another zone must not make yesterday's data look like today's. */
const todayGst = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(new Date())

function fmtAed(n: number): string {
  return `AED ${Math.round(n).toLocaleString()}`
}

// Sum Meta lead actions from an insights object.
function metaLeads(insights: unknown): number {
  const actions = (insights as { actions?: { action_type: string; value: string }[] } | null)?.actions
  return metaLeadCount(Array.isArray(actions) ? actions : null)
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
  const [campaigns, setCampaigns] = useState<LiveRowData[]>([])

  const load = useCallback(async () => {
    const list: LiveRowData[] = []
    let metaOk = false
    let googleOk = false
    const today = todayGst()

    // Meta
    try {
      const r = await fetch('/api/meta/campaigns', { cache: 'no-store' })
      const d = r.ok ? await r.json() : null
      if (d && !d.demo) {
        metaOk = true
        for (const c of (d.campaigns ?? [])) {
          const ins = c?.insights ?? null
          const spend = Number(ins?.spend) || 0
          const leads = metaLeads(ins)
          const impressions = Number(ins?.impressions) || 0
          const started = Date.parse(String(c?.created_time ?? '')) || Date.now()
          list.push({
            id: String(c.id ?? ''), name: c.name, platform: 'meta',
            cpl: leads > 0 ? spend / leads : null,
            facts: {
              status: String(c.status ?? 'PAUSED'),
              // META'S OWN VERDICT, not the status we asked for. issues_info is
              // where a delivery error or a policy hold actually lives.
              deliveryBlocked: Array.isArray(c?.issues_info) && c.issues_info.length > 0,
              spendAed: spend,
              leads,
              // The cheap list read does not count these. NULL, never zero —
              // a screen that cannot tell "none" from "not asked" invents
              // faults on every row.
              ratedLeads: null,
              liveAds: null,
              impressions,
              clicks: Number(ins?.clicks) || 0,
              frequency: ins?.frequency != null ? Number(ins.frequency) : null,
              days: Math.max(1, Math.round((Date.now() - started) / 86_400_000)),
              // The edge of the DATA — what makes "live" a claim about the
              // numbers rather than about the browser clock.
              dataThrough: ins?.date_stop ?? null,
              today,
            },
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
            id: String(c.id ?? ''), name: c.name, platform: 'google',
            cpl: leads > 0 ? spend / leads : null,
            facts: {
              status: /enabled|active|running/i.test(String(c.status ?? '')) ? 'ACTIVE' : 'PAUSED',
              spendAed: spend, leads, ratedLeads: null, liveAds: null,
              impressions: Number(c?.metrics?.impressions) || 0,
              clicks: Number(c?.metrics?.clicks) || 0,
              frequency: null,
              days: 30,
              dataThrough: null,
              today,
            },
          })
        }
      }
    } catch { /* leave googleOk false */ }

    setMetaConnected(metaOk)
    setGoogleConnected(googleOk)
    setCampaigns(list)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  // A LIVE SCREEN REFRESHES ITSELF. Not because the numbers move every minute
  // — Meta's reporting lags hours — but because a page left open on a second
  // monitor must not still be showing this morning at four o'clock.
  useEffect(() => {
    const id = setInterval(() => { void load() }, 120_000)
    return () => clearInterval(id)
  }, [load])

  const connected = metaConnected || googleConnected

  const tabs: Platform[] = ['All', 'Meta', 'Google']
  const tabLabel: Record<Platform, string> = {
    All: t('lm.live.tab.all'), Meta: t('lm.live.tab.meta'), Google: t('lm.live.tab.google'),
  }

  // Whatever is asking for a person, first — then by spend. A list ordered by
  // money alone buries the blocked campaign under the big quiet one.
  const shown = campaigns
    .filter((c) => {
      if (platform === 'All') return true
      if (platform === 'Meta') return c.platform === 'meta'
      return c.platform === 'google'
    })
    .sort((a, b) => {
      const rank = (x: LiveRowData) => {
        const s = signalsFor(x.facts)
        return s.some((y) => y.tone === 'bad') ? 0 : s.some((y) => y.action !== 'none') ? 1 : 2
      }
      const d = rank(a) - rank(b)
      return d !== 0 ? d : b.facts.spendAed - a.facts.spendAed
    })

  // Real aggregates. LIFETIME, not a rolling window — /api/meta/campaigns
  // returns what each campaign ever did, so a switched-off campaign's leads
  // keep counting. A report must never go down.
  const totalSpend = campaigns.reduce((s, c) => s + c.facts.spendAed, 0)
  const totalLeads = campaigns.reduce((s, c) => s + c.facts.leads, 0)
  const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : null
  const activeCount = campaigns.filter((c) => c.facts.status === 'ACTIVE').length
  // THE FOURTH CARD IS THE POINT OF THE SCREEN: how many campaigns are asking
  // for a person right now. "Active campaigns" was a number nobody acts on.
  const needsYou = campaigns.filter((c) => signalsFor(c.facts).some((s) => s.action !== 'none')).length
  const fresh = dataFreshness(campaigns.map((c) => ({ dataThrough: c.facts.dataThrough })), todayGst())

  const header = (
    <PageHeader
      eyebrow={t('lm.live.eyebrow')}
      Icon={Radio}
      title={t('lm.live.title')}
      subtitle={t('lm.live.subtitle')}
      /* THE BADGE IS ABOUT THE DATA, NOT THE CLOCK.
         It used to print the browser's time, which ticks every minute whether
         or not a single number behind it has moved — so a campaign two days
         stale read as live to the second. This is the freshest date_stop
         across the rows on screen, and it says "nothing to report" rather
         than filling the space with a time. */
      actions={connected ? (
        <span className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="relative flex h-2 w-2">
            {(fresh?.daysBehind ?? 0) === 0 && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            )}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${
              !fresh ? 'bg-slate-600' : fresh.daysBehind === 0 ? 'bg-emerald-400'
                : fresh.daysBehind === 1 ? 'bg-amber-400' : 'bg-rose-400'}`} />
          </span>
          {!fresh ? t('lm.live.fresh.none')
            : fresh.daysBehind === 0 ? t('lm.live.fresh.today')
            : t('lm.live.fresh.behind', { days: fresh.daysBehind })}
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
            <StatCard label={t('lm.live.stat.needsYou')} value={needsYou}
              hint={needsYou > 0 ? t('lm.live.stat.needsYou.hint') : t('lm.live.stat.needsYou.clear', { n: activeCount })} />
          </div>

          {/* Live campaigns */}
          <Section
            className="mt-10"
            title={t('lm.live.section.campaigns')}
            action={
              <span className="flex items-center gap-1.5 text-xs text-emerald-300/80">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
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
                <div>
                  {shown.map((c) => (
                    <LiveRow key={`${c.platform}-${c.id || c.name}`} row={c} onChanged={() => void load()} />
                  ))}
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
          </div>
        </>
      )}
    </div>
  )
}
