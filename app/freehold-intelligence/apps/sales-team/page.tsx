'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, Users, AlertTriangle, ArrowUpRight, Trophy } from 'lucide-react'
import {
  crmAgentRoster,
  crmLeads,
  crmInboxLeads,
  crmFollowUpQueue,
} from '@/src/features/freehold-intelligence/server-session'

const STATUS_CONFIG = {
  available:   { dot: 'bg-gold', text: 'text-gold', badge: 'border-gold/20 bg-gold/10', label: 'Available'   },
  at_capacity: { dot: 'bg-gold', text: 'text-[#F8E7AE]', badge: 'border-gold/20 bg-gold/10', label: 'At capacity' },
  overloaded:  { dot: 'bg-red-400',   text: 'text-red-300',   badge: 'border-red-400/20 bg-red-400/10',     label: 'Overloaded'  },
}

const PRIORITY_STATUS = { overloaded: 0, at_capacity: 1, available: 2 }

type StatusFilter = 'All' | 'available' | 'at_capacity' | 'overloaded'
type SortKey = 'status' | 'hot' | 'overdue' | 'wins'

export default function SalesTeamPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')
  const [sortKey, setSortKey] = useState<SortKey>('status')

  const overloaded  = crmAgentRoster.filter((a) => a.status === 'overloaded')
  const available   = crmAgentRoster.filter((a) => a.status === 'available')
  const totalHot    = crmAgentRoster.reduce((s, a) => s + a.hotLeads, 0)
  const totalOverdue = crmAgentRoster.reduce((s, a) => s + a.overdueFollowUps, 0)
  const unassigned  = crmInboxLeads.filter((l) => l.status === 'unassigned')

  const filteredAgents = useMemo(() => {
    let items = [...crmAgentRoster]
    if (statusFilter !== 'All') items = items.filter((a) => a.status === statusFilter)
    items.sort((a, b) => {
      if (sortKey === 'status') return PRIORITY_STATUS[a.status] - PRIORITY_STATUS[b.status]
      if (sortKey === 'hot') return b.hotLeads - a.hotLeads
      if (sortKey === 'overdue') return b.overdueFollowUps - a.overdueFollowUps
      if (sortKey === 'wins') return b.recentWins - a.recentWins
      return 0
    })
    return items
  }, [statusFilter, sortKey])

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
    if (value !== statusFilter) {
      return 'border-line bg-surface-2 text-slate-500 hover:text-slate-300'
    }
    if (value === 'overloaded')  return 'border-red-400/35 bg-red-400/10 text-red-300'
    if (value === 'at_capacity') return 'border-gold/35 bg-gold/10 text-gold'
    if (value === 'available')   return 'border-emerald-400/30 bg-gold/10 text-gold'
    return 'border-gold/40 bg-gold/10 text-gold'
  }

  function sortPillClass(value: SortKey) {
    return value === sortKey
      ? 'border-gold/40 bg-gold/10 text-gold'
      : 'border-line bg-surface-2 text-slate-500 hover:text-slate-300'
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      <Link
        href="/freehold-intelligence/apps"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All apps
      </Link>

      {/* Header */}
      <section className="mt-7">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold/85">
          <Users className="h-3.5 w-3.5" /> Sales Team
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
          {crmAgentRoster.length} agents.<br />
          <span className="text-slate-500">{totalHot} hot leads active.</span>
        </h1>
      </section>

      {/* Overload warning */}
      {overloaded.length > 0 && (
        <div className="mt-8 flex items-start gap-3 rounded-[20px] border border-red-400/20 bg-red-400/[0.05] p-5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <div>
            <div className="text-sm font-semibold text-white">
              {overloaded.map((a) => a.name).join(', ')} {overloaded.length === 1 ? 'is' : 'are'} overloaded
            </div>
            <p className="mt-0.5 text-sm text-slate-400">
              Reassign leads or pause new assignments until utilization drops below 85%.
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Agents',    value: crmAgentRoster.length, color: 'text-white'       },
          { label: 'Available', value: available.length,       color: 'text-gold' },
          { label: 'Hot leads', value: totalHot,               color: 'text-red-300'     },
          { label: 'Overdue',   value: totalOverdue,           color: totalOverdue > 3 ? 'text-red-300' : 'text-gold' },
        ].map((s) => (
          <div key={s.label} className="rounded-[18px] border border-line bg-surface p-4 text-center">
            <div className={`text-[28px] font-semibold leading-none ${s.color}`}>{s.value}</div>
            <div className="mt-1.5 text-xs text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Agent roster */}
      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Roster
            {statusFilter !== 'All' && (
              <span className="ml-2 normal-case tracking-normal text-slate-600">
                {filteredAgents.length} of {crmAgentRoster.length} agents
              </span>
            )}
          </div>

          {/* Filter + sort pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {statusPills.map((pill) => (
              <button
                key={pill.value}
                onClick={() => setStatusFilter(pill.value)}
                className={`rounded-full border px-3 py-1 text-sm font-medium transition ${statusPillClass(pill.value)}`}
              >
                {pill.label}
              </button>
            ))}

            <span className="text-slate-700 select-none">|</span>

            {sortPills.map((pill) => (
              <button
                key={pill.value}
                onClick={() => setSortKey(pill.value)}
                className={`rounded-full border px-3 py-1 text-sm font-medium transition ${sortPillClass(pill.value)}`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {filteredAgents.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-[22px] border border-line bg-surface py-14 text-center">
              <p className="text-sm text-slate-500">No agents match this filter</p>
              <button
                onClick={() => setStatusFilter('All')}
                className="rounded-full border border-line bg-surface-2 px-4 py-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-300"
              >
                Clear
              </button>
            </div>
          ) : (
            filteredAgents.map((agent) => {
              const st         = STATUS_CONFIG[agent.status]
              const agentLeads = crmLeads.filter((l) => l.assignedAgent === agent.name)
              const hotLeads   = agentLeads.filter((l) => l.urgency === 'critical' || l.urgency === 'high')
              const overdue    = crmFollowUpQueue.filter(
                (f) => f.assignedAgent === agent.name && f.overdueHours > 0,
              )

              return (
                <div key={agent.id} className="rounded-[22px] border border-line bg-surface p-6">

                  {/* Top row */}
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-line bg-surface-2 text-base font-semibold text-slate-300">
                        {agent.initials}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-semibold text-white">{agent.name}</span>
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${st.badge} ${st.text}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                            {st.label}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">{agent.role}</div>
                        <div className="mt-0.5 text-sm text-slate-500">{agent.specialty}</div>
                      </div>
                    </div>

                    <div className="flex gap-5 text-center">
                      {[
                        { label: 'Leads',   value: agent.totalLeads,      color: 'text-white'       },
                        { label: 'Hot',     value: agent.hotLeads,         color: agent.hotLeads > 0 ? 'text-red-400' : 'text-white' },
                        { label: 'Overdue', value: agent.overdueFollowUps, color: agent.overdueFollowUps > 0 ? 'text-gold' : 'text-white' },
                        { label: 'Wins',    value: agent.recentWins,       color: 'text-gold' },
                      ].map((m) => (
                        <div key={m.label}>
                          <div className={`text-xl font-semibold ${m.color}`}>{m.value}</div>
                          <div className="text-[9px] text-slate-600">{m.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Utilization */}
                  <div className="mt-5">
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="text-slate-500">Utilization</span>
                      <span className={
                        agent.utilization >= 85 ? 'text-red-300'
                        : agent.utilization >= 70 ? 'text-gold'
                        : 'text-gold'
                      }>
                        {agent.utilization}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                      <div
                        className={`h-full rounded-full ${
                          agent.utilization >= 85 ? 'bg-red-400'
                          : agent.utilization >= 70 ? 'bg-gold'
                          : 'bg-gold'
                        }`}
                        style={{ width: `${agent.utilization}%` }}
                      />
                    </div>
                  </div>

                  {/* Hot lead chips */}
                  {hotLeads.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {hotLeads.map((l) => (
                        <Link
                          key={l.id}
                          href={`/freehold-intelligence/crm/leads/${l.id}`}
                          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1 text-sm text-slate-400 transition hover:border-gold/25 hover:text-white"
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${l.urgency === 'critical' ? 'bg-red-400' : 'bg-gold'}`} />
                          {l.name.split(' ')[0]}
                          <span className="text-slate-600">· {l.intentScore}</span>
                        </Link>
                      ))}
                      {overdue.length > 0 && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/20 bg-gold/[0.06] px-3 py-1 text-sm text-[#F8E7AE]">
                          {overdue.length} overdue follow-up{overdue.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </section>

      {/* Leaderboard */}
      <section className="mt-12">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Win ranking</div>
        <div className="mt-4 overflow-hidden rounded-[22px] border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">#</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Agent</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 sm:table-cell">Specialty</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Wins</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Hot</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Load</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[...crmAgentRoster]
                .sort((a, b) => b.recentWins - a.recentWins)
                .map((agent, i) => {
                  const st = STATUS_CONFIG[agent.status]
                  return (
                    <tr key={agent.id} className={`transition hover:bg-surface-2 ${i === 0 ? 'bg-gold/[0.03]' : ''}`}>
                      <td className="px-6 py-4">
                        {i === 0
                          ? <Trophy className="h-4 w-4 text-gold" />
                          : <span className="text-sm text-slate-500">{i + 1}</span>
                        }
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface-2 text-sm font-semibold text-slate-300">
                            {agent.initials}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-slate-100">{agent.name}</div>
                            <div className="text-sm text-slate-500">{agent.role}</div>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-4 py-4 text-xs text-slate-500 sm:table-cell">{agent.specialty}</td>
                      <td className="px-4 py-4 text-center text-sm font-semibold text-gold">{agent.recentWins}</td>
                      <td className="px-4 py-4 text-center">
                        <span className={`text-sm font-semibold ${agent.hotLeads > 0 ? 'text-red-400' : 'text-slate-600'}`}>
                          {agent.hotLeads}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`text-xs font-medium ${st.text}`}>{agent.utilization}%</span>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Unassigned leads */}
      {unassigned.length > 0 && (
        <section className="mt-12">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Unassigned inbox</div>
              <h2 className="mt-1 text-lg font-semibold text-white">{unassigned.length} leads waiting for assignment</h2>
            </div>
            <Link
              href="/freehold-intelligence/crm/inbox"
              className="inline-flex items-center gap-1 text-xs text-gold/60 transition hover:text-gold"
            >
              Full inbox <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {unassigned.map((lead) => (
              <div key={lead.id} className="flex items-start justify-between gap-4 rounded-[18px] border border-line bg-surface p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-white">{lead.name}</span>
                    <span className="text-sm text-slate-500">{lead.source}</span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-xs text-slate-400">{lead.aiNote}</p>
                </div>
                <div className="shrink-0 text-right">
                  <div className={`text-sm font-semibold ${lead.intentScore >= 80 ? 'text-gold' : 'text-slate-300'}`}>
                    {lead.intentScore}
                  </div>
                  <div className="text-xs text-slate-500">intent</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}


    </div>
  )
}
