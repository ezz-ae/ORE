'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Users, AlertTriangle, Trophy, Loader2 } from 'lucide-react'

// Live team metrics from the CRM (same source as Analytics → Team).
type AgentMetric = {
  id: string
  name: string
  tenureDays: number | null
  totalLeads: number
  hotLeads: number
  wins30d: number
  overdueFollowups: number
  activity30d: number
  calls: number
  messages: number
  notes: number
}

type Status = 'available' | 'at_capacity' | 'overloaded'

const STATUS_CONFIG: Record<Status, { dot: string; text: string; badge: string; label: string }> = {
  available:   { dot: 'bg-gold',     text: 'text-gold',      badge: 'border-gold/20 bg-gold/10',       label: 'Available'   },
  at_capacity: { dot: 'bg-[#F8E7AE]', text: 'text-[#F8E7AE]', badge: 'border-gold/20 bg-gold/10',       label: 'At capacity' },
  overloaded:  { dot: 'bg-red-400',  text: 'text-red-300',   badge: 'border-red-400/20 bg-red-400/10', label: 'Overloaded'  },
}

const PRIORITY_STATUS: Record<Status, number> = { overloaded: 0, at_capacity: 1, available: 2 }

// Status is derived from real signals: overdue follow-ups first, then load.
function statusFor(a: AgentMetric): Status {
  if (a.overdueFollowups >= 3) return 'overloaded'
  if (a.totalLeads >= 20 || a.overdueFollowups >= 1) return 'at_capacity'
  return 'available'
}

