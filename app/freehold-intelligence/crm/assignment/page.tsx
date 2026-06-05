'use client'

import { useState, useMemo } from 'react'
import { UserCog, CheckCircle2, Users, AlertCircle, Clock, TrendingUp } from 'lucide-react'
import { crmLeads, crmAgentRoster, crmInboxLeads } from '@/src/features/freehold-intelligence/server-session'
import type { CRMInboxLead, CRMAgentCapacity } from '@/src/features/freehold-intelligence/server-session'

// ─── Helpers ────────────────────────────────────────────────────────────────

type UrgencyFilter = 'all' | 'critical' | 'high' | 'medium'

function urgencyBadgeClass(u: string) {
  if (u === 'critical') return 'bg-red-400/10 border-red-400/25 text-red-400'
  if (u === 'high')     return 'bg-[#D4AF37]/10 border-[#D4AF37]/25 text-[#D4AF37]'
  if (u === 'medium')   return 'bg-sky-500/10 border-sky-400/25 text-sky-400'
  return 'bg-white/[0.04] border-white/10 text-white/50'
}

function agentStatusClass(status: CRMAgentCapacity['status']) {
  if (status === 'available')   return 'bg-emerald-400/10 border-emerald-400/25 text-emerald-300'
  if (status === 'at_capacity') return 'bg-amber-400/10 border-amber-400/25 text-amber-400'
  return 'bg-white/[0.04] border-white/10 text-white/40'
}

function agentStatusLabel(status: CRMAgentCapacity['status']) {
  if (status === 'available')   return 'Available'
  if (status === 'at_capacity') return 'Busy'
  return 'Offline'
}

function agentBarClass(status: CRMAgentCapacity['status']) {
  if (status === 'available')   return 'bg-emerald-400'
  if (status === 'at_capacity') return 'bg-amber-400'
  return 'bg-white/20'
}

function agentAvatarClass(status: CRMAgentCapacity['status']) {
  if (status === 'available')   return 'from-emerald-500/20 to-emerald-400/5 text-emerald-300'
  if (status === 'at_capacity') return 'from-amber-500/20 to-amber-400/5 text-amber-300'
  return 'from-white/10 to-white/5 text-white/40'
}

const URGENCY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub }: {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
}) {
  return (
    <div className="rounded-[18px] border border-white/[0.06] bg-[#0A0D10] px-5 py-4">
      <div className="flex items-center gap-2 text-white/35">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] font-medium uppercase tracking-[0.18em]">{label}</span>
      </div>
      <div className="mt-2 text-[28px] font-semibold leading-none text-white">{value}</div>
      {sub && <div className="mt-1.5 text-[11px] text-white/35">{sub}</div>}
    </div>
  )
}

function AgentButton({
  agent,
  onAssign,
}: {
  agent: CRMAgentCapacity
  onAssign: () => void
}) {
  return (
    <button
      onClick={onAssign}
      disabled={agent.status === 'overloaded'}
      className={[
        'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[11px] font-medium transition-all',
        agent.status === 'available'
          ? 'border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300 hover:border-emerald-400/40 hover:bg-emerald-400/10'
          : agent.status === 'at_capacity'
          ? 'border-amber-400/20 bg-amber-400/[0.04] text-amber-400/80 hover:border-amber-400/35 hover:bg-amber-400/08'
          : 'cursor-not-allowed border-white/[0.05] bg-white/[0.02] text-white/25',
      ].join(' ')}
    >
      <span className={[
        'h-1.5 w-1.5 rounded-full',
        agent.status === 'available' ? 'bg-emerald-400' : agent.status === 'at_capacity' ? 'bg-amber-400' : 'bg-white/20',
      ].join(' ')} />
      {agent.name}
    </button>
  )
}

