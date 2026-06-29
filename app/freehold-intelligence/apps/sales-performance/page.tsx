'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, TrendingUp, Loader2 } from 'lucide-react'

// Live team metrics from the CRM (same source as Analytics → Team).
type AgentMetric = {
  id: string
  name: string
  tenureDays: number | null
  totalLeads: number
  hotLeads: number
  wins30d: number
  overdueFollowups: number
  activity30d: number
  calls: number
  messages: number
  notes: number
}

type SortKey = 'wins' | 'leads' | 'overdue' | 'activity'

const initialsOf = (name: string) =>
  name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()

export default function SalesPerformancePage() {
  const [agents, setAgents] = useState<AgentMetric[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('wins')

  useEffect(() => {
    fetch('/api/freehold/analytics/team')
      .then((r) => r.json())
      .then((d) => setAgents(Array.isArray(d.agents) ? d.agents : []))
      .catch(() => setAgents([]))
      .finally(() => setLoading(false))
  }, [])

  const totalLeads    = agents.reduce((s, a) => s + a.totalLeads, 0)
  const hotLeads      = agents.reduce((s, a) => s + a.hotLeads, 0)
  const overdueTotal  = agents.reduce((s, a) => s + a.overdueFollowups, 0)
  const winsTotal     = agents.reduce((s, a) => s + a.wins30d, 0)
  const activityTotal = agents.reduce((s, a) => s + a.activity30d, 0)

  const sortedAgents = useMemo(() => {
    return [...agents].sort((a, b) => {
      switch (sortKey) {
        case 'wins':     return b.wins30d - a.wins30d
        case 'leads':    return b.totalLeads - a.totalLeads
        case 'overdue':  return b.overdueFollowups - a.overdueFollowups
        case 'activity': return b.activity30d - a.activity30d
        default:         return 0
      }
    })
  }, [agents, sortKey])

  const sortPills: { key: SortKey; label: string }[] = [
    { key: 'wins',     label: 'Wins' },
    { key: 'leads',    label: 'Leads' },
    { key: 'overdue',  label: 'Overdue' },
    { key: 'activity', label: 'Activity' },
  ]

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      <Link href="/freehold-intelligence/apps" className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> All apps
      </Link>

      <section className="mt-7">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold/85">
          <TrendingUp className="h-3.5 w-3.5" /> Sales Performance
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
          Sales signals<br /><span className="text-slate-500">leads, wins, activity, risk.</span>
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-300">
          Per-agent leads, hot pipeline, overdue follow-ups, wins and logged activity — live from CRM data.
        </p>
      </section>

      {loading && (
        <div className="mt-10 flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> <span className="text-sm">Loading performance…</span>
        </div>
      )}

      {!loading && agents.length === 0 && (
        <div className="mt-10 rounded-[22px] border border-line bg-surface py-14 text-center text-sm text-slate-500">
          No team performance data yet. Figures appear here once the CRM has agents and activity.
        </div>
      )}

      {!loading && agents.length > 0 && (
        <>
          {/* KPI row — real aggregates */}
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { label: 'Active leads', value: totalLeads,    color: 'text-white' },
              { label: 'High intent',  value: hotLeads,      color: hotLeads > 0 ? 'text-red-300' : 'text-white' },
              { label: 'Overdue FU',   value: overdueTotal,  color: overdueTotal > 0 ? 'text-orange-300' : 'text-gold' },
              { label: 'Wins · 30d',   value: winsTotal,     color: 'text-gold' },
              { label: 'Activity·30d', value: activityTotal, color: 'text-white' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-[16px] border border-line bg-surface p-4">
                <div className={`text-[26px] font-semibold leading-none ${stat.color}`}>{stat.value}</div>
                <div className="mt-1.5 text-xs text-slate-500">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Agent ranking */}
          <section className="mt-12">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Agent ranking</div>
            <h2 className="mt-2 text-xl font-semibold text-white">Performance by advisor</h2>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-sm text-slate-500">Sort by:</span>
              {sortPills.map(({ key, label }) => (
                <button key={key} onClick={() => setSortKey(key)}
                  className={`rounded-full border px-3 py-1 text-sm font-medium transition ${
                    sortKey === key ? 'border-gold/40 bg-gold/10 text-gold' : 'border-line bg-surface-2 text-slate-500 hover:text-slate-300'
                  }`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-5 overflow-hidden rounded-[22px] border border-line bg-surface">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Agent</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Leads</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Hot</th>
                    <th className="hidden px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 sm:table-cell">Overdue</th>
                    <th className="hidden px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 md:table-cell">Activity</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Wins · 30d</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {sortedAgents.map((agent, i) => (
                    <tr key={agent.id} className={`transition hover:bg-surface-2 ${i === 0 ? 'bg-gold/[0.03]' : ''}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-gold/20 to-gold/5 text-sm font-semibold text-gold">
                            {initialsOf(agent.name)}
                          </div>
                          <div className="flex items-center gap-1.5 font-medium text-slate-100">
                            {agent.name}
                            {i === 0 && sortKey === 'wins' && <span className="rounded-full border border-gold/25 bg-gold/10 px-1.5 py-0.5 text-[8px] font-semibold text-gold">TOP</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center text-slate-300">{agent.totalLeads}</td>
                      <td className="px-4 py-4 text-center">
                        <span className={`font-semibold ${agent.hotLeads > 0 ? 'text-red-400' : 'text-slate-600'}`}>{agent.hotLeads}</span>
                      </td>
                      <td className="hidden px-4 py-4 text-center sm:table-cell">
                        <span className={agent.overdueFollowups > 0 ? 'text-orange-300' : 'text-slate-500'}>{agent.overdueFollowups}</span>
                      </td>
                      <td className="hidden px-4 py-4 text-center text-slate-400 md:table-cell">{agent.activity30d}</td>
                      <td className="px-6 py-4 text-right font-semibold text-gold">{agent.wins30d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              Ranked by {sortKey === 'wins' ? 'wins in the last 30 days' : sortKey === 'leads' ? 'total leads' : sortKey === 'overdue' ? 'overdue follow-ups' : 'logged activity'}.
            </p>
          </section>
        </>
      )}
    </div>
  )
}
