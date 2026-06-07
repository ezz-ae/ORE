'use client'

import { useState } from 'react'
import {
  Users, Phone, Calendar, FileText, TrendingUp,
  Clock, MessageSquare, Star, Award, Activity,
  CheckCircle2, Circle,
} from 'lucide-react'
import { StatCard, Panel, PanelHeader } from '@/components/freehold/ui'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Agent {
  id: number
  name: string
  role: string
  avatar: string
  leadsAssigned: number
  leadsClosed: number
  calls: number
  lastActive: string
  status: 'online' | 'offline' | 'away'
  responseTime: number // minutes
}

interface CRMActivity {
  id: number
  agent: string
  action: string
  target: string
  time: string
  type: 'call' | 'meeting' | 'note' | 'deal' | 'message'
}

// ─── Mock data ─────────────────────────────────────────────────────────────────

const AGENTS: Agent[] = [
  {
    id: 1,
    name: 'Sara Al Mansoori',
    role: 'Senior Agent',
    avatar: 'SA',
    leadsAssigned: 34,
    leadsClosed: 12,
    calls: 58,
    lastActive: '2 min ago',
    status: 'online',
    responseTime: 8,
  },
  {
    id: 2,
    name: 'Ahmad Khalil',
    role: 'Senior Agent',
    avatar: 'AK',
    leadsAssigned: 29,
    leadsClosed: 9,
    calls: 47,
    lastActive: '5 min ago',
    status: 'online',
    responseTime: 12,
  },
  {
    id: 3,
    name: 'Fatima Hassan',
    role: 'Agent',
    avatar: 'FH',
    leadsAssigned: 22,
    leadsClosed: 7,
    calls: 41,
    lastActive: '14 min ago',
    status: 'online',
    responseTime: 15,
  },
  {
    id: 4,
    name: 'Omar Al Rashid',
    role: 'Agent',
    avatar: 'OR',
    leadsAssigned: 19,
    leadsClosed: 5,
    calls: 33,
    lastActive: '1 hr ago',
    status: 'away',
    responseTime: 22,
  },
  {
    id: 5,
    name: 'Layla Nasser',
    role: 'Agent',
    avatar: 'LN',
    leadsAssigned: 17,
    leadsClosed: 4,
    calls: 29,
    lastActive: '3 hr ago',
    status: 'offline',
    responseTime: 31,
  },
  {
    id: 6,
    name: 'Hassan Al Ali',
    role: 'Junior Agent',
    avatar: 'HA',
    leadsAssigned: 15,
    leadsClosed: 3,
    calls: 24,
    lastActive: '4 hr ago',
    status: 'offline',
    responseTime: 38,
  },
  {
    id: 7,
    name: 'Nour Ibrahim',
    role: 'Junior Agent',
    avatar: 'NI',
    leadsAssigned: 14,
    leadsClosed: 2,
    calls: 21,
    lastActive: '5 hr ago',
    status: 'offline',
    responseTime: 42,
  },
  {
    id: 8,
    name: 'Yasmin Mohammed',
    role: 'Agent',
    avatar: 'YM',
    leadsAssigned: 18,
    leadsClosed: 4,
    calls: 30,
    lastActive: '20 min ago',
    status: 'online',
    responseTime: 19,
  },
]

