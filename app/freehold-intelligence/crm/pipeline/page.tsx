'use client'

import Link from 'next/link'
import { useState, useMemo } from 'react'
import { Users, ArrowRight, TrendingUp, Clock, AlertCircle } from 'lucide-react'
import { useLiveLeads } from '@/lib/freehold/use-live-leads'
import { AiPrompt } from '@/components/freehold/ai-prompt'
import { useT } from '@/lib/i18n/provider'

// Real pipeline stages (match the lead status taxonomy used across the CRM)
const STAGE_ORDER = ['New', 'Contacted', 'Qualified', 'Viewing', 'Negotiation', 'Closed']

const STAGE_NAME_KEY: Record<string, string> = {
  'New':         'crm.stage.new',
  'Contacted':   'crm.stage.contacted',
  'Qualified':   'crm.stage.qualified',
  'Viewing':     'crm.stage.viewing',
  'Negotiation': 'crm.stage.negotiation',
  'Closed':      'crm.stage.closed',
}

const STAGE_CONFIG: Record<string, { tone: string; dot: string; dotBg: string }> = {
  'New':         { tone: 'text-teal-300',    dot: 'bg-teal-400',     dotBg: 'bg-teal-400/20'    },
  'Contacted':   { tone: 'text-amber-300',  dot: 'bg-amber-400',   dotBg: 'bg-amber-400/20'  },
  'Qualified':   { tone: 'text-violet-300', dot: 'bg-violet-400',  dotBg: 'bg-violet-400/20' },
  'Viewing':     { tone: 'text-fuchsia-300',   dot: 'bg-fuchsia-400',    dotBg: 'bg-fuchsia-400/20'   },
  'Negotiation': { tone: 'text-orange-300', dot: 'bg-orange-400',  dotBg: 'bg-orange-400/20' },
  'Closed':      { tone: 'text-[#D4AF37]',  dot: 'bg-[#D4AF37]',   dotBg: 'bg-[#D4AF37]/20'  },
}

