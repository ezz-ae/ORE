'use client'

import { useEffect, useMemo, useState } from 'react'
import { Sparkles, ArrowUpRight } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { sendToExpert } from '@/lib/freehold/expert-bus'
import { STAGE_ORDER } from '@/lib/freehold/analytics-format'
import { ComparisonTable, type CmpColumn, type CmpItem, type CmpPreset } from '@/components/freehold/analytics/comparison-table'

type AgentMetric = {
  name: string; tenureDays: number | null
  totalLeads: number; hotLeads: number; wins30d: number; overdueFollowups: number
  activity30d: number; calls: number; messages: number; notes: number
}

const MAX_CAP = 12
const initialsOf = (name: string) => name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
const util = (leads: number) => Math.round((leads / MAX_CAP) * 100)
function loadColor(u: number) {
  if (u >= 90) return 'bg-red-500'
  if (u >= 65) return 'bg-amber-500'
  return 'bg-emerald-500'
}

// Computed "math" metrics derived from the raw signals.
const convRate = (a: AgentMetric) => (a.totalLeads > 0 ? Math.round((a.wins30d / a.totalLeads) * 100) : 0)
const effortPerLead = (a: AgentMetric) => (a.totalLeads > 0 ? Math.round((a.activity30d / a.totalLeads) * 10) / 10 : 0)
const responseHealth = (a: AgentMetric) => (a.totalLeads > 0 ? Math.max(0, Math.min(100, Math.round((1 - a.overdueFollowups / a.totalLeads) * 100))) : 100)

const COLUMNS: CmpColumn[] = [
  { key: 'leads', labelKey: 'analytics.col.leads', better: 'high' },
  { key: 'hot', labelKey: 'analytics.col.hot', better: 'high' },
  { key: 'wins', labelKey: 'analytics.col.wins', better: 'high' },
  { key: 'convRate', labelKey: 'analytics.col.convRate', better: 'high', fmt: (n) => `${n}%` },
  { key: 'responseHealth', labelKey: 'analytics.col.responseHealth', better: 'high', fmt: (n) => `${n}%` },
  { key: 'overdue', labelKey: 'analytics.col.overdue', better: 'low' },
  { key: 'calls', labelKey: 'analytics.col.calls', better: 'high' },
  { key: 'messages', labelKey: 'analytics.col.messages', better: 'high' },
  { key: 'activity', labelKey: 'analytics.col.activity', better: 'high' },
  { key: 'effortPerLead', labelKey: 'analytics.col.effortPerLead', better: 'high', fmt: (n) => n.toFixed(1) },
  { key: 'tenure', labelKey: 'analytics.col.tenure' },
  { key: 'utilization', labelKey: 'analytics.col.utilization', fmt: (n) => `${n}%` },
]

const PRESETS: CmpPreset[] = [
  { labelKey: 'analytics.preset.performance', columns: ['leads', 'wins', 'convRate', 'responseHealth'] },
  { labelKey: 'analytics.preset.effort', columns: ['calls', 'messages', 'activity', 'effortPerLead'] },
  { labelKey: 'analytics.preset.retention', columns: ['tenure', 'wins', 'convRate', 'activity', 'overdue'] },
  { labelKey: 'analytics.preset.full', columns: COLUMNS.map((c) => c.key) },
]

