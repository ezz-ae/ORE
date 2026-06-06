'use client'

import { useState, useMemo } from 'react'
import { TrendingUp, BarChart3, Target, Users, Zap } from 'lucide-react'
import { crmLeads, crmActivityLog } from '@/src/features/freehold-intelligence/server-session'
import { AiPrompt } from '@/components/freehold/ai-prompt'

// Static lead-source data (30-day window)
const LEAD_SOURCES = [
  { label: 'Meta Ads',        count: 248, bar: 'bg-[#D4AF37]' },
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

// Historical monthly trend — illustrative seeded data (no live revenue store in V1)
const MONTHLY = [
  { month: 'Jan', revenue: 18.4, deals: 6 },
  { month: 'Feb', revenue: 22.1, deals: 8 },
  { month: 'Mar', revenue: 19.7, deals: 7 },
  { month: 'Apr', revenue: 27.5, deals: 10 },
  { month: 'May', revenue: 32.0, deals: 12 },
]
const MAX_REV = Math.max(...MONTHLY.map((m) => m.revenue))

const SOURCE_COLORS: Record<string, string> = {
  'Palm investor landing':    'bg-[#D4AF37]',
  'Market tracker':           'bg-sky-400',
  'WhatsApp':                 'bg-[#D4AF37]',
  'Dubai Hills landing':      'bg-violet-400',
  'Golden Visa inquiry form': 'bg-amber-400',
  'Secondary market mailer':  'bg-rose-400',
}

type DateRange = '7d' | '30d' | '90d' | 'MTD'
const DATE_RANGES: DateRange[] = ['7d', '30d', '90d', 'MTD']
type IntentFilter = 'All' | 'High' | 'Medium' | 'Low'
const INTENT_FILTERS: IntentFilter[] = ['All', 'High', 'Medium', 'Low']

const ALL_AGENTS = ['All', ...Array.from(new Set(crmLeads.map((l) => l.assignedAgent)))]

export default function CrmReportsPage() {
  const [dateRange, setDateRange] = useState<DateRange>('30d')
  const [intentFilter, setIntentFilter] = useState<IntentFilter>('All')
  const [agentFilter, setAgentFilter] = useState('All')

  // Compute live source breakdown from real lead data
  const sourceMap = useMemo(() => crmLeads.reduce<Record<string, number>>((acc, l) => {
    acc[l.source] = (acc[l.source] || 0) + 1
    return acc
  }, {}), [])

  const sources = useMemo(() => Object.entries(sourceMap)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count), [sourceMap])

  const maxSource = Math.max(...sources.map((s) => s.count))

  // Live stats from real data
  const totalLeads   = crmLeads.length
  const critical     = crmLeads.filter((l) => l.urgency === 'critical').length
  const callsLogged  = crmActivityLog.filter((e) => e.type === 'call').length
  const connected    = crmActivityLog.filter((e) => e.outcome === 'connected').length
  const connectRate  = callsLogged > 0 ? Math.round((connected / callsLogged) * 100) : 0

  // Intent score distribution — filtered
  const avgIntent = Math.round(crmLeads.reduce((s, l) => s + l.intentScore, 0) / crmLeads.length)
  const highIntent = crmLeads.filter((l) => l.intentScore >= 80).length

  const filteredLeads = useMemo(() => {
    return crmLeads.filter((l) => {
      if (agentFilter !== 'All' && l.assignedAgent !== agentFilter) return false
      if (intentFilter === 'High' && l.intentScore < 80) return false
      if (intentFilter === 'Medium' && (l.intentScore < 60 || l.intentScore >= 80)) return false
      if (intentFilter === 'Low' && l.intentScore >= 60) return false
      return true
    })
  }, [agentFilter, intentFilter])

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:pt-6">
      <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-10 xl:grid-cols-[1fr_380px] xl:gap-14">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-[#D4AF37]/85">
            <TrendingUp className="h-3.5 w-3.5" /> Reports
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-100">
            Lead intelligence<br/><span className="text-slate-500">at a glance.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-slate-400">
            Source mix, intent signals, and monthly revenue trend. Live lead stats from Freehold CRM · HubSpot sync pending.
          </p>

          {/* Date range pills */}
          <div className="mt-8 flex items-center gap-2">
            {DATE_RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={[
                  'rounded-full px-3.5 py-1.5 text-xs font-medium transition',
                  dateRange === r
                    ? 'bg-[#D4AF37] text-[#06080A]'
                    : 'border border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200',
                ].join(' ')}
              >
                {r}
              </button>
            ))}
          </div>

          {/* KPI tiles — live where available */}
          <div className="mt-12 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: 'Active leads',   value: String(totalLeads),   delta: `${critical} critical`,       tone: critical > 0 ? 'text-red-300' : 'text-[#D4AF37]' },
              { label: 'High intent',    value: String(highIntent),   delta: `${avgIntent} avg score`,     tone: 'text-[#D4AF37]' },
              { label: 'Connect rate',   value: `${connectRate}%`,    delta: `${connected}/${callsLogged} calls`, tone: connectRate >= 50 ? 'text-[#D4AF37]' : 'text-orange-300' },
              { label: 'Revenue MTD',    value: 'AED 32M',           delta: '+16% vs Apr',                tone: 'text-[#D4AF37]' },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{kpi.label}</div>
                <div className="mt-3 text-[28px] font-semibold text-white">{kpi.value}</div>
                <div className={`mt-1 text-xs ${kpi.tone}`}>{kpi.delta}</div>
              </div>
            ))}
          </div>

          {/* Lead Sources (30d) — static bar chart */}
          <section className="mt-14">
            <div className="mb-5 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[#D4AF37]" />
              <h2 className="text-[18px] font-semibold text-white">Lead Sources (30d)</h2>
              <span className="rounded-full border border-sky-400/20 bg-sky-400/[0.06] px-2 py-0.5 text-xs text-slate-400">Static · paid channels</span>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-800/50 p-6 sm:p-8">
              <div className="space-y-5">
                {LEAD_SOURCES.map((src) => (
                  <div key={src.label}>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="font-medium text-slate-300">{src.label}</span>
                      <span className="text-slate-400">{src.count} leads</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={`h-full rounded-full ${src.bar}`}
                        style={{ width: `${(src.count / MAX_LEAD_SOURCE) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Monthly Lead Trend — SVG bar chart */}
          <section className="mt-14">
            <div className="mb-5 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#D4AF37]" />
              <h2 className="text-[18px] font-semibold text-white">Monthly Lead Trend</h2>
              <span className="rounded-full border border-amber-400/20 bg-amber-400/[0.06] px-2 py-0.5 text-xs text-amber-300">Jan – May</span>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-800/50 p-6 sm:p-8">
              <div className="overflow-x-auto">
                <svg
                  width={SVG_W}
                  height={SVG_H + 28}
                  viewBox={`0 0 ${SVG_W} ${SVG_H + 28}`}
                  className="min-w-[360px]"
                >
                  {MONTHLY_LEADS.map((m, i) => {
                    const barH = Math.round((m.leads / MAX_MONTHLY_LEADS) * SVG_H)
                    const x = i * BAR_TOTAL
                    const y = SVG_H - barH
                    return (
                      <g key={m.month}>
                        <rect
                          x={x}
                          y={y}
                          width={BAR_W}
                          height={barH}
                          rx={6}
                          fill={m.current ? '#D4AF37' : 'rgba(148,163,184,0.15)'}
                        />
                        <text
                          x={x + BAR_W / 2}
                          y={SVG_H + 18}
                          textAnchor="middle"
                          fontSize={10}
                          fill="rgba(148,163,184,0.60)"
                          fontFamily="inherit"
                        >
                          {m.month}
                        </text>
                        {m.current && (
                          <text
                            x={x + BAR_W / 2}
                            y={y - 6}
                            textAnchor="middle"
                            fontSize={9}
                            fill="#D4AF37"
                            fontFamily="inherit"
                          >
                            {m.leads}
                          </text>
                        )}
                      </g>
                    )
                  })}
                </svg>
              </div>
            </div>
          </section>

          {/* Source breakdown — live */}
          <section className="mt-14">
            <div className="mb-5 flex items-center gap-2">
              <Target className="h-4 w-4 text-[#D4AF37]" />
              <h2 className="text-[18px] font-semibold text-white">Lead sources</h2>
              <span className="rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/[0.06] px-2 py-0.5 text-xs text-[#D4AF37]">Live</span>
            </div>
            <div className="rounded-[24px] border border-slate-800 bg-slate-900 p-6 sm:p-8">
              <div className="space-y-5">
                {sources.map((src) => (
                  <div key={src.source}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-300">{src.source}</span>
                      <span className="text-slate-400">{src.count} lead{src.count !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={`h-full rounded-full ${SOURCE_COLORS[src.source] ?? 'bg-slate-500'}`}
                        style={{ width: `${(src.count / maxSource) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Intent score breakdown */}
          <section className="mt-14">
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-[#D4AF37]" />
                <h2 className="text-[18px] font-semibold text-white">Intent distribution</h2>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {INTENT_FILTERS.map((f) => (
                  <button
                    key={f}
                    onClick={() => setIntentFilter(f)}
                    className={[
                      'rounded-full px-3 py-1 text-sm font-medium transition',
                      intentFilter === f
                        ? 'bg-[#D4AF37] text-[#06080A]'
                        : 'border border-slate-700 text-slate-400 hover:text-slate-200',
                    ].join(' ')}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <select
                value={agentFilter}
                onChange={(e) => setAgentFilter(e.target.value)}
                className="rounded-full border border-slate-700 bg-transparent px-3 py-1 text-sm text-slate-400 outline-none transition hover:border-slate-500 hover:text-slate-200"
              >
                {ALL_AGENTS.map((a) => <option key={a} value={a} className="bg-[#0B0F1A]">{a === 'All' ? 'All agents' : a}</option>)}
              </select>
            </div>
            <div className="rounded-[24px] border border-slate-800 bg-slate-900 p-6 sm:p-8">
              {filteredLeads.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500">No leads match these filters.</div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {filteredLeads.map((lead) => (
                    <div key={lead.id} className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-300">{lead.name}</div>
                        <div className="text-sm text-slate-500">{lead.stage} · {lead.assignedAgent}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className={`h-full rounded-full ${lead.intentScore >= 85 ? 'bg-[#D4AF37]' : lead.intentScore >= 70 ? 'bg-[#D4AF37]' : 'bg-orange-400'}`}
                            style={{ width: `${lead.intentScore}%` }}
                          />
                        </div>
                        <span className="w-6 text-right text-xs font-semibold text-slate-300">{lead.intentScore}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Monthly trend — seeded */}
          <section className="mt-14">
            <div className="mb-5 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[#D4AF37]" />
              <h2 className="text-[18px] font-semibold text-white">Monthly revenue</h2>
              <span className="rounded-full border border-sky-400/20 bg-sky-400/[0.06] px-2 py-0.5 text-xs text-slate-400">Seeded data — live in V1.1</span>
            </div>
            <div className="rounded-[24px] border border-slate-800 bg-slate-900 p-6 sm:p-8">
              <div className="grid grid-cols-5 gap-3 sm:gap-5">
                {MONTHLY.map((m) => (
                  <div key={m.month} className="flex flex-col items-center gap-3">
                    <div className="flex h-32 w-full items-end overflow-hidden rounded-lg bg-slate-800/50">
                      <div
                        className="w-full rounded-lg bg-gradient-to-t from-[#D4AF37]/70 to-[#D4AF37]/30"
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
            </div>
          </section>

          <section className="mt-14">
            <AiPrompt
              placeholder="Ask about lead volume, conversion, agent performance…"
              suggestions={[
                'Which source has the highest conversion rate?',
                'How many leads came in this week vs last?',
                'Summarise the call connect rate by agent.',
              ]}
            />
          </section>
        </div>

        {/* Sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-[112px] space-y-5">
            <div className="rounded-xl border border-[#D4AF37]/20 bg-gradient-to-br from-[#D4AF37]/[0.06] to-transparent p-5">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-[#D4AF37]">Top channel</div>
              <div className="mt-3 text-[16px] font-semibold text-white">{sources[0]?.source ?? '—'}</div>
              <div className="mt-1 text-xs text-slate-400">{sources[0]?.count ?? 0} leads · highest volume</div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                <Users className="h-3 w-3" /> Cohort watch
              </div>
              <div className="mt-3 text-[14px] font-semibold text-white">Golden Visa buyers</div>
              <div className="mt-2 text-xs leading-relaxed text-slate-400">
                1 lead tagged GV-eligible · AED 2.5M+ budget · at Qualified stage.
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Activity this week</div>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                <div className="flex justify-between">
                  <span>Calls logged</span>
                  <span className="font-semibold text-white">{callsLogged}</span>
                </div>
                <div className="flex justify-between">
                  <span>Connected</span>
                  <span className="font-semibold text-[#D4AF37]">{connected}</span>
                </div>
                <div className="flex justify-between">
                  <span>Connect rate</span>
                  <span className={`font-semibold ${connectRate >= 50 ? 'text-[#D4AF37]' : 'text-orange-300'}`}>{connectRate}%</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Next report</div>
              <div className="mt-3 text-[14px] text-slate-300">Weekly · Mondays 09:00 GST</div>
              <div className="mt-1 text-xs text-slate-400">Sent to owner + sales leads.</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
