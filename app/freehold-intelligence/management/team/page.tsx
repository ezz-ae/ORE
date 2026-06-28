'use client'

import { useState, useEffect } from 'react'
import {
  Users, Phone, TrendingUp, Clock, MessageSquare,
  Star, Award, Activity, CheckCircle2, Loader2,
} from 'lucide-react'
import { StatCard, Panel, PanelHeader } from '@/components/freehold/ui'
import { useT } from '@/lib/i18n/provider'
import { TeamAdmin } from './_team-admin'

interface AgentRow {
  id: string
  name: string
  email: string
  initials: string
  dbRole: string
  leadsAssigned: number
  leadsClosed: number
  lastActive: string | null
}

const RANK_COLORS = [
  'border-gold/40 bg-gold/[0.06]',
  'border-line-strong bg-surface-2',
  'border-line-strong bg-surface-2',
]
const RANK_TEXT = ['text-gold', 'text-slate-300', 'text-slate-400']
const RANK_LABELS = ['#1', '#2', '#3']

function conversionPct(a: AgentRow) {
  return a.leadsAssigned > 0 ? Math.round((a.leadsClosed / a.leadsAssigned) * 100) : 0
}

function lastActiveLabel(iso: string | null, t: (key: string, vars?: Record<string, string | number>) => string) {
  if (!iso) return t('mgmt.team.never')
  const diff = Date.now() - new Date(iso).getTime()
  const h = diff / 3_600_000
  if (h < 1)  return t('mgmt.team.minAgo', { n: Math.round(h * 60) })
  if (h < 24) return t('mgmt.team.hourAgo', { n: Math.round(h) })
  const d = Math.round(h / 24)
  return t('mgmt.team.dayAgo', { n: d })
}

