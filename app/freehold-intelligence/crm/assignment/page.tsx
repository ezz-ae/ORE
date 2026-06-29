'use client'

import { useState, useMemo, useEffect } from 'react'
import { UserCog, CheckCircle2, Users, AlertCircle, Clock, TrendingUp } from 'lucide-react'
import { crmAgentRoster, crmInboxLeads } from '@/src/features/freehold-intelligence/server-session'
import type { CRMInboxLead, CRMAgentCapacity } from '@/src/features/freehold-intelligence/server-session'
import { useLiveLeads } from '@/lib/freehold/use-live-leads'
import { useT } from '@/lib/i18n/provider'

type TFn = (key: string, vars?: Record<string, string | number>) => string

// ─── Helpers ────────────────────────────────────────────────────────────────

type UrgencyFilter = 'all' | 'critical' | 'high' | 'medium'

const URGENCY_LABEL_KEY: Record<string, string> = {
  critical: 'crm.urgency.critical',
  high:     'crm.urgency.high',
  medium:   'crm.urgency.medium',
  low:      'crm.urgency.low',
}

function urgencyBadgeClass(u: string) {
  if (u === 'critical') return 'bg-red-400/10 border-red-400/25 text-red-400'
  if (u === 'high')     return 'bg-gold/10 border-gold/25 text-gold'
  if (u === 'medium')   return 'bg-teal-500/10 border-teal-400/25 text-slate-300'
  return 'bg-surface-2 border-line-strong text-slate-400'
}

function agentStatusClass(status: CRMAgentCapacity['status']) {
  if (status === 'available')   return 'bg-gold/10 border-gold/25 text-gold'
  if (status === 'at_capacity') return 'bg-amber-400/10 border-amber-400/25 text-amber-400'
  return 'bg-surface-2 border-line-strong text-slate-400'
}

function agentStatusLabelKey(status: CRMAgentCapacity['status']) {
  if (status === 'available')   return 'crm.statusAvailable'
  if (status === 'at_capacity') return 'crm.statusBusy'
  return 'crm.statusOffline'
}

function agentBarClass(status: CRMAgentCapacity['status']) {
  if (status === 'available')   return 'bg-gold'
  if (status === 'at_capacity') return 'bg-amber-400'
  return 'bg-surface-3'
}

