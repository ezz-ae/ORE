'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Search, Target, X, Users, AlertTriangle } from 'lucide-react'
import { useLiveLeads } from '@/lib/freehold/use-live-leads'
import { PageHeader, StatCard, EmptyState } from '@/components/freehold/ui'
import { useT } from '@/lib/i18n/provider'

function urgencyConfig(u: string) {
  if (u === 'critical') return { dot: 'bg-red-400',   badge: 'border-red-400/20 bg-red-400/10 text-red-300',    label: 'Critical' }
  if (u === 'high')     return { dot: 'bg-gold',       badge: 'border-gold/20 bg-gold/10 text-[#F8E7AE]',        label: 'High'     }
  if (u === 'medium')   return { dot: 'bg-sky-400',   badge: 'border-sky-400/20 bg-sky-400/10 text-sky-200',    label: 'Medium'   }
  return                       { dot: 'bg-slate-500', badge: 'border-line-strong bg-surface-2 text-slate-400', label: 'Low'      }
}

function scoreColor(n: number) {
  if (n >= 80) return { text: 'text-gold', bar: 'bg-gold' }
  if (n >= 60) return { text: 'text-amber-400', bar: 'bg-amber-400' }
  return { text: 'text-red-400', bar: 'bg-red-400' }
}

function stageStyle(stage: string) {
  const map: Record<string, string> = {
    Hot:         'text-red-300 border-red-400/20 bg-red-400/10',
    Qualified:   'text-gold border-gold/20 bg-gold/10',
    'Follow-up': 'text-[#F8E7AE] border-gold/20 bg-gold/10',
    New:         'text-sky-200 border-sky-400/20 bg-sky-400/10',
    Viewing:     'text-blue-200 border-blue-400/20 bg-blue-400/10',
    Negotiation: 'text-orange-200 border-orange-400/20 bg-orange-400/10',
    Closed:      'text-emerald-300 border-emerald-400/20 bg-emerald-400/10',
    Lost:        'text-slate-500 border-line-strong bg-surface-2',
  }
  return map[stage] ?? 'text-slate-400 border-line-strong bg-surface-2'
}