function initialsOf(name: string): string {
  return name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

type StatusFilter = 'All' | Status
type SortKey = 'status' | 'hot' | 'overdue' | 'wins'

export default function SalesTeamPage() {
  const [agents, setAgents] = useState<AgentMetric[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')
  const [sortKey, setSortKey] = useState<SortKey>('status')

  useEffect(() => {
    fetch('/api/freehold/analytics/team')
      .then((r) => r.json())
      .then((d) => setAgents(Array.isArray(d.agents) ? d.agents : []))
      .catch(() => setAgents([]))
      .finally(() => setLoading(false))
  }, [])

  const overloaded   = agents.filter((a) => statusFor(a) === 'overloaded')
  const available    = agents.filter((a) => statusFor(a) === 'available')
  const totalHot     = agents.reduce((s, a) => s + a.hotLeads, 0)
  const totalOverdue = agents.reduce((s, a) => s + a.overdueFollowups, 0)

  const filteredAgents = useMemo(() => {
    let items = [...agents]
    if (statusFilter !== 'All') items = items.filter((a) => statusFor(a) === statusFilter)
    items.sort((a, b) => {
      if (sortKey === 'status') return PRIORITY_STATUS[statusFor(a)] - PRIORITY_STATUS[statusFor(b)]
      if (sortKey === 'hot') return b.hotLeads - a.hotLeads
      if (sortKey === 'overdue') return b.overdueFollowups - a.overdueFollowups
      if (sortKey === 'wins') return b.wins30d - a.wins30d
      return 0
    })
    return items
  }, [agents, statusFilter, sortKey])

  const statusPills: { value: StatusFilter; label: string }[] = [
    { value: 'All',         label: 'All'         },
    { value: 'available',   label: 'Available'   },
    { value: 'at_capacity', label: 'At capacity' },
    { value: 'overloaded',  label: 'Overloaded'  },
  ]
  const sortPills: { value: SortKey; label: string }[] = [
    { value: 'status',  label: 'Status'    },
    { value: 'hot',     label: 'Hot leads' },
    { value: 'overdue', label: 'Overdue'   },
    { value: 'wins',    label: 'Wins'      },
  ]

  function statusPillClass(value: StatusFilter) {
    if (value !== statusFilter) return 'border-line bg-surface-2 text-slate-500 hover:text-slate-300'
    if (value === 'overloaded') return 'border-red-400/35 bg-red-400/10 text-red-300'
    return 'border-gold/40 bg-gold/10 text-gold'
  }
  function sortPillClass(value: SortKey) {
    return value === sortKey
      ? 'border-gold/40 bg-gold/10 text-gold'
      : 'border-line bg-surface-2 text-slate-500 hover:text-slate-300'
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      <Link href="/freehold-intelligence/apps" className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> All apps
      </Link>

      <section className="mt-7">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold/85">
          <Users className="h-3.5 w-3.5" /> Sales Team
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
          {agents.length} agents.<br />
          <span className="text-slate-500">{totalHot} hot leads active.</span>
        </h1>
      </section>

      {loading && (
        <div className="mt-10 flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> <span className="text-sm">Loading team…</span>
        </div>
      )}

      {!loading && agents.length === 0 && (
        <div className="mt-10 rounded-[22px] border border-line bg-surface py-14 text-center text-sm text-slate-500">
          No team data yet. Agents and their leads appear here once the CRM has activity.
        </div>
      )}

      {!loading && agents.length > 0 && (
        <>
          {/* Overload warning */}
          {overloaded.length > 0 && (
            <div className="mt-8 flex items-start gap-3 rounded-[20px] border border-red-400/20 bg-red-400/[0.05] p-5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <div>
                <div className="text-sm font-semibold text-white">
                  {overloaded.map((a) => a.name).join(', ')} {overloaded.length === 1 ? 'is' : 'are'} overloaded
                </div>
                <p className="mt-0.5 text-sm text-slate-400">
                  Reassign leads or clear overdue follow-ups to bring the load down.
                </p>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Agents',    value: agents.length,    color: 'text-white'   },
              { label: 'Available', value: available.length, color: 'text-gold'    },
              { label: 'Hot leads', value: totalHot,         color: 'text-red-300' },
              { label: 'Overdue',   value: totalOverdue,     color: totalOverdue > 3 ? 'text-red-300' : 'text-gold' },
            ].map((s) => (
              <div key={s.label} className="rounded-[18px] border border-line bg-surface p-4 text-center">
                <div className={`text-[28px] font-semibold leading-none ${s.color}`}>{s.value}</div>
                <div className="mt-1.5 text-xs text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Roster */}
          <section className="mt-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Roster
                {statusFilter !== 'All' && (
                  <span className="ml-2 normal-case tracking-normal text-slate-600">
                    {filteredAgents.length} of {agents.length} agents
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {statusPills.map((pill) => (
                  <button key={pill.value} onClick={() => setStatusFilter(pill.value)}
                    className={`rounded-full border px-3 py-1 text-sm font-medium transition ${statusPillClass(pill.value)}`}>
                    {pill.label}
                  </button>
                ))}
                <span className="select-none text-slate-700">|</span>
                {sortPills.map((pill) => (
                  <button key={pill.value} onClick={() => setSortKey(pill.value)}
                    className={`rounded-full border px-3 py-1 text-sm font-medium transition ${sortPillClass(pill.value)}`}>
                    {pill.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {filteredAgents.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-[22px] border border-line bg-surface py-14 text-center">
                  <p className="text-sm text-slate-500">No agents match this filter</p>
                  <button onClick={() => setStatusFilter('All')}
                    className="rounded-full border border-line bg-surface-2 px-4 py-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-300">
                    Clear
                  </button>
                </div>
              ) : (
                filteredAgents.map((agent) => {
                  const st = STATUS_CONFIG[statusFor(agent)]
                  return (
                    <div key={agent.id} className="rounded-[22px] border border-line bg-surface p-6">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-line bg-surface-2 text-base font-semibold text-slate-300">
                            {initialsOf(agent.name)}
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-base font-semibold text-white">{agent.name}</span>
                              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${st.badge} ${st.text}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                                {st.label}
                              </span>
                            </div>
                            <div className="mt-0.5 text-xs text-slate-500">
                              {agent.tenureDays != null ? `${agent.tenureDays}d on team` : 'Broker'} · {agent.activity30d} actions / 30d
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-5 text-center">
                          {[
                            { label: 'Leads',   value: agent.totalLeads,       color: 'text-white' },
                            { label: 'Hot',     value: agent.hotLeads,         color: agent.hotLeads > 0 ? 'text-red-400' : 'text-white' },
                            { label: 'Overdue', value: agent.overdueFollowups, color: agent.overdueFollowups > 0 ? 'text-gold' : 'text-white' },
                            { label: 'Wins',    value: agent.wins30d,          color: 'text-gold' },
                          ].map((m) => (
                            <div key={m.label}>
                              <div className={`text-xl font-semibold ${m.color}`}>{m.value}</div>
                              <div className="text-[9px] text-slate-600">{m.label}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Activity breakdown (real) */}
                      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span className="rounded-full border border-line bg-surface-2 px-3 py-1">{agent.calls} calls</span>
                        <span className="rounded-full border border-line bg-surface-2 px-3 py-1">{agent.messages} messages</span>
                        <span className="rounded-full border border-line bg-surface-2 px-3 py-1">{agent.notes} notes</span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </section>

          {/* Leaderboard */}
          <section className="mt-12">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Win ranking · last 30 days</div>
            <div className="mt-4 overflow-hidden rounded-[22px] border border-line bg-surface">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">#</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Agent</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Wins</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Hot</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Leads</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {[...agents].sort((a, b) => b.wins30d - a.wins30d).map((agent, i) => (
                    <tr key={agent.id} className={`transition hover:bg-surface-2 ${i === 0 ? 'bg-gold/[0.03]' : ''}`}>
                      <td className="px-6 py-4">
                        {i === 0 ? <Trophy className="h-4 w-4 text-gold" /> : <span className="text-sm text-slate-500">{i + 1}</span>}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface-2 text-sm font-semibold text-slate-300">
                            {initialsOf(agent.name)}
                          </div>
                          <div className="text-sm font-medium text-slate-100">{agent.name}</div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center text-sm font-semibold text-gold">{agent.wins30d}</td>
                      <td className="px-4 py-4 text-center">
                        <span className={`text-sm font-semibold ${agent.hotLeads > 0 ? 'text-red-400' : 'text-slate-600'}`}>{agent.hotLeads}</span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-slate-400">{agent.totalLeads}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
