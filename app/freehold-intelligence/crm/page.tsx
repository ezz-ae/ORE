'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Search, X, PhoneCall, MessageCircle, ArrowUpRight,
  ArrowRight, Users, AlertTriangle, Zap, Clock,
  TrendingUp, Target, UserCircle2,
} from 'lucide-react'
import {
  crmLeads,
  type PipelineStage,
  type CRMLeadIntelligence,
} from '@/src/features/freehold-intelligence/server-session'
import { PageHeader, StatCard, EmptyState, Panel, PanelHeader } from '@/components/freehold/ui'
import { useSession } from '@/lib/freehold/use-session'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
}

function intentColor(n: number) {
  if (n >= 80) return 'bg-gold'
  if (n >= 60) return 'bg-amber-400'
  return 'bg-slate-500'
}

// ─── Config ───────────────────────────────────────────────────────────────────

const TEMP_STYLE: Record<string, { label: string; badge: string }> = {
  priority: { label: 'Priority', badge: 'bg-gold/10 text-gold border-gold/25' },
  hot:      { label: 'Hot',      badge: 'bg-red-400/10 text-red-400 border-red-400/20' },
  warm:     { label: 'Warm',     badge: 'bg-amber-400/10 text-amber-400 border-amber-400/20' },
  cold:     { label: 'Cold',     badge: 'bg-surface-2 text-slate-500 border-line-strong' },
}

