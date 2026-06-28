'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import {
  Search, X, PhoneCall, MessageCircle, ArrowUpRight,
  RefreshCw, ChevronRight,
} from 'lucide-react'
import {
  integrationSyncStatuses,
  type PipelineStage,
  type CRMLeadIntelligence,
} from '@/src/features/freehold-intelligence/server-session'
import { useLiveLeads } from '@/lib/freehold/use-live-leads'
import { AiPrompt } from '@/components/freehold/ai-prompt'
import { useT } from '@/lib/i18n/provider'

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

const TEMP_STYLE: Record<string, { labelKey: string; badge: string }> = {
  priority: { labelKey: 'crm.temp.priority', badge: 'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/25' },
  hot:      { labelKey: 'crm.temp.hot',      badge: 'bg-red-400/10 text-red-400 border-red-400/20'         },
  warm:     { labelKey: 'crm.temp.warm',     badge: 'bg-amber-400/10 text-amber-400 border-amber-400/20'   },
  cold:     { labelKey: 'crm.temp.cold',     badge: 'bg-slate-800/50 text-slate-500 border-slate-700'      },
}

const STAGE_CONFIG: Record<PipelineStage, { labelKey: string; dot: string; badge: string }> = {
  new:         { labelKey: 'crm.stage.new',         dot: 'bg-sky-400',     badge: 'bg-sky-400/10 text-sky-400 border-sky-400/20'             },
  contacted:   { labelKey: 'crm.stage.contacted',   dot: 'bg-amber-400',   badge: 'bg-amber-400/10 text-amber-400 border-amber-400/20'       },
  qualified:   { labelKey: 'crm.stage.qualified',   dot: 'bg-violet-400',  badge: 'bg-violet-400/10 text-violet-400 border-violet-400/20'    },
  viewing:     { labelKey: 'crm.stage.viewing',     dot: 'bg-blue-400',    badge: 'bg-blue-400/10 text-blue-400 border-blue-400/20'          },
  negotiation: { labelKey: 'crm.stage.negotiation', dot: 'bg-orange-400',  badge: 'bg-orange-400/10 text-orange-400 border-orange-400/20'    },
  closed:      { labelKey: 'crm.stage.closed',      dot: 'bg-emerald-400', badge: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20' },
  lost:        { labelKey: 'crm.stage.lost',        dot: 'bg-red-400/50',  badge: 'bg-red-400/[0.06] text-red-400/55 border-red-400/[0.12]' },
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
  return 'bg-slate-600'
}

function syncLabel(s: typeof integrationSyncStatuses[0], t: (key: string, vars?: Record<string, string | number>) => string) {
  if (s.status === 'synced')        return <span className="text-xs text-slate-500">{t('crm.leadsCount', { count: s.leadsIn })}</span>
  if (s.status === 'not_connected') return <span className="text-xs text-slate-600">{t('crm.notConnected')}</span>
  if (s.status === 'syncing')       return <span className="text-xs text-amber-400/70">{t('crm.syncing')}</span>
  return <span className="text-xs text-red-400/70">{t('crm.error')}</span>
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FreeholdCrmPage() {
  const t = useT()
  const { leads } = useLiveLeads()
  const [query, setQuery]           = useState('')
  const [stageFilter, setStageFilter] = useState<PipelineStage | 'all'>('all')
  // Relative times depend on Date.now(); compute only after mount to avoid SSR/client hydration mismatch.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isActive = (l: CRMLeadIntelligence) =>
    l.pipelineStage !== 'closed' && l.pipelineStage !== 'lost'

  // ── Metrics ──
  const newCount         = leads.filter(l => l.pipelineStage === 'new').length
  const followUpsCount   = leads.filter(l => isActive(l) && (l.urgency === 'critical' || l.urgency === 'high')).length
  const hotCount         = leads.filter(l => isActive(l) && (l.temperature === 'hot' || l.temperature === 'priority')).length
  const qualifiedCount   = leads.filter(l => l.pipelineStage === 'qualified').length
  const closedCount      = leads.filter(l => l.pipelineStage === 'closed').length

  // ── Stage counts ──
  const stageCounts = useMemo(
    () => Object.fromEntries(STAGES.map(s => [s, leads.filter(l => l.pipelineStage === s).length])) as Record<PipelineStage, number>,
    [leads],
  )

  // ── Filtered leads ──
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return leads
      .filter(l => stageFilter === 'all' || l.pipelineStage === stageFilter)
      .filter(l => !q || [l.name, l.projectInterest, l.assignedAgent, l.source].some(f => f.toLowerCase().includes(q)))
      .sort((a, b) => b.intentScore - a.intentScore)
  }, [leads, query, stageFilter])

  // ── Tile definitions ──
  const TILES = [
    { label: t('crm.tile.newLeads'),   value: String(newCount),                           sub: t('crm.tile.newLeadsSub'), color: 'text-sky-400',     border: 'border-sky-400/15',     bg: 'bg-sky-400/[0.06]'     },
    { label: t('crm.tile.followUps'),  value: String(followUpsCount),                     sub: t('crm.tile.followUpsSub'),  color: 'text-red-400',     border: 'border-red-400/15',     bg: 'bg-red-400/[0.06]'     },
    { label: t('crm.tile.hot'),         value: String(hotCount),                           sub: t('crm.tile.hotSub'),      color: 'text-[#D4AF37]',   border: 'border-[#D4AF37]/20',   bg: 'bg-[#D4AF37]/[0.06]'   },
    { label: t('crm.tile.qualified'),   value: String(qualifiedCount),                     sub: t('crm.tile.qualifiedSub'),    color: 'text-violet-400',  border: 'border-violet-400/15',  bg: 'bg-violet-400/[0.06]'  },
    { label: t('crm.tile.pipeline'),    value: `AED ${(PIPELINE_VALUE / 1_000_000).toFixed(1)}M`, sub: t('crm.tile.pipelineSub'), color: 'text-emerald-400', border: 'border-emerald-400/15', bg: 'bg-emerald-400/[0.06]' },
    { label: t('crm.tile.closedMtd'),  value: String(closedCount),                        sub: t('crm.tile.closedMtdSub'),          color: 'text-slate-400',   border: 'border-slate-700',      bg: 'bg-slate-800/50'       },
  ]

  const lastSyncStr = integrationSyncStatuses.find(s => s.lastSyncAt)?.lastSyncAt
  const totalLeadsIn = integrationSyncStatuses.reduce((s, i) => s + i.leadsIn, 0)

  return (
    <div className="px-4 pb-16 pt-5 sm:px-6">
      <div className="lg:grid lg:grid-cols-[1fr_268px] lg:gap-7 xl:gap-8">

        {/* ══ Main ══ */}
        <div className="min-w-0">

          {/* Header */}
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-[17px] font-semibold text-white">{t('crm.commandCentre')}</h1>
              <p className="mt-0.5 text-xs text-slate-500">
                {t('crm.leadsPipelineStages', { leads: leads.length, stages: STAGES.length })}
              </p>
            </div>
            <Link
              href="/freehold-intelligence/crm/board"
              className="flex items-center gap-1.5 rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-400 transition hover:text-slate-200"
            >
              {t('crm.board')} <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

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
          <div className="mb-5 rounded-[14px] border border-slate-800 bg-slate-900 p-4">
            <div className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">{t('crm.pipeline')}</div>
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
                        : 'border-slate-800 bg-slate-800/30 hover:bg-slate-800',
                    ].join(' ')}
                  >
                    <span className={`h-2 w-2 rounded-full ${sc.dot}`} />
                    <span className={`text-[18px] font-semibold leading-none tabular-nums ${active ? '' : 'text-slate-300'}`}>
                      {count}
                    </span>
                    <span className={`text-[9px] whitespace-nowrap font-medium uppercase tracking-wide ${active ? '' : 'text-slate-500'}`}>
                      {t(sc.labelKey)}
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
                placeholder={t('crm.searchLeadsProjectsAgents')}
                className="w-full rounded-[10px] border border-slate-800 bg-slate-900 py-2 pl-8 pr-8 text-sm text-white placeholder-slate-500 outline-none focus:border-[#D4AF37]/50"
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
                className="flex items-center gap-1 rounded-[10px] border border-slate-800 bg-slate-800/50 px-3 py-2 text-xs text-slate-400 transition hover:text-slate-200"
              >
                <X className="h-3 w-3" /> {t('crm.clear')}
              </button>
            )}
          </div>

          <div className="mb-1.5 px-0.5 text-xs text-slate-500">
            {filtered.length === 1 ? t('crm.countLead', { count: filtered.length }) : t('crm.countLeads', { count: filtered.length })}
            {stageFilter !== 'all' && ` · ${t(STAGE_CONFIG[stageFilter].labelKey)}`}
            {query && ` ${t('crm.matching', { query })}`}
          </div>

          {/* ── Lead table ── */}
          <div className="overflow-hidden rounded-[16px] border border-slate-800 bg-slate-900">

            {/* Desktop header row */}
            <div
              className="hidden items-center gap-4 border-b border-slate-800 px-4 py-2.5 text-[10px] font-medium uppercase tracking-wider text-slate-500 lg:grid"
              style={{ gridTemplateColumns: '1fr 118px 130px 1fr 72px 68px 56px' }}
            >
              <div>{t('crm.colLead')}</div>
              <div>{t('crm.colTemperature')}</div>
              <div>{t('crm.colStage')}</div>
              <div>{t('crm.colProjectBudget')}</div>
              <div>{t('crm.colAgent')}</div>
              <div>{t('crm.colLast')}</div>
              <div />
            </div>

            {filtered.length === 0 && (
              <div className="py-12 text-center text-sm text-slate-500">
                {t('crm.noLeadsMatchFilter')}
              </div>
            )}

            {filtered.map(lead => {
              const ts = TEMP_STYLE[lead.temperature]
              const sc = STAGE_CONFIG[lead.pipelineStage]
              return (
                <div
                  key={lead.id}
                  className="flex items-center gap-3 border-b border-slate-800 px-4 py-3 transition last:border-0 hover:bg-slate-800/50 lg:grid lg:gap-4"
                  style={{ gridTemplateColumns: '1fr 118px 130px 1fr 72px 68px 56px' }}
                >
                  {/* Avatar + name */}
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-slate-800 text-[10px] font-bold text-slate-400">
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
                      {t(ts.labelKey)}
                    </span>
                  </div>

                  {/* Stage */}
                  <div className="hidden lg:block">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${sc.badge}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                      {t(sc.labelKey)}
                    </span>
                  </div>

                  {/* Project + budget */}
                  <div className="hidden min-w-0 lg:block">
                    <div className="truncate text-xs text-slate-400">{lead.projectInterest}</div>
                    <div className="text-xs font-medium text-[#D4AF37]/65">{lead.budgetAED}</div>
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
                      title={t('crm.call')}
                      className="flex h-7 w-7 items-center justify-center rounded-[7px] border border-slate-800 text-slate-600 transition hover:border-slate-600 hover:text-slate-400"
                    >
                      <PhoneCall className="h-3 w-3" />
                    </button>
                    <button
                      title={t('crm.whatsapp')}
                      className="flex h-7 w-7 items-center justify-center rounded-[7px] border border-slate-800 text-slate-600 transition hover:border-slate-600 hover:text-slate-400"
                    >
                      <MessageCircle className="h-3 w-3" />
                    </button>
                    <Link
                      href={`/freehold-intelligence/crm/leads/${lead.id}`}
                      className="flex h-7 w-7 items-center justify-center rounded-[7px] border border-slate-800 text-slate-600 transition hover:border-slate-600 hover:text-slate-400"
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
            <div className="rounded-[16px] border border-slate-800 bg-slate-900 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-xs font-medium uppercase tracking-wider text-slate-500">{t('crm.integrations')}</div>
                <button
                  onClick={() => { if (typeof window !== 'undefined') window.location.reload() }}
                  className="flex items-center gap-1 text-xs text-slate-500 transition hover:text-slate-300"
                >
                  <RefreshCw className="h-3 w-3" /> {t('crm.syncNow')}
                </button>
              </div>

              <div className="space-y-2.5">
                {integrationSyncStatuses.map(s => (
                  <div key={s.id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${syncDot(s.status)}`} />
                      <span className="text-sm text-slate-300">{s.name}</span>
                    </div>
                    {syncLabel(s, t)}
                  </div>
                ))}
              </div>

              {lastSyncStr && mounted && (
                <div className="mt-3 border-t border-slate-800 pt-2.5 text-xs text-slate-600">
                  {t('crm.lastSync', { time: relTime(lastSyncStr), count: totalLeadsIn })}
                </div>
              )}
            </div>

            {/* Top by intent */}
            <div className="rounded-[16px] border border-slate-800 bg-slate-900 p-4">
              <div className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">{t('crm.topByIntent')}</div>
              <div className="space-y-2">
                {[...leads]
                  .sort((a, b) => b.intentScore - a.intentScore)
                  .slice(0, 6)
                  .map(l => (
                    <div key={l.id} className="flex items-center gap-2.5">
                      <div className="w-[70px] shrink-0 truncate text-xs text-slate-400">
                        {l.name.split(' ')[0]}
                      </div>
                      <div className="flex-1 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-1.5 rounded-full bg-[#D4AF37]"
                          style={{ width: `${l.intentScore}%` }}
                        />
                      </div>
                      <div className="w-7 text-right text-xs font-medium tabular-nums text-slate-400">
                        {l.intentScore}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* AI prompt */}
            <AiPrompt
              skill="crm_advisor"
              placeholder={t('crm.aiPlaceholderOverview')}
              suggestions={[
                t('crm.aiSuggest.urgentFollowUp'),
                t('crm.aiSuggest.draftWhatsApp'),
                t('crm.aiSuggest.closestClosing'),
                t('crm.aiSuggest.flagDuplicates'),
              ]}
              context={{
                pipeline: {
                  totalLeads: leads.length,
                  newLeads: newCount,
                  urgentFollowUps: followUpsCount,
                  hotLeads: hotCount,
                  qualified: qualifiedCount,
                  closedMTD: closedCount,
                  pipelineValueAED: PIPELINE_VALUE,
                },
                topByIntent: [...leads]
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
