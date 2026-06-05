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
import { AiPrompt } from '@/components/freehold/ai-prompt'

const STATUS_CONFIG = {
  available:   { dot: 'bg-[#D4AF37]', text: 'text-[#D4AF37]', badge: 'border-[#D4AF37]/20 bg-[#D4AF37]/10', label: 'Available'   },
  at_capacity: { dot: 'bg-[#D4AF37]',   text: 'text-[#F8E7AE]',  badge: 'border-[#D4AF37]/20 bg-[#D4AF37]/10',   label: 'At capacity' },
  overloaded:  { dot: 'bg-red-400',     text: 'text-red-300',     badge: 'border-red-400/20 bg-red-400/10',       label: 'Overloaded'  },
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
      return 'border-white/[0.08] bg-white/[0.03] text-white/40 hover:text-white/65'
    }
    if (value === 'overloaded')  return 'border-red-400/35 bg-red-400/10 text-red-300'
    if (value === 'at_capacity') return 'border-[#D4AF37]/35 bg-[#D4AF37]/10 text-[#D4AF37]'
    if (value === 'available')   return 'border-emerald-400/30 bg-[#D4AF37]/10 text-[#D4AF37]'
    return 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]'
  }

  function sortPillClass(value: SortKey) {
    return value === sortKey
      ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]'
      : 'border-white/[0.08] bg-white/[0.03] text-white/40 hover:text-white/65'
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-10 sm:px-6 sm:pt-14">

      <Link
        href="/freehold-intelligence/apps"
        className="inline-flex items-center gap-1.5 text-[12px] text-white/40 transition hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All apps
      </Link>

      {/* Header */}
      <section className="mt-7">
        <div className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
          <Users className="h-3.5 w-3.5" /> Sales Team
        </div>
        <h1 className="mt-4 text-[36px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[52px]">
          {crmAgentRoster.length} agents.<br />
          <span className="text-white/35">{totalHot} hot leads active.</span>
        </h1>
      </section>

      {/* Overload warning */}
      {overloaded.length > 0 && (
        <div className="mt-8 flex items-start gap-3 rounded-[20px] border border-red-400/20 bg-red-400/[0.05] p-5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <div>
            <div className="text-[13px] font-semibold text-white">
              {overloaded.map((a) => a.name).join(', ')} {overloaded.length === 1 ? 'is' : 'are'} overloaded
            </div>
            <p className="mt-0.5 text-[13px] text-white/55">
              Reassign leads or pause new assignments until utilization drops below 85%.
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Agents',    value: crmAgentRoster.length, color: 'text-white'       },
          { label: 'Available', value: available.length,       color: 'text-[#D4AF37]' },
          { label: 'Hot leads', value: totalHot,               color: 'text-red-300'     },
          { label: 'Overdue',   value: totalOverdue,           color: totalOverdue > 3 ? 'text-red-300' : 'text-[#D4AF37]' },
        ].map((s) => (
          <div key={s.label} className="rounded-[18px] border border-white/[0.08] bg-[#131B2B] p-4 text-center">
            <div className={`text-[28px] font-semibold leading-none ${s.color}`}>{s.value}</div>
            <div className="mt-1.5 text-[12px] text-white/35">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Agent roster */}
      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-[13px] font-medium uppercase tracking-[0.22em] text-white/40">
            Roster
            {statusFilter !== 'All' && (
              <span className="ml-2 normal-case tracking-normal text-white/25">
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
                className={`rounded-full border px-3 py-1 text-[13px] font-medium transition ${statusPillClass(pill.value)}`}
              >
                {pill.label}
              </button>
            ))}

            <span className="text-white/20 select-none">|</span>

            {sortPills.map((pill) => (
              <button
                key={pill.value}
                onClick={() => setSortKey(pill.value)}
                className={`rounded-full border px-3 py-1 text-[13px] font-medium transition ${sortPillClass(pill.value)}`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {filteredAgents.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-[22px] border border-white/[0.08] bg-[#131B2B] py-14 text-center">
              <p className="text-[13px] text-white/35">No agents match this filter</p>
              <button
                onClick={() => setStatusFilter('All')}
                className="rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1.5 text-[13px] font-medium text-white/40 transition hover:text-white/65"
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
                <div key={agent.id} className="rounded-[22px] border border-white/[0.08] bg-[#131B2B] p-6">

                  {/* Top row */}
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-[15px] font-semibold text-white/70">
                        {agent.initials}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[16px] font-semibold text-white">{agent.name}</span>
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[12px] font-medium ${st.badge} ${st.text}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                            {st.label}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[12px] text-white/40">{agent.role}</div>
                        <div className="mt-0.5 text-[13px] text-white/25">{agent.specialty}</div>
                      </div>
                    </div>

                    <div className="flex gap-5 text-center">
                      {[
                        { label: 'Leads',   value: agent.totalLeads,      color: 'text-white'       },
                        { label: 'Hot',     value: agent.hotLeads,         color: agent.hotLeads > 0 ? 'text-red-400' : 'text-white' },
                        { label: 'Overdue', value: agent.overdueFollowUps, color: agent.overdueFollowUps > 0 ? 'text-[#D4AF37]' : 'text-white' },
                        { label: 'Wins',    value: agent.recentWins,       color: 'text-[#D4AF37]' },
                      ].map((m) => (
                        <div key={m.label}>
                          <div className={`text-[20px] font-semibold ${m.color}`}>{m.value}</div>
                          <div className="text-[9px] text-white/30">{m.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Utilization */}
                  <div className="mt-5">
                    <div className="mb-1.5 flex items-center justify-between text-[13px]">
                      <span className="text-white/35">Utilization</span>
                      <span className={
                        agent.utilization >= 85 ? 'text-red-300'
                        : agent.utilization >= 70 ? 'text-[#D4AF37]'
                        : 'text-[#D4AF37]'
                      }>
                        {agent.utilization}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className={`h-full rounded-full ${
                          agent.utilization >= 85 ? 'bg-red-400'
                          : agent.utilization >= 70 ? 'bg-[#D4AF37]'
                          : 'bg-[#D4AF37]'
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
                          className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1 text-[13px] text-white/60 transition hover:border-[#D4AF37]/25 hover:text-white"
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${l.urgency === 'critical' ? 'bg-red-400' : 'bg-[#D4AF37]'}`} />
                          {l.name.split(' ')[0]}
                          <span className="text-white/30">· {l.intentScore}</span>
                        </Link>
                      ))}
                      {overdue.length > 0 && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/[0.06] px-3 py-1 text-[13px] text-[#F8E7AE]">
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
        <div className="text-[13px] font-medium uppercase tracking-[0.22em] text-white/40">Win ranking</div>
        <div className="mt-4 overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#131B2B]">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-white/[0.05]">
                <th className="px-6 py-3 text-left text-[12px] font-medium uppercase tracking-[0.18em] text-white/30">#</th>
                <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-[0.18em] text-white/30">Agent</th>
                <th className="hidden px-4 py-3 text-left text-[12px] font-medium uppercase tracking-[0.18em] text-white/30 sm:table-cell">Specialty</th>
                <th className="px-4 py-3 text-center text-[12px] font-medium uppercase tracking-[0.18em] text-white/30">Wins</th>
                <th className="px-4 py-3 text-center text-[12px] font-medium uppercase tracking-[0.18em] text-white/30">Hot</th>
                <th className="px-6 py-3 text-right text-[12px] font-medium uppercase tracking-[0.18em] text-white/30">Load</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {[...crmAgentRoster]
                .sort((a, b) => b.recentWins - a.recentWins)
                .map((agent, i) => {
                  const st = STATUS_CONFIG[agent.status]
                  return (
                    <tr key={agent.id} className={`transition hover:bg-white/[0.02] ${i === 0 ? 'bg-[#D4AF37]/[0.03]' : ''}`}>
                      <td className="px-6 py-4">
                        {i === 0
                          ? <Trophy className="h-4 w-4 text-[#D4AF37]" />
                          : <span className="text-[13px] text-white/30">{i + 1}</span>
                        }
                      </td>
                      <td className="px-4 py-4">
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
                      <td className="hidden px-4 py-4 text-[12px] text-white/40 sm:table-cell">{agent.specialty}</td>
                      <td className="px-4 py-4 text-center text-[14px] font-semibold text-[#D4AF37]">{agent.recentWins}</td>
                      <td className="px-4 py-4 text-center">
                        <span className={`text-[13px] font-semibold ${agent.hotLeads > 0 ? 'text-red-400' : 'text-white/30'}`}>
                          {agent.hotLeads}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`text-[12px] font-medium ${st.text}`}>{agent.utilization}%</span>
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
              <div className="text-[13px] font-medium uppercase tracking-[0.22em] text-white/40">Unassigned inbox</div>
              <h2 className="mt-1 text-lg font-semibold text-white">{unassigned.length} leads waiting for assignment</h2>
            </div>
            <Link
              href="/freehold-intelligence/crm/inbox"
              className="inline-flex items-center gap-1 text-[12px] text-[#D4AF37]/60 transition hover:text-[#D4AF37]"
            >
              Full inbox <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {unassigned.map((lead) => (
              <div key={lead.id} className="flex items-start justify-between gap-4 rounded-[18px] border border-white/[0.08] bg-[#131B2B] p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-semibold text-white">{lead.name}</span>
                    <span className="text-[13px] text-white/35">{lead.source}</span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-[12px] text-white/50">{lead.aiNote}</p>
                </div>
                <div className="shrink-0 text-right">
                  <div className={`text-[14px] font-semibold ${lead.intentScore >= 80 ? 'text-[#D4AF37]' : 'text-white/70'}`}>
                    {lead.intentScore}
                  </div>
                  <div className="text-[12px] text-white/30">intent</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-12">
        <AiPrompt
          placeholder="Ask about agents, capacity, assignments, wins…"
          suggestions={[
            'Which agent should take the next high-intent lead?',
            'Who has the most overdue follow-ups?',
            'Reassign Ahmad\'s hottest lead to an available agent.',
            'Show team win rate ranking.',
          ]}
        />
      </section>

    </div>
  )
}