export default function TeamPerformancePage() {
  const t = useT()
  const [agents,  setAgents]  = useState<AgentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy,  setSortBy]  = useState<'leadsClosed' | 'conversion' | 'leadsAssigned'>('leadsClosed')

  useEffect(() => {
    Promise.all([
      fetch('/api/freehold/team').then(r => r.json()),
      fetch('/api/freehold/crm/leads').then(r => r.ok ? r.json() : { leads: [] }),
    ]).then(([teamData, crmData]) => {
      const members: any[] = teamData.members ?? []
      const leads: any[]   = crmData.leads ?? []

      const rows: AgentRow[] = members
        .filter((m: any) => m.dbRole === 'broker')
        .map((m: any): AgentRow => {
          const myLeads   = leads.filter((l: any) => l.assignedAgent === m.id || l.assignedAgent === m.email)
          const myClosed  = myLeads.filter((l: any) => l.pipelineStage === 'closed').length
          return {
            id:            m.id,
            name:          m.name,
            email:         m.email,
            initials:      m.initials,
            dbRole:        m.dbRole,
            leadsAssigned: myLeads.length,
            leadsClosed:   myClosed,
            lastActive:    m.lastActive,
          }
        })

      setAgents(rows)
    }).finally(() => setLoading(false))
  }, [])

  const sorted = [...agents].sort((a, b) => {
    if (sortBy === 'leadsClosed')   return b.leadsClosed - a.leadsClosed
    if (sortBy === 'conversion')    return conversionPct(b) - conversionPct(a)
    return b.leadsAssigned - a.leadsAssigned
  })

  const top3            = [...agents].sort((a, b) => b.leadsClosed - a.leadsClosed).slice(0, 3)
  const totalClosed     = agents.reduce((s, a) => s + a.leadsClosed, 0)
  const totalAssigned   = agents.reduce((s, a) => s + a.leadsAssigned, 0)
  const topAgent        = top3[0]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-sm">{t('mgmt.team.loading')}</span>
      </div>
    )
  }

  if (agents.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-6 pt-8 space-y-6">
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <Users className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">{t('mgmt.team.noBrokers')}</p>
        </div>
        <TeamAdmin />
      </div>
    )
  }

  const SUMMARY_STATS = [
    { label: t('mgmt.team.totalBrokers'),  value: String(agents.length),   sub: t('mgmt.team.totalBrokersHint'),  icon: Users,        color: 'text-sky-400'     },
    { label: t('mgmt.team.leadsAssigned'), value: String(totalAssigned),   sub: t('mgmt.team.leadsAssignedHint'), icon: Activity,    color: 'text-violet-400'  },
    { label: t('mgmt.team.dealsClosed'),   value: String(totalClosed),     sub: t('mgmt.team.dealsClosedHint'),   icon: CheckCircle2, color: 'text-emerald-400' },
    { label: t('mgmt.team.topPerformer'),  value: topAgent?.name.split(' ')[0] ?? '—', sub: t('mgmt.team.topPerformerHint', { count: topAgent?.leadsClosed ?? 0 }), icon: Star, color: 'text-gold' },
  ]

  return (
    <div className="min-h-screen bg-ink pb-20">

      <div className="sticky top-0 z-30 border-b border-line bg-app/90 backdrop-blur-xl px-6 py-4">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-line-strong bg-surface-2">
              <Users className="h-4 w-4 text-slate-300" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">{t('mgmt.team.title')}</h1>
              <p className="mt-0.5 text-xs text-slate-500">{t('mgmt.team.brokersCount', { count: agents.length })}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 pt-6 space-y-6">

        <TeamAdmin />

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {SUMMARY_STATS.map(stat => (
            <StatCard key={stat.label} label={stat.label} value={stat.value} hint={stat.sub} Icon={stat.icon} />
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2 space-y-6">

            <Panel>
              <PanelHeader
                title={t('mgmt.team.allBrokers')}
                action={
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{t('mgmt.team.sortBy')}</span>
                    {(['leadsClosed', 'conversion', 'leadsAssigned'] as const).map(key => (
                      <button
                        key={key}
                        onClick={() => setSortBy(key)}
                        className={[
                          'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                          sortBy === key ? 'bg-surface-3 text-white' : 'text-slate-500 hover:text-slate-300',
                        ].join(' ')}
                      >
                        {key === 'leadsClosed' ? t('mgmt.team.sort.closed') : key === 'conversion' ? t('mgmt.team.sort.conv') : t('mgmt.team.sort.assigned')}
                      </button>
                    ))}
                  </div>
                }
              />

              <div className="hidden md:grid grid-cols-[1fr_120px_90px_90px_80px_110px] gap-3 border-b border-line px-5 py-2.5">
                {['mgmt.team.col.name', 'mgmt.team.col.email', 'mgmt.team.col.assigned', 'mgmt.team.col.closed', 'mgmt.team.col.conv', 'mgmt.team.col.lastActive'].map(h => (
                  <span key={h} className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t(h)}</span>
                ))}
              </div>

              <div className="divide-y divide-line">
                {sorted.map((agent) => {
                  const conv = conversionPct(agent)
                  const rank = top3.findIndex(a => a.id === agent.id)
                  return (
                    <div key={agent.id} className="group px-5 py-3.5 hover:bg-surface-2 transition-colors">
                      <div className="hidden md:grid grid-cols-[1fr_120px_90px_90px_80px_110px] gap-3 items-center">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={[
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                            rank === 0 ? 'bg-gold/20 text-gold' : 'bg-surface-2 text-slate-500',
                          ].join(' ')}>
                            {agent.initials}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-100 truncate">{agent.name}</p>
                            {rank >= 0 && rank <= 2 && (
                              <span className={['text-xs font-semibold', RANK_TEXT[rank]].join(' ')}>
                                {t('mgmt.team.rankThisPeriod', { rank: RANK_LABELS[rank] })}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-slate-500 truncate">{agent.email.split('@')[0]}</span>
                        <span className="text-sm font-medium text-slate-200 tabular-nums">{agent.leadsAssigned}</span>
                        <span className="text-sm font-medium text-emerald-400 tabular-nums">{agent.leadsClosed}</span>
                        <span className={['text-sm font-semibold tabular-nums', conv >= 40 ? 'text-emerald-400' : conv >= 20 ? 'text-amber-400' : 'text-slate-400'].join(' ')}>
                          {conv}%
                        </span>
                        <span className="text-xs text-slate-500">{lastActiveLabel(agent.lastActive, t)}</span>
                      </div>

                      <div className="md:hidden">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-bold text-slate-500">
                              {agent.initials}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-100">{agent.name}</p>
                              <p className="text-xs text-slate-500">{lastActiveLabel(agent.lastActive, t)}</p>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          {[
                            { label: t('mgmt.team.col.assigned'), value: agent.leadsAssigned, color: 'text-slate-200' },
                            { label: t('mgmt.team.col.closed'),   value: agent.leadsClosed,   color: 'text-emerald-400' },
                            { label: t('mgmt.team.col.conv'),     value: `${conv}%`,           color: conv >= 30 ? 'text-emerald-400' : 'text-amber-400' },
                          ].map(col => (
                            <div key={col.label} className="rounded-lg bg-surface-2 py-2">
                              <p className={['text-sm font-semibold tabular-nums', col.color].join(' ')}>{col.value}</p>
                              <p className="text-xs text-slate-600 mt-0.5">{col.label}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Panel>

          </div>

          <div className="space-y-6">
            <Panel>
              <PanelHeader title={t('mgmt.team.topPerformers')} icon={<Award className="h-4 w-4 text-gold" />} />
              <div className="grid gap-3 p-4">
                {top3.map((agent, i) => (
                  <div key={agent.id} className={['rounded-xl border p-4', RANK_COLORS[i]].join(' ')}>
                    <div className="flex items-center gap-3">
                      <div className={[
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                        i === 0 ? 'bg-gold/20 text-gold' : 'bg-surface-3 text-slate-300',
                      ].join(' ')}>
                        {agent.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={['text-sm font-bold', RANK_TEXT[i]].join(' ')}>{RANK_LABELS[i]}</p>
                        <p className="text-sm font-semibold text-white truncate">{agent.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-emerald-400">{agent.leadsClosed}</p>
                        <p className="text-xs text-slate-500">{t('mgmt.team.closedShort')}</p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">{t('mgmt.team.col.assigned')}</span>
                        <span className="text-slate-200">{agent.leadsAssigned}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">{t('mgmt.team.col.conv')}</span>
                        <span className="text-slate-200">{conversionPct(agent)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  )
}
