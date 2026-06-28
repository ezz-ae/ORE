'use client'

import { useState, useMemo } from 'react'
import { TrendingUp, BarChart3, Target, Users, Zap } from 'lucide-react'
import { crmActivityLog } from '@/src/features/freehold-intelligence/server-session'
import { useLiveLeads } from '@/lib/freehold/use-live-leads'
import { PageHeader, StatCard, Section, Panel, PanelHeader, EmptyState } from '@/components/freehold/ui'

// Static lead-source data (30-day window)
const LEAD_SOURCES = [
  { label: 'Meta Ads',        count: 248, bar: 'bg-gold' },
  { label: 'Google Ads',      count: 167, bar: 'bg-blue-400'    },
  { label: 'WhatsApp',        count:  65, bar: 'bg-green-400'   },
  { label: 'Direct/Organic',  count:  41, bar: 'bg-violet-400'  },
  { label: 'Referral',        count:  28, bar: 'bg-amber-400'   },
]
const MAX_LEAD_SOURCE = 248

// Static monthly lead totals
const MONTHLY_LEADS = [
  { month: 'Jan', leads: 398, current: false },
  { month: 'Feb', leads: 421, current: false },
  { month: 'Mar', leads: 449, current: false },
  { month: 'Apr', leads: 462, current: false },
  { month: 'May', leads: 415, current: true  },
]
const MAX_MONTHLY_LEADS = 462
// SVG bar chart constants
const SVG_W = 400
const SVG_H = 80
const BAR_W = 48
const BAR_GAP = 32
const BAR_TOTAL = BAR_W + BAR_GAP

const MONTHLY = [
  { month: 'Jan', revenue: 18.4, deals: 6 },
  { month: 'Feb', revenue: 22.1, deals: 8 },
  { month: 'Mar', revenue: 19.7, deals: 7 },
  { month: 'Apr', revenue: 27.5, deals: 10 },
  { month: 'May', revenue: 32.0, deals: 12 },
]
const MAX_REV = Math.max(...MONTHLY.map((m) => m.revenue))

const SOURCE_COLORS: Record<string, string> = {
  'Palm investor landing':    'bg-gold',
  'Market tracker':           'bg-sky-400',
  'WhatsApp':                 'bg-gold',
  'Dubai Hills landing':      'bg-violet-400',
  'Golden Visa inquiry form': 'bg-amber-400',
  'Secondary market mailer':  'bg-rose-400',
}

type DateRange = '7d' | '30d' | '90d' | 'MTD'
const DATE_RANGES: DateRange[] = ['7d', '30d', '90d', 'MTD']
type IntentFilter = 'All' | 'High' | 'Medium' | 'Low'
const INTENT_FILTERS: IntentFilter[] = ['All', 'High', 'Medium', 'Low']

