'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { UserCheck, Phone, MessageSquare, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react'
import { crmAgentRoster } from '@/src/features/freehold-intelligence/server-session'
import { AiPrompt } from '@/components/freehold/ai-prompt'

const STATUS_CONFIG = {
  available:    { label: 'Available',    classes: 'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/20' },
  at_capacity:  { label: 'At capacity',  classes: 'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/25'       },
  overloaded:   { label: 'Overloaded',   classes: 'bg-red-400/10 text-red-300 border-red-400/20'             },
}

type StatusFilter = 'All' | 'available' | 'at_capacity' | 'overloaded'
const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'All',          label: 'All'          },
  { key: 'available',    label: 'Available'    },
  { key: 'at_capacity',  label: 'At capacity'  },
  { key: 'overloaded',   label: 'Overloaded'   },
]

type SortKey = 'leads' | 'utilization' | 'wins' | 'overdue'
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'leads',       label: 'Leads'       },
  { key: 'utilization', label: 'Utilization' },
  { key: 'wins',        label: 'Wins'        },
  { key: 'overdue',     label: 'Overdue'     },
]

export default function CrmAgentsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')
  const [sortBy, setSortBy] = useState<SortKey>('utilization')
  const [contacted, setContacted] = useState<Set<string>>(new Set())
  const [flash, setFlash] = useState<string | null>(null)

  const agents = crmAgentRoster
  const totalLeads   = agents.reduce((s, a) => s + a.totalLeads, 0)
  const totalOverdue = agents.reduce((s, a) => s + a.overdueFollowUps, 0)
  const overloaded   = agents.filter((a) => a.status === 'overloaded')
  const topPerformer = useMemo(() => [...agents].sort((a, b) => b.recentWins - a.recentWins)[0], [])

  const filtered = useMemo(() => {
    const base = statusFilter === 'All' ? agents : agents.filter((a) => a.status === statusFilter)
    return [...base].sort((a, b) => {
      if (sortBy === 'leads')       return b.totalLeads - a.totalLeads
      if (sortBy === 'utilization') return b.utilization - a.utilization
      if (sortBy === 'wins')        return b.recentWins - a.recentWins
      if (sortBy === 'overdue')     return b.overdueFollowUps - a.overdueFollowUps
      return 0
    })
  }, [statusFilter, sortBy])

  function handleContact(agentId: string, agentName: string, mode: 'call' | 'message') {
    setContacted((prev) => new Set([...prev, agentId]))
    setFlash(`${mode === 'call' ? 'Calling' : 'Messaging'} ${agentName}…`)
    setTimeout(() => setFlash(null), 2500)
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:pt-6">
      <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-10 xl:grid-cols-[1fr_380px] xl:gap-14">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-[#D4AF37]/85">
            <UserCheck className="h-3.5 w-3.5" /> Agents
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-100">
            Sales team<br/><span className="text-slate-500">performance.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-slate-400">
            {agents.length} active advisors · {totalLeads} live leads · {totalOverdue} overdue follow-up{totalOverdue !== 1 ? 's' : ''}. Watch utilization and time-to-close.
          </p>

          {overloaded.length > 0 && (
            <div className="mt-7 flex items-start gap-3 rounded-xl border border-red-400/20 bg-red-400/[0.04] p-4">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <p className="text-sm text-slate-300">
                <span className="font-semibold text-white">{overloaded.map((a) => a.name).join(', ')}</span>
                {' '}
                {overloaded.length === 1 ? 'is' : 'are'} overloaded. Redistribute before assigning new leads.
              </p>
            </div>
          )}

          {/* Filter + sort controls */}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {STATUS_FILTERS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  className={[
                    'rounded-full px-3.5 py-1.5 text-xs font-medium transition',
                    statusFilter === key
                      ? 'bg-[#D4AF37] text-[#0D1117]'
                      : 'border border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Sort:</span>
              {SORT_OPTIONS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSortBy(key)}
                  className={[
                    'rounded px-2 py-0.5 transition',
                    sortBy === key ? 'text-white' : 'text-slate-500 hover:text-slate-300',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="mt-10 py-16 text-center text-[14px] text-slate-500">No agents match this filter.</div>
          ) : (
            <div className="mt-6 space-y-4">
              {filtered.map((agent) => {
                const st = STATUS_CONFIG[agent.status]
                const wasContacted = contacted.has(agent.id)
                return (
                  <div key={agent.id} className="rounded-[24px] border border-slate-800 bg-slate-900 p-5 transition hover:border-slate-700 sm:p-7">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#D4AF37]/20 to-[#D4AF37]/5 text-sm font-semibold text-[#D4AF37]">
                          {agent.initials}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <h3 className="text-[18px] font-semibold text-white">{agent.name}</h3>
                            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${st.classes}`}>{st.label}</span>
                            {wasContacted && (
                              <span className="flex items-center gap-1 rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/[0.06] px-2 py-0.5 text-xs text-[#D4AF37]">
                                <CheckCircle className="h-3 w-3" /> Contacted
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-slate-400">{agent.role} · {agent.specialty}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-5 sm:gap-6">
                        <div className="text-center">
                          <div className="text-[22px] font-semibold text-white">{agent.totalLeads}</div>
                          <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Leads</div>
                        </div>
                        <div className="text-center">
                          <div className={`text-[22px] font-semibold ${agent.hotLeads > 0 ? 'text-red-400' : 'text-slate-500'}`}>{agent.hotLeads}</div>
                          <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Hot</div>
                        </div>
                        <div className="text-center">
                          <div className={`text-[22px] font-semibold ${agent.overdueFollowUps > 0 ? 'text-orange-400' : 'text-slate-500'}`}>{agent.overdueFollowUps}</div>
                          <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Overdue</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[22px] font-semibold text-[#D4AF37]">{agent.recentWins}</div>
                          <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Wins</div>
                        </div>
                      </div>
                    </div>

                    {/* Utilization bar */}
                    <div className="mt-5 border-t border-slate-800 pt-4">
                      <div className="flex items-center justify-between text-sm text-slate-400">
                        <span>Utilization</span>
                        <span className={agent.utilization >= 90 ? 'text-red-300' : agent.utilization >= 75 ? 'text-[#D4AF37]' : 'text-[#D4AF37]'}>
                          {agent.utilization}%
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className={`h-full rounded-full ${agent.utilization >= 90 ? 'bg-red-400' : agent.utilization >= 75 ? 'bg-[#D4AF37]' : 'bg-[#D4AF37]'}`}
                          style={{ width: `${agent.utilization}%` }}
                        />
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <Link
                          href="/freehold-intelligence/crm/assignment"
                          className="text-sm text-[#D4AF37]/60 transition hover:text-[#D4AF37]"
                        >
                          View assignments
                        </Link>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleContact(agent.id, agent.name, 'call')}
                            className="inline-flex h-7 items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/50 px-3 text-sm font-medium text-slate-400 transition hover:bg-slate-700 active:scale-95"
                          >
                            <Phone className="h-3 w-3" /> Call
                          </button>
                          <button
                            onClick={() => handleContact(agent.id, agent.name, 'message')}
                            className="inline-flex h-7 items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/50 px-3 text-sm font-medium text-slate-400 transition hover:bg-slate-700 active:scale-95"
                          >
                            <MessageSquare className="h-3 w-3" /> Message
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <section className="mt-14">
            <AiPrompt
              placeholder="Ask about agent performance, capacity, follow-ups…"
              suggestions={[
                'Which agent needs coaching right now?',
                'Who should I reassign overloaded leads to?',
                'What is the team average follow-up delay?',
              ]}
            />
          </section>
        </div>

        {/* Sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-[112px] space-y-5">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                <TrendingUp className="h-3 w-3" /> Team load
              </div>
              <div className="mt-3 text-[34px] font-semibold text-white">{totalLeads}</div>
              <div className="mt-1 text-xs text-slate-400">leads across {agents.length} agents</div>
            </div>

            {topPerformer && (
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Top performer</div>
                <div className="mt-3 text-[18px] font-semibold text-white">{topPerformer.name}</div>
                <div className="mt-1 text-xs text-slate-400">{topPerformer.recentWins} recent wins · {topPerformer.specialty.split(' · ')[0]}</div>
              </div>
            )}

            {overloaded.length > 0 && (
              <div className="rounded-xl border border-[#D4AF37]/20 bg-gradient-to-br from-[#D4AF37]/[0.05] to-transparent p-5">
                <div className="text-xs font-medium uppercase tracking-[0.18em] text-[#D4AF37]">Coaching flag</div>
                <div className="mt-3 text-[14px] font-semibold text-white">{overloaded[0].name} — overloaded</div>
                <div className="mt-2 text-xs leading-relaxed text-slate-400">
                  {overloaded[0].utilization}% utilization · {overloaded[0].overdueFollowUps} overdue. Redistribute before assigning new leads.
                </div>
              </div>
            )}

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Avg. time-to-close</div>
              <div className="mt-3 text-[34px] font-semibold text-white">18d</div>
              <div className="mt-1 text-xs text-slate-400">target: &lt;21 days</div>
            </div>
          </div>
        </aside>
      </div>

      {/* Flash banner */}
      {flash && (
        <div className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-full border border-[#D4AF37]/25 bg-slate-900 px-5 py-2.5 text-sm font-medium text-[#D4AF37] shadow-xl">
          {flash}
        </div>
      )}
    </div>
  )
}