export default function TeamAnalyticsPage() {
  const t = useT()
  const [agents, setAgents] = useState<AgentMetric[] | null>(null)
  const [stages, setStages] = useState<{ stage: string; count: number }[] | null>(null)

  useEffect(() => {
    fetch('/api/freehold/analytics/team')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (Array.isArray(d?.agents)) setAgents(d.agents) })
      .catch(() => {})
    fetch('/api/freehold/analytics/leads')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setStages(d.stages ?? []) })
      .catch(() => {})
  }, [])

  const stageCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const s of stages ?? []) m[s.stage] = s.count
    return m
  }, [stages])
  const funnel = STAGE_ORDER.map((stage) => ({ stage, count: stageCounts[stage] ?? 0 }))
  const funnelMax = Math.max(1, ...funnel.map((s) => s.count))
  const hasFunnel = funnel.some((s) => s.count > 0)

  const cmpItems: CmpItem[] = useMemo(() => (agents ?? []).map((a) => ({
    id: a.name,
    label: a.name,
    values: {
      leads: a.totalLeads, hot: a.hotLeads, wins: a.wins30d, overdue: a.overdueFollowups,
      calls: a.calls, messages: a.messages, activity: a.activity30d,
      tenure: a.tenureDays ?? 0, utilization: util(a.totalLeads),
      convRate: convRate(a), effortPerLead: effortPerLead(a), responseHealth: responseHealth(a),
    },
  })), [agents])

  const questions = ['analytics.ai.q1', 'analytics.ai.q2', 'analytics.ai.q3', 'analytics.ai.q4']

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-100">{t('analytics.tab.team')}</h1>
        <p className="mt-1 text-sm text-slate-400">{t('analytics.team.sub')}</p>
      </div>

      {/* Depth: prompt the single side-docked Expert (no separate conversation) */}
      <section className="overflow-hidden rounded-xl border border-gold/20 bg-gradient-to-br from-gold/[0.08] via-gold/[0.02] to-transparent p-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-gold/25 bg-gold/10">
            <Sparkles className="h-4 w-4 text-gold" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">{t('analytics.ai.title')}</div>
            <div className="text-xs text-slate-400">{t('analytics.ai.subtitle')}</div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {questions.map((q) => (
            <button key={q} type="button" onClick={() => sendToExpert(t(q))}
              className="group inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.04] px-3.5 py-1.5 text-sm text-slate-300 transition-colors hover:border-gold/40 hover:text-white">
              {t(q)}
              <ArrowUpRight className="h-3.5 w-3.5 text-slate-500 transition-colors group-hover:text-gold" />
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">{t('analytics.ai.disclaimer')}</p>
      </section>

      {/* Custom comparison — choose metrics + items, save to Notebook */}
      <ComparisonTable items={cmpItems} columns={COLUMNS} presets={PRESETS} loading={!agents} />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Agent leaderboard */}
        <section>
          <div className="mb-4 text-xs font-medium uppercase tracking-widest text-slate-400">{t('analytics.sec.leaderboard')}</div>
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-800/50">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">{t('analytics.th.agent')}</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">{t('analytics.th.leads')}</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">{t('analytics.th.wins')}</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">{t('analytics.th.overdue')}</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">{t('analytics.th.load')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {agents && agents.length > 0 ? (
                    agents.map((ag) => {
                      const u = util(ag.totalLeads)
                      return (
                        <tr key={ag.name} className="transition hover:bg-slate-800/40">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-slate-200">{initialsOf(ag.name)}</span>
                              <span className="font-medium text-slate-200">{ag.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-300">{ag.totalLeads}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-[#D4AF37]">{ag.wins30d}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-300">{ag.overdueFollowups}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-700">
                                <div className={`h-full rounded-full ${loadColor(u)}`} style={{ width: `${Math.min(100, u)}%` }} />
                              </div>
                              <span className="w-9 text-right text-xs tabular-nums text-slate-400">{u}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                        {agents ? t('analytics.empty.agents') : t('analytics.loading')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Team pipeline */}
        <section>
          <div className="mb-4 text-xs font-medium uppercase tracking-widest text-slate-400">{t('analytics.sec.teamPipeline')}</div>
          <div className="rounded-xl border border-slate-800 bg-slate-800/50 p-5 space-y-4">
            {hasFunnel ? (
              funnel.map((step, i) => (
                <div key={step.stage}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-300">{t(`analytics.stage.${step.stage}`)}</span>
                    <span className="text-xs font-semibold tabular-nums text-slate-100">{step.count.toLocaleString('en-US')}</span>
                  </div>
                  <div className="h-6 w-full overflow-hidden rounded-lg bg-slate-800/50">
                    <div className={`h-full rounded-lg transition-all ${i === funnel.length - 1 ? 'bg-[#D4AF37]/70' : 'bg-white/[0.12]'}`} style={{ width: `${Math.round((step.count / funnelMax) * 100)}%` }} />
                  </div>
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-sm text-slate-500">{stages ? t('analytics.empty.pipeline') : t('analytics.loading')}</p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
