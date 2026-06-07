'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Search, Target, X } from 'lucide-react'
import { crmLeads } from '@/src/features/freehold-intelligence/server-session'

function urgencyConfig(u: string) {
  if (u === 'critical') return { dot: 'bg-red-400',     text: 'text-red-300',     badge: 'border-red-400/20 bg-red-400/10',       label: 'Critical' }
  if (u === 'high')     return { dot: 'bg-gold',   text: 'text-[#F8E7AE]',  badge: 'border-gold/20 bg-gold/10',  label: 'High'     }
  if (u === 'medium')   return { dot: 'bg-sky-400',     text: 'text-sky-200',    badge: 'border-sky-400/20 bg-sky-400/10',       label: 'Medium'   }
  return                       { dot: 'bg-slate-500',   text: 'text-slate-400',  badge: 'border-line-strong bg-surface-2',      label: 'Low'      }
}

function scoreColor(n: number) {
  if (n >= 85) return 'text-gold'
  if (n >= 65) return 'text-gold'
  return 'text-red-300'
}

function stageColor(stage: string) {
  if (stage === 'Hot')       return 'text-red-300 border-red-400/20 bg-red-400/10'
  if (stage === 'Qualified') return 'text-gold border-gold/20 bg-gold/10'
  if (stage === 'Follow-up') return 'text-[#F8E7AE] border-gold/20 bg-gold/10'
  if (stage === 'New')       return 'text-sky-200 border-sky-400/20 bg-sky-400/10'
  return 'text-slate-400 border-line-strong bg-surface-2'
}

const ALL_STAGES  = ['All', ...Array.from(new Set(crmLeads.map((l) => l.stage)))]
const ALL_AGENTS  = ['All', ...Array.from(new Set(crmLeads.map((l) => l.assignedAgent)))]

