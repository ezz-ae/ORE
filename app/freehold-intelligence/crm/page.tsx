'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Search, X, PhoneCall, MessageCircle, ArrowUpRight,
  RefreshCw, ChevronRight, Users, Filter,
} from 'lucide-react'
import {
  crmLeads,
  integrationSyncStatuses,
  type PipelineStage,
  type CRMLeadIntelligence,
} from '@/src/features/freehold-intelligence/server-session'
import { AiPrompt } from '@/components/freehold/ai-prompt'
import { PageHeader, EmptyState, Panel, PanelHeader, buttonClass } from '@/components/freehold/ui'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 60)  return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h`
  return `${Math.floor(h / 24)}d`
}

// ─── Config ───────────────────────────────────────────────────────────────────

const TEMP_STYLE: Record<string, { label: string; badge: string }> = {
  priority: { label: '★ Priority', badge: 'bg-gold/10 text-gold border-gold/25' },
  hot:      { label: '● Hot',      badge: 'bg-red-400/10 text-red-400 border-red-400/20'         },
  warm:     { label: '◎ Warm',     badge: 'bg-amber-400/10 text-amber-400 border-amber-400/20'   },
  cold:     { label: '○ Cold',     badge: 'bg-surface-2 text-slate-500 border-line-strong'      },
}

const STAGE_CONFIG: Record<PipelineStage, { label: string; dot: string; badge: string }> = {
  new:         { label: 'New',         dot: 'bg-sky-400',     badge: 'bg-sky-400/10 text-sky-400 border-sky-400/20'             },
  contacted:   { label: 'Contacted',   dot: 'bg-amber-400',   badge: 'bg-amber-400/10 text-amber-400 border-amber-400/20'       },
  qualified:   { label: 'Qualified',   dot: 'bg-violet-400',  badge: 'bg-violet-400/10 text-violet-400 border-violet-400/20'    },
  viewing:     { label: 'Viewing',     dot: 'bg-blue-400',    badge: 'bg-blue-400/10 text-blue-400 border-blue-400/20'          },
  negotiation: { label: 'Negotiation', dot: 'bg-orange-400',  badge: 'bg-orange-400/10 text-orange-400 border-orange-400/20'    },
  closed:      { label: 'Closed',      dot: 'bg-emerald-400', badge: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20' },
  lost:        { label: 'Lost',        dot: 'bg-red-400/50',  badge: 'bg-red-400/[0.06] text-red-400/55 border-red-400/[0.12]' },
}

const STAGES: PipelineStage[] = ['new', 'contacted', 'qualified', 'viewing', 'negotiation', 'closed', 'lost']

// Active pipeline budget midpoints (AED) — approximate, excluding closed/lost
const BUDGET_MID: Record<string, number> = {
  lead_001: 4_000_000, lead_002: 1_750_000, lead_011: 3_500_000,
  lead_004: 1_800_000, lead_012: 2_500_000, lead_013: 2_000_000, lead_014: 900_000,
  lead_003: 1_600_000, lead_005: 2_500_000, lead_015: 4_000_000, lead_016: 1_200_000,
  lead_017: 5_000_000, lead_018: 3_000_000, lead_019: 2_000_000,
  lead_006: 1_000_000, lead_020: 7_500_000,
}
const PIPELINE_VALUE = Object.values(BUDGET_MID).reduce((s, v) => s + v, 0)

// ─── Sync dot helper ──────────────────────────────────────────────────────────

function syncDot(status: string) {
  if (status === 'synced')  return 'bg-emerald-400'
  if (status === 'syncing') return 'bg-amber-400 animate-pulse'
  if (status === 'error')   return 'bg-red-400'
  return 'bg-surface-3'
}

function syncLabel(s: typeof integrationSyncStatuses[0]) {
  if (s.status === 'synced')        return <span className="text-xs text-slate-500">{s.leadsIn} leads</span>
  if (s.status === 'not_connected') return <span className="text-xs text-slate-600">Not connected</span>
  if (s.status === 'syncing')       return <span className="text-xs text-amber-400/70">Syncing…</span>
  return <span className="text-xs text-red-400/70">Error</span>
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FreeholdCrmPage() {
  const router = useRouter()
  const [query, setQuery]           = useState('')
  const [stageFilter, setStageFilter] = useState<PipelineStage | 'all'>('all')
  // Relative times depend on Date.now(); compute only after mount to avoid SSR/client hydration mismatch.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isActive = (l: CRMLeadIntelligence) =>
    l.pipelineStage !== 'closed' && l.pipelineStage !== 'lost'

  // ── Metrics ──
  const newCount         = crmLeads.filter(l => l.pipelineStage === 'new').length
  const followUpsCount   = crmLeads.filter(l => isActive(l) && (l.urgency === 'critical' || l.urgency === 'high')).length
  const hotCount         = crmLeads.filter(l => isActive(l) && (l.temperature === 'hot' || l.temperature === 'priority')).length
  const qualifiedCount   = crmLeads.filter(l => l.pipelineStage === 'qualified').length
  const closedCount      = crmLeads.filter(l => l.pipelineStage === 'closed').length

  // ── Stage counts ──
  const stageCounts = useMemo(
    () => Object.fromEntries(STAGES.map(s => [s, crmLeads.filter(l => l.pipelineStage === s).length])) as Record<PipelineStage, number>,
    [],
  )

  // ── Filtered leads ──
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return crmLeads
      .filter(l => stageFilter === 'all' || l.pipelineStage === stageFilter)
      .filter(l => !q || [l.name, l.projectInterest, l.assignedAgent, l.source].some(f => f.toLowerCase().includes(q)))
      .sort((a, b) => b.intentScore - a.intentScore)
  }, [query, stageFilter])

  // ── Tile definitions ──
  const TILES = [
    { label: 'New Leads',   value: String(newCount),                           sub: 'need first response', color: 'text-sky-400',     border: 'border-sky-400/15',     bg: 'bg-sky-400/[0.06]'     },
    { label: 'Follow-ups',  value: String(followUpsCount),                     sub: 'urgent or critical',  color: 'text-red-400',     border: 'border-red-400/15',     bg: 'bg-red-400/[0.06]'     },
    { label: 'Hot',         value: String(hotCount),                           sub: 'hot + priority',      color: 'text-gold',   border: 'border-gold/20',   bg: 'bg-gold/[0.06]'   },
    { label: 'Qualified',   value: String(qualifiedCount),                     sub: 'in qualification',    color: 'text-violet-400',  border: 'border-violet-400/15',  bg: 'bg-violet-400/[0.06]'  },
    { label: 'Pipeline',    value: `AED ${(PIPELINE_VALUE / 1_000_000).toFixed(1)}M`, sub: 'active AED est.', color: 'text-emerald-400', border: 'border-emerald-400/15', bg: 'bg-emerald-400/[0.06]' },
    { label: 'Closed MTD',  value: String(closedCount),                        sub: 'this month',          color: 'text-slate-400',   border: 'border-line-strong',      bg: 'bg-surface-2'       },
  ]

  const lastSyncStr = integrationSyncStatuses.find(s => s.lastSyncAt)?.lastSyncAt
  const totalLeadsIn = integrationSyncStatuses.reduce((s, i) => s + i.leadsIn, 0)

  return (
    <div className="px-4 pb-16 pt-5 sm:px-6">
      <div className="lg:grid lg:grid-cols-[1fr_268px] lg:gap-7 xl:gap-8">

        {/* ══ Main ══ */}
        <div className="min-w-0">

          {/* Header */}
          <PageHeader
            className="mb-6"
            Icon={Users}
            title="CRM Command Centre"
            subtitle={`${crmLeads.length} leads across ${STAGES.length} pipeline stages`}
            actions={
              <Link
                href="/freehold-intelligence/crm/board"
                className={buttonClass('secondary', 'sm')}
              >
                Board view <ChevronRight className="h-3 w-3" />
              </Link>
            }
          />

          {/* ── 6 Metric tiles ── */}
          <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {TILES.map(t => (
              <div key={t.label} className={`rounded-[14px] border p-3.5 ${t.bg} ${t.border}`}>
                <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{t.label}</div>
                <div className={`mt-1.5 text-[22px] font-semibold leading-none tabular-nums ${t.color}`}>{t.value}</div>
                <div className="mt-1 text-[10px] text-slate-600">{t.sub}</div>
              </div>
            ))}
          </div>

          {/* ── Pipeline stage funnel ── */}
          <div className="mb-5 rounded-[14px] border border-line bg-surface p-4">
            <div className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">Pipeline</div>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {STAGES.map(stage => {
                const sc    = STAGE_CONFIG[stage]
                const count = stageCounts[stage]
                const active = stageFilter === stage
                return (
                  <button
                    key={stage}
                    onClick={() => setStageFilter(active ? 'all' : stage)}
                    className={[
                      'flex min-w-[66px] flex-1 flex-col items-center gap-1.5 rounded-[10px] border px-2 py-2.5 transition',
                      active
                        ? `${sc.badge} border-current`
                        : 'border-line bg-surface-2 hover:bg-surface-2',
                    ].join(' ')}
                  >
                    <span className={`h-2 w-2 rounded-full ${sc.dot}`} />
                    <span className={`text-[18px] font-semibold leading-none tabular-nums ${active ? '' : 'text-slate-300'}`}>
                      {count}
                    </span>
                    <span className={`text-[9px] whitespace-nowrap font-medium uppercase tracking-wide ${active ? '' : 'text-slate-500'}`}>
                      {sc.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Search bar ── */}
          <div className="mb-2.5 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search leads, projects, agents…"
                className="w-full rounded-[10px] border border-line bg-surface py-2 pl-8 pr-8 text-sm text-white placeholder-slate-500 outline-none focus:border-gold/50"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {stageFilter !== 'all' && (
              <button
                onClick={() => setStageFilter('all')}
                className="flex items-center gap-1 rounded-[10px] border border-line bg-surface-2 px-3 py-2 text-xs text-slate-400 transition hover:text-slate-200"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            )}
          </div>

          <div className="mb-1.5 px-0.5 text-xs text-slate-500">
            {filtered.length} {filtered.length === 1 ? 'lead' : 'leads'}
            {stageFilter !== 'all' && ` · ${STAGE_CONFIG[stageFilter].label}`}
            {query && ` matching "${query}"`}
          </div>

          {/* ── Lead table ── */}
          <div className="overflow-hidden rounded-[16px] border border-line bg-surface">

            {/* Desktop header row */}
            <div
              className="hidden items-center gap-4 border-b border-line px-4 py-2.5 text-[10px] font-medium uppercase tracking-wider text-slate-500 lg:grid"
              style={{ gridTemplateColumns: '1fr 118px 130px 1fr 72px 68px 56px' }}
            >
              <div>Lead</div>
              <div>Temperature</div>
              <div>Stage</div>
              <div>Project · Budget</div>
              <div>Agent</div>
              <div>Last</div>
              <div />
            </div>

            {filtered.length === 0 && (
              <EmptyState
                Icon={Filter}
                title="No leads match this filter"
                description="Try a different stage or clear the search query."
                className="rounded-none border-x-0 border-b-0"
              />
            )}

            {filtered.map(lead => {
              const ts = TEMP_STYLE[lead.temperature]
              const sc = STAGE_CONFIG[lead.pipelineStage]
              return (
                <div
                  key={lead.id}
                  className="flex items-center gap-3 border-b border-line px-4 py-3 transition last:border-0 hover:bg-surface-2 lg:grid lg:gap-4"
                  style={{ gridTemplateColumns: '1fr 118px 130px 1fr 72px 68px 56px' }}
                >
                  {/* Avatar + name */}
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-surface-2 text-[10px] font-bold text-slate-400">
                      {initials(lead.name)}
                    </div>
                    <div className="min-w-0">
                      <Link
                        href={`/freehold-intelligence/crm/leads/${lead.id}`}
                        className="block truncate text-sm font-medium text-slate-200 hover:text-white"
                      >
                        {lead.name}
                      </Link>
                      <div className="truncate text-xs text-slate-500 lg:hidden">
                        {lead.budgetAED} · {lead.projectInterest}
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
                    <div className="text-xs font-medium text-gold/65">{lead.budgetAED}</div>
                  </div>

                  {/* Agent */}
                  <div className="hidden truncate text-xs text-slate-500 lg:block">
                    {lead.assignedAgent}
                  </div>

                  {/* Last contact */}
                  <div className="hidden text-xs text-slate-500 lg:block">
                    {mounted ? relTime(lead.lastContactAt) : '—'}
                  </div>

                  {/* Actions */}
                  <div className="ml-auto flex items-center gap-1 lg:ml-0">
                    <button
                      title="Call"
                      onClick={() => lead.phone ? window.open('tel:' + lead.phone) : toast.info('Calling ' + lead.name)}
                      className="flex h-7 w-7 items-center justify-center rounded-[7px] border border-line text-slate-600 transition hover:border-line-strong hover:text-slate-400"
                    >
                      <PhoneCall className="h-3 w-3" />
                    </button>
                    <button
                      title="WhatsApp"
                      onClick={() => router.push(`/freehold-intelligence/crm/leads/${lead.id}/whatsapp`)}
                      className="flex h-7 w-7 items-center justify-center rounded-[7px] border border-line text-slate-600 transition hover:border-line-strong hover:text-slate-400"
                    >
                      <MessageCircle className="h-3 w-3" />
                    </button>
                    <Link
                      href={`/freehold-intelligence/crm/leads/${lead.id}`}
                      className="flex h-7 w-7 items-center justify-center rounded-[7px] border border-line text-slate-600 transition hover:border-line-strong hover:text-slate-400"
                    >
                      <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>

        </div>

        {/* ══ Sidebar ══ */}
        <aside className="mt-6 hidden lg:mt-0 lg:block">
          <div className="sticky top-14 space-y-3">

            {/* Integration sync panel */}
            <Panel>
              <PanelHeader
                title="Integrations"
                action={
                  <button
                    onClick={() => toast.success('CRM sync started')}
                    className="flex items-center gap-1 text-xs text-slate-500 transition hover:text-slate-300"
                  >
                    <RefreshCw className="h-3 w-3" /> Sync now
                  </button>
                }
              />
              <div className="p-4 space-y-2.5">
                {integrationSyncStatuses.map(s => (
                  <div key={s.id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${syncDot(s.status)}`} />
                      <span className="text-sm text-slate-300">{s.name}</span>
                    </div>
                    {syncLabel(s)}
                  </div>
                ))}
                {lastSyncStr && mounted && (
                  <div className="border-t border-line pt-2.5 text-xs text-slate-600">
                    Last sync {relTime(lastSyncStr)} ago · {totalLeadsIn} leads imported
                  </div>
                )}
              </div>
            </Panel>

            {/* Top by intent */}
            <Panel>
              <PanelHeader title="Top by Intent" />
              <div className="p-4 space-y-2">
                {[...crmLeads]
                  .sort((a, b) => b.intentScore - a.intentScore)
                  .slice(0, 6)
                  .map(l => (
                    <div key={l.id} className="flex items-center gap-2.5">
                      <div className="w-[70px] shrink-0 truncate text-xs text-slate-400">
                        {l.name.split(' ')[0]}
                      </div>
                      <div className="flex-1 overflow-hidden rounded-full bg-surface-2">
                        <div
                          className="h-1.5 rounded-full bg-gold"
                          style={{ width: `${l.intentScore}%` }}
                        />
                      </div>
                      <div className="w-7 text-right text-xs font-medium tabular-nums text-slate-400">
                        {l.intentScore}
                      </div>
                    </div>
                  ))}
              </div>
            </Panel>

            {/* AI prompt */}
            <AiPrompt
              skill="crm_advisor"
              placeholder="Ask about leads, pipeline, follow-ups…"
              suggestions={[
                'Which leads need urgent follow-up?',
                'Draft a WhatsApp for the hottest lead.',
                'Who is closest to closing?',
                'Flag any duplicate or wrong-number risks.',
              ]}
              context={{
                pipeline: {
                  totalLeads: crmLeads.length,
                  newLeads: newCount,
                  urgentFollowUps: followUpsCount,
                  hotLeads: hotCount,
                  qualified: qualifiedCount,
                  closedMTD: closedCount,
                  pipelineValueAED: PIPELINE_VALUE,
                },
                topByIntent: [...crmLeads]
                  .sort((a, b) => b.intentScore - a.intentScore)
                  .slice(0, 6)
                  .map(l => ({ name: l.name, stage: l.pipelineStage, temperature: l.temperature, intentScore: l.intentScore, project: l.projectInterest, budget: l.budgetAED })),
              }}
            />

          </div>
        </aside>

      </div>
    </div>
  )
}