export default function CrmLeadsPage() {
  const t = useT()
  const { leads } = useLiveLeads()
  const [query,       setQuery]       = useState('')
  const [activeStage, setActiveStage] = useState('All')
  const [activeAgent, setActiveAgent] = useState('All')
  const [activeLanding, setActiveLanding] = useState('All')

  const ALL_STAGES = useMemo(
    () => ['All', ...Array.from(new Set(leads.map((l) => l.stage)))],
    [leads],
  )

  const ALL_AGENTS = useMemo(
    () => ['All', ...Array.from(new Set(leads.map((l) => l.assignedAgent)))],
    [leads],
  )

  const ALL_LANDINGS = useMemo(
    () => ['All', ...Array.from(new Set(leads.map((l) => l.landingId).filter((s): s is string => !!s)))],
    [leads],
  )

  const sorted = useMemo(
    () => [...leads].sort((a, b) => b.intentScore - a.intentScore),
    [leads],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return sorted.filter(lead => {
      if (activeStage !== 'All' && lead.stage !== activeStage) return false
      if (activeAgent !== 'All' && lead.assignedAgent !== activeAgent) return false
      if (activeLanding !== 'All' && lead.landingId !== activeLanding) return false
      if (q) return (
        lead.name.toLowerCase().includes(q) ||
        lead.source.toLowerCase().includes(q) ||
        lead.stage.toLowerCase().includes(q) ||
        lead.assignedAgent.toLowerCase().includes(q) ||
        (lead.landingId || '').toLowerCase().includes(q) ||
        (lead.leadCode || '').toLowerCase().includes(q)
      )
      return true
    })
  }, [sorted, query, activeStage, activeAgent, activeLanding])

  const hot       = leads.filter(l => l.urgency === 'critical' || l.urgency === 'high').length
  const avgIntent = leads.length > 0 ? Math.round(leads.reduce((s, l) => s + l.intentScore, 0) / leads.length) : 0
  const withRisk  = leads.filter(l => l.duplicateRisk || l.wrongNumberRisk).length

  const hasFilters = query.trim() || activeStage !== 'All' || activeAgent !== 'All' || activeLanding !== 'All'

  function clearFilters() { setQuery(''); setActiveStage('All'); setActiveAgent('All'); setActiveLanding('All') }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      <PageHeader
        eyebrow={t('crm.crm')}
        Icon={Users}
        title={t('crm.leadsTitle', { count: leads.length })}
        subtitle={t('crm.leadsSubtitle', { count: hot })}
      />

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t('crm.statTotal')} value={leads.length} hint={t('crm.statTotalHint')} Icon={Users} />
        <StatCard
          label={t('crm.statUrgent')}
          value={hot}
          hint={t('crm.statUrgentHint')}
          delta={hot > 0 ? { value: t('crm.statActNow'), direction: 'down' } : undefined}
          Icon={AlertTriangle}
        />
        <StatCard label={t('crm.statAvgIntent')} value={avgIntent} hint={t('crm.statAvgIntentHint')} Icon={Target} />
        <StatCard
          label={t('crm.statRiskFlags')}
          value={withRisk}
          hint={withRisk > 0 ? t('crm.statNeedsReview') : t('crm.statAllClear')}
          delta={withRisk > 0 ? { value: t('crm.statReviewNeeded'), direction: 'down' } : undefined}
        />
      </div>

      {/* Search + filters in one compact row */}
      <div className="mt-7 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('crm.searchNameSourceStageAgent')}
            className="w-full rounded-xl border border-line bg-surface-2 py-2.5 pl-10 pr-10 text-sm text-slate-100 placeholder:text-slate-600 outline-none transition focus:border-gold/50"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-300"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Stage + agent + clear in one scrollable row */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-0.5">
          {ALL_STAGES.map(stage => (
            <button
              key={stage}
              onClick={() => setActiveStage(stage)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition ${
                activeStage === stage
                  ? stage === 'All' ? 'border-gold/30 bg-gold/10 text-gold' : stageStyle(stage)
                  : 'border-line bg-surface-2 text-slate-400 hover:text-slate-200'
              }`}
            >
              {stage === 'All' ? t('crm.all') : stage}
            </button>
          ))}

          <span className="mx-0.5 text-slate-700">·</span>

          {ALL_AGENTS.map(agent => (
            <button
              key={agent}
              onClick={() => setActiveAgent(agent)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition ${
                activeAgent === agent
                  ? 'border-gold/30 bg-gold/10 text-gold'
                  : 'border-line bg-surface-2 text-slate-400 hover:text-slate-200'
              }`}
            >
              {agent === 'All' ? t('crm.allAgents') : agent.split(' ')[0]}
            </button>
          ))}

          {ALL_LANDINGS.length > 1 && (
            <>
              <span className="mx-0.5 text-slate-700">·</span>
              <select
                value={activeLanding}
                onChange={(e) => setActiveLanding(e.target.value)}
                className="shrink-0 rounded-full border border-line bg-surface-2 px-3 py-1 text-xs text-slate-400 outline-none transition hover:text-slate-200 focus:border-gold/40"
              >
                {ALL_LANDINGS.map((lp) => (
                  <option key={lp} value={lp} className="bg-surface">{lp === 'All' ? t('crm.allLandingPages') : lp}</option>
                ))}
              </select>
            </>
          )}

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="ml-1 flex items-center gap-1 rounded-full border border-line bg-surface-2 px-3 py-1 text-xs text-slate-400 transition hover:text-slate-200"
            >
              <X className="h-3 w-3" /> {t('crm.clear')}
            </button>
          )}
        </div>

        <p className="text-xs text-slate-500">
          {t('crm.countOfTotalLeads', { count: filtered.length, total: leads.length })}
          {hasFilters && <span className="ml-1.5 text-gold/60">· {t('crm.filtered')}</span>}
        </p>
      </div>

      {/* Lead table */}
      <section className="mt-3">
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          {/* Header (desktop) */}
          <div className="hidden grid-cols-[2fr_1fr_72px_96px_1fr_40px] items-center gap-4 border-b border-line px-5 py-2.5 sm:grid">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{t('crm.colLead')}</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{t('crm.colStage')}</div>
            <div className="text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{t('crm.score')}</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{t('crm.colAgent')}</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{t('crm.source')}</div>
            <div />
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              Icon={Target}
              title={t('crm.noLeadsMatchFilters')}
              description={t('crm.noLeadsMatchFiltersDesc')}
              className="rounded-none border-x-0 border-b-0"
            />
          ) : (
            <div className="divide-y divide-line">
              {filtered.map(lead => {
                const ug      = urgencyConfig(lead.urgency)
                const sc      = scoreColor(lead.intentScore)
                const hasRisk = lead.duplicateRisk || lead.wrongNumberRisk

                return (
                  <Link
                    key={lead.id}
                    href={`/freehold-intelligence/crm/leads/${lead.id}`}
                    className="group flex items-center gap-4 px-5 py-4 transition hover:bg-surface-2"
                  >
                    {/* Lead name */}
                    <div className="min-w-0 flex-[2] flex items-center gap-2.5">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${ug.dot}`} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {lead.leadCode && (
                            <span className="shrink-0 font-mono text-[10px] text-gold/60">{lead.leadCode}</span>
                          )}
                          <span className="text-sm font-semibold text-slate-100 group-hover:text-white truncate">
                            {lead.name}
                          </span>
                          {hasRisk && (
                            <span className="shrink-0 rounded-full border border-orange-400/20 bg-orange-400/10 px-1.5 py-0.5 text-[9px] font-semibold text-orange-300">
                              {t('crm.risk')}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500 truncate sm:hidden">
                          {lead.stage} · {lead.assignedAgent} · {lead.intentScore}
                        </div>
                      </div>
                    </div>

                    {/* Stage */}
                    <div className="hidden flex-1 sm:flex">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${stageStyle(lead.stage)}`}>
                        {lead.stage}
                      </span>
                    </div>

                    {/* Score */}
                    <div className="hidden w-[72px] flex-col items-center gap-1 sm:flex">
                      <span className={`text-sm font-bold tabular-nums ${sc.text}`}>{lead.intentScore}</span>
                      <div className="h-1 w-10 overflow-hidden rounded-full bg-surface-2">
                        <div className={`h-full rounded-full ${sc.bar}`} style={{ width: `${lead.intentScore}%` }} />
                      </div>
                    </div>

                    {/* Agent */}
                    <div className="hidden w-24 sm:block">
                      <span className="truncate text-xs text-slate-400 block">{lead.assignedAgent.split(' ')[0]}</span>
                    </div>

                    {/* Source */}
                    <div className="hidden flex-1 sm:block">
                      <span className="line-clamp-1 text-xs text-slate-500">{lead.source}</span>
                      {lead.landingId && (
                        <span className="mt-0.5 inline-flex items-center gap-1 rounded-full border border-gold/15 bg-gold/[0.06] px-1.5 py-0.5 text-[9px] font-medium text-gold/70">
                          LP · {lead.landingId}
                        </span>
                      )}
                    </div>

                    <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-600 transition group-hover:text-gold" />
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
        <span>{t('crm.leadsSortedByIntent', { count: filtered.length })}</span>
        <Link href="/freehold-intelligence/crm" className="text-gold/60 transition hover:text-gold">{t('crm.crmOverview')}</Link>
        <Link href="/freehold-intelligence/crm/inbox" className="text-gold/60 transition hover:text-gold">{t('crm.unassignedInbox')}</Link>
      </div>

    </div>
  )
}
