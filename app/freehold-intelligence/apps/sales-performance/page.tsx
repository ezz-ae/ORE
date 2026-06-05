'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, TrendingUp, AlertCircle, Clock, Phone, CheckCircle2, ArrowUpRight } from 'lucide-react'
import { crmAgentRoster, crmLeads, crmActivityLog, crmFollowUpQueue } from '@/src/features/freehold-intelligence/server-session'
import { AiPrompt } from '@/components/freehold/ai-prompt'

// Seeded response-time data (no timestamp-per-lead-arrival in V1)
const AGENT_METRICS: Record<string, { avgResponseH: number; leadToViewing: number; viewingToOffer: number; revMTD: string }> = {
  agent_noura:    { avgResponseH: 1.2, leadToViewing: 52, viewingToOffer: 38, revMTD: 'AED 11.2M' },
  agent_omar:     { avgResponseH: 3.4, leadToViewing: 38, viewingToOffer: 25, revMTD: 'AED 6.1M'  },
  agent_layla:    { avgResponseH: 2.1, leadToViewing: 44, viewingToOffer: 30, revMTD: 'AED 5.3M'  },
  agent_ahmad:    { avgResponseH: 0.8, leadToViewing: 55, viewingToOffer: 40, revMTD: 'AED 14.8M' },
  agent_sara:     { avgResponseH: 1.6, leadToViewing: 50, viewingToOffer: 35, revMTD: 'AED 9.4M'  },
  agent_rami_t:   { avgResponseH: 5.2, leadToViewing: 28, viewingToOffer: 18, revMTD: 'AED 3.7M'  },
}

const TEAM_TARGET_RESPONSE = 2.0 // hours

type SortKey = 'wins' | 'response' | 'revenue' | 'leads'
type RiskFilter = 'All' | 'duplicate' | 'wrong_number' | 'critical'

function parseRevenue(rev: string): number {
  // e.g. 'AED 11.2M' → 11200000
  const num = parseFloat(rev.replace('AED ', '').replace('M', ''))
  return num * 1_000_000
}

