'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { TrendingUp, BarChart3, Target, Users, Zap } from 'lucide-react'
import { useLiveLeads } from '@/lib/freehold/use-live-leads'
import { PageHeader, StatCard, Section, Panel, PanelHeader, EmptyState } from '@/components/freehold/ui'
import { useT } from '@/lib/i18n/provider'
import { loadCrmView, saveCrmView } from '../_lib/view-prefs'

// SVG bar chart constants
const SVG_W = 400
const SVG_H = 80
const BAR_W = 48
const BAR_GAP = 32
const BAR_TOTAL = BAR_W + BAR_GAP

// Minimal slice of a deal from /api/freehold/deals (session-scoped).
type DealSlice = {
  status: string
  createdAt: string | null
  agencyCommissionAed: number
}

const isBooked = (d: DealSlice) => d.status === 'approved' || d.status === 'closed'

function fmtAedShort(n: number): string {
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `AED ${(n / 1_000).toFixed(0)}K`
  return `AED ${Math.round(n).toLocaleString()}`
}

const SOURCE_COLORS: Record<string, string> = {
  'Palm investor landing':    'bg-gold',
  'Market tracker':           'bg-teal-400',
  'WhatsApp':                 'bg-gold',
  'Dubai Hills landing':      'bg-violet-400',
  'Golden Visa inquiry form': 'bg-amber-400',
  'Secondary market mailer':  'bg-rose-400',
}

type DateRange = '7d' | '30d' | '90d' | 'MTD'
const DATE_RANGES: DateRange[] = ['7d', '30d', '90d', 'MTD']

function rangeStart(range: DateRange): number {
  if (range === 'MTD') {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  }
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90
  return Date.now() - days * 86_400_000
}
type IntentFilter = 'All' | 'High' | 'Medium' | 'Low'
const INTENT_FILTERS: IntentFilter[] = ['All', 'High', 'Medium', 'Low']
const INTENT_FILTER_KEY: Record<IntentFilter, string> = {
  All:    'crm.all',
  High:   'crm.intentHigh',
  Medium: 'crm.intentMedium',
  Low:    'crm.intentLow',
}

