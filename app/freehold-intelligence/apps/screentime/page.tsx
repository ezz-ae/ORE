'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, Activity, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { crmActivityLog, crmAgentRoster } from '@/src/features/freehold-intelligence/server-session'
import { AiPrompt } from '@/components/freehold/ai-prompt'

const DAYS  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]

type SortKey = 'events' | 'calls' | 'connect' | 'avgDur'

function intensityClass(count: number, max: number) {
  if (count === 0) return 'bg-white/[0.04]'
  const pct = count / max
  if (pct >= 0.75) return 'bg-[#D4AF37]'
  if (pct >= 0.5)  return 'bg-[#D4AF37]/70'
  if (pct >= 0.25) return 'bg-[#D4AF37]/35'
  return 'bg-[#D4AF37]/15'
}

function isoToDayHour(iso: string): { day: number; hour: number } {
  const d    = new Date(iso)
  const day  = d.getDay() === 0 ? 6 : d.getDay() - 1
  const hour = d.getHours()
  return { day, hour }
}

// Build heatmap at module level (static data — no need to recompute per render)
const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
for (const event of crmActivityLog) {
  const { day, hour } = isoToDayHour(event.createdAt)
  grid[day][hour]++
}
const maxCell = Math.max(...grid.flatMap((row) => row))

const hourTotals = Array(24).fill(0)
for (const event of crmActivityLog) {
  hourTotals[new Date(event.createdAt).getHours()]++
}
const peakHour  = hourTotals.indexOf(Math.max(...hourTotals))
const peakLabel = peakHour < 12 ? `${peakHour}:00 AM` : peakHour === 12 ? '12:00 PM' : `${peakHour - 12}:00 PM`

const totalEvents = crmActivityLog.length
const totalCalls  = crmActivityLog.filter((e) => e.type === 'call').length
const connected   = crmActivityLog.filter((e) => e.outcome === 'connected').length
const connectRate = totalCalls > 0 ? Math.round((connected / totalCalls) * 100) : 0

const BASE_AGENT_STATS = crmAgentRoster.map((agent) => {
  const events     = crmActivityLog.filter((e) => e.actor === agent.name)
  const calls      = events.filter((e) => e.type === 'call')
  const connectedC = calls.filter((e) => e.outcome === 'connected')
  const avgDur     = calls.length > 0
    ? Math.round(calls.reduce((s, c) => s + (c.durationMin ?? 0), 0) / calls.length)
    : 0
  const cr = calls.length > 0 ? Math.round((connectedC.length / calls.length) * 100) : 0
  return { agent, events: events.length, calls: calls.length, connectRate: cr, avgDur }
})