export default function CrmLeadsPage() {
  const [query,        setQuery]        = useState('')
  const [activeStage,  setActiveStage]  = useState('All')
  const [activeAgent,  setActiveAgent]  = useState('All')

  const sorted = useMemo(
    () => [...crmLeads].sort((a, b) => b.intentScore - a.intentScore),
    [],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return sorted.filter((lead) => {
      if (activeStage !== 'All' && lead.stage !== activeStage) return false
      if (activeAgent !== 'All' && lead.assignedAgent !== activeAgent) return false
      if (q) {
        return (
          lead.name.toLowerCase().includes(q) ||
          lead.source.toLowerCase().includes(q) ||
          lead.stage.toLowerCase().includes(q) ||
          lead.assignedAgent.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [sorted, query, activeStage, activeAgent])

  const hot       = crmLeads.filter((l) => l.urgency === 'critical' || l.urgency === 'high').length
  const avgIntent = Math.round(crmLeads.reduce((s, l) => s + l.intentScore, 0) / crmLeads.length)
  const withRisk  = crmLeads.filter((l) => l.duplicateRisk || l.wrongNumberRisk).length

  const hasFilters = query.trim() || activeStage !== 'All' || activeAgent !== 'All'

  function clearFilters() {
    setQuery('')
    setActiveStage('All')
    setActiveAgent('All')
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      {/* Header */}
      <section>
        <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-gold/85">
          <Target className="h-3.5 w-3.5" /> CRM · All Leads
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-100">
          {crmLeads.length} leads tracked.<br />
          <span className="text-slate-500">{hot} need action now.</span>
        </h1>
      </section>

      {/* Stats */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total',        value: crmLeads.length, color: 'text-white'                                    },
          { label: 'Hot / urgent', value: hot,             color: 'text-red-300'                                  },
          { label: 'Avg intent',   value: avgIntent,       color: 'text-gold'                                },
          { label: 'Risk flags',   value: withRisk,        color: withRisk > 0 ? 'text-orange-300' : 'text-white' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-line bg-surface p-4 text-center">
            <div className={`text-[26px] font-semibold leading-none ${s.color}`}>{s.value}</div>
            <div className="mt-1.5 text-xs text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="mt-8 relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, source, stage or agent…"
          className="w-full rounded-xl border border-line bg-surface-2 py-2.5 pl-10 pr-4 text-sm text-slate-300 placeholder:text-slate-500 focus:border-gold/50 focus:outline-none"
        />
      </div>

      {/* Stage filter */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-500 shrink-0">Stage:</span>
        {ALL_STAGES.map((stage) => (
          <button
            key={stage}
            onClick={() => setActiveStage(stage)}
            className={`rounded-full border px-2.5 py-0.5 text-sm font-medium transition ${
              activeStage === stage
                ? stage === 'All'
                  ? 'border-gold/30 bg-gold/10 text-gold'
                  : stageColor(stage)
                : 'border-line-strong bg-surface-2 text-slate-400 hover:text-slate-200 hover:border-slate-500'
            }`}
          >
            {stage}
          </button>
        ))}
      </div>

      {/* Agent filter */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-500 shrink-0">Agent:</span>
        {ALL_AGENTS.map((agent) => (
          <button
            key={agent}
            onClick={() => setActiveAgent(agent)}
            className={`rounded-full border px-2.5 py-0.5 text-sm font-medium transition ${
              activeAgent === agent
                ? 'border-gold/30 bg-gold/10 text-gold'
                : 'border-line-strong bg-surface-2 text-slate-400 hover:text-slate-200 hover:border-slate-500'
            }`}
          >
            {agent}
          </button>
        ))}
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="ml-1 flex items-center gap-1 rounded-full border border-line-strong bg-surface-2 px-2.5 py-0.5 text-sm text-slate-400 transition hover:text-slate-200 hover:border-slate-500"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      {/* Result count */}
      <p className="mt-3 text-sm text-slate-500">
        {filtered.length} of {crmLeads.length} leads
        {hasFilters && <span className="ml-1.5 text-gold/60">· filtered</span>}
      </p>

      {/* Lead table */}
      <section className="mt-4">
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          {/* Table header */}
          <div className="hidden grid-cols-[2fr_1fr_80px_100px_120px_40px] items-center gap-4 border-b border-line px-6 py-3 sm:grid">
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Lead</div>
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Stage</div>
            <div className="text-center text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Score</div>
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Agent</div>
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Source</div>
            <div />
          </div>

          {filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-500">
              No leads match these filters.
            </div>
          ) : (
            <div className="divide-y divide-line">
              {filtered.map((lead) => {
                const ug      = urgencyConfig(lead.urgency)
                const hasRisk = lead.duplicateRisk || lead.wrongNumberRisk

                return (
                  <Link
                    key={lead.id}
                    href={`/freehold-intelligence/crm/leads/${lead.id}`}
                    className="group flex items-center gap-4 px-6 py-4 transition hover:bg-surface-2"
                  >
                    {/* Name + urgency */}
                    <div className="min-w-0 flex-[2] flex items-center gap-2.5">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${ug.dot}`} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[14px] font-semibold text-slate-100 group-hover:text-white truncate">
                            {lead.name}
                          </span>
                          {hasRisk && (
                            <span className="shrink-0 rounded-full border border-orange-400/20 bg-orange-400/10 px-1.5 py-0.5 text-[9px] font-medium text-orange-300">
                              ⚠ risk
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-sm text-slate-500 truncate sm:hidden">
                          {lead.stage} · {lead.assignedAgent} · score {lead.intentScore}
                        </div>
                      </div>
                    </div>

                    {/* Stage */}
                    <div className="hidden flex-1 sm:flex">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${stageColor(lead.stage)}`}>
                        {lead.stage}
                      </span>
                    </div>

                    {/* Score */}
                    <div className="hidden w-20 text-center sm:block">
                      <span className={`text-sm font-semibold tabular-nums ${scoreColor(lead.intentScore)}`}>
                        {lead.intentScore}
                      </span>
                      <div className="mx-auto mt-1 h-1 w-12 overflow-hidden rounded-full bg-surface-2">
                        <div
                          className={`h-full rounded-full ${scoreColor(lead.intentScore).replace('text-', 'bg-').replace('/30', '').replace('/300', '')}`}
                          style={{ width: `${lead.intentScore}%` }}
                        />
                      </div>
                    </div>

                    {/* Agent */}
                    <div className="hidden w-28 sm:block">
                      <span className="text-xs text-slate-400 truncate block">{lead.assignedAgent}</span>
                    </div>

                    {/* Source */}
                    <div className="hidden flex-1 sm:block">
                      <span className="line-clamp-1 text-sm text-slate-500">{lead.source}</span>
                    </div>

                    {/* Arrow */}
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-600 transition group-hover:text-gold" />
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-500">
        <span>{filtered.length} leads · sorted by intent score</span>
        <Link href="/freehold-intelligence/crm" className="text-gold/60 transition hover:text-gold">
          → Intelligence view
        </Link>
        <Link href="/freehold-intelligence/crm/inbox" className="text-gold/60 transition hover:text-gold">
          → Unassigned inbox
        </Link>
      </div>

    </div>
  )
}
