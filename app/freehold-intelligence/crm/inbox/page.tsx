'use client'

import { useState, useMemo } from 'react'
import { Inbox, Clock, AlertCircle, ArrowUpRight, CheckCircle2 } from 'lucide-react'
import { crmInboxLeads, crmAgentRoster } from '@/src/features/freehold-intelligence/server-session'
import { AiPrompt } from '@/components/freehold/ai-prompt'

type FilterTab = 'All' | 'Unassigned' | 'Assigned' | 'Contacted'

function urgencyTone(u: string) {
  if (u === 'critical') return { label: 'Critical', badge: 'bg-red-400/10 border-red-400/25 text-red-300',         dot: 'bg-red-400'   }
  if (u === 'high')     return { label: 'High',     badge: 'bg-gold/10 border-gold/25 text-[#F8E7AE]', dot: 'bg-gold' }
  if (u === 'medium')   return { label: 'Medium',   badge: 'bg-sky-500/10 border-sky-400/25 text-sky-200',        dot: 'bg-sky-400'   }
  return                       { label: 'Low',      badge: 'bg-surface-2 border-line-strong text-slate-400',     dot: 'bg-slate-500' }
}

function timeAgo(iso: string) {
  const now  = new Date('2026-06-04T12:00:00+04:00').getTime()
  const mins = Math.floor((now - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const FILTERS: FilterTab[] = ['All', 'Unassigned', 'Assigned', 'Contacted']

export default function CrmInboxPage() {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('All')
  const [assignments,  setAssignments]  = useState<Record<string, string>>({})
  const [contacted,    setContacted]    = useState<Set<string>>(new Set())
  const [justAssigned, setJustAssigned] = useState<string | null>(null)

  const available = crmAgentRoster.filter((a) => a.status === 'available')

  // Derive effective status per lead — session overrides take precedence
  const leadsWithStatus = useMemo(
    () =>
      crmInboxLeads.map((lead) => ({
        ...lead,
        effectiveStatus: contacted.has(lead.id)
          ? 'contacted'
          : assignments[lead.id]
            ? 'assigned'
            : lead.status,
        effectiveAgent: assignments[lead.id] ?? lead.assignedAgent ?? null,
      })),
    [assignments, contacted],
  )

  // Live stat counts
  const unassignedCount = leadsWithStatus.filter((l) => l.effectiveStatus === 'unassigned').length
  const assignedCount   = leadsWithStatus.filter((l) => l.effectiveStatus === 'assigned').length
  const contactedCount  = leadsWithStatus.filter((l) => l.effectiveStatus === 'contacted').length

  // Leads that still need an agent
  const unassignedLeads = leadsWithStatus.filter((l) => l.effectiveStatus === 'unassigned')

  // Leads shown in the "All leads" table, filtered by active tab
  const filteredLeads = useMemo(() => {
    if (activeFilter === 'All')        return leadsWithStatus
    if (activeFilter === 'Unassigned') return leadsWithStatus.filter((l) => l.effectiveStatus === 'unassigned')
    if (activeFilter === 'Assigned')   return leadsWithStatus.filter((l) => l.effectiveStatus === 'assigned')
    if (activeFilter === 'Contacted')  return leadsWithStatus.filter((l) => l.effectiveStatus === 'contacted')
    return leadsWithStatus
  }, [leadsWithStatus, activeFilter])

  // Table hides unassigned when "All" since the card section already shows them
  const tableLeads =
    activeFilter === 'All'
      ? filteredLeads.filter((l) => l.effectiveStatus !== 'unassigned')
      : filteredLeads

  function handleAssign(leadId: string, agentName: string) {
    setAssignments((prev) => ({ ...prev, [leadId]: agentName }))
    setJustAssigned(agentName)
    setTimeout(() => setJustAssigned(null), 2000)
  }

  function handleContacted(leadId: string) {
    setContacted((prev) => {
      const next = new Set(prev)
      next.add(leadId)
      return next
    })
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:pt-6">
      <div className="lg:grid lg:grid-cols-[1fr_300px] lg:gap-10">
        <div className="min-w-0">

          {/* Eyebrow */}
          <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-gold/85">
            <Inbox className="h-3.5 w-3.5" /> Inbox
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
            New leads<br /><span className="text-slate-400">arriving.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-400">
            {crmInboxLeads.length} leads in the last 48 hours.{' '}
            {unassignedCount > 0 && (
              <span className="text-gold">{unassignedCount} still unassigned.</span>
            )}
          </p>

          {/* Filter pills */}
          <div className="mt-6 flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
                  activeFilter === f
                    ? 'border border-gold/40 bg-gold/15 text-gold'
                    : 'border border-line bg-surface-2 text-slate-400 hover:border-line-strong hover:text-slate-300'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Stats strip */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-[18px] border border-gold/15 bg-gold/[0.04] p-5">
              <div className="text-[28px] font-semibold text-gold">{unassignedCount}</div>
              <div className="mt-0.5 text-sm text-slate-400">Unassigned</div>
            </div>
            <div className="rounded-[18px] border border-line bg-surface p-5">
              <div className="text-[28px] font-semibold text-white">{assignedCount}</div>
              <div className="mt-0.5 text-sm text-slate-400">Assigned</div>
            </div>
            <div className="rounded-[18px] border border-line bg-surface p-5">
              <div className="text-[28px] font-semibold text-gold">{contactedCount}</div>
              <div className="mt-0.5 text-sm text-slate-400">Contacted</div>
            </div>
          </div>

          {/* justAssigned flash */}
          {justAssigned && (
            <div className="mt-4 flex items-center gap-2 rounded-[14px] border border-gold/25 bg-gold/[0.08] px-4 py-3 text-sm font-medium text-gold">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Assigned to {justAssigned}
            </div>
          )}

          {/* Unassigned cards — shown when filter includes unassigned leads */}
          {(activeFilter === 'All' || activeFilter === 'Unassigned') && unassignedLeads.length > 0 && (
            <section className="mt-12">
              <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-red-300/70">
                <AlertCircle className="h-3.5 w-3.5" /> Needs assignment
              </div>
              <div className="mt-4 space-y-3">
                {unassignedLeads.map((lead) => {
                  const tone = urgencyTone(lead.urgency)
                  return (
                    <div
                      key={lead.id}
                      className="rounded-[22px] border border-gold/15 bg-gold/[0.03] p-5 sm:p-6"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-lg font-semibold text-white">{lead.name}</span>
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-medium ${tone.badge}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                              {tone.label}
                            </span>
                            <span className="text-sm text-slate-400">Intent {lead.intentScore}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                            <span>{lead.source}</span>
                            <span className="text-slate-600">·</span>
                            <Clock className="h-3 w-3" />
                            <span>{timeAgo(lead.arrivedAt)}</span>
                          </div>
                          <p className="mt-2.5 text-sm leading-relaxed text-slate-300">{lead.aiNote}</p>
                        </div>
                        <div className="flex flex-col gap-2 sm:shrink-0">
                          <div className="flex flex-wrap gap-2">
                            {available.map((agent) => (
                              <button
                                key={agent.id}
                                onClick={() => handleAssign(lead.id, agent.name)}
                                className="inline-flex items-center rounded-full border border-line-strong bg-surface-2 px-3.5 py-2 text-xs text-slate-300 transition hover:border-gold/30 hover:bg-gold/[0.06] hover:text-white active:scale-95"
                              >
                                → {agent.name}
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={() => handleContacted(lead.id)}
                            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-gold/25 bg-gold/[0.06] px-3.5 py-2 text-xs font-medium text-gold transition hover:bg-gold/[0.12] active:scale-95"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Mark contacted
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* All leads table */}
          <section className="mt-12">
            <div className="text-sm font-medium uppercase tracking-wider text-slate-400">
              {activeFilter === 'All' ? 'All leads · last 48h' : `${activeFilter} leads`}
              <span className="ml-2 text-slate-500">({tableLeads.length})</span>
            </div>
            <div className="mt-4 space-y-2">
              {tableLeads.map((lead) => {
                const tone        = urgencyTone(lead.urgency)
                const isContacted = lead.effectiveStatus === 'contacted'
                const isAssigned  = lead.effectiveStatus === 'assigned'
                return (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between gap-4 rounded-[18px] border border-line bg-surface px-5 py-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-white">{lead.name}</span>
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${tone.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                          {tone.label}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-slate-400">
                        {lead.source} · {lead.effectiveAgent ?? 'Unassigned'} · {timeAgo(lead.arrivedAt)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {isContacted ? (
                        <span className="text-xs font-medium text-gold">Contacted</span>
                      ) : isAssigned ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-400">Assigned</span>
                          <button
                            onClick={() => handleContacted(lead.id)}
                            className="rounded-full border border-gold/20 bg-gold/[0.05] px-2.5 py-1 text-xs text-gold transition hover:bg-gold/[0.12] active:scale-95"
                          >
                            Mark contacted
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs font-medium text-slate-500">Unassigned</span>
                      )}
                      <ArrowUpRight className="h-3.5 w-3.5 text-slate-600" />
                    </div>
                  </div>
                )
              })}
              {tableLeads.length === 0 && (
                <div className="rounded-[18px] border border-line bg-surface px-5 py-8 text-center text-sm text-slate-400">
                  No leads match this filter.
                </div>
              )}
            </div>
          </section>

        </div>

        {/* Sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-[112px] space-y-4">

            <div className="rounded-[20px] border border-line bg-surface p-5">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Available agents</div>
              <div className="space-y-3">
                {available.map((agent) => (
                  <div key={agent.id} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-gold/20 to-gold/5 text-sm font-semibold text-gold">
                        {agent.initials}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">{agent.name}</div>
                        <div className="text-xs text-slate-400">{agent.totalLeads} leads</div>
                      </div>
                    </div>
                    <span className="text-sm text-gold">{agent.utilization}%</span>
                  </div>
                ))}
              </div>
            </div>

            <AiPrompt
              placeholder="Ask about new leads…"
              suggestions={[
                'Who should handle the critical referral?',
                'Which source sent the highest-intent lead today?',
                'Assign all unassigned leads to best-fit agents.',
              ]}
            />

          </div>
        </aside>

      </div>
    </div>
  )
}