export default function ScreentimePage() {
  const [sortKey, setSortKey] = useState<SortKey>('events')
  const [sortAsc, setSortAsc] = useState(false)

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v)
    else { setSortKey(key); setSortAsc(false) }
  }

  const agentStats = useMemo(() => {
    return [...BASE_AGENT_STATS].sort((a, b) => {
      let diff = 0
      if (sortKey === 'events')   diff = a.events - b.events
      if (sortKey === 'calls')    diff = a.calls - b.calls
      if (sortKey === 'connect')  diff = a.connectRate - b.connectRate
      if (sortKey === 'avgDur')   diff = a.avgDur - b.avgDur
      return sortAsc ? diff : -diff
    })
  }, [sortKey, sortAsc])

  const SORT_COLS: { key: SortKey; label: string }[] = [
    { key: 'events',  label: 'Events'    },
    { key: 'calls',   label: 'Calls'     },
    { key: 'connect', label: 'Connect %' },
    { key: 'avgDur',  label: 'Avg dur'   },
  ]

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-10 sm:px-6 sm:pt-14">

      <Link href="/freehold-intelligence/apps" className="inline-flex items-center gap-1.5 text-[12px] text-white/40 transition hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> All apps
      </Link>

      <section className="mt-7">
        <div className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
          <Activity className="h-3.5 w-3.5" /> Screentime
        </div>
        <h1 className="mt-4 text-[36px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[52px]">
          Operator activity<br />
          <span className="text-white/35">patterns &amp; gaps.</span>
        </h1>
        <p className="mt-5 max-w-xl text-[16px] leading-[1.65] text-white/60">
          Derived from the CRM activity log — call times, response gaps, and agent intensity. Live session telemetry connects in V2.
        </p>
      </section>

      <div className="mt-6 flex items-start gap-2.5 rounded-[16px] border border-[#D4AF37]/15 bg-[#D4AF37]/[0.04] px-4 py-3">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#D4AF37]/70" />
        <p className="text-[12px] text-white/55">
          <span className="text-[#D4AF37]/80 font-medium">V1 — CRM-derived data.</span> Activity timing is pulled from the CRM event log.
          Real-time session tracking and keystroke telemetry require V2 instrumentation.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Events logged', value: totalEvents,       color: 'text-white'       },
          { label: 'Calls made',    value: totalCalls,        color: 'text-white'       },
          { label: 'Connect rate',  value: `${connectRate}%`, color: 'text-[#D4AF37]' },
          { label: 'Peak hour',     value: peakLabel,         color: 'text-[#D4AF37]'   },
        ].map((s) => (
          <div key={s.label} className="rounded-[18px] border border-white/[0.08] bg-[#1A1F2A] p-4 text-center">
            <div className={`text-[22px] font-semibold leading-none ${s.color}`}>{s.value}</div>
            <div className="mt-1.5 text-[12px] text-white/35">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Activity heatmap */}
      <section className="mt-12">
        <div className="text-[13px] font-medium uppercase tracking-[0.22em] text-white/40">Activity heatmap</div>
        <h2 className="mt-1.5 text-lg font-semibold text-white">Hour × day distribution</h2>
        <div className="mt-5 overflow-x-auto">
          <div className="min-w-[520px]">
            <div className="mb-2 flex">
              <div className="w-10 shrink-0" />
              {HOURS.map((h) => (
                <div key={h} className="flex-1 text-center text-[9px] text-white/25">
                  {h < 12 ? `${h}` : h === 12 ? '12' : `${h - 12}p`}
                </div>
              ))}
            </div>
            {DAYS.map((day, di) => (
              <div key={day} className="mb-1.5 flex items-center gap-1">
                <div className="w-10 shrink-0 text-[12px] text-white/30">{day}</div>
                <div className="flex flex-1 gap-1">
                  {HOURS.map((h) => {
                    const count = grid[di][h]
                    return (
                      <div
                        key={h}
                        title={`${day} ${h}:00 — ${count} events`}
                        className={`h-7 flex-1 rounded-[5px] ${intensityClass(count, maxCell)}`}
                      />
                    )
                  })}
                </div>
              </div>
            ))}
            <div className="mt-3 flex items-center gap-2 pl-10 text-[12px] text-white/30">
              <span>Less</span>
              {['bg-white/[0.04]', 'bg-[#D4AF37]/15', 'bg-[#D4AF37]/35', 'bg-[#D4AF37]/70', 'bg-[#D4AF37]'].map((cls) => (
                <div key={cls} className={`h-4 w-4 rounded-[4px] ${cls}`} />
              ))}
              <span>More</span>
            </div>
          </div>
        </div>
      </section>

      {/* Per-agent breakdown — sortable */}
      <section className="mt-12">
        <div className="text-[13px] font-medium uppercase tracking-[0.22em] text-white/40">Agent activity</div>
        <h2 className="mt-1.5 text-lg font-semibold text-white">CRM events by agent</h2>
        <div className="mt-5 overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#1A1F2A]">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-white/[0.05]">
                <th className="px-6 py-3 text-left text-[12px] font-medium uppercase tracking-[0.18em] text-white/30">Agent</th>
                {SORT_COLS.map(({ key, label }) => (
                  <th key={key} className={`px-4 py-3 text-center ${key === 'avgDur' ? 'hidden md:table-cell' : key === 'calls' ? 'hidden sm:table-cell' : ''}`}>
                    <button
                      onClick={() => handleSort(key)}
                      className={[
                        'flex items-center gap-1 mx-auto text-[12px] font-medium uppercase tracking-[0.16em] transition',
                        sortKey === key ? 'text-white/65' : 'text-white/30 hover:text-white/55',
                      ].join(' ')}
                    >
                      {label}
                      {sortKey === key && (sortAsc ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />)}
                    </button>
                  </th>
                ))}
                <th className="px-6 py-3 text-right text-[12px] font-medium uppercase tracking-[0.18em] text-white/30">Intensity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {agentStats.map(({ agent, events, calls, connectRate: cr }) => {
                const maxEventsAll = Math.max(...BASE_AGENT_STATS.map((s) => s.events), 1)
                return (
                  <tr key={agent.id} className="transition hover:bg-white/[0.02]">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-[13px] font-semibold text-white/60">
                          {agent.initials}
                        </div>
                        <div>
                          <div className="text-[13px] font-medium text-white/85">{agent.name}</div>
                          <div className="text-[13px] text-white/35">{agent.role}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-[14px] font-semibold text-white">{events}</span>
                    </td>
                    <td className="hidden px-4 py-4 text-center text-white/60 sm:table-cell">{calls}</td>
                    <td className="hidden px-4 py-4 text-center md:table-cell">
                      <span className={cr >= 60 ? 'text-[#D4AF37]' : cr > 0 ? 'text-[#D4AF37]' : 'text-white/30'}>
                        {cr > 0 ? `${cr}%` : '—'}
                      </span>
                    </td>
                    <td className="hidden px-4 py-4 text-center text-white/50 md:table-cell">
                      {agentStats.find((s) => s.agent.id === agent.id)?.avgDur || 0}m
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-24 overflow-hidden rounded-full bg-white/[0.06]">
                          <div
                            className="h-1.5 rounded-full bg-[#D4AF37]/70"
                            style={{ width: `${maxEventsAll > 0 ? (events / maxEventsAll) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Hour distribution bar chart */}
      <section className="mt-12">
        <div className="text-[13px] font-medium uppercase tracking-[0.22em] text-white/40">Hour distribution</div>
        <h2 className="mt-1.5 text-lg font-semibold text-white">When the team is most active</h2>
        <div className="mt-5 flex h-24 items-end gap-1 rounded-[18px] border border-white/[0.08] bg-[#1A1F2A] p-4">
          {HOURS.map((h) => {
            const count = hourTotals[h]
            const max   = Math.max(...HOURS.map((hh) => hourTotals[hh]))
            const pct   = max > 0 ? (count / max) * 100 : 0
            const isPeak = h === peakHour
            return (
              <div key={h} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={`w-full rounded-t-[3px] ${isPeak ? 'bg-[#D4AF37]' : 'bg-white/[0.12]'}`}
                  style={{ height: `${Math.max(pct, 4)}%` }}
                />
                <span className={`text-[8px] ${isPeak ? 'text-[#D4AF37]' : 'text-white/20'}`}>
                  {h < 12 ? h : h === 12 ? '12' : h - 12}
                </span>
              </div>
            )
          })}
        </div>
        <p className="mt-2 text-[12px] text-white/35">
          Peak activity at {peakLabel}. Morning calls dominate — align hot-lead follow-ups accordingly.
        </p>
      </section>

      <section className="mt-12">
        <AiPrompt
          placeholder="Ask about activity patterns, agent behaviour, response gaps…"
          suggestions={[
            'When is the team least active and why might that matter?',
            'Which agent has the best call connect rate?',
            'Show response time gaps by day of week.',
            'Who should handle WhatsApp leads arriving overnight?',
          ]}
        />
      </section>

    </div>
  )
}