export default function SalesPerformancePage() {
  const agents  = crmAgentRoster
  const leads   = crmLeads
  const actLog  = crmActivityLog
  const fuQueue = crmFollowUpQueue

  const [sortKey, setSortKey] = useState<SortKey>('wins')
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('All')

  // Live computed stats
  const totalLeads    = leads.length
  const hotLeads      = leads.filter((l) => l.intentScore >= 85).length
  const callsTotal    = actLog.filter((e) => e.type === 'call').length
  const connected     = actLog.filter((e) => e.outcome === 'connected').length
  const connectRate   = callsTotal > 0 ? Math.round((connected / callsTotal) * 100) : 0
  const overdueTotal  = fuQueue.reduce((s, f) => s + (f.overdueHours > 0 ? 1 : 0), 0)
  const riskLeads     = leads.filter((l) => l.duplicateRisk || l.wrongNumberRisk).length

  // Avg response time vs target
  const agentIds = agents.map((a) => a.id)
  const avgResponse = agentIds.reduce((s, id) => s + (AGENT_METRICS[id]?.avgResponseH ?? 0), 0) / agentIds.length

  // Sorted agents
  const sortedAgents = useMemo(() => {
    return [...agents].sort((a, b) => {
      switch (sortKey) {
        case 'wins':
          return b.recentWins - a.recentWins
        case 'response':
          return (AGENT_METRICS[a.id]?.avgResponseH ?? 99) - (AGENT_METRICS[b.id]?.avgResponseH ?? 99)
        case 'revenue':
          return parseRevenue(AGENT_METRICS[b.id]?.revMTD ?? 'AED 0M') - parseRevenue(AGENT_METRICS[a.id]?.revMTD ?? 'AED 0M')
        case 'leads':
          return b.totalLeads - a.totalLeads
        default:
          return 0
      }
    })
  }, [agents, sortKey])

  // Risk-filtered leads
  const riskLeadsList = useMemo(() => {
    const base = leads.filter((l) => l.duplicateRisk || l.wrongNumberRisk || l.urgency === 'critical')
    if (riskFilter === 'All') return base
    if (riskFilter === 'duplicate')    return base.filter((l) => l.duplicateRisk === true)
    if (riskFilter === 'wrong_number') return base.filter((l) => l.wrongNumberRisk === true)
    if (riskFilter === 'critical')     return base.filter((l) => l.urgency === 'critical')
    return base
  }, [leads, riskFilter])

  const sortPills: { key: SortKey; label: string }[] = [
    { key: 'wins',     label: 'Wins' },
    { key: 'response', label: 'Response time' },
    { key: 'revenue',  label: 'Revenue' },
    { key: 'leads',    label: 'Leads' },
  ]

  const riskPills: { key: RiskFilter; label: string }[] = [
    { key: 'All',          label: 'All' },
    { key: 'duplicate',    label: 'Duplicate risk' },
    { key: 'wrong_number', label: 'Wrong number' },
    { key: 'critical',     label: 'Critical' },
  ]

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      <Link href="/freehold-intelligence/apps" className="inline-flex items-center gap-1.5 text-[12px] text-white/40 transition hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> All apps
      </Link>

      <section className="mt-7">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-wider text-[#D4AF37]/85">
            <TrendingUp className="h-3.5 w-3.5" /> Sales Performance
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/25 bg-sky-400/10 px-2.5 py-0.5 text-[12px] font-medium text-white/55">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" /> Planned
          </span>
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white/90">
          Sales signals<br /><span className="text-white/35">response, quality, risk.</span>
        </h1>
        <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-white/60">
          Agent response times, conversion rates, lead quality signals and team risk flags. Call connect rate and overdue queue are live — revenue and time-to-close will connect to HubSpot in V1.1.
        </p>
      </section>

      {/* KPI row */}
      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'Active leads',    value: totalLeads,           color: 'text-white' },
          { label: 'High intent',     value: hotLeads,             color: 'text-red-300' },
          { label: 'Connect rate',    value: `${connectRate}%`,    color: connectRate >= 50 ? 'text-[#D4AF37]' : 'text-orange-300' },
          { label: 'Overdue FU',      value: overdueTotal,         color: overdueTotal > 0 ? 'text-orange-300' : 'text-[#D4AF37]' },
          { label: 'Risk flags',      value: riskLeads,            color: riskLeads > 0 ? 'text-red-300' : 'text-[#D4AF37]' },
          { label: 'Avg. response',   value: `${avgResponse.toFixed(1)}h`, color: avgResponse <= TEAM_TARGET_RESPONSE ? 'text-[#D4AF37]' : 'text-orange-300' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-[16px] border border-white/[0.08] bg-[#131B2B] p-4">
            <div className={`text-[26px] font-semibold leading-none ${stat.color}`}>{stat.value}</div>
            <div className="mt-1.5 text-[12px] text-white/35">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Agent performance table */}
      <section className="mt-12">
        <div className="text-[13px] font-medium uppercase tracking-wider text-white/40">Agent ranking</div>
        <h2 className="mt-2 text-xl font-semibold text-white">Performance by advisor</h2>

        {/* Sort controls */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-white/35 mr-1">Sort by:</span>
          {sortPills.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSortKey(key)}
              className={`rounded-full border px-3 py-1 text-[13px] font-medium transition ${
                sortKey === key
                  ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]'
                  : 'border-white/[0.08] bg-white/[0.03] text-white/40 hover:text-white/65'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-5 overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#131B2B]">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-white/[0.05]">
                <th className="px-6 py-3 text-left text-[12px] font-medium uppercase tracking-[0.18em] text-white/30">Agent</th>
                <th className="px-4 py-3 text-center text-[12px] font-medium uppercase tracking-[0.18em] text-white/30">Leads</th>
                <th className="px-4 py-3 text-center text-[12px] font-medium uppercase tracking-[0.18em] text-white/30">Response</th>
                <th className="hidden px-4 py-3 text-center text-[12px] font-medium uppercase tracking-[0.18em] text-white/30 sm:table-cell">Lead→View</th>
                <th className="hidden px-4 py-3 text-center text-[12px] font-medium uppercase tracking-[0.18em] text-white/30 md:table-cell">Wins</th>
                <th className="px-6 py-3 text-right text-[12px] font-medium uppercase tracking-[0.18em] text-white/30">Revenue MTD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {sortedAgents.map((agent, i) => {
                const m = AGENT_METRICS[agent.id]
                const responseOk = m ? m.avgResponseH <= TEAM_TARGET_RESPONSE : true
                return (
                  <tr key={agent.id} className={`transition hover:bg-white/[0.02] ${i === 0 ? 'bg-[#D4AF37]/[0.03]' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#D4AF37]/20 to-[#D4AF37]/5 text-[13px] font-semibold text-[#D4AF37]">
                          {agent.initials}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 font-medium text-white/85">
                            {agent.name}
                            {i === 0 && <span className="rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-1.5 py-0.5 text-[8px] font-semibold text-[#D4AF37]">TOP</span>}
                          </div>
                          <div className="text-[13px] text-white/35">{agent.specialty.split(' · ')[0]}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center text-white/70">{agent.totalLeads}</td>
                    <td className="px-4 py-4 text-center">
                      <span className={`font-semibold ${responseOk ? 'text-[#D4AF37]' : 'text-orange-300'}`}>
                        {m ? `${m.avgResponseH}h` : '—'}
                      </span>
                    </td>
                    <td className="hidden px-4 py-4 text-center text-white/55 sm:table-cell">
                      {m ? `${m.leadToViewing}%` : '—'}
                    </td>
                    <td className="hidden px-4 py-4 text-center text-[#D4AF37] md:table-cell">
                      {agent.recentWins}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-white/80">
                      {m?.revMTD ?? '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[13px] text-white/30">Target response time: &lt;{TEAM_TARGET_RESPONSE}h. Revenue and conversion data seeded — live via HubSpot in V1.1.</p>
      </section>

      {/* Risk signals */}
      <section className="mt-14">
        <div className="text-[13px] font-medium uppercase tracking-wider text-white/40">Risk signals</div>
        <h2 className="mt-2 text-xl font-semibold text-white">Leads needing attention</h2>

        {/* Risk filter pills */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {riskPills.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setRiskFilter(key)}
              className={`rounded-full border px-3 py-1 text-[13px] font-medium transition ${
                riskFilter === key
                  ? key === 'All'
                    ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]'
                    : 'border-red-400/35 bg-red-400/10 text-red-300'
                  : 'border-white/[0.08] bg-white/[0.03] text-white/40 hover:text-white/65'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-2">
          {riskLeadsList.map((lead) => (
            <div key={lead.id} className="flex items-center justify-between gap-4 rounded-[16px] border border-white/[0.08] bg-[#131B2B] px-5 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-white/85">{lead.name}</span>
                  {lead.duplicateRisk  && <span className="rounded-full border border-orange-400/20 bg-orange-400/10 px-2 py-0.5 text-[12px] text-orange-300">Duplicate risk</span>}
                  {lead.wrongNumberRisk && <span className="rounded-full border border-red-400/20 bg-red-400/10 px-2 py-0.5 text-[12px] text-red-300">Wrong number</span>}
                  {lead.urgency === 'critical' && !lead.duplicateRisk && !lead.wrongNumberRisk && (
                    <span className="rounded-full border border-red-400/20 bg-red-400/10 px-2 py-0.5 text-[12px] text-red-300">Critical</span>
                  )}
                </div>
                <div className="mt-0.5 text-[12px] text-white/40">{lead.nextBestAction}</div>
              </div>
              <Link
                href={`/freehold-intelligence/crm/leads/${lead.id}`}
                className="shrink-0 inline-flex items-center gap-1 text-[13px] text-[#D4AF37]/60 transition hover:text-[#D4AF37]"
              >
                Open <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          ))}
          {riskLeadsList.length === 0 && (
            <div className="flex items-center gap-2 rounded-[16px] border border-emerald-400/15 bg-[#D4AF37]/[0.03] px-5 py-4 text-[13px] text-[#D4AF37]">
              <CheckCircle2 className="h-4 w-4" /> No risk flags active.
            </div>
          )}
        </div>
      </section>

      {/* Overdue follow-up snapshot */}
      <section className="mt-14">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[13px] font-medium uppercase tracking-wider text-white/40">Follow-up queue</div>
            <h2 className="mt-2 text-xl font-semibold text-white">Overdue by agent</h2>
          </div>
          <Link href="/freehold-intelligence/crm/follow-up" className="inline-flex items-center gap-1 text-[12px] text-[#D4AF37]/60 transition hover:text-[#D4AF37]">
            View all <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="mt-5 space-y-2">
          {fuQueue.slice(0, 4).map((fu) => (
            <div key={fu.leadId} className="flex items-center justify-between gap-4 rounded-[16px] border border-white/[0.05] bg-[#131B2B] px-5 py-4">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-white/85">{fu.leadName}</div>
                <div className="mt-0.5 text-[12px] text-white/40">
                  {fu.assignedAgent} · {fu.overdueHours}h overdue · {fu.source}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[13px] font-medium ${fu.urgency === 'critical' ? 'text-red-300' : fu.urgency === 'high' ? 'text-orange-300' : 'text-[#D4AF37]'}`}>
                  {fu.urgency}
                </span>
                <Clock className="h-3.5 w-3.5 text-white/20" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <AiPrompt
          placeholder="Ask about agent performance, response times, conversion…"
          suggestions={[
            'Which agent is most at risk of losing a hot lead?',
            'How does the team response time compare to target?',
            'Who should take the next unassigned lead?',
          ]}
        />
      </section>

    </div>
  )
}