const STAGE_CONFIG: Record<PipelineStage, { label: string; dot: string; badge: string; flow: string }> = {
  new:         { label: 'New',         dot: 'bg-sky-400',     badge: 'bg-sky-400/10 text-sky-400 border-sky-400/20',              flow: 'text-sky-400'     },
  contacted:   { label: 'Contacted',   dot: 'bg-amber-400',   badge: 'bg-amber-400/10 text-amber-400 border-amber-400/20',         flow: 'text-amber-400'   },
  qualified:   { label: 'Qualified',   dot: 'bg-violet-400',  badge: 'bg-violet-400/10 text-violet-400 border-violet-400/20',      flow: 'text-violet-400'  },
  viewing:     { label: 'Viewing',     dot: 'bg-blue-400',    badge: 'bg-blue-400/10 text-blue-400 border-blue-400/20',            flow: 'text-blue-400'    },
  negotiation: { label: 'Negotiation', dot: 'bg-orange-400',  badge: 'bg-orange-400/10 text-orange-400 border-orange-400/20',      flow: 'text-orange-400'  },
  closed:      { label: 'Closed ✓',    dot: 'bg-emerald-400', badge: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',   flow: 'text-emerald-400' },
  lost:        { label: 'Lost',        dot: 'bg-red-400/50',  badge: 'bg-red-400/[0.06] text-red-400/55 border-red-400/[0.12]',   flow: 'text-slate-600'   },
}

const ACTIVE_STAGES: PipelineStage[] = ['new', 'contacted', 'qualified', 'viewing', 'negotiation']
const ALL_STAGES:    PipelineStage[] = ['new', 'contacted', 'qualified', 'viewing', 'negotiation', 'closed', 'lost']

const BUDGET_MID: Record<string, number> = {
  lead_001: 4_000_000, lead_002: 1_750_000, lead_011: 3_500_000,
  lead_004: 1_800_000, lead_012: 2_500_000, lead_013: 2_000_000, lead_014: 900_000,
  lead_003: 1_600_000, lead_005: 2_500_000, lead_015: 4_000_000, lead_016: 1_200_000,
  lead_017: 5_000_000, lead_018: 3_000_000, lead_019: 2_000_000,
  lead_006: 1_000_000, lead_020: 7_500_000,
}
const PIPELINE_VALUE = Object.values(BUDGET_MID).reduce((s, v) => s + v, 0)

// ─── Agent stats (for manager view) ──────────────────────────────────────────

interface AgentStat {
  name: string
  total: number
  hot: number
  urgent: number
  avgIntent: number
}

function computeAgentStats(): AgentStat[] {
  const map = new Map<string, { scores: number[]; hot: number; urgent: number }>()
  crmLeads.forEach(lead => {
    if (!map.has(lead.assignedAgent)) map.set(lead.assignedAgent, { scores: [], hot: 0, urgent: 0 })
    const a = map.get(lead.assignedAgent)!
    a.scores.push(lead.intentScore)
    if (lead.temperature === 'hot' || lead.temperature === 'priority') a.hot++
    if (lead.urgency === 'critical' || lead.urgency === 'high') a.urgent++
  })
  return Array.from(map.entries())
    .map(([name, a]) => ({
      name,
      total:     a.scores.length,
      hot:       a.hot,
      urgent:    a.urgent,
      avgIntent: Math.round(a.scores.reduce((s, n) => s + n, 0) / a.scores.length),
    }))
    .sort((a, b) => b.total - a.total)
}

const AGENT_STATS = computeAgentStats()

// ─── Component ────────────────────────────────────────────────────────────────

export default function FreeholdCrmPage() {
  const router = useRouter()
  const { user } = useSession()
  const isManager = !!user && MANAGEMENT_ROLES.includes(user.role)

  const [query, setQuery]             = useState('')
  const [stageFilter, setStageFilter] = useState<PipelineStage | 'all'>('all')
  const [mounted, setMounted]         = useState(false)
  useEffect(() => setMounted(true), [])

  const isActive = (l: CRMLeadIntelligence) =>
    l.pipelineStage !== 'closed' && l.pipelineStage !== 'lost'

  // ── Metrics ──
  const newCount       = crmLeads.filter(l => l.pipelineStage === 'new').length
  const urgentCount    = crmLeads.filter(l => isActive(l) && (l.urgency === 'critical' || l.urgency === 'high')).length
  const hotCount       = crmLeads.filter(l => isActive(l) && (l.temperature === 'hot' || l.temperature === 'priority')).length
  const qualifiedCount = crmLeads.filter(l => l.pipelineStage === 'qualified').length
  const closedCount    = crmLeads.filter(l => l.pipelineStage === 'closed').length
  const avgIntent      = Math.round(crmLeads.reduce((s, l) => s + l.intentScore, 0) / crmLeads.length)

  const stageCounts = useMemo(
    () => Object.fromEntries(ALL_STAGES.map(s => [s, crmLeads.filter(l => l.pipelineStage === s).length])) as Record<PipelineStage, number>,
    [],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return crmLeads
      .filter(l => stageFilter === 'all' || l.pipelineStage === stageFilter)
      .filter(l => !q || [l.name, l.projectInterest, l.assignedAgent, l.source].some(f => f.toLowerCase().includes(q)))
      .sort((a, b) => b.intentScore - a.intentScore)
  }, [query, stageFilter])

  const hotLeads = useMemo(() =>
    [...crmLeads]
      .filter(l => isActive(l) && (l.temperature === 'hot' || l.temperature === 'priority'))
      .sort((a, b) => b.intentScore - a.intentScore)
      .slice(0, 5),
    [],
  )

  return (
    <div className="px-4 pb-16 pt-5 sm:px-6">
      <div className="lg:grid lg:grid-cols-[1fr_260px] lg:gap-7 xl:gap-8">

        {/* ══ Main ══ */}
        <div className="min-w-0">

          <PageHeader
            className="mb-6"
            Icon={Users}
            title="CRM"
            subtitle={`${crmLeads.length} leads · AED ${(PIPELINE_VALUE / 1_000_000).toFixed(1)}M pipeline`}
            actions={
              <Link
                href="/freehold-intelligence/crm/leads"
                className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface-2 px-3.5 py-1.5 text-sm text-slate-300 transition hover:border-gold/30 hover:text-white"
              >
                All leads <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            }
          />

          {/* ── KPI row ── */}
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {isManager ? (
              <>
                <StatCard label="Total leads"    value={crmLeads.length} hint="in pipeline"         Icon={Users}         />
                <StatCard label="Urgent"         value={urgentCount}     hint="need action now"
                  delta={urgentCount > 0 ? { value: 'act now', direction: 'down' } : undefined}    Icon={AlertTriangle} />
                <StatCard label="Hot leads"      value={hotCount}        hint="hot + priority"       Icon={Target}        />
                <StatCard label="New this cycle" value={newCount}        hint="awaiting response"
                  delta={{ value: 'assign now', direction: 'up' }}                                  Icon={Zap}           />
                <StatCard label="Pipeline"       value={`AED ${(PIPELINE_VALUE / 1_000_000).toFixed(1)}M`} hint="active estimate" Icon={TrendingUp} />
                <StatCard label="Closed MTD"     value={closedCount}     hint={`avg intent ${avgIntent}`} Icon={Users}    />
              </>
            ) : (
              <>
                <StatCard label="New leads"           value={newCount}       hint="awaiting first response"
                  delta={{ value: 'needs action', direction: 'up' }}         Icon={Zap}           />
                <StatCard label="Urgent follow-ups"   value={urgentCount}    hint="critical + high"
                  delta={urgentCount > 0 ? { value: 'act now', direction: 'down' } : undefined}   Icon={AlertTriangle} />
                <StatCard label="Hot leads"           value={hotCount}       hint="hot + priority"  Icon={Target}        />
                <StatCard label="Qualified"           value={qualifiedCount} hint="in qualification" Icon={TrendingUp}    />
                <StatCard label="Pipeline"            value={`AED ${(PIPELINE_VALUE / 1_000_000).toFixed(1)}M`} hint="active estimate" Icon={TrendingUp} />
                <StatCard label="Avg intent score"    value={avgIntent}      hint={`${closedCount} closed MTD`} Icon={Users} />
              </>
            )}
          </div>

          {/* ── Pipeline flow ── */}
          <div className="mb-5 overflow-hidden rounded-[14px] border border-line bg-surface">
            <div className="flex items-center justify-between px-4 py-3 border-b border-line">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pipeline stages</span>
              {stageFilter !== 'all' && (
                <button
                  onClick={() => setStageFilter('all')}
                  className="flex items-center gap-1 text-xs text-slate-400 transition hover:text-slate-200"
                >
                  <X className="h-3 w-3" /> Clear filter
                </button>
              )}
            </div>
            <div className="flex items-stretch overflow-x-auto">
              {ACTIVE_STAGES.map((stage, idx) => {
                const sc    = STAGE_CONFIG[stage]
                const count = stageCounts[stage]
                const active = stageFilter === stage
                return (
                  <div key={stage} className="flex items-stretch">
                    <button
                      onClick={() => setStageFilter(active ? 'all' : stage)}
                      className={[
                        'flex min-w-[88px] flex-1 flex-col items-center gap-1.5 px-3 py-3.5 transition',
                        active
                          ? `${sc.badge} border border-current`
                          : 'text-slate-400 hover:bg-surface-2',
                      ].join(' ')}
                    >
                      <span className={`h-2 w-2 rounded-full ${sc.dot}`} />
                      <span className={`text-2xl font-bold leading-none tabular-nums ${active ? '' : 'text-slate-200'}`}>
                        {count}
                      </span>
                      <span className={`whitespace-nowrap text-[9px] font-semibold uppercase tracking-wider ${active ? '' : 'text-slate-500'}`}>
                        {sc.label}
                      </span>
                    </button>
                    {idx < ACTIVE_STAGES.length - 1 && (
                      <div className="flex items-center px-0.5">
                        <ArrowRight className="h-3 w-3 text-slate-700" />
                      </div>
                    )}
                  </div>
                )
              })}
              {/* Closed + Lost */}
              <div className="ml-auto flex items-stretch border-l border-line">
                {(['closed', 'lost'] as PipelineStage[]).map((stage) => {
                  const sc    = STAGE_CONFIG[stage]
                  const count = stageCounts[stage]
                  const active = stageFilter === stage
                  return (
                    <button
                      key={stage}
                      onClick={() => setStageFilter(active ? 'all' : stage)}
                      className={[
                        'flex min-w-[72px] flex-col items-center gap-1.5 px-3 py-3.5 transition',
                        active
                          ? `${sc.badge} border border-current`
                          : 'text-slate-400 hover:bg-surface-2',
                      ].join(' ')}
                    >
                      <span className={`h-2 w-2 rounded-full ${sc.dot}`} />
                      <span className={`text-2xl font-bold leading-none tabular-nums ${active ? '' : 'text-slate-500'}`}>
                        {count}
                      </span>
                      <span className={`whitespace-nowrap text-[9px] font-semibold uppercase tracking-wider ${active ? '' : 'text-slate-600'}`}>
                        {sc.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ── Management view: agent performance table ── */}
          {isManager && (
            <div className="mb-5 overflow-hidden rounded-xl border border-line bg-surface">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Agent performance</span>
                <Link
                  href="/freehold-intelligence/crm/assignment"
                  className="text-xs text-gold/70 transition hover:text-gold"
                >
                  Manage assignment →
                </Link>
              </div>
              {/* Header */}
              <div className="hidden grid-cols-[1fr_60px_60px_60px_80px] gap-4 border-b border-line px-4 py-2 sm:grid">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Agent</div>
                <div className="text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">Leads</div>
                <div className="text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">Hot</div>
                <div className="text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">Urgent</div>
                <div className="text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">Avg intent</div>
              </div>
              <div className="divide-y divide-line">
                {AGENT_STATS.map(agent => (
                  <div
                    key={agent.name}
                    className="flex items-center gap-3 px-4 py-3 sm:grid sm:grid-cols-[1fr_60px_60px_60px_80px] sm:gap-4"
                  >
                    {/* Agent name */}
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-[10px] font-bold text-slate-400">
                        {initials(agent.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-200">{agent.name}</div>
                        <div className="text-xs text-slate-500 sm:hidden">
                          {agent.total} leads · {agent.hot} hot · {agent.urgent} urgent
                        </div>
                      </div>
                    </div>
                    {/* Leads */}
                    <div className="hidden text-center text-sm font-semibold tabular-nums text-slate-200 sm:block">
                      {agent.total}
                    </div>
                    {/* Hot */}
                    <div className="hidden text-center sm:block">
                      {agent.hot > 0 ? (
                        <span className="text-sm font-semibold tabular-nums text-red-400">{agent.hot}</span>
                      ) : (
                        <span className="text-sm text-slate-600">—</span>
                      )}
                    </div>
                    {/* Urgent */}
                    <div className="hidden text-center sm:block">
                      {agent.urgent > 0 ? (
                        <span className="text-sm font-semibold tabular-nums text-orange-400">{agent.urgent}</span>
                      ) : (
                        <span className="text-sm text-slate-600">—</span>
                      )}
                    </div>
                    {/* Avg intent */}
                    <div className="hidden flex-col items-center gap-1 sm:flex">
                      <span className="text-sm font-semibold tabular-nums text-slate-200">{agent.avgIntent}</span>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-surface-2">
                        <div className={`h-full rounded-full ${intentColor(agent.avgIntent)}`} style={{ width: `${agent.avgIntent}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Search + result count ── */}
          <div className="mb-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={isManager ? 'Search all leads, agents, projects…' : 'Search leads, projects, agents…'}
                className="w-full rounded-xl border border-line bg-surface py-2.5 pl-9 pr-9 text-sm text-white placeholder-slate-500 outline-none transition focus:border-gold/50"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-300"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="mt-2 px-0.5 text-xs text-slate-500">
              {filtered.length} {filtered.length === 1 ? 'lead' : 'leads'}
              {stageFilter !== 'all' && ` · ${STAGE_CONFIG[stageFilter].label}`}
              {query && ` matching "${query}"`}
            </div>
          </div>

          {/* ── Lead table ── */}
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            <div
              className="hidden items-center gap-4 border-b border-line px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 lg:grid"
              style={{ gridTemplateColumns: '1fr 120px 120px 1fr 80px 60px' }}
            >
              <div>Lead</div>
              <div>Temperature</div>
              <div>Stage</div>
              <div>Project · Budget</div>
              <div>Intent</div>
              <div />
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                Icon={Search}
                title="No leads match this filter"
                description="Try a different stage or clear the search query."
                className="rounded-none border-x-0 border-b-0"
              />
            ) : (
              filtered.map(lead => {
                const ts = TEMP_STYLE[lead.temperature]
                const sc = STAGE_CONFIG[lead.pipelineStage]
                return (
                  <div
                    key={lead.id}
                    className="group flex items-center gap-3 border-b border-line px-4 py-3.5 transition last:border-0 hover:bg-surface-2 lg:grid lg:gap-4"
                    style={{ gridTemplateColumns: '1fr 120px 120px 1fr 80px 60px' }}
                  >
                    {/* Avatar + name */}
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-[10px] font-bold text-gold">
                        {initials(lead.name)}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/freehold-intelligence/crm/leads/${lead.id}`}
                          className="block truncate text-sm font-semibold text-slate-100 transition hover:text-white"
                        >
                          {lead.name}
                        </Link>
                        <div className="flex items-center gap-1.5 truncate text-xs text-slate-500 lg:hidden">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] ${sc.badge}`}>
                            <span className={`h-1 w-1 rounded-full ${sc.dot}`} />
                            {sc.label}
                          </span>
                          <span className="text-slate-600">·</span>
                          <span>{lead.budgetAED}</span>
                        </div>
                      </div>
                    </div>

                    {/* Temperature */}
                    <div className="hidden lg:block">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${ts.badge}`}>
                        {ts.label}
                      </span>
                    </div>

                    {/* Stage */}
                    <div className="hidden lg:block">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${sc.badge}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                        {sc.label}
                      </span>
                    </div>

                    {/* Project + budget */}
                    <div className="hidden min-w-0 lg:block">
                      <div className="truncate text-xs text-slate-400">{lead.projectInterest}</div>
                      <div className="text-xs font-semibold text-gold/70">{lead.budgetAED}</div>
                    </div>

                    {/* Intent score */}
                    <div className="hidden lg:flex lg:flex-col lg:gap-1">
                      <span className="text-sm font-semibold tabular-nums text-slate-200">{lead.intentScore}</span>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-surface-2">
                        <div className={`h-full rounded-full ${intentColor(lead.intentScore)}`} style={{ width: `${lead.intentScore}%` }} />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="ml-auto flex items-center gap-1 lg:ml-0">
                      <button
                        title="Call"
                        onClick={() => lead.phone ? window.open('tel:' + lead.phone) : toast.info('Calling ' + lead.name)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-slate-600 transition hover:border-line-strong hover:text-slate-300"
                      >
                        <PhoneCall className="h-3 w-3" />
                      </button>
                      <button
                        title="WhatsApp"
                        onClick={() => router.push(`/freehold-intelligence/crm/leads/${lead.id}/whatsapp`)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-slate-600 transition hover:border-line-strong hover:text-slate-300"
                      >
                        <MessageCircle className="h-3 w-3" />
                      </button>
                      <Link
                        href={`/freehold-intelligence/crm/leads/${lead.id}`}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-slate-600 transition group-hover:border-gold/30 group-hover:text-gold"
                      >
                        <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                )
              })
            )}
          </div>

        </div>

        {/* ══ Sidebar ══ */}
        <aside className="mt-6 hidden lg:mt-0 lg:block">
          <div className="sticky top-14 space-y-3">

            {/* Hot leads — quick action */}
            <Panel>
              <PanelHeader
                title="Hot leads"
                action={
                  <Link href="/freehold-intelligence/crm/follow-up" className="text-xs text-gold/70 transition hover:text-gold">
                    Follow-up queue →
                  </Link>
                }
              />
              <div className="divide-y divide-line">
                {hotLeads.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-slate-500">No hot leads right now</div>
                ) : (
                  hotLeads.map(lead => {
                    const ts = TEMP_STYLE[lead.temperature]
                    return (
                      <Link
                        key={lead.id}
                        href={`/freehold-intelligence/crm/leads/${lead.id}`}
                        className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2"
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-[9px] font-bold text-gold">
                          {initials(lead.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-slate-200">{lead.name}</div>
                          <div className="text-xs text-slate-500 truncate">{lead.projectInterest}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-medium ${ts.badge}`}>
                            {ts.label}
                          </span>
                          <span className="text-[10px] font-semibold tabular-nums text-slate-400">{lead.intentScore}</span>
                        </div>
                      </Link>
                    )
                  })
                )}
              </div>
            </Panel>

            {/* Intent leaderboard */}
            <Panel>
              <PanelHeader title="Top intent scores" />
              <div className="p-4 space-y-2.5">
                {[...crmLeads]
                  .sort((a, b) => b.intentScore - a.intentScore)
                  .slice(0, 6)
                  .map(l => (
                    <div key={l.id} className="flex items-center gap-2.5">
                      <div className="w-[72px] shrink-0 truncate text-xs text-slate-400">
                        {l.name.split(' ')[0]}
                      </div>
                      <div className="flex-1 overflow-hidden rounded-full bg-surface-2">
                        <div
                          className={`h-1.5 rounded-full ${intentColor(l.intentScore)}`}
                          style={{ width: `${l.intentScore}%` }}
                        />
                      </div>
                      <div className="w-7 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-300">
                        {l.intentScore}
                      </div>
                    </div>
                  ))}
              </div>
            </Panel>

            {/* Manager: agent workload summary */}
            {isManager && (
              <Panel>
                <PanelHeader
                  title="Team workload"
                  action={
                    <Link href="/freehold-intelligence/crm/agents" className="text-xs text-gold/70 transition hover:text-gold">
                      Agents →
                    </Link>
                  }
                />
                <div className="divide-y divide-line">
                  {AGENT_STATS.slice(0, 4).map(agent => (
                    <div key={agent.name} className="flex items-center gap-3 px-4 py-2.5">
                      <UserCircle2 className="h-4 w-4 shrink-0 text-slate-500" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium text-slate-300">{agent.name.split(' ')[0]}</div>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] tabular-nums">
                        <span className="text-slate-400">{agent.total}</span>
                        {agent.hot > 0 && <span className="text-red-400">{agent.hot}🔥</span>}
                        {agent.urgent > 0 && <span className="text-orange-400">{agent.urgent}!</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            {/* Urgent follow-ups shortcut */}
            {urgentCount > 0 && (
              <Link
                href="/freehold-intelligence/crm/follow-up"
                className="flex items-center gap-3 rounded-xl border border-red-400/20 bg-red-400/[0.05] px-4 py-3.5 transition hover:border-red-400/35"
              >
                <Clock className="h-4 w-4 shrink-0 text-red-400" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white">{urgentCount} urgent follow-ups</div>
                  <div className="text-xs text-slate-500">Need action today</div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-600" />
              </Link>
            )}

          </div>
        </aside>

      </div>
    </div>
  )
}