function parseBudget(s: string): number {
  const n = Number(String(s || '').replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function fmtAedShort(n: number): string {
  if (!n || n <= 0) return 'AED 0'
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `AED ${(n / 1_000).toFixed(0)}K`
  return `AED ${Math.round(n).toLocaleString()}`
}

export default function CrmPipelinePage() {
  const t = useT()
  const { leads } = useLiveLeads()
  const [activeStage, setActiveStage] = useState<string | null>(null)

  // Compute real stage counts from live lead data
  const stageCounts = useMemo(() => leads.reduce<Record<string, typeof leads>>(
    (acc, lead) => {
      ;(acc[lead.stage] = acc[lead.stage] || []).push(lead)
      return acc
    },
    {},
  ), [leads])

  const stages = useMemo(() => STAGE_ORDER.map((name) => {
    const list = stageCounts[name] || []
    const valueAed = list.reduce((s, l) => s + parseBudget(l.budgetAED), 0)
    return {
      name,
      leads: list,
      count: list.length,
      ...(STAGE_CONFIG[name] ?? { tone: 'text-slate-400', dot: 'bg-slate-500', dotBg: 'bg-white/[0.08]' }),
      value: fmtAedShort(valueAed),
      valueAed,
      delta: `${list.length} ${list.length !== 1 ? t('crm.leadsLower') : t('crm.leadLower')}`,
    }
  }), [stageCounts, t])

  const totalLeads = stages.reduce((s, st) => s + st.count, 0)
  const totalValueAed = stages.reduce((s, st) => s + st.valueAed, 0)
  const wonValueAed = stages.find((s) => s.name === 'Closed')?.valueAed ?? 0

  // If a stage is selected, show only that stage; otherwise default to Hot + Qualified
  const spotlight = useMemo(() => {
    if (activeStage) {
      const stage = stages.find((s) => s.name === activeStage)
      return stage && stage.leads.length > 0 ? [{ label: stage.name, leads: stage.leads }] : []
    }
    return stages
      .filter((s) => s.name === 'Negotiation' || s.name === 'Qualified')
      .filter((s) => s.leads.length > 0)
      .map((s) => ({ label: s.name, leads: s.leads }))
  }, [activeStage, stages])

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:pt-6">
      <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-10 xl:grid-cols-[1fr_380px] xl:gap-14">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-[#D4AF37]/85">
            <Users className="h-3.5 w-3.5" /> {t('crm.pipeline')}
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-100">
            {t('crm.salesPipelineByStage1')}<br/><span className="text-slate-500">{t('crm.salesPipelineByStage2')}</span>
          </h1>
          <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-slate-400">
            {totalLeads !== 1
              ? t('crm.pipelineSummary', { count: totalLeads, value: fmtAedShort(totalValueAed), closed: fmtAedShort(wonValueAed) })
              : t('crm.pipelineSummarySingular', { count: totalLeads, value: fmtAedShort(totalValueAed), closed: fmtAedShort(wonValueAed) })}
          </p>

          {/* Pipeline Value strip */}
          <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {stages.map((item) => (
              <div
                key={item.name}
                className="rounded-2xl border border-line bg-white/[0.05] p-4"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${item.dot}`} />
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 truncate">
                    {t(STAGE_NAME_KEY[item.name] ?? '') || item.name}
                  </span>
                </div>
                <div className="text-[22px] font-semibold text-white leading-none">{item.count}</div>
                <div className="mt-0.5 text-xs text-slate-400">{item.count !== 1 ? t('crm.leadsLower') : t('crm.leadLower')}</div>
                <div className="mt-3 text-sm font-semibold text-slate-300">{item.value}</div>
                <div className="text-xs text-slate-500">{item.name === 'Closed' ? t('crm.closedLower') : t('crm.pipelineLower')}</div>
              </div>
            ))}
          </div>

          {/* Kanban — click to filter spotlight below */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {stages.map((stage) => {
              const isSelected = activeStage === stage.name
              return (
                <button
                  key={stage.name}
                  onClick={() => setActiveStage(isSelected ? null : stage.name)}
                  className={[
                    'rounded-xl border p-5 text-left transition',
                    isSelected
                      ? 'border-[#D4AF37]/40 bg-[#D4AF37]/[0.06]'
                      : 'border-line bg-surface hover:border-line-strong',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${stage.dot}`} />
                    <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{t(STAGE_NAME_KEY[stage.name] ?? '') || stage.name}</div>
                  </div>
                  <div className="mt-3 text-[32px] font-semibold text-white">{stage.count}</div>
                  <div className="mt-1 text-xs font-medium text-slate-400">{stage.value}</div>
                  <div className={`mt-3 text-sm ${stage.tone}`}>{stage.delta}</div>
                </button>
              )
            })}
          </div>

          {activeStage && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-xs text-slate-400">{t('crm.showing')}</span>
              <span className="rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/[0.08] px-3 py-1 text-sm font-medium text-[#D4AF37]">{t(STAGE_NAME_KEY[activeStage] ?? '') || activeStage}</span>
              <button
                onClick={() => setActiveStage(null)}
                className="text-xs text-slate-500 transition hover:text-slate-300"
              >
                {t('crm.clear')}
              </button>
            </div>
          )}

          {/* Lead snapshots — filtered by selected stage, or Hot + Qualified by default */}
          {spotlight.map(({ label, leads }) => (
            <section key={label} className="mt-14">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[18px] font-semibold text-white">{t(STAGE_NAME_KEY[label] ?? '') || label}</h2>
                <span className="text-sm uppercase tracking-[0.18em] text-slate-500">{leads.length} {t('crm.activeLower')}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {leads.map((lead) => (
                  <Link
                    key={lead.id}
                    href={`/freehold-intelligence/crm/leads/${lead.id}`}
                    className="group rounded-xl border border-line bg-surface p-5 transition hover:border-[#D4AF37]/25"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white group-hover:text-white">{lead.name}</div>
                        <div className="mt-0.5 truncate text-xs text-slate-400">{lead.source}</div>
                      </div>
                      <span className="shrink-0 rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-2.5 py-0.5 text-xs font-medium text-[#D4AF37]">
                        {lead.intentScore}
                      </span>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-sm text-slate-400">
                      <span>{t('crm.agentLabel')}<span className="text-slate-300">{lead.assignedAgent}</span></span>
                      <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}

          <section className="mt-14">
            <AiPrompt
              placeholder={t('crm.aiPlaceholderPipeline')}
              suggestions={[
                t('crm.aiSuggest.stalledLeads'),
                t('crm.aiSuggest.agentsHotLeads'),
                t('crm.aiSuggest.avgTimeQualified'),
              ]}
            />
          </section>
        </div>

        {/* Sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-[112px] space-y-5">
            <div className="rounded-xl border border-line bg-surface p-5">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                <TrendingUp className="h-3 w-3" /> {t('crm.conversionRate')}
              </div>
              <div className="mt-3 text-[34px] font-semibold text-white">23%</div>
              <div className="mt-1 text-xs text-[#D4AF37]">{t('crm.vsLastMonth')}</div>
            </div>

            <div className="rounded-xl border border-line bg-surface p-5">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                <Clock className="h-3 w-3" /> {t('crm.avgTimeToClose')}
              </div>
              <div className="mt-3 text-[34px] font-semibold text-white">18d</div>
              <div className="mt-1 text-xs text-slate-400">{t('crm.target21days')}</div>
            </div>

            <div className="rounded-xl border border-red-400/20 bg-red-400/[0.04] p-5">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-red-300/80">
                <AlertCircle className="h-3 w-3" /> {t('crm.stuckStage')}
              </div>
              <div className="mt-3 text-sm font-semibold text-white">{t('crm.followUpToQualified')}</div>
              <div className="mt-2 text-xs leading-relaxed text-slate-400">
                {(stageCounts['Follow-up'] ?? []).length !== 1
                  ? t('crm.stuckStageDesc', { count: (stageCounts['Follow-up'] ?? []).length })
                  : t('crm.stuckStageDescSingular', { count: (stageCounts['Follow-up'] ?? []).length })}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