function LeadCard({
  lead,
  agents,
  justAssigned,
  assignedName,
  onAssign,
}: {
  lead: CRMInboxLead
  agents: CRMAgentCapacity[]
  justAssigned: boolean
  assignedName: string | null
  onAssign: (leadId: string, agentName: string) => void
}) {
  const availableAgents = agents.filter((a) => a.status !== 'overloaded').slice(0, 3)

  if (justAssigned) {
    return (
      <div className="flex items-center gap-3 rounded-[18px] border border-emerald-400/20 bg-emerald-400/[0.04] px-5 py-4 transition-all">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
        <div>
          <span className="text-[14px] font-medium text-white">{lead.name}</span>
          <span className="ml-2 text-[12px] text-emerald-400">Assigned to {assignedName}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-[20px] border border-white/[0.06] bg-[#0A0D10] p-5 transition-all hover:border-white/[0.10]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[16px] font-semibold text-white">{lead.name}</span>
            <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] ${urgencyBadgeClass(lead.urgency)}`}>
              {lead.urgency}
            </span>
            <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/40">
              Intent {lead.intentScore}
            </span>
          </div>
          <div className="mt-1 text-[12px] text-white/40">{lead.source}</div>
          <p className="mt-2 max-w-lg text-[12px] leading-relaxed text-white/55">{lead.aiNote}</p>
        </div>

        <div className="flex flex-wrap gap-2 sm:shrink-0 sm:flex-col sm:items-end">
          {availableAgents.map((agent) => (
            <AgentButton
              key={agent.id}
              agent={agent}
              onAssign={() => onAssign(lead.id, agent.name)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function AgentRosterCard({ agent }: { agent: CRMAgentCapacity }) {
  return (
    <div className="rounded-[18px] border border-white/[0.06] bg-[#0D1014] p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-[12px] font-semibold ${agentAvatarClass(agent.status)}`}>
          {agent.initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[14px] font-semibold text-white truncate">{agent.name}</span>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] ${agentStatusClass(agent.status)}`}>
              {agentStatusLabel(agent.status)}
            </span>
          </div>
          <div className="mt-0.5 text-[10px] text-white/35 truncate">{agent.specialty}</div>
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[10px] text-white/35">
          <span>Load</span>
          <span className="font-medium text-white/55">{agent.utilization}%</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className={`h-full transition-all ${agentBarClass(agent.status)}`}
            style={{ width: `${Math.min(agent.utilization, 100)}%` }}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-white/[0.04] pt-3 text-[10px]">
        <div className="text-center">
          <div className="text-[15px] font-semibold text-white">{agent.totalLeads}</div>
          <div className="text-white/30">Leads</div>
        </div>
        <div className="text-center">
          <div className={`text-[15px] font-semibold ${agent.hotLeads > 0 ? 'text-red-400' : 'text-white/50'}`}>{agent.hotLeads}</div>
          <div className="text-white/30">Hot</div>
        </div>
        <div className="text-center">
          <div className={`text-[15px] font-semibold ${agent.overdueFollowUps > 0 ? 'text-amber-400' : 'text-white/50'}`}>{agent.overdueFollowUps}</div>
          <div className="text-white/30">Overdue</div>
        </div>
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AssignmentPage() {
  const [activeUrgency, setActiveUrgency] = useState<UrgencyFilter>('all')
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [justAssigned, setJustAssigned] = useState<Set<string>>(new Set())

  // Leads that started unassigned in the inbox
  const unassignedLeads = useMemo(
    () =>
      crmInboxLeads
        .filter((l) => l.status === 'unassigned')
        .sort((a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency]),
    [],
  )

  // Leads already in inbox that have an agent (assigned/contacted)
  const alreadyAssignedLeads = useMemo(
    () => crmInboxLeads.filter((l) => l.status !== 'unassigned'),
    [],
  )

  // Queue = unassigned leads that haven't been freshly assigned in this session
  const queueLeads = useMemo(
    () => unassignedLeads.filter((l) => !assignments[l.id] || justAssigned.has(l.id)),
    [unassignedLeads, assignments, justAssigned],
  )

  // Filtered queue based on urgency pill
  const filteredQueue = useMemo(() => {
    if (activeUrgency === 'all') return queueLeads
    return queueLeads.filter((l) => l.urgency === activeUrgency)
  }, [queueLeads, activeUrgency])

  // Leads that have been assigned and flash period is over
  const recentlyCompleted = useMemo(
    () => unassignedLeads.filter((l) => assignments[l.id] && !justAssigned.has(l.id)),
    [unassignedLeads, assignments, justAssigned],
  )

  // Sorted agent roster: available first, then at_capacity, then overloaded
  const sortedAgents = useMemo(
    () =>
      [...crmAgentRoster].sort((a, b) => {
        const order = { available: 0, at_capacity: 1, overloaded: 2 }
        return order[a.status] - order[b.status]
      }),
    [],
  )

  const availableAgentCount = crmAgentRoster.filter((a) => a.status === 'available').length
  const totalUnassigned = unassignedLeads.length
  const totalLeadsAll = crmLeads.length + crmInboxLeads.length

  function handleAssign(leadId: string, agentName: string) {
    setAssignments((prev) => ({ ...prev, [leadId]: agentName }))
    setJustAssigned((prev) => new Set([...prev, leadId]))

    // Remove from flash set after 2 seconds
    setTimeout(() => {
      setJustAssigned((prev) => {
        const next = new Set(prev)
        next.delete(leadId)
        return next
      })
    }, 2000)
  }

  const urgencyFilters: { key: UrgencyFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'critical', label: 'Critical' },
    { key: 'high', label: 'High' },
    { key: 'medium', label: 'Medium' },
  ]

  return (
    <div className="mx-auto max-w-7xl px-4 pb-32 pt-10 sm:px-6 lg:pt-14">

      {/* ── Header ── */}
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
        <UserCog className="h-3.5 w-3.5" />
        <span>CRM · Assignment</span>
      </div>
      <h1 className="mt-4 text-[36px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[48px]">
        Agent Assignment
      </h1>
      <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/50">
        {totalLeadsAll} total leads across team &mdash;{' '}
        <span className={totalUnassigned > 0 ? 'text-[#D4AF37]' : 'text-white/50'}>
          {totalUnassigned} unassigned
        </span>{' '}
        waiting for an agent.
      </p>

      {/* ── Stats strip ── */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={TrendingUp}    label="Total leads"      value={totalLeadsAll}       sub="CRM + inbox" />
        <StatCard icon={AlertCircle}   label="Unassigned"       value={totalUnassigned}     sub={totalUnassigned > 0 ? 'Action needed' : 'Queue clear'} />
        <StatCard icon={Users}         label="Available agents" value={availableAgentCount} sub={`of ${crmAgentRoster.length} total`} />
        <StatCard icon={Clock}         label="Avg response"     value="4.2h"                sub="Team average" />
      </div>

      {/* ── Two-column layout ── */}
      <div className="mt-10 grid gap-6 lg:grid-cols-3">

        {/* ── Main: Unassigned queue ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Filter pills */}
          <div className="flex items-center gap-2">
            {urgencyFilters.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveUrgency(key)}
                className={[
                  'rounded-full border px-3.5 py-1.5 text-[11px] font-medium transition-all',
                  activeUrgency === key
                    ? key === 'critical'
                      ? 'border-red-400/40 bg-red-400/10 text-red-400'
                      : key === 'high'
                      ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]'
                      : key === 'medium'
                      ? 'border-sky-400/40 bg-sky-400/10 text-sky-400'
                      : 'border-white/20 bg-white/[0.06] text-white'
                    : 'border-white/[0.06] bg-transparent text-white/40 hover:border-white/[0.12] hover:text-white/60',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
            <span className="ml-auto text-[11px] text-white/30">
              {filteredQueue.filter((l) => !justAssigned.has(l.id)).length} in queue
            </span>
          </div>

          {/* Queue header */}
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/30">
              Unassigned leads
            </div>
          </div>

          {/* Queue cards */}
          {filteredQueue.length === 0 && (
            <div className="rounded-[20px] border border-white/[0.04] bg-[#0A0D10] px-6 py-10 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400/40" />
              <p className="mt-3 text-[14px] text-white/35">
                {activeUrgency === 'all' ? 'All leads have been assigned.' : `No ${activeUrgency} leads in queue.`}
              </p>
            </div>
          )}

          <div className="space-y-3">
            {filteredQueue.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                agents={sortedAgents}
                justAssigned={justAssigned.has(lead.id)}
                assignedName={assignments[lead.id] ?? null}
                onAssign={handleAssign}
              />
            ))}
          </div>

          {/* Recently assigned (this session) */}
          {recentlyCompleted.length > 0 && (
            <div className="mt-2">
              <div className="mb-3 text-[10px] font-medium uppercase tracking-[0.2em] text-white/25">
                Assigned this session
              </div>
              <div className="space-y-2">
                {recentlyCompleted.map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center gap-3 rounded-[14px] border border-white/[0.04] bg-[#0A0D10] px-4 py-3"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400/60" />
                    <span className="text-[13px] text-white/60">{lead.name}</span>
                    <span className="text-[11px] text-white/30">→</span>
                    <span className="text-[13px] text-emerald-300/70">{assignments[lead.id]}</span>
                    <span className={`ml-auto rounded-full border px-2 py-0.5 text-[9px] font-medium ${urgencyBadgeClass(lead.urgency)}`}>
                      {lead.urgency}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Already-assigned inbox leads (compact table) */}
          {alreadyAssignedLeads.length > 0 && (
            <div className="mt-6">
              <div className="mb-3 text-[10px] font-medium uppercase tracking-[0.2em] text-white/25">
                Already assigned
              </div>
              <div className="overflow-hidden rounded-[18px] border border-white/[0.06] bg-[#0A0D10]">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-white/[0.05]">
                      <th className="px-5 py-3 text-left text-[9px] font-medium uppercase tracking-[0.18em] text-white/25">Lead</th>
                      <th className="hidden px-5 py-3 text-left text-[9px] font-medium uppercase tracking-[0.18em] text-white/25 sm:table-cell">Source</th>
                      <th className="px-5 py-3 text-left text-[9px] font-medium uppercase tracking-[0.18em] text-white/25">Agent</th>
                      <th className="px-5 py-3 text-right text-[9px] font-medium uppercase tracking-[0.18em] text-white/25">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {alreadyAssignedLeads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-white/[0.015] transition-colors">
                        <td className="px-5 py-3">
                          <div className="font-medium text-white/80">{lead.name}</div>
                          <div className="text-[10px] text-white/30">Intent {lead.intentScore}</div>
                        </td>
                        <td className="hidden px-5 py-3 text-white/40 sm:table-cell">{lead.source}</td>
                        <td className="px-5 py-3 text-white/60">{lead.assignedAgent}</td>
                        <td className="px-5 py-3 text-right">
                          <span className={`rounded-full border px-2 py-0.5 text-[9px] font-medium ${urgencyBadgeClass(lead.urgency)}`}>
                            {lead.urgency}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── Sidebar: Agent roster ── */}
        <div className="space-y-4">
          <div className="rounded-[22px] border border-white/[0.06] bg-[#0A0D10] p-5">
            <div className="mb-4 text-[10px] font-medium uppercase tracking-[0.2em] text-white/30">
              Agent roster
            </div>
            <div className="space-y-3">
              {sortedAgents.map((agent) => (
                <AgentRosterCard key={agent.id} agent={agent} />
              ))}
            </div>
          </div>

          {/* Quick legend */}
          <div className="rounded-[18px] border border-white/[0.04] bg-[#0A0D10]/60 px-4 py-4">
            <div className="mb-3 text-[9px] font-medium uppercase tracking-[0.2em] text-white/20">Status legend</div>
            <div className="space-y-2">
              {[
                { label: 'Available', dot: 'bg-emerald-400', text: 'text-emerald-300' },
                { label: 'Busy', dot: 'bg-amber-400', text: 'text-amber-400' },
                { label: 'Overloaded', dot: 'bg-red-400', text: 'text-red-400' },
              ].map(({ label, dot, text }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${dot}`} />
                  <span className={`text-[11px] ${text}`}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
