'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  Briefcase, TrendingUp, CheckCircle2, Clock, AlertCircle,
  ArrowUpRight, Calendar, Users, Building2, ChevronRight,
} from 'lucide-react'

const STATS = [
  { label: 'Total Active Deals',  value: '12',       delta: '+2 this week', positive: true,  icon: Briefcase },
  { label: 'Pipeline Value',      value: 'AED 8.4M', delta: '+AED 520K',    positive: true,  icon: TrendingUp },
  { label: 'Closing This Week',   value: '3',        delta: 'High priority', positive: true, icon: Clock },
  { label: 'Won This Month',      value: '8',        delta: '+3 vs May',     positive: true, icon: CheckCircle2 },
]

type Stage = 'Prospect' | 'Qualified' | 'Proposal' | 'Contract Review' | 'Closed Won'

interface Deal {
  id: string
  client: string
  property: string
  agent: string
  stage: Stage
  value: number
  expectedClose: string
  daysOpen: number
  lastActivity: number
}

const DEALS: Deal[] = [
  { id: 'DL-2026-048', client: 'David Chen',           property: 'Atlantis The Royal Penthouse, 4BR',  agent: 'Sara Al Mansoori',   stage: 'Contract Review', value: 5200000,  expectedClose: '10 Jun 2026', daysOpen: 18, lastActivity: 1 },
  { id: 'DL-2026-047', client: 'Omar Bin Salem',        property: 'Palm Jumeirah Signature Villa, 6BR', agent: 'Khalid Rashid',      stage: 'Contract Review', value: 3800000,  expectedClose: '12 Jun 2026', daysOpen: 22, lastActivity: 2 },
  { id: 'DL-2026-046', client: 'Yuki Tanaka',           property: 'Downtown Dubai 3BR Apartment',       agent: 'Omar Farouq',        stage: 'Proposal',         value: 950000,   expectedClose: '14 Jun 2026', daysOpen: 11, lastActivity: 0 },
  { id: 'DL-2026-045', client: 'Anna Volkova',          property: 'Dubai Creek Harbour Studio',         agent: 'Aisha Kamal',        stage: 'Proposal',         value: 720000,   expectedClose: '18 Jun 2026', daysOpen: 9,  lastActivity: 1 },
  { id: 'DL-2026-044', client: 'Sheikh Hamdan Al Noor', property: 'Jumeirah Bay Island Villa, 7BR',     agent: 'Sara Al Mansoori',   stage: 'Qualified',        value: 8900000,  expectedClose: '25 Jun 2026', daysOpen: 5,  lastActivity: 0 },
  { id: 'DL-2026-043', client: 'Priya Mehta',           property: 'Business Bay Penthouse, 3BR',        agent: 'Mohammed Al Rashed', stage: 'Qualified',        value: 1400000,  expectedClose: '28 Jun 2026', daysOpen: 7,  lastActivity: 3 },
  { id: 'DL-2026-042', client: 'Carlos Reyes',          property: 'JVC Townhouse, 3BR',                 agent: 'Aisha Kamal',        stage: 'Prospect',         value: 680000,   expectedClose: '05 Jul 2026', daysOpen: 3,  lastActivity: 1 },
  { id: 'DL-2026-041', client: 'Natasha Ivanova',       property: 'Emaar Beachfront 2BR',               agent: 'Omar Farouq',        stage: 'Prospect',         value: 1100000,  expectedClose: '10 Jul 2026', daysOpen: 2,  lastActivity: 0 },
  { id: 'DL-2026-040', client: 'Faisal Al Qasimi',      property: 'DIFC Penthouse, 4BR',                agent: 'Khalid Rashid',      stage: 'Proposal',         value: 2800000,  expectedClose: '20 Jun 2026', daysOpen: 14, lastActivity: 9 },
  { id: 'DL-2026-039', client: 'Wei Zhang',             property: 'Palm Jumeirah Apt, 2BR',             agent: 'Sara Al Mansoori',   stage: 'Qualified',        value: 1950000,  expectedClose: '22 Jun 2026', daysOpen: 8,  lastActivity: 8 },
  { id: 'DL-2026-038', client: 'Maria Santos',          property: 'Meydan One Tower, 1BR',              agent: 'Mohammed Al Rashed', stage: 'Prospect',         value: 620000,   expectedClose: '15 Jul 2026', daysOpen: 1,  lastActivity: 1 },
  { id: 'DL-2026-037', client: 'Tariq Bin Zayed',       property: 'Emirates Hills Compound, 5BR',       agent: 'Khalid Rashid',      stage: 'Contract Review', value: 4200000,  expectedClose: '08 Jun 2026', daysOpen: 29, lastActivity: 12 },
]

