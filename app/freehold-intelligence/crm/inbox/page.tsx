'use client'

import { useState, useMemo, useEffect } from 'react'
import { Inbox, Clock, AlertCircle, ArrowUpRight, CheckCircle2 } from 'lucide-react'
import { crmAgentRoster } from '@/src/features/freehold-intelligence/server-session'
import type { CRMInboxLead } from '@/src/features/freehold-intelligence/server-session'
import { useLiveLeads } from '@/lib/freehold/use-live-leads'
import { PageHeader, Panel, PanelHeader } from '@/components/freehold/ui'
import { useT } from '@/lib/i18n/provider'

type TFn = (key: string, vars?: Record<string, string | number>) => string

type FilterTab = 'All' | 'Unassigned' | 'Assigned' | 'Contacted'

const FILTER_KEY: Record<FilterTab, string> = {
  All:        'crm.filterAll',
  Unassigned: 'crm.filterUnassigned',
  Assigned:   'crm.filterAssigned',
  Contacted:  'crm.filterContacted',
}

function urgencyTone(u: string) {
  if (u === 'critical') return { labelKey: 'crm.urgency.critical', badge: 'bg-red-400/10 border-red-400/25 text-red-300',         dot: 'bg-red-400'   }
  if (u === 'high')     return { labelKey: 'crm.urgency.high',     badge: 'bg-gold/10 border-gold/25 text-[#F8E7AE]', dot: 'bg-gold' }
  if (u === 'medium')   return { labelKey: 'crm.urgency.medium',   badge: 'bg-sky-500/10 border-sky-400/25 text-sky-200',        dot: 'bg-sky-400'   }
  return                       { labelKey: 'crm.urgency.low',      badge: 'bg-surface-2 border-line-strong text-slate-400',     dot: 'bg-slate-500' }
}

function timeAgo(iso: string, t: TFn) {
  const now  = Date.now()
  const mins = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000))
  if (mins < 60) return t('crm.timeMinAgo', { count: mins })
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return t('crm.timeHrAgo', { count: hrs })
  return t('crm.timeDayAgo', { count: Math.floor(hrs / 24) })
}

const FILTERS: FilterTab[] = ['All', 'Unassigned', 'Assigned', 'Contacted']