export default function CrmReportsPage() {
  const t = useT()
  const { leads } = useLiveLeads()
  const [dateRange, setDateRange] = useState<DateRange>('30d')
  const [intentFilter, setIntentFilter] = useState<IntentFilter>('All')
  const [agentFilter, setAgentFilter] = useState('All')

  // Restore + persist the account's saved date range.
  const viewHydrated = useRef(false)
  useEffect(() => {
    let cancelled = false
    loadCrmView().then((view) => {
      if (cancelled) return
      if (view.reportsRange && (DATE_RANGES as string[]).includes(view.reportsRange)) {
        setDateRange(view.reportsRange as DateRange)
      }
      viewHydrated.current = true
    })
    return () => { cancelled = true }
  }, [])
  useEffect(() => {
    if (!viewHydrated.current) return
    saveCrmView({ reportsRange: dateRange })
  }, [dateRange])

  // Real deals (approved/closed) power the revenue figures.
  const [deals, setDeals] = useState<DealSlice[]>([])
  useEffect(() => {
    let cancelled = false
    fetch('/api/freehold/deals', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && Array.isArray(d?.deals)) setDeals(d.deals as DealSlice[]) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // The date-range pills genuinely filter every range-scoped series below.
  const rangeFrom = useMemo(() => rangeStart(dateRange), [dateRange])
  const rangeLeads = useMemo(
    () => leads.filter((l) => {
      const d = new Date(l.lastContactAt).getTime()
      return !Number.isNaN(d) && d >= rangeFrom
    }),
    [leads, rangeFrom],
  )
  const rangeDeals = useMemo(
    () => deals.filter((d) => {
      if (!isBooked(d) || !d.createdAt) return false
      const at = new Date(d.createdAt).getTime()
      return !Number.isNaN(at) && at >= rangeFrom
    }),
    [deals, rangeFrom],
  )
  const rangeRevenue = rangeDeals.reduce((s, d) => s + (Number(d.agencyCommissionAed) || 0), 0)

  const ALL_AGENTS = useMemo(
    () => ['All', ...Array.from(new Set(leads.map((l) => l.assignedAgent)))],
    [leads],
  )

  // Compute live source breakdown from real lead data (range-scoped)
  const sourceMap = useMemo(() => rangeLeads.reduce<Record<string, number>>((acc, l) => {
    acc[l.source] = (acc[l.source] || 0) + 1
    return acc
  }, {}), [rangeLeads])

  const sources = useMemo(() => Object.entries(sourceMap)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count), [sourceMap])

  const maxSource = Math.max(...sources.map((s) => s.count), 1)

  // Real monthly lead activity (last 5 months) from live leads.
  const monthlyLeads = useMemo(() => {
    const now = new Date()
    const buckets: { key: string; month: string; leads: number }[] = []
    for (let i = 4; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, month: d.toLocaleString('en-US', { month: 'short' }), leads: 0 })
    }
    const idx = new Map(buckets.map((b, i) => [b.key, i]))
    for (const l of leads) {
      const d = new Date(l.lastContactAt)
      if (Number.isNaN(d.getTime())) continue
      const k = `${d.getFullYear()}-${d.getMonth()}`
      const i = idx.get(k)
      if (i != null) buckets[i].leads++
    }
    return buckets
  }, [leads])
  const maxMonthly = Math.max(...monthlyLeads.map((m) => m.leads), 1)

  // Live stats from real data — call counts come from the real activity log.
  const [activity, setActivity] = useState<Array<{ activity_type: string; created_at: string }>>([])
  useEffect(() => {
    let cancelled = false
    fetch('/api/freehold/crm/activity', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && Array.isArray(d?.activity)) setActivity(d.activity) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])
  const rangeActivity = useMemo(
    () => activity.filter((e) => {
      const at = new Date(e.created_at).getTime()
      return !Number.isNaN(at) && at >= rangeFrom
    }),
    [activity, rangeFrom],
  )
  const totalLeads   = rangeLeads.length
  const critical     = rangeLeads.filter((l) => l.urgency === 'critical').length
  const callsLogged  = rangeActivity.filter((e) => /call/i.test(e.activity_type)).length
  const connected    = rangeActivity.filter((e) => /connect/i.test(e.activity_type)).length
  const connectRate  = callsLogged > 0 ? Math.round((connected / callsLogged) * 100) : 0

  // Priority score distribution — filtered (range-scoped)
  const avgIntent = rangeLeads.length > 0 ? Math.round(rangeLeads.reduce((s, l) => s + l.intentScore, 0) / rangeLeads.length) : 0
  const highIntent = rangeLeads.filter((l) => l.intentScore >= 80).length

  // Monthly revenue (last 5 months) from real booked deals.
  const monthlyRevenue = useMemo(() => {
    const now = new Date()
    const buckets: { key: string; month: string; revenue: number; deals: number }[] = []
    for (let i = 4; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, month: d.toLocaleString('en-US', { month: 'short' }), revenue: 0, deals: 0 })
    }
    const idx = new Map(buckets.map((b, i) => [b.key, i]))
    for (const deal of deals) {
      if (!isBooked(deal) || !deal.createdAt) continue
      const d = new Date(deal.createdAt)
      if (Number.isNaN(d.getTime())) continue
      const i = idx.get(`${d.getFullYear()}-${d.getMonth()}`)
      if (i == null) continue
      buckets[i].revenue += Number(deal.agencyCommissionAed) || 0
      buckets[i].deals++
    }
    return buckets
  }, [deals])
  const maxRevenue = Math.max(...monthlyRevenue.map((m) => m.revenue), 1)
  const hasRevenue = monthlyRevenue.some((m) => m.deals > 0)

  const filteredLeads = useMemo(() => {
    return rangeLeads.filter((l) => {
      if (agentFilter !== 'All' && l.assignedAgent !== agentFilter) return false
      if (intentFilter === 'High' && l.intentScore < 80) return false
      if (intentFilter === 'Medium' && (l.intentScore < 60 || l.intentScore >= 80)) return false
      if (intentFilter === 'Low' && l.intentScore >= 60) return false
      return true
    })
  }, [rangeLeads, agentFilter, intentFilter])

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:pt-6">
      <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-10 xl:grid-cols-[1fr_380px] xl:gap-14">
        <div className="min-w-0">
          <PageHeader
            eyebrow={t('crm.reportsEyebrow')}
            Icon={TrendingUp}
            title={t('crm.leadIntelligence')}
            subtitle={t('crm.reportsSubtitle')}
            actions={
              <div className="flex items-center gap-2">
                {DATE_RANGES.map((r) => (
                  <button
                    key={r}
                    onClick={() => setDateRange(r)}
                    className={[
                      'rounded-full px-3.5 py-1.5 text-xs font-medium transition',
                      dateRange === r
                        ? 'bg-gold text-ink'
                        : 'border border-line-strong text-slate-400 hover:border-slate-500 hover:text-slate-200',
                    ].join(' ')}
                  >
                    {r}
                  </button>
                ))}
              </div>
            }
          />

          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label={t('crm.statActiveLeads')}  value={totalLeads}        delta={{ value: t('crm.statCriticalCount', { count: critical }), direction: critical > 0 ? 'down' : 'flat' }} />
            <StatCard label={t('crm.statHighIntent')}   value={highIntent}        hint={t('crm.statAvgScore', { count: avgIntent })} delta={{ value: t('crm.statHighIntentLabel'), direction: 'up' }} />
            <StatCard label={t('crm.statConnectRate')}  value={`${connectRate}%`} hint={t('crm.statCalls', { connected, total: callsLogged })} delta={{ value: connectRate >= 50 ? t('crm.statGood') : t('crm.statLow'), direction: connectRate >= 50 ? 'up' : 'down' }} />
            <StatCard label={t('crm.statRevenue', { range: dateRange })} value={fmtAedShort(rangeRevenue)} hint={t('crm.statFromDeals', { count: rangeDeals.length })} />
          </div>

          <Section
            className="mt-10"
            title={t('crm.monthlyLeadActivity')}
            action={<span className="rounded-full border border-gold/20 bg-gold/[0.06] px-2 py-0.5 text-xs text-gold">{t('crm.liveLast5Months')}</span>}
          >
            <Panel className="p-6 sm:p-8">
              <div className="overflow-x-auto">
                <svg
                  width={SVG_W}
                  height={SVG_H + 28}
                  viewBox={`0 0 ${SVG_W} ${SVG_H + 28}`}
                  className="min-w-[360px]"
                >
                  {monthlyLeads.map((m, i) => {
                    const barH = Math.round((m.leads / maxMonthly) * SVG_H)
                    const x = i * BAR_TOTAL
                    const y = SVG_H - barH
                    const current = i === monthlyLeads.length - 1
                    return (
                      <g key={m.key}>
                        <rect x={x} y={y} width={BAR_W} height={barH} rx={6} fill={current ? '#D4AF37' : 'rgba(148,163,184,0.15)'} />
                        <text x={x + BAR_W / 2} y={SVG_H + 18} textAnchor="middle" fontSize={10} fill="rgba(148,163,184,0.60)" fontFamily="inherit">{m.month}</text>
                        {m.leads > 0 && (
                          <text x={x + BAR_W / 2} y={y - 6} textAnchor="middle" fontSize={9} fill={current ? '#D4AF37' : 'rgba(148,163,184,0.6)'} fontFamily="inherit">{m.leads}</text>
                        )}
                      </g>
                    )
                  })}
                </svg>
              </div>
            </Panel>
          </Section>

          <Section
            className="mt-10"
            title={t('crm.leadSources')}
            action={<span className="rounded-full border border-gold/20 bg-gold/[0.06] px-2 py-0.5 text-xs text-gold">{t('crm.live')}</span>}
          >
            <Panel className="p-6 sm:p-8">
              <div className="space-y-5">
                {sources.map((src) => (
                  <div key={src.source}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-300">{src.source}</span>
                      <span className="text-slate-400">{src.count !== 1 ? t('crm.countLeads', { count: src.count }) : t('crm.countLead', { count: src.count })}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className={`h-full rounded-full ${SOURCE_COLORS[src.source] ?? 'bg-slate-500'}`}
                        style={{ width: `${(src.count / maxSource) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </Section>

          <Section
            className="mt-10"
            title={t('crm.intentDistribution')}
            action={
              <div className="flex flex-wrap items-center gap-2">
                {INTENT_FILTERS.map((f) => (
                  <button
                    key={f}
                    onClick={() => setIntentFilter(f)}
                    className={[
                      'rounded-full px-3 py-1 text-xs font-medium transition',
                      intentFilter === f
                        ? 'bg-gold text-ink'
                        : 'border border-line-strong text-slate-400 hover:text-slate-200',
                    ].join(' ')}
                  >
                    {t(INTENT_FILTER_KEY[f])}
                  </button>
                ))}
                <select
                  value={agentFilter}
                  onChange={(e) => setAgentFilter(e.target.value)}
                  className="rounded-full border border-line-strong bg-transparent px-3 py-1 text-xs text-slate-400 outline-none transition hover:border-slate-500 hover:text-slate-200"
                >
                  {ALL_AGENTS.map((a) => <option key={a} value={a} className="bg-surface">{a === 'All' ? t('crm.allAgents') : a}</option>)}
                </select>
              </div>
            }
          >
            <Panel className="p-6 sm:p-8">
              {filteredLeads.length === 0 ? (
                <EmptyState Icon={Target} title={t('crm.noLeadsMatchFilters')} />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {filteredLeads.map((lead) => (
                    <div key={lead.id} className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-300">{lead.name}</div>
                        <div className="text-sm text-slate-500">{lead.stage} · {lead.assignedAgent}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-2">
                          <div
                            className={`h-full rounded-full ${lead.intentScore >= 70 ? 'bg-gold' : 'bg-orange-400'}`}
                            style={{ width: `${lead.intentScore}%` }}
                          />
                        </div>
                        <span className="w-6 text-right text-xs font-semibold text-slate-300">{lead.intentScore}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </Section>

          <Section
            className="mt-10"
            title={t('crm.monthlyRevenue')}
            action={<span className="rounded-full border border-gold/20 bg-gold/[0.06] px-2 py-0.5 text-xs text-gold">{t('crm.liveLast5Months')}</span>}
          >
            <Panel className="p-6 sm:p-8">
              {!hasRevenue ? (
                <EmptyState Icon={Zap} title={t('crm.noRevenueYet')} />
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 sm:gap-5">
                  {monthlyRevenue.map((m) => (
                    <div key={m.key} className="flex flex-col items-center gap-3">
                      <div className="flex h-32 w-full items-end overflow-hidden rounded-lg bg-surface-2">
                        <div
                          className="w-full rounded-lg bg-gradient-to-t from-gold/70 to-gold/30"
                          style={{ height: `${(m.revenue / maxRevenue) * 100}%` }}
                        />
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-semibold text-white">{fmtAedShort(m.revenue)}</div>
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                          {m.month} · {m.deals !== 1 ? t('crm.countDeals', { count: m.deals }) : t('crm.countDeal', { count: m.deals })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </Section>

        </div>

        {/* Sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-[112px] space-y-5">
            <div className="rounded-xl border border-gold/20 bg-gradient-to-br from-gold/[0.06] to-transparent p-5">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-gold">{t('crm.topChannel')}</div>
              <div className="mt-3 text-[16px] font-semibold text-white">{sources[0]?.source ?? '—'}</div>
              <div className="mt-1 text-xs text-slate-400">{t('crm.leadsHighestVolume', { count: sources[0]?.count ?? 0 })}</div>
            </div>

            <Panel className="p-5">
              <PanelHeader title={t('crm.cohortWatch')} icon={<Users className="h-3.5 w-3.5" />} />
              <div className="mt-3 text-[14px] font-semibold text-white">{t('crm.goldenVisaBuyers')}</div>
              <div className="mt-2 text-xs leading-relaxed text-slate-400">
                {t('crm.cohortDesc')}
              </div>
            </Panel>

            <Panel className="p-5">
              <PanelHeader title={t('crm.activityThisWeek')} />
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                <div className="flex justify-between">
                  <span>{t('crm.callsLogged')}</span>
                  <span className="font-semibold text-white">{callsLogged}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('crm.outcome.connected')}</span>
                  <span className="font-semibold text-gold">{connected}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('crm.connectRate')}</span>
                  <span className={`font-semibold ${connectRate >= 50 ? 'text-gold' : 'text-orange-300'}`}>{connectRate}%</span>
                </div>
              </div>
            </Panel>

            <Panel className="p-5">
              <PanelHeader title={t('crm.nextReport')} />
              <div className="mt-3 text-[14px] text-slate-300">{t('crm.nextReportSchedule')}</div>
              <div className="mt-1 text-xs text-slate-400">{t('crm.nextReportTo')}</div>
            </Panel>
          </div>
        </aside>
      </div>
    </div>
  )
}