const CRM_FEED: CRMActivity[] = [
  { id: 1, agent: 'Sara Al Mansoori',  action: 'Called',           target: 'Lead #L-901 · Reem Al Mansouri',     time: '10 min ago', type: 'call' },
  { id: 2, agent: 'Ahmad Khalil',      action: 'Scheduled meeting', target: 'Client Ahmed Hassan — Palm viewing', time: '25 min ago', type: 'meeting' },
  { id: 3, agent: 'Fatima Hassan',     action: 'Added note to',     target: 'Deal #D-1047 — Contract review',     time: '40 min ago', type: 'note' },
  { id: 4, agent: 'Sara Al Mansoori',  action: 'Moved deal to',     target: '"Closed Won" — AED 3.2M villa',      time: '52 min ago', type: 'deal' },
  { id: 5, agent: 'Yasmin Mohammed',   action: 'Sent WhatsApp to',  target: 'Lead #L-887 · Follow-up message',    time: '1 hr ago',   type: 'message' },
  { id: 6, agent: 'Omar Al Rashid',    action: 'Completed tour for', target: 'Creek Harbour 2BR — Client Nadia',  time: '1.5 hr ago', type: 'meeting' },
  { id: 7, agent: 'Ahmad Khalil',      action: 'Called',            target: 'Lead #L-915 · Khaled Al Farsi',      time: '2 hr ago',   type: 'call' },
  { id: 8, agent: 'Hassan Al Ali',     action: 'Added note to',     target: 'Lead #L-892 — Emaar interest noted', time: '3 hr ago',   type: 'note' },
]