const CLOSED_DEALS = [
  { id: 'DL-2026-036', client: 'Ahmed Hassan',     property: 'Palm Jumeirah Villa, 4BR',     agent: 'Sara Al Mansoori',   value: 4200000,  closedOn: '02 Jun 2026' },
  { id: 'DL-2026-035', client: 'Priya Nair',       property: 'Downtown Dubai 2BR',           agent: 'Khalid Rashid',      value: 890000,   closedOn: '01 Jun 2026' },
  { id: 'DL-2026-034', client: 'James O\'Brien',   property: 'Dubai Hills Villa 3BR',        agent: 'Sara Al Mansoori',   value: 1480000,  closedOn: '30 May 2026' },
  { id: 'DL-2026-033', client: 'Liu Wei',           property: 'Business Bay Studio',          agent: 'Omar Farouq',        value: 650000,   closedOn: '29 May 2026' },
  { id: 'DL-2026-032', client: 'Nadia Kowalski',   property: 'Meydan One 2BR',               agent: 'Aisha Kamal',        value: 890000,   closedOn: '28 May 2026' },
]

const PIPELINE_STAGES: { stage: Stage; color: string; bgColor: string; borderColor: string }[] = [
  { stage: 'Prospect',        color: 'text-slate-400',   bgColor: 'bg-slate-800',      borderColor: 'border-slate-700' },
  { stage: 'Qualified',       color: 'text-sky-400',     bgColor: 'bg-sky-500/10',     borderColor: 'border-sky-500/30' },
  { stage: 'Proposal',        color: 'text-violet-400',  bgColor: 'bg-violet-500/10',  borderColor: 'border-violet-500/30' },
  { stage: 'Contract Review', color: 'text-amber-400',   bgColor: 'bg-amber-500/10',   borderColor: 'border-amber-500/30' },
  { stage: 'Closed Won',      color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/30' },
]

const STAGE_BADGE: Record<Stage, string> = {
  'Prospect':        'bg-slate-700/70 text-slate-300',
  'Qualified':       'bg-sky-500/15 text-sky-400',
  'Proposal':        'bg-violet-500/15 text-violet-400',
  'Contract Review': 'bg-amber-500/15 text-amber-400',
  'Closed Won':      'bg-emerald-500/15 text-emerald-400',
}

function fmtAED(n: number) {
  if (n >= 1000000) return `AED ${(n / 1000000).toFixed(2)}M`
  if (n >= 1000)    return `AED ${(n / 1000).toFixed(0)}K`
  return `AED ${n.toLocaleString()}`
}

export default function DealsPage() {
  const [activeFilter, setActiveFilter] = useState<Stage | 'All'>('All')

  const atRisk = DEALS.filter(d => d.lastActivity >= 7)
  const filtered = activeFilter === 'All' ? DEALS : DEALS.filter(d => d.stage === activeFilter)

  return (
    <div className="min-h-screen pb-16 bg-[#0D1117]">
      {/* Header */}
      <div className="border-b border-slate-800 bg-[#090C12]/80 px-6 py-5 backdrop-blur-xl sticky top-0 z-30">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-white">Deals Pipeline</h1>
            <p className="mt-0.5 text-sm text-slate-500">June 2026 · {DEALS.length} active deals · AED 8.4M pipeline</p>
          </div>
          <div className="flex items-center gap-3">
            {atRisk.length > 0 && (
              <div className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1">
                <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-xs font-medium text-amber-400">{atRisk.length} at risk</span>
              </div>
            )}
            <button
              onClick={() => toast.success('New deal — opening deal form')}
              className="rounded-lg border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-1.5 text-sm font-medium text-[#D4AF37] hover:bg-[#D4AF37]/20 transition-colors">
              + New Deal
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 pt-6 space-y-6">

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {STATS.map((stat) => (
            <div key={stat.label} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex items-start justify-between gap-2 mb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-800">
                  <stat.icon className="h-4 w-4 text-slate-400" />
                </div>
                <span className={[
                  'text-xs font-semibold',
                  stat.positive ? 'text-emerald-400' : 'text-red-400',
                ].join(' ')}>
                  {stat.delta}
                </span>
              </div>
              <p className="text-2xl font-semibold text-white tabular-nums tracking-tight">{stat.value}</p>
              <p className="mt-1 text-sm font-medium text-slate-400">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Pipeline Kanban Summary */}
        <div className="rounded-xl border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 px-5 py-4">
            <h2 className="text-sm font-semibold text-white">Pipeline Overview</h2>
            <p className="text-xs text-slate-500 mt-0.5">Deal count and value per stage</p>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              {PIPELINE_STAGES.map(({ stage, color, bgColor, borderColor }, idx) => {
                const stageDeals = DEALS.filter(d => d.stage === stage)
                const stageValue = stageDeals.reduce((s, d) => s + d.value, 0)
                return (
                  <div key={stage} className="relative">
                    <div className={[
                      'rounded-xl border p-4 cursor-pointer transition-all duration-200',
                      bgColor, borderColor,
                      activeFilter === stage ? 'ring-1 ring-offset-1 ring-offset-[#0D1117]' : 'hover:opacity-90',
                    ].join(' ')}
                      onClick={() => setActiveFilter(activeFilter === stage ? 'All' : stage)}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className={['text-xs font-semibold uppercase tracking-wider', color].join(' ')}>
                          {stage}
                        </span>
                        <span className={['flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold', bgColor, color].join(' ')}>
                          {stageDeals.length}
                        </span>
                      </div>
                      <p className={['text-lg font-bold tabular-nums', color].join(' ')}>
                        {fmtAED(stageValue)}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {stageDeals.length} deal{stageDeals.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    {idx < PIPELINE_STAGES.length - 1 && (
                      <div className="hidden xl:flex absolute -right-1.5 top-1/2 -translate-y-1/2 z-10">
                        <ChevronRight className="h-4 w-4 text-slate-700" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={() => setActiveFilter('All')}
                className={[
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  activeFilter === 'All'
                    ? 'bg-slate-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200',
                ].join(' ')}
              >
                Show All ({DEALS.length})
              </button>
              {activeFilter !== 'All' && (
                <span className="text-xs text-slate-500">
                  Showing {filtered.length} deals in <span className="text-slate-300 font-medium">{activeFilter}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* At Risk Section */}
        {atRisk.length > 0 && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04]">
            <div className="flex items-center gap-3 border-b border-amber-500/15 px-5 py-4">
              <AlertCircle className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-white">At Risk — No Activity in 7+ Days</h2>
              <span className="ml-auto text-xs text-amber-400 font-medium">{atRisk.length} deals</span>
            </div>
            <div className="divide-y divide-amber-500/10">
              {atRisk.map((deal) => (
                <div key={deal.id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-mono text-slate-500">{deal.id}</span>
                      <span className={['rounded-full px-2 py-0.5 text-xs font-medium', STAGE_BADGE[deal.stage]].join(' ')}>
                        {deal.stage}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-100 truncate">{deal.property}</p>
                    <p className="text-xs text-slate-500">{deal.client} · {deal.agent}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-white tabular-nums">{fmtAED(deal.value)}</p>
                    <p className="text-xs text-amber-400 font-medium">{deal.lastActivity}d no activity</p>
                  </div>
                  <button
                    onClick={() => toast.success('Follow-up reminder scheduled')}
                    className="shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/20 transition-colors whitespace-nowrap">
                    Follow Up
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Deals Table */}
        <div className="rounded-xl border border-slate-800 bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-white">
                Active Deals
                {activeFilter !== 'All' && (
                  <span className="ml-2 text-slate-500 font-normal">— {activeFilter}</span>
                )}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">{filtered.length} deals · {fmtAED(filtered.reduce((s, d) => s + d.value, 0))} total value</p>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-slate-500" />
              <Users className="h-4 w-4 text-slate-500" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-800/40">
                  {['Deal ID', 'Client', 'Property', 'Agent', 'Stage', 'Value', 'Expected Close', 'Days Open'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filtered.map((deal) => (
                  <tr
                    key={deal.id}
                    className={[
                      'transition-colors cursor-pointer',
                      deal.lastActivity >= 7
                        ? 'bg-amber-500/[0.03] hover:bg-amber-500/[0.06]'
                        : 'hover:bg-slate-800/30',
                    ].join(' ')}
                  >
                    <td className="px-4 py-3 text-xs font-mono text-slate-400 whitespace-nowrap">{deal.id}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-100 whitespace-nowrap">{deal.client}</td>
                    <td className="px-4 py-3 text-sm text-slate-400 max-w-[200px] truncate">{deal.property}</td>
                    <td className="px-4 py-3 text-sm text-slate-400 whitespace-nowrap">{deal.agent}</td>
                    <td className="px-4 py-3">
                      <span className={['rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap', STAGE_BADGE[deal.stage]].join(' ')}>
                        {deal.stage}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-white tabular-nums whitespace-nowrap">
                      {fmtAED(deal.value)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400 whitespace-nowrap">{deal.expectedClose}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={[
                          'text-sm font-semibold tabular-nums',
                          deal.daysOpen > 20 ? 'text-amber-400' : 'text-slate-300',
                        ].join(' ')}>
                          {deal.daysOpen}d
                        </span>
                        {deal.lastActivity >= 7 && (
                          <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recently Closed */}
        <div className="rounded-xl border border-slate-800 bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Recently Closed</h2>
              <p className="text-xs text-slate-500 mt-0.5">Last 5 won deals — June 2026</p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-xs font-medium text-emerald-400">8 won this month</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-800/40">
                  {['Deal ID', 'Client', 'Property', 'Agent', 'Value', 'Closed On'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {CLOSED_DEALS.map((deal) => (
                  <tr key={deal.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 text-xs font-mono text-slate-400">{deal.id}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-100">{deal.client}</td>
                    <td className="px-4 py-3 text-sm text-slate-400 max-w-[220px] truncate">{deal.property}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{deal.agent}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-emerald-400 tabular-nums whitespace-nowrap">
                      {fmtAED(deal.value)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <span className="text-sm text-slate-400 whitespace-nowrap">{deal.closedOn}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-700 bg-slate-800/40">
                  <td colSpan={4} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    5 Closed Deals Total
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-emerald-400 tabular-nums">
                    {fmtAED(CLOSED_DEALS.reduce((s, d) => s + d.value, 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}