export default function CrmReportsPage() {
  const { leads } = useLiveLeads()
  const [dateRange, setDateRange] = useState<DateRange>('30d')
  const [intentFilter, setIntentFilter] = useState<IntentFilter>('All')
  const [agentFilter, setAgentFilter] = useState('All')

  const ALL_AGENTS = useMemo(
    () => ['All', ...Array.from(new Set(leads.map((l) => l.assignedAgent)))],
    [leads],
  )

  // Compute live source breakdown from real lead data
  const sourceMap = useMemo(() => leads.reduce<Record<string, number>>((acc, l) => {
    acc[l.source] = (acc[l.source] || 0) + 1
    return acc
  }, {}), [leads])

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

  // Live stats from real data
  const totalLeads   = leads.length
  const critical     = leads.filter((l) => l.urgency === 'critical').length
  const callsLogged  = crmActivityLog.filter((e) => e.type === 'call').length
  const connected    = crmActivityLog.filter((e) => e.outcome === 'connected').length
  const connectRate  = callsLogged > 0 ? Math.round((connected / callsLogged) * 100) : 0

  // Intent score distribution — filtered
  const avgIntent = leads.length > 0 ? Math.round(leads.reduce((s, l) => s + l.intentScore, 0) / leads.length) : 0
  const highIntent = leads.filter((l) => l.intentScore >= 80).length

  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      if (agentFilter !== 'All' && l.assignedAgent !== agentFilter) return false
      if (intentFilter === 'High' && l.intentScore < 80) return false
      if (intentFilter === 'Medium' && (l.intentScore < 60 || l.intentScore >= 80)) return false
      if (intentFilter === 'Low' && l.intentScore >= 60) return false
      return true
    })
  }, [leads, agentFilter, intentFilter])

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:pt-6">
      <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-10 xl:grid-cols-[1fr_380px] xl:gap-14">
        <div className="min-w-0">
          <PageHeader
            eyebrow="CRM · Reports"
            Icon={TrendingUp}
            title="Lead Intelligence"
            subtitle="Source mix, intent signals, and monthly revenue trend. Live lead stats from Freehold CRM · HubSpot sync pending."
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
            <StatCard label="Active leads"  value={totalLeads}        delta={{ value: `${critical} critical`, direction: critical > 0 ? 'down' : 'flat' }} />
            <StatCard label="High intent"   value={highIntent}        hint={`${avgIntent} avg score`} delta={{ value: 'high intent', direction: 'up' }} />
            <StatCard label="Connect rate"  value={`${connectRate}%`} hint={`${connected}/${callsLogged} calls`} delta={{ value: connectRate >= 50 ? 'good' : 'low', direction: connectRate >= 50 ? 'up' : 'down' }} />
            <StatCard label="Revenue MTD"   value="AED 32M"           delta={{ value: '+16% vs Apr', direction: 'up' }} />
          </div>

          <Section
            className="mt-10"
            title="Monthly Lead Activity"
            action={<span className="rounded-full border border-gold/20 bg-gold/[0.06] px-2 py-0.5 text-xs text-gold">Live · last 5 months</span>}
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
            title="Lead sources"
            action={<span className="rounded-full border border-gold/20 bg-gold/[0.06] px-2 py-0.5 text-xs text-gold">Live</span>}
          >
            <Panel className="p-6 sm:p-8">
              <div className="space-y-5">
                {sources.map((src) => (
                  <div key={src.source}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-300">{src.source}</span>
                      <span className="text-slate-400">{src.count} lead{src.count !== 1 ? 's' : ''}</span>
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
            title="Intent distribution"
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
                    {f}
                  </button>
                ))}
                <select
                  value={agentFilter}
                  onChange={(e) => setAgentFilter(e.target.value)}
                  className="rounded-full border border-line-strong bg-transparent px-3 py-1 text-xs text-slate-400 outline-none transition hover:border-slate-500 hover:text-slate-200"
                >
                  {ALL_AGENTS.map((a) => <option key={a} value={a} className="bg-surface">{a === 'All' ? 'All agents' : a}</option>)}
                </select>
              </div>
            }
          >
            <Panel className="p-6 sm:p-8">
              {filteredLeads.length === 0 ? (
                <EmptyState Icon={Target} title="No leads match these filters" />
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
            title="Monthly revenue"
            action={<span className="rounded-full border border-amber-400/20 bg-amber-400/[0.06] px-2 py-0.5 text-xs text-amber-300">Jan – May</span>}
          >
            <Panel className="p-6 sm:p-8">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 sm:gap-5">
                {MONTHLY.map((m) => (
                  <div key={m.month} className="flex flex-col items-center gap-3">
                    <div className="flex h-32 w-full items-end overflow-hidden rounded-lg bg-surface-2">
                      <div
                        className="w-full rounded-lg bg-gradient-to-t from-gold/70 to-gold/30"
                        style={{ height: `${(m.revenue / MAX_REV) * 100}%` }}
                      />
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-semibold text-white">AED {m.revenue}M</div>
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{m.month} · {m.deals}d</div>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </Section>

        </div>

        {/* Sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-[112px] space-y-5">
            <div className="rounded-xl border border-gold/20 bg-gradient-to-br from-gold/[0.06] to-transparent p-5">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Top channel</div>
              <div className="mt-3 text-[16px] font-semibold text-white">{sources[0]?.source ?? '—'}</div>
              <div className="mt-1 text-xs text-slate-400">{sources[0]?.count ?? 0} leads · highest volume</div>
            </div>

            <Panel className="p-5">
              <PanelHeader title="Cohort watch" icon={<Users className="h-3.5 w-3.5" />} />
              <div className="mt-3 text-[14px] font-semibold text-white">Golden Visa buyers</div>
              <div className="mt-2 text-xs leading-relaxed text-slate-400">
                1 lead tagged GV-eligible · AED 2.5M+ budget · at Qualified stage.
              </div>
            </Panel>

            <Panel className="p-5">
              <PanelHeader title="Activity this week" />
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                <div className="flex justify-between">
                  <span>Calls logged</span>
                  <span className="font-semibold text-white">{callsLogged}</span>
                </div>
                <div className="flex justify-between">
                  <span>Connected</span>
                  <span className="font-semibold text-gold">{connected}</span>
                </div>
                <div className="flex justify-between">
                  <span>Connect rate</span>
                  <span className={`font-semibold ${connectRate >= 50 ? 'text-gold' : 'text-orange-300'}`}>{connectRate}%</span>
                </div>
              </div>
            </Panel>

            <Panel className="p-5">
              <PanelHeader title="Next report" />
              <div className="mt-3 text-[14px] text-slate-300">Weekly · Mondays 09:00 GST</div>
              <div className="mt-1 text-xs text-slate-400">Sent to owner + sales leads.</div>
            </Panel>
          </div>
        </aside>
      </div>
    </div>
  )
}