function agentAvatarClass(status: CRMAgentCapacity['status']) {
  if (status === 'available')   return 'from-emerald-500/20 to-emerald-400/5 text-gold'
  if (status === 'at_capacity') return 'from-amber-500/20 to-amber-400/5 text-amber-300'
  return 'from-surface-3 to-surface-2 text-slate-400'
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
    <div className="rounded-[18px] border border-line bg-surface px-5 py-4">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-2 text-[28px] font-semibold leading-none text-white">{value}</div>
      {sub && <div className="mt-1.5 text-sm text-slate-400">{sub}</div>}
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
        'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all',
        agent.status === 'available'
          ? 'border-gold/20 bg-gold/[0.06] text-gold hover:border-emerald-400/40 hover:bg-gold/10'
          : agent.status === 'at_capacity'
          ? 'border-amber-400/20 bg-amber-400/[0.04] text-amber-400/80 hover:border-amber-400/35'
          : 'cursor-not-allowed border-line bg-surface-2 text-slate-500',
      ].join(' ')}
    >
      <span className={[
        'h-1.5 w-1.5 rounded-full',
        agent.status === 'available' ? 'bg-gold' : agent.status === 'at_capacity' ? 'bg-amber-400' : 'bg-surface-3',
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
  onAssign: (leadId: string, agentId: string, agentName: string) => void
}) {
  const t = useT()
  const availableAgents = agents.filter((a) => a.status !== 'overloaded').slice(0, 3)

  if (justAssigned) {
    return (
      <div className="flex items-center gap-3 rounded-[18px] border border-gold/20 bg-gold/[0.04] px-5 py-4 transition-all">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-gold" />
        <div>
          <span className="text-sm font-medium text-white">{lead.name}</span>
          <span className="ml-2 text-sm text-gold">{t('crm.assignedToShort', { name: assignedName ?? '' })}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-[20px] border border-line bg-surface p-5 transition-all hover:border-line-strong">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-white">{lead.name}</span>
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium uppercase tracking-[0.1em] ${urgencyBadgeClass(lead.urgency)}`}>
              {URGENCY_LABEL_KEY[lead.urgency] ? t(URGENCY_LABEL_KEY[lead.urgency]) : lead.urgency}
            </span>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-slate-400">
              {t('crm.intentLabel', { score: lead.intentScore })}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-400">{lead.source}</div>
          <p className="mt-2 max-w-lg text-xs leading-relaxed text-slate-300">{lead.aiNote}</p>
        </div>

        <div className="flex flex-wrap gap-2 sm:shrink-0 sm:flex-col sm:items-end">
          {availableAgents.map((agent) => (
            <AgentButton
              key={agent.id}
              agent={agent}
              onAssign={() => onAssign(lead.id, agent.id, agent.name)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function AgentRosterCard({ agent }: { agent: CRMAgentCapacity }) {
  const t = useT()
  return (
    <div className="rounded-[18px] border border-line bg-ink p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-xs font-semibold ${agentAvatarClass(agent.status)}`}>
          {agent.initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-white truncate">{agent.name}</span>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium uppercase tracking-[0.12em] ${agentStatusClass(agent.status)}`}>
              {t(agentStatusLabelKey(agent.status))}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-slate-400 truncate">{agent.specialty}</div>
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
          <span>{t('crm.load')}</span>
          <span className="font-medium text-slate-300">{agent.utilization}%</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-surface-2">
          <div
            className={`h-full transition-all ${agentBarClass(agent.status)}`}
            style={{ width: `${Math.min(agent.utilization, 100)}%` }}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-xs">
        <div className="text-center">
          <div className="text-sm font-semibold text-white">{agent.totalLeads}</div>
          <div className="text-slate-500">{t('crm.colLeads')}</div>
        </div>
        <div className="text-center">
          <div className={`text-sm font-semibold ${agent.hotLeads > 0 ? 'text-red-400' : 'text-slate-500'}`}>{agent.hotLeads}</div>
          <div className="text-slate-500">{t('crm.colHot')}</div>
        </div>
        <div className="text-center">
          <div className={`text-sm font-semibold ${agent.overdueFollowUps > 0 ? 'text-amber-400' : 'text-slate-500'}`}>{agent.overdueFollowUps}</div>
          <div className="text-slate-500">{t('crm.colOverdue')}</div>
        </div>
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AssignmentPage() {
  const t = useT()
  const [activeUrgency, setActiveUrgency] = useState<UrgencyFilter>('all')
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [justAssigned, setJustAssigned] = useState<Set<string>>(new Set())
  const [liveAgents, setLiveAgents] = useState<CRMAgentCapacity[] | null>(null)
  const { leads } = useLiveLeads()

  useEffect(() => {
    let cancelled = false
    fetch('/api/freehold/crm/agents')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && d?.agents?.length > 0) setLiveAgents(d.agents) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const agentRoster: CRMAgentCapacity[] = liveAgents ?? []

  // Derive inbox leads from live leads: new stage = unassigned, contacted = assigned
  const inboxLeads: CRMInboxLead[] = useMemo(() => {
    if (leads.length === 0) return crmInboxLeads
    return leads
      .filter(l => l.pipelineStage === 'new' || l.pipelineStage === 'contacted')
      .map(l => ({
        id: l.id,
        name: l.name,
        phone: l.phone,
        email: l.email ?? '',
        source: l.source,
        intentScore: l.intentScore,
        urgency: l.urgency,
        arrivedAt: l.lastContactAt,
        assignedAgent: l.assignedAgent,
        status: (l.pipelineStage === 'new' && !l.assignedAgent
          ? 'unassigned'
          : l.pipelineStage === 'contacted' ? 'contacted' : 'assigned') as CRMInboxLead['status'],
        aiNote: l.nextBestAction,
      }))
  }, [leads])

  // Leads that started unassigned in the inbox
  const unassignedLeads = useMemo(
    () =>
      inboxLeads
        .filter((l) => l.status === 'unassigned')
        .sort((a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency]),
    [inboxLeads],
  )

  // Leads already in inbox that have an agent (assigned/contacted)
  const alreadyAssignedLeads = useMemo(
    () => inboxLeads.filter((l) => l.status !== 'unassigned'),
    [inboxLeads],
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
      [...agentRoster].sort((a, b) => {
        const order = { available: 0, at_capacity: 1, overloaded: 2 }
        return order[a.status] - order[b.status]
      }),
    [agentRoster],
  )

  const availableAgentCount = agentRoster.filter((a) => a.status === 'available').length
  const totalUnassigned = unassignedLeads.length
  const totalLeadsAll = leads.length

  function handleAssign(leadId: string, agentId: string, agentName: string) {
    setAssignments((prev) => ({ ...prev, [leadId]: agentName }))
    setJustAssigned((prev) => new Set([...prev, leadId]))

    // Persist the assignment.
    fetch(`/api/freehold/crm/leads/${leadId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigned_broker_id: agentId }),
    }).catch(() => {})

    // Remove from flash set after 2 seconds
    setTimeout(() => {
      setJustAssigned((prev) => {
        const next = new Set(prev)
        next.delete(leadId)
        return next
      })
    }, 2000)
  }

  const urgencyFilters: { key: UrgencyFilter; labelKey: string }[] = [
    { key: 'all', labelKey: 'crm.all' },
    { key: 'critical', labelKey: 'crm.urgency.critical' },
    { key: 'high', labelKey: 'crm.urgency.high' },
    { key: 'medium', labelKey: 'crm.urgency.medium' },
  ]

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:pt-6">

      {/* ── Header ── */}
      <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-gold/85">
        <UserCog className="h-3.5 w-3.5" />
        <span>{t('crm.assignmentEyebrow')}</span>
      </div>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
        {t('crm.agentAssignment')}
      </h1>
      <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-400">
        {t('crm.assignmentSubtitle1', { count: totalLeadsAll })}{' '}
        <span className={totalUnassigned > 0 ? 'text-gold' : 'text-slate-400'}>
          {t('crm.unassignedWaiting', { count: totalUnassigned })}
        </span>{' '}
        {t('crm.waitingForAgent')}
      </p>

      {/* ── Stats strip ── */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={TrendingUp}    label={t('crm.statTotalLeads')}      value={totalLeadsAll}       sub={t('crm.statCrmInbox')} />
        <StatCard icon={AlertCircle}   label={t('crm.unassigned')}          value={totalUnassigned}     sub={totalUnassigned > 0 ? t('crm.statActionNeeded') : t('crm.statQueueClear')} />
        <StatCard icon={Users}         label={t('crm.statAvailableAgents')} value={availableAgentCount} sub={t('crm.statOfTotal', { total: agentRoster.length })} />
        <StatCard icon={Clock}         label={t('crm.statAvgResponse')}     value="4.2h"                sub={t('crm.statTeamAverage')} />
      </div>

      {/* ── Two-column layout ── */}
      <div className="mt-10 grid gap-6 lg:grid-cols-3">

        {/* ── Main: Unassigned queue ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Filter pills */}
          <div className="flex items-center gap-2">
            {urgencyFilters.map(({ key, labelKey }) => (
              <button
                key={key}
                onClick={() => setActiveUrgency(key)}
                className={[
                  'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all',
                  activeUrgency === key
                    ? key === 'critical'
                      ? 'border-red-400/40 bg-red-400/10 text-red-400'
                      : key === 'high'
                      ? 'border-gold/40 bg-gold/10 text-gold'
                      : key === 'medium'
                      ? 'border-teal-400/40 bg-teal-400/10 text-slate-300'
                      : 'border-line-strong bg-surface-2 text-white'
                    : 'border-line bg-transparent text-slate-400 hover:border-line-strong hover:text-slate-300',
                ].join(' ')}
              >
                {t(labelKey)}
              </button>
            ))}
            <span className="ml-auto text-sm text-slate-500">
              {t('crm.inQueue', { count: filteredQueue.filter((l) => !justAssigned.has(l.id)).length })}
            </span>
          </div>

          {/* Queue header */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t('crm.unassignedLeads')}
            </div>
          </div>

          {/* Queue cards */}
          {filteredQueue.length === 0 && (
            <div className="rounded-[20px] border border-line bg-surface px-6 py-10 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-gold/40" />
              <p className="mt-3 text-sm text-slate-400">
                {activeUrgency === 'all' ? t('crm.allLeadsAssigned') : t('crm.noUrgencyLeadsInQueue', { urgency: t(URGENCY_LABEL_KEY[activeUrgency] ?? '') || activeUrgency })}
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
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t('crm.assignedThisSession')}
              </div>
              <div className="space-y-2">
                {recentlyCompleted.map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center gap-3 rounded-[14px] border border-line bg-surface px-4 py-3"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-gold/60" />
                    <span className="text-sm text-slate-300">{lead.name}</span>
                    <span className="text-sm text-slate-500">→</span>
                    <span className="text-sm text-gold/70">{assignments[lead.id]}</span>
                    <span className={`ml-auto rounded-full border px-2 py-0.5 text-xs font-medium ${urgencyBadgeClass(lead.urgency)}`}>
                      {URGENCY_LABEL_KEY[lead.urgency] ? t(URGENCY_LABEL_KEY[lead.urgency]) : lead.urgency}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Already-assigned inbox leads (compact table) */}
          {alreadyAssignedLeads.length > 0 && (
            <div className="mt-6">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t('crm.alreadyAssigned')}
              </div>
              <div className="overflow-hidden rounded-[18px] border border-line bg-surface">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-line">
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{t('crm.colLead')}</th>
                      <th className="hidden px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 sm:table-cell">{t('crm.source')}</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{t('crm.agent')}</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">{t('crm.statusCol')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {alreadyAssignedLeads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-surface-2 transition-colors">
                        <td className="px-5 py-3">
                          <div className="font-medium text-slate-100">{lead.name}</div>
                          <div className="text-xs text-slate-500">{t('crm.intentLabel', { score: lead.intentScore })}</div>
                        </td>
                        <td className="hidden px-5 py-3 text-slate-400 sm:table-cell">{lead.source}</td>
                        <td className="px-5 py-3 text-slate-300">{lead.assignedAgent}</td>
                        <td className="px-5 py-3 text-right">
                          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${urgencyBadgeClass(lead.urgency)}`}>
                            {URGENCY_LABEL_KEY[lead.urgency] ? t(URGENCY_LABEL_KEY[lead.urgency]) : lead.urgency}
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
          <div className="rounded-[22px] border border-line bg-surface p-5">
            <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t('crm.agentRoster')}
            </div>
            <div className="space-y-3">
              {sortedAgents.map((agent) => (
                <AgentRosterCard key={agent.id} agent={agent} />
              ))}
            </div>
          </div>

          {/* Quick legend */}
          <div className="rounded-[18px] border border-line bg-surface px-4 py-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{t('crm.statusLegend')}</div>
            <div className="space-y-2">
              {[
                { labelKey: 'crm.statusAvailable', dot: 'bg-gold', text: 'text-gold' },
                { labelKey: 'crm.statusBusy', dot: 'bg-amber-400', text: 'text-amber-400' },
                { labelKey: 'crm.statusOverloaded', dot: 'bg-red-400', text: 'text-red-400' },
              ].map(({ labelKey, dot, text }) => (
                <div key={labelKey} className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${dot}`} />
                  <span className={`text-sm ${text}`}>{t(labelKey)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