export default function CrmInboxPage() {
  const t = useT()
  const { leads } = useLiveLeads()
  const [activeFilter, setActiveFilter] = useState<FilterTab>('All')
  const [assignments,  setAssignments]  = useState<Record<string, string>>({})
  const [contacted,    setContacted]    = useState<Set<string>>(new Set())
  const [justAssigned, setJustAssigned] = useState<string | null>(null)

  const available = crmAgentRoster.filter((a) => a.status === 'available')

  // Real agents (brokers) from the team API — used for actual assignment.
  const [realAgents, setRealAgents] = useState<{ id: string; name: string }[]>([])
  useEffect(() => {
    fetch('/api/freehold/team', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d?.members) return
        const brokers = d.members.filter((m: { dbRole?: string }) => m.dbRole === 'broker')
        setRealAgents((brokers.length ? brokers : d.members).map((m: { id: string; name: string }) => ({ id: m.id, name: m.name })))
      })
      .catch(() => {})
  }, [])

  // Map live leads (filtered to new pipeline stage) to CRMInboxLead shape
  const inboxLeads = useMemo<CRMInboxLead[]>(
    () =>
      leads
        .filter((l) => l.pipelineStage === 'new')
        .map((l) => ({
          id: l.id,
          name: l.name,
          phone: l.phone,
          email: l.email,
          source: l.source,
          intentScore: l.intentScore,
          urgency: l.urgency,
          arrivedAt: l.lastContactAt,
          assignedAgent: l.assignedAgent !== 'Unassigned' ? l.assignedAgent : undefined,
          status: (l.assignedAgent && l.assignedAgent !== 'Unassigned' ? 'assigned' : 'unassigned') as CRMInboxLead['status'],
          aiNote: l.aiSummary,
        })),
    [leads],
  )

  // Derive effective status per lead — session overrides take precedence
  const leadsWithStatus = useMemo(
    () =>
      inboxLeads.map((lead) => ({
        ...lead,
        effectiveStatus: contacted.has(lead.id)
          ? 'contacted'
          : assignments[lead.id]
            ? 'assigned'
            : lead.status,
        effectiveAgent: assignments[lead.id] ?? lead.assignedAgent ?? null,
      })),
    [inboxLeads, assignments, contacted],
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

  function patchLead(leadId: string, body: Record<string, unknown>) {
    return fetch(`/api/freehold/crm/leads/${leadId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).catch(() => null)
  }

  function handleAssign(leadId: string, agentId: string, agentName: string) {
    setAssignments((prev) => ({ ...prev, [leadId]: agentName }))
    setJustAssigned(agentName)
    setTimeout(() => setJustAssigned(null), 2000)
    patchLead(leadId, { assigned_broker_id: agentId })
  }

  function handleContacted(leadId: string) {
    setContacted((prev) => {
      const next = new Set(prev)
      next.add(leadId)
      return next
    })
    patchLead(leadId, { status: 'contacted', last_contact_at: new Date().toISOString() })
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:pt-6">
      <div className="lg:grid lg:grid-cols-[1fr_300px] lg:gap-10">
        <div className="min-w-0">

          <PageHeader
            eyebrow={t('crm.crm')}
            Icon={Inbox}
            title={t('crm.incomingLeads')}
            subtitle={unassignedCount > 0
              ? t('crm.inboxSubtitleUnassigned', { count: inboxLeads.length, unassigned: unassignedCount })
              : t('crm.inboxSubtitle', { count: inboxLeads.length })}
            className="mb-6"
          />

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
                {t(FILTER_KEY[f])}
              </button>
            ))}
          </div>

          {/* Stats strip */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-[18px] border border-gold/15 bg-gold/[0.04] p-5">
              <div className="text-[28px] font-semibold text-gold">{unassignedCount}</div>
              <div className="mt-0.5 text-sm text-slate-400">{t('crm.unassigned')}</div>
            </div>
            <div className="rounded-[18px] border border-line bg-surface p-5">
              <div className="text-[28px] font-semibold text-white">{assignedCount}</div>
              <div className="mt-0.5 text-sm text-slate-400">{t('crm.assigned')}</div>
            </div>
            <div className="rounded-[18px] border border-line bg-surface p-5">
              <div className="text-[28px] font-semibold text-gold">{contactedCount}</div>
              <div className="mt-0.5 text-sm text-slate-400">{t('crm.contacted')}</div>
            </div>
          </div>

          {/* justAssigned flash */}
          {justAssigned && (
            <div className="mt-4 flex items-center gap-2 rounded-[14px] border border-gold/25 bg-gold/[0.08] px-4 py-3 text-sm font-medium text-gold">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {t('crm.assignedTo', { agent: justAssigned })}
            </div>
          )}

          {/* Unassigned cards — shown when filter includes unassigned leads */}
          {(activeFilter === 'All' || activeFilter === 'Unassigned') && unassignedLeads.length > 0 && (
            <section className="mt-12">
              <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-red-300/70">
                <AlertCircle className="h-3.5 w-3.5" /> {t('crm.needsAssignment')}
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
                              {t(tone.labelKey)}
                            </span>
                            <span className="text-sm text-slate-400">{t('crm.intentLabel', { score: lead.intentScore })}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                            <span>{lead.source}</span>
                            <span className="text-slate-600">·</span>
                            <Clock className="h-3 w-3" />
                            <span>{timeAgo(lead.arrivedAt, t)}</span>
                          </div>
                          <p className="mt-2.5 text-sm leading-relaxed text-slate-300">{lead.aiNote}</p>
                        </div>
                        <div className="flex flex-col gap-2 sm:shrink-0">
                          <div className="flex flex-wrap gap-2">
                            {(realAgents.length ? realAgents : available).map((agent) => (
                              <button
                                key={agent.id}
                                onClick={() => handleAssign(lead.id, agent.id, agent.name)}
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
                            <CheckCircle2 className="h-3.5 w-3.5" /> {t('crm.markContacted')}
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
              {activeFilter === 'All' ? t('crm.allLeadsLast48') : t('crm.filterLeads', { filter: t(FILTER_KEY[activeFilter]) })}
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
                          {t(tone.labelKey)}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-slate-400">
                        {lead.source} · {lead.effectiveAgent ?? t('crm.unassigned')} · {timeAgo(lead.arrivedAt, t)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {isContacted ? (
                        <span className="text-xs font-medium text-gold">{t('crm.contacted')}</span>
                      ) : isAssigned ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-400">{t('crm.assigned')}</span>
                          <button
                            onClick={() => handleContacted(lead.id)}
                            className="rounded-full border border-gold/20 bg-gold/[0.05] px-2.5 py-1 text-xs text-gold transition hover:bg-gold/[0.12] active:scale-95"
                          >
                            {t('crm.markContacted')}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs font-medium text-slate-500">{t('crm.unassigned')}</span>
                      )}
                      <ArrowUpRight className="h-3.5 w-3.5 text-slate-600" />
                    </div>
                  </div>
                )
              })}
              {tableLeads.length === 0 && (
                <div className="rounded-[18px] border border-line bg-surface px-5 py-8 text-center text-sm text-slate-400">
                  {t('crm.noLeadsMatchFilter')}
                </div>
              )}
            </div>
          </section>

        </div>

        {/* Sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-[112px] space-y-4">

            <Panel>
              <PanelHeader title={t('crm.availableAgents')} />
              <div className="p-5">
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
            </Panel>


          </div>
        </aside>

      </div>
    </div>
  )
}