// Heatmap: hours 8–18, Mon–Fri. Values 0-4 intensity
const HEATMAP_HOURS = ['8AM', '9AM', '10AM', '11AM', '12PM', '1PM', '2PM', '3PM', '4PM', '5PM', '6PM']
const HEATMAP_DAYS  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const HEATMAP_DATA: number[][] = [
  [1, 2, 3, 3, 2, 1, 2, 3, 2, 1, 0], // Mon
  [2, 4, 4, 3, 2, 2, 3, 4, 3, 2, 1], // Tue
  [1, 3, 4, 4, 3, 2, 3, 3, 2, 1, 0], // Wed
  [2, 3, 4, 4, 2, 2, 4, 4, 3, 2, 1], // Thu
  [1, 2, 3, 2, 1, 1, 2, 2, 1, 0, 0], // Fri
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function conversionPct(agent: Agent) {
  return agent.leadsAssigned > 0
    ? Math.round((agent.leadsClosed / agent.leadsAssigned) * 100)
    : 0
}

function heatColor(val: number) {
  if (val === 0) return 'bg-surface-2 border-line-strong'
  if (val === 1) return 'bg-gold/15 border-gold/20'
  if (val === 2) return 'bg-gold/30 border-gold/30'
  if (val === 3) return 'bg-gold/55 border-gold/40'
  return 'bg-gold/85 border-gold/50'
}

const STATUS_STYLES = {
  online:  { dot: 'bg-emerald-400', label: 'text-emerald-400', badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' },
  away:    { dot: 'bg-amber-400',   label: 'text-amber-400',   badge: 'border-amber-500/30 bg-amber-500/10 text-amber-400' },
  offline: { dot: 'bg-surface-3',   label: 'text-slate-500',   badge: 'border-line-strong bg-surface-2 text-slate-500' },
}

const ACTIVITY_ICONS = {
  call:    Phone,
  meeting: Calendar,
  note:    FileText,
  deal:    TrendingUp,
  message: MessageSquare,
}

const ACTIVITY_COLORS = {
  call:    'text-sky-400 bg-sky-500/10 border-sky-500/20',
  meeting: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  note:    'text-slate-400 bg-surface-3 border-line-strong',
  deal:    'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  message: 'text-green-400 bg-green-500/10 border-green-500/20',
}

const RANK_LABELS = ['#1', '#2', '#3']
const RANK_COLORS = [
  'border-gold/40 bg-gold/[0.06]',
  'border-line-strong bg-surface-2',
  'border-line-strong bg-surface-2',
]
const RANK_TEXT = ['text-gold', 'text-slate-300', 'text-slate-400']

// ─── Component ────────────────────────────────────────────────────────────────

export default function TeamPerformancePage() {
  const [sortBy, setSortBy] = useState<'leadsClosed' | 'conversion' | 'calls'>('leadsClosed')

  const totalLeadsToday    = 14
  const closedThisMonth    = AGENTS.reduce((s, a) => s + a.leadsClosed, 0)
  const avgResponseTime    = Math.round(AGENTS.reduce((s, a) => s + a.responseTime, 0) / AGENTS.length)
  const topAgent           = [...AGENTS].sort((a, b) => b.leadsClosed - a.leadsClosed)[0]
  const onlineCount        = AGENTS.filter(a => a.status === 'online').length

  const sorted = [...AGENTS].sort((a, b) => {
    if (sortBy === 'leadsClosed') return b.leadsClosed - a.leadsClosed
    if (sortBy === 'conversion')  return conversionPct(b) - conversionPct(a)
    return b.calls - a.calls
  })

  const top3 = [...AGENTS]
    .sort((a, b) => b.leadsClosed - a.leadsClosed)
    .slice(0, 3)

  const SUMMARY_STATS = [
    {
      label: 'New Leads Today',
      value: String(totalLeadsToday),
      sub: 'from Meta & Google',
      icon: Activity,
      color: 'text-sky-400',
      bg:   'bg-sky-500/10 border-sky-500/20',
    },
    {
      label: 'Closed This Month',
      value: `${closedThisMonth} deals`,
      sub: 'across all agents',
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bg:   'bg-emerald-500/10 border-emerald-500/20',
    },
    {
      label: 'Avg Response Time',
      value: `${avgResponseTime} min`,
      sub: 'team average',
      icon: Clock,
      color: 'text-amber-400',
      bg:   'bg-amber-500/10 border-amber-500/20',
    },
    {
      label: 'Best Performer',
      value: topAgent.name.split(' ')[0],
      sub: `${topAgent.leadsClosed} deals closed`,
      icon: Star,
      color: 'text-gold',
      bg:   'bg-gold/10 border-gold/20',
    },
  ]

  return (
    <div className="min-h-screen bg-ink pb-20">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 border-b border-line bg-app/90 backdrop-blur-xl px-6 py-4">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-line-strong bg-surface-2">
              <Users className="h-4 w-4 text-slate-300" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">Team Performance</h1>
              <p className="mt-0.5 text-xs text-slate-500">
                {onlineCount} of {AGENTS.length} agents online
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-medium text-emerald-400">{onlineCount} Online</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 pt-6 space-y-6">

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {SUMMARY_STATS.map(stat => (
            <StatCard key={stat.label} label={stat.label} value={stat.value} hint={stat.sub} Icon={stat.icon} />
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          {/* ── Left + center: table + rankings ──────────────────────────── */}
          <div className="xl:col-span-2 space-y-6">

            <Panel>
              <PanelHeader
                title="All Agents"
                action={<div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Sort by:</span>
                  {(['leadsClosed', 'conversion', 'calls'] as const).map(key => (
                    <button
                      key={key}
                      onClick={() => setSortBy(key)}
                      className={[
                        'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                        sortBy === key
                          ? 'bg-surface-3 text-white'
                          : 'text-slate-500 hover:text-slate-300',
                      ].join(' ')}
                    >
                      {key === 'leadsClosed' ? 'Closed' : key === 'conversion' ? 'Conv %' : 'Calls'}
                    </button>
                  ))}
                </div>} />

              {/* Table header */}
              <div className="hidden md:grid grid-cols-[1fr_100px_80px_80px_80px_90px_100px_90px] gap-3 border-b border-line px-5 py-2.5">
                {['Name', 'Role', 'Assigned', 'Closed', 'Conv %', 'Calls', 'Last Active', 'Status'].map(h => (
                  <span key={h} className="text-xs font-semibold uppercase tracking-wider text-slate-500">{h}</span>
                ))}
              </div>

              <div className="divide-y divide-line">
                {sorted.map((agent, idx) => {
                  const conv   = conversionPct(agent)
                  const status = STATUS_STYLES[agent.status]
                  const rank   = top3.findIndex(a => a.id === agent.id)
                  return (
                    <div
                      key={agent.id}
                      className="group px-5 py-3.5 hover:bg-surface-2 transition-colors"
                    >
                      {/* Desktop */}
                      <div className="hidden md:grid grid-cols-[1fr_100px_80px_80px_80px_90px_100px_90px] gap-3 items-center">
                        {/* Name */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={[
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                            rank === 0 ? 'bg-gold/20 text-gold' :
                            rank === 1 ? 'bg-surface-3 text-slate-300' :
                            rank === 2 ? 'bg-surface-3 text-slate-400' :
                                         'bg-surface-2 text-slate-500',
                          ].join(' ')}>
                            {agent.avatar}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-100 truncate">{agent.name}</p>
                            {rank >= 0 && rank <= 2 && (
                              <span className={['text-xs font-semibold', RANK_TEXT[rank]].join(' ')}>
                                {RANK_LABELS[rank]} this month
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Role */}
                        <span className="text-xs text-slate-500">{agent.role}</span>
                        {/* Assigned */}
                        <span className="text-sm font-medium text-slate-200 tabular-nums">{agent.leadsAssigned}</span>
                        {/* Closed */}
                        <span className="text-sm font-medium text-emerald-400 tabular-nums">{agent.leadsClosed}</span>
                        {/* Conv % */}
                        <div>
                          <span className={[
                            'text-sm font-semibold tabular-nums',
                            conv >= 40 ? 'text-emerald-400' :
                            conv >= 25 ? 'text-amber-400' :
                                          'text-red-400',
                          ].join(' ')}>{conv}%</span>
                        </div>
                        {/* Calls */}
                        <span className="text-sm text-slate-300 tabular-nums">{agent.calls}</span>
                        {/* Last active */}
                        <span className="text-xs text-slate-500">{agent.lastActive}</span>
                        {/* Status */}
                        <div>
                          <span className={[
                            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
                            status.badge,
                          ].join(' ')}>
                            <span className={['h-1.5 w-1.5 rounded-full', status.dot].join(' ')} />
                            {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
                          </span>
                        </div>
                      </div>

                      {/* Mobile */}
                      <div className="md:hidden">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2">
                            <div className={[
                              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                              rank === 0 ? 'bg-gold/20 text-gold' : 'bg-surface-2 text-slate-500',
                            ].join(' ')}>
                              {agent.avatar}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-100">{agent.name}</p>
                              <p className="text-xs text-slate-500">{agent.role}</p>
                            </div>
                          </div>
                          <span className={[
                            'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium',
                            status.badge,
                          ].join(' ')}>
                            <span className={['h-1.5 w-1.5 rounded-full', status.dot].join(' ')} />
                            {agent.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-center">
                          {[
                            { label: 'Assigned', value: agent.leadsAssigned, color: 'text-slate-200' },
                            { label: 'Closed', value: agent.leadsClosed, color: 'text-emerald-400' },
                            { label: 'Conv %', value: `${conv}%`, color: conv >= 30 ? 'text-emerald-400' : 'text-amber-400' },
                            { label: 'Calls', value: agent.calls, color: 'text-slate-300' },
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

            <Panel>
              <PanelHeader title="Top Performers — This Month" icon={<Award className="h-4 w-4 text-gold" />} />
              <div className="grid gap-3 p-4 sm:grid-cols-3">
                {top3.map((agent, i) => (
                  <div
                    key={agent.id}
                    className={[
                      'rounded-xl border p-4 text-center',
                      RANK_COLORS[i],
                    ].join(' ')}
                  >
                    <div className={[
                      'mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full text-base font-bold',
                      i === 0 ? 'bg-gold/20 text-gold' :
                      i === 1 ? 'bg-surface-3 text-slate-200' :
                               'bg-surface-3 text-slate-400',
                    ].join(' ')}>
                      {agent.avatar}
                    </div>
                    <p className={['text-lg font-bold mb-0.5', RANK_TEXT[i]].join(' ')}>{RANK_LABELS[i]}</p>
                    <p className="text-sm font-semibold text-white">{agent.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{agent.role}</p>
                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Closed</span>
                        <span className="font-semibold text-emerald-400">{agent.leadsClosed}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Conv %</span>
                        <span className="font-semibold text-slate-200">{conversionPct(agent)}%</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Calls</span>
                        <span className="font-semibold text-slate-300">{agent.calls}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          {/* ── Right column ─────────────────────────────────────────────── */}
          <div className="space-y-6">

            <Panel>
              <PanelHeader
                title="Recent CRM Activity"
                icon={<span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />}
              />
              <div className="divide-y divide-line">
                {CRM_FEED.map(item => {
                  const Icon   = ACTIVITY_ICONS[item.type]
                  const colors = ACTIVITY_COLORS[item.type]
                  return (
                    <div key={item.id} className="flex items-start gap-3 px-4 py-3.5">
                      <div className={[
                        'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs',
                        colors,
                      ].join(' ')}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-300">{item.agent}</p>
                        <p className="text-xs text-slate-500">
                          <span>{item.action}</span>{' '}
                          <span className="text-slate-400">{item.target}</span>
                        </p>
                        <p className="mt-1 text-xs text-slate-600">{item.time}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Activity Heatmap" icon={<Clock className="h-4 w-4 text-slate-400" />} action={<span className="text-xs text-slate-500">This week</span>} />
              <div className="p-4">
                {/* Hour labels */}
                <div className="mb-2 grid gap-1" style={{ gridTemplateColumns: `36px repeat(${HEATMAP_HOURS.length}, 1fr)` }}>
                  <span />
                  {HEATMAP_HOURS.map(h => (
                    <span key={h} className="text-center text-[10px] text-slate-600">{h}</span>
                  ))}
                </div>
                {/* Grid */}
                {HEATMAP_DAYS.map((day, di) => (
                  <div key={day} className="mb-1 grid gap-1" style={{ gridTemplateColumns: `36px repeat(${HEATMAP_HOURS.length}, 1fr)` }}>
                    <span className="flex items-center text-xs text-slate-500">{day}</span>
                    {HEATMAP_DATA[di].map((val, hi) => (
                      <div
                        key={hi}
                        title={`${day} ${HEATMAP_HOURS[hi]}: ${val === 0 ? 'No activity' : val === 1 ? 'Low' : val === 2 ? 'Moderate' : val === 3 ? 'High' : 'Peak'}`}
                        className={['h-5 rounded-sm border', heatColor(val)].join(' ')}
                      />
                    ))}
                  </div>
                ))}
                {/* Legend */}
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-[10px] text-slate-600">Low</span>
                  {[0, 1, 2, 3, 4].map(v => (
                    <div key={v} className={['h-3 w-5 rounded-sm border', heatColor(v)].join(' ')} />
                  ))}
                  <span className="text-[10px] text-slate-600">Peak</span>
                </div>
              </div>
            </Panel>

            <Panel>
              <div className="border-b border-line px-5 py-3.5">
                <span className="text-sm font-semibold text-white">Response Time</span>
                <p className="mt-0.5 text-xs text-slate-500">Avg minutes to first contact</p>
              </div>
              <div className="divide-y divide-line">
                {[...AGENTS]
                  .sort((a, b) => a.responseTime - b.responseTime)
                  .map(agent => {
                    const pct = Math.min((agent.responseTime / 60) * 100, 100)
                    return (
                      <div key={agent.id} className="px-5 py-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs text-slate-300">{agent.name.split(' ')[0]} {agent.name.split(' ')[1]?.charAt(0)}.</span>
                          <span className={[
                            'text-xs font-semibold tabular-nums',
                            agent.responseTime <= 15 ? 'text-emerald-400' :
                            agent.responseTime <= 30 ? 'text-amber-400' :
                                                        'text-red-400',
                          ].join(' ')}>
                            {agent.responseTime} min
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-surface-2">
                          <div
                            className={[
                              'h-full rounded-full transition-all',
                              agent.responseTime <= 15 ? 'bg-emerald-500' :
                              agent.responseTime <= 30 ? 'bg-amber-500' :
                                                          'bg-red-500',
                            ].join(' ')}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  )
}
