'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  Search, X, PhoneCall, MessageCircle, ArrowUpRight,
  RefreshCw, ChevronRight, Users, Plus, AlertCircle,
} from 'lucide-react'
import { EmptyState } from '@/components/freehold/ui/empty-state'
import {
  type PipelineStage,
  type CRMLeadIntelligence,
} from '@/src/features/freehold-intelligence/server-session'
import { useLiveLeads } from '@/lib/freehold/use-live-leads'
import { LeadValueBadge } from '@/components/freehold/lead-value-chips'
import { useT } from '@/lib/i18n/provider'
import { loadCrmView, saveCrmView } from './_lib/view-prefs'

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
  priority: { labelKey: 'crm.temp.priority', badge: 'bg-gold/10 text-gold border-gold/25' },
  hot:      { labelKey: 'crm.temp.hot',      badge: 'bg-red-400/10 text-red-400 border-red-400/20'         },
  warm:     { labelKey: 'crm.temp.warm',     badge: 'bg-amber-400/10 text-amber-400 border-amber-400/20'   },
  cold:     { labelKey: 'crm.temp.cold',     badge: 'bg-surface-2 text-slate-500 border-line-strong'      },
}

const STAGE_CONFIG: Record<PipelineStage, { labelKey: string; dot: string; badge: string }> = {
  new:         { labelKey: 'crm.stage.new',         dot: 'bg-teal-400', badge: 'bg-teal-400/10 text-teal-300 border-teal-400/30' },
  contacted:   { labelKey: 'crm.stage.contacted',   dot: 'bg-amber-400',   badge: 'bg-amber-400/10 text-amber-400 border-amber-400/20'       },
  qualified:   { labelKey: 'crm.stage.qualified',   dot: 'bg-violet-400',  badge: 'bg-violet-400/10 text-violet-400 border-violet-400/20'    },
  viewing:     { labelKey: 'crm.stage.viewing',     dot: 'bg-violet-400', badge: 'bg-violet-400/10 text-violet-300 border-violet-400/30' },
  negotiation: { labelKey: 'crm.stage.negotiation', dot: 'bg-violet-400',  badge: 'bg-violet-400/10 text-violet-300 border-violet-400/30'    },
  closed:      { labelKey: 'crm.stage.closed',      dot: 'bg-emerald-400', badge: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20' },
  lost:        { labelKey: 'crm.stage.lost',        dot: 'bg-slate-500',   badge: 'bg-surface-2 text-slate-500 border-line-strong' },
}

const STAGES: PipelineStage[] = ['new', 'contacted', 'qualified', 'viewing', 'negotiation', 'closed', 'lost']

function fmtAedShort(n: number): string {
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `AED ${(n / 1_000).toFixed(0)}K`
  return `AED ${Math.round(n).toLocaleString()}`
}


/**
 * Where the lead came from, in words a human uses. The raw `source` is a
 * machine string ("meta_form:1203…", "Direct", a landing slug) and was only
 * ever used as a hidden search key — never shown. Knowing a lead came from a
 * paid Meta ad rather than the website changes how it is worked and what it
 * cost, so it belongs on the row.
 */
function sourceLabel(raw: string): string {
  const s = (raw || '').trim()
  if (!s) return '—'
  if (s.startsWith('meta_form:')) return 'Meta lead form'
  if (/^meta|facebook|instagram/i.test(s)) return 'Meta'
  if (/^google/i.test(s)) return 'Google'
  if (/^whatsapp/i.test(s)) return 'WhatsApp'
  if (/^direct$/i.test(s)) return 'Direct'
  if (/^lp[:/]|^landing/i.test(s)) return 'Landing page'
  return s.length > 24 ? `${s.slice(0, 24)}…` : s
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FreeholdCrmPage() {
  const t = useT()
  const { leads, loading: leadsLoading, unassigned, total: leadTotal, truncated } = useLiveLeads()
  const [query, setQuery]           = useState('')
  const [stageFilter, setStageFilter] = useState<PipelineStage | 'all'>('all')
  // Rank by VALUE, most unqualified first — the deliberate inversion. The
  // bottom of the list is not noise to hide; it is the set the machine (and
  // the team) must explicitly know it does not want. Unrated leads sort after
  // the rated: unknown is not the same fact as unqualified.
  const [rankByValue, setRankByValue] = useState(false)
  // Relative times depend on Date.now(); compute only after mount to avoid SSR/client hydration mismatch.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Drill-down support: a deep link from Analytics (e.g. /crm?stage=closed or
  // /crm?source=meta) lands here pre-filtered. Read once on mount via the raw
  // querystring to avoid the useSearchParams Suspense bailout. Otherwise the
  // account's saved view (stage filter + search) is restored.
  const viewHydrated = useRef(false)
  useEffect(() => {
    let cancelled = false
    loadCrmView().then((view) => {
      if (cancelled) return
      const params = new URLSearchParams(window.location.search)
      const stage = params.get('stage') ?? view.overviewStage
      if (stage === 'all' || (stage && (STAGES as string[]).includes(stage))) {
        setStageFilter(stage as PipelineStage | 'all')
      }
      const source = params.get('source')
      if (source) setQuery(source)
      else if (view.overviewSearch) setQuery(view.overviewSearch)
      viewHydrated.current = true
    })
    return () => { cancelled = true }
  }, [])

  // Persist the view on change (debounced in the account-memory helper).
  useEffect(() => {
    if (!viewHydrated.current) return
    saveCrmView({ overviewStage: stageFilter, overviewSearch: query })
  }, [stageFilter, query])

  // Real pipeline value: open (in-progress) deals from the deals API. The API
  // is session-scoped — brokers see their own deals, management sees all.
  const [openDealValue, setOpenDealValue] = useState<number | null>(null)
  useEffect(() => {
    let cancelled = false
    fetch('/api/freehold/deals?totals=1', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then((d: { deals?: Array<{ status: string; propertyValueAed: number }> } | null) => {
        if (cancelled || !Array.isArray(d?.deals)) return
        setOpenDealValue(d.deals
          .filter(deal => deal.status === 'pending_step1' || deal.status === 'pending_step2')
          .reduce((s, deal) => s + (Number(deal.propertyValueAed) || 0), 0))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

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
      .sort((a, b) => rankByValue
        ? (a.valueRating ?? 99) - (b.valueRating ?? 99)
        : b.intentScore - a.intentScore)
  }, [leads, query, stageFilter, rankByValue])

  // ── Tile definitions ──
  const TILES = [
    { label: t('crm.tile.newLeads'),   value: String(newCount),                           sub: t('crm.tile.newLeadsSub'), color: 'text-emerald-400',     border: 'border-emerald-400/15',     bg: 'bg-emerald-400/[0.06]'     },
    { label: t('crm.tile.followUps'),  value: String(followUpsCount),                     sub: t('crm.tile.followUpsSub'),  color: 'text-red-400',     border: 'border-red-400/15',     bg: 'bg-red-400/[0.06]'     },
    { label: t('crm.tile.hot'),         value: String(hotCount),                           sub: t('crm.tile.hotSub'),      color: 'text-gold',   border: 'border-gold/20',   bg: 'bg-gold/[0.06]'   },
    { label: t('crm.tile.qualified'),   value: String(qualifiedCount),                     sub: t('crm.tile.qualifiedSub'),    color: 'text-violet-400',  border: 'border-violet-400/15',  bg: 'bg-violet-400/[0.06]'  },
    { label: t('crm.tile.pipeline'),    value: openDealValue == null ? '—' : fmtAedShort(openDealValue), sub: t('crm.tile.pipelineSub'), color: 'text-emerald-400', border: 'border-emerald-400/15', bg: 'bg-emerald-400/[0.06]' },
    { label: t('crm.tile.closedMtd'),  value: String(closedCount),                        sub: t('crm.tile.closedMtdSub'),          color: 'text-slate-400',   border: 'border-line-strong',      bg: 'bg-surface-2'       },
  ]


  return (
    <div className="px-4 pb-16 pt-5 sm:px-6">
      <div className="mx-auto max-w-7xl">

        {/* ══ Main ══ */}
        <div className="min-w-0">

          {/* Header */}
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-[17px] font-semibold text-white">{t('crm.commandCentre')}</h1>
              <p className="mt-0.5 text-xs text-slate-500">
                {t('crm.leadsPipelineStages', { leads: leads.length, stages: STAGES.length })}
                {/* The dashboard counter counts every row while this list is
                    capped, so an account with more leads than the page size saw
                    a total that its own list never reached. Say which it is. */}
                {truncated && (
                  <span className="ms-1 text-amber-300/90">
                    {t('crm.showingOf', { shown: String(leads.length), total: String(leadTotal) })}
                  </span>
                )}
              </p>
            </div>
            <Link
              href="/freehold-intelligence/crm/board"
              className="flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-xs text-slate-400 transition hover:text-slate-200"
            >
              {t('crm.board')} <ChevronRight className="h-3 w-3" />
            </Link>
          </div>


          {/* ── Leads that belong to NOBODY ────────────────────────────────
              The end of the ingestion chain, and the last place a lead can go
              missing after arriving perfectly. Auto-distribution only runs when
              distribution is set to 'auto'; otherwise a Meta-form or landing
              lead keeps no owner — which every broker's list filters out
              entirely, and which management sees as an ordinary row. Unworked
              and unnoticed is the same outcome as never arriving. */}
          {unassigned > 0 && (
            <Link
              href="/freehold-intelligence/crm/assignment"
              className="mb-5 flex items-start gap-3 rounded-[18px] border border-amber-400/30 bg-amber-400/[0.07] p-4 transition hover:border-amber-400/50"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-amber-200">
                  {t('crm.unassigned.title', { n: String(unassigned) })}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-400/80">
                  {t('crm.unassigned.body')}
                </p>
              </div>
            </Link>
          )}

          {/* Empty pipeline → one clean state instead of a wall of zeros. */}
          {!leadsLoading && leads.length === 0 ? (
            <EmptyState
              Icon={Users}
              title={t('crm.empty.title')}
              description={t('crm.empty.desc')}
              className="mb-5"
              action={(
                <button type="button" onClick={() => window.dispatchEvent(new Event('fh:add-lead'))}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-xs font-semibold text-ink transition hover:bg-gold-bright">
                  <Plus className="h-3.5 w-3.5" /> {t('crm.empty.cta')}
                </button>
              )}
            />
          ) : (
          <>
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
                      'flex min-w-[66px] flex-1 flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 transition',
                      active
                        ? `${sc.badge} border-current`
                        : 'border-line bg-surface hover:bg-surface-2',
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
          </>
          )}

          {/* ── Search bar ── */}
          <div className="mb-2.5 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={t('crm.searchLeadsProjectsAgents')}
                className="w-full rounded-lg border border-line bg-surface py-2 ps-8 pe-8 text-sm text-white placeholder-slate-500 outline-none focus:border-gold/40"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {stageFilter !== 'all' && (
              <button
                onClick={() => setStageFilter('all')}
                className="flex items-center gap-1 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-slate-400 transition hover:text-slate-200"
              >
                <X className="h-3 w-3" /> {t('crm.clear')}
              </button>
            )}
            {/* Rank by value, most unqualified first — surfacing the bottom
                of the book on purpose: that set is what the machine must
                learn to stop buying. */}
            <button
              onClick={() => setRankByValue((v) => !v)}
              className={`flex items-center gap-1 rounded-lg border px-3 py-2 text-xs transition ${
                rankByValue
                  ? 'border-red-400/40 bg-red-400/10 text-red-300'
                  : 'border-line bg-surface-2 text-slate-400 hover:text-slate-200'
              }`}
            >
              {t('crm.rank.valueWorstFirst')}
            </button>
          </div>

          <div className="mb-1.5 px-0.5 text-xs text-slate-500">
            {filtered.length === 1 ? t('crm.countLead', { count: filtered.length }) : t('crm.countLeads', { count: filtered.length })}
            {stageFilter !== 'all' && ` · ${t(STAGE_CONFIG[stageFilter].labelKey)}`}
            {query && ` ${t('crm.matching', { query })}`}
          </div>

          {/* ── Lead table ── */}
          <div className="overflow-hidden rounded-xl border border-line bg-surface">

            {/* Desktop header row */}
            <div
              className="hidden items-center gap-4 border-b border-line px-4 py-2.5 text-[10px] font-medium uppercase tracking-wider text-slate-500 lg:grid"
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
                  className="flex items-center gap-3 border-b border-line px-4 py-3 transition last:border-0 hover:bg-surface-2 lg:grid lg:gap-4"
                  style={{ gridTemplateColumns: '1fr 118px 130px 1fr 72px 68px 56px' }}
                >
                  {/* Avatar + name (+ the value judgment at a glance) */}
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-surface-2 text-[10px] font-bold text-slate-400">
                      {initials(lead.name)}
                    </div>
                    <LeadValueBadge value={lead.valueRating ?? null} />
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

                  {/* Project + budget + where it came from */}
                  <div className="hidden min-w-0 lg:block">
                    <div className="truncate text-xs text-slate-400">{lead.projectInterest}</div>
                    <div className="text-xs font-medium text-gold/65">{lead.budgetAED}</div>
                    <div className="truncate text-[11px] text-slate-500">{sourceLabel(lead.source)}</div>
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
                    <a
                      href={`tel:${lead.phone}`}
                      title={t('crm.call')}
                      className="flex h-7 w-7 items-center justify-center rounded-[7px] border border-line text-slate-600 transition hover:border-slate-600 hover:text-slate-400"
                    >
                      <PhoneCall className="h-3 w-3" />
                    </a>
                    <Link
                      href={`/freehold-intelligence/crm/leads/${lead.id}/whatsapp`}
                      title={t('crm.whatsapp')}
                      className="flex h-7 w-7 items-center justify-center rounded-[7px] border border-line text-slate-600 transition hover:border-slate-600 hover:text-slate-400"
                    >
                      <MessageCircle className="h-3 w-3" />
                    </Link>
                    <Link
                      href={`/freehold-intelligence/crm/leads/${lead.id}`}
                      className="flex h-7 w-7 items-center justify-center rounded-[7px] border border-line text-slate-600 transition hover:border-slate-600 hover:text-slate-400"
                    >
                      <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>

        </div>

      </div>
    </div>
  )
}
