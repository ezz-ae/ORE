'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import {
  Sparkles, Activity, Users, Megaphone, DollarSign,
  Briefcase, Building2, TrendingUp, FileBarChart2, Bot,
  MessageSquare, Mail, CheckCircle2, AlertCircle,
  ArrowUpRight, Send, WifiOff,
  Target, Zap, Coins,
} from 'lucide-react'
import { StatCard, type StatDelta } from '@/components/freehold/ui'

function fmtAedShort(n: number): string {
  if (!n || n <= 0) return 'AED 0'
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `AED ${(n / 1_000).toFixed(0)}K`
  return `AED ${Math.round(n).toLocaleString()}`
}

interface DashboardStats {
  newLeadsToday: number
  newLeadsDelta: number
  pipelineValueAed: number
  dealsClosingWeek: number
  revenueMtdAed: number
  teamCount: number
  openLeads: number
  commissionOutstandingAed: number
}
interface DashTask { id: string; priority: string; text: string; done: boolean }
interface DashEvent { time: string; user: string; action: string; tag: string }
interface DashLead { name: string; status: string }

const EVENT_COLOR: Record<string, string> = {
  deal: 'text-emerald-400',
  lead: 'text-sky-400',
}

const QUICK_NAV = [
  { href: '/freehold-intelligence/management/events',   label: 'Events Log', icon: Activity,      color: 'text-sky-400 border-sky-400/20 bg-sky-400/10' },
  { href: '/freehold-intelligence/management/team',     label: 'Team',       icon: Users,         color: 'text-violet-400 border-violet-400/20 bg-violet-400/10' },
  { href: '/freehold-intelligence/management/deals',    label: 'Deals',      icon: Briefcase,     color: 'text-emerald-400 border-emerald-400/20 bg-emerald-400/10' },
  { href: '/freehold-intelligence/management/roi',      label: 'ROI',        icon: TrendingUp,    color: 'text-orange-400 border-orange-400/20 bg-orange-400/10' },
  { href: '/freehold-intelligence/management/reports',  label: 'Reports',    icon: FileBarChart2, color: 'text-pink-400 border-pink-400/20 bg-pink-400/10' },
  { href: '/freehold-intelligence/ads',                 label: 'Ads',        icon: Megaphone,     color: 'text-blue-400 border-blue-400/20 bg-blue-400/10' },
  { href: '/freehold-intelligence/finance',             label: 'Finance',    icon: DollarSign,    color: 'text-green-400 border-green-400/20 bg-green-400/10' },
  { href: '/freehold-intelligence/inventory',           label: 'Inventory',  icon: Building2,     color: 'text-slate-300 border-line-strong bg-surface-2' },
  { href: '/freehold-intelligence/agent/ai',            label: 'AI Chat',    icon: Bot,           color: 'text-gold border-gold/20 bg-gold/10' },
  { href: '/freehold-intelligence/finance/credits',     label: 'Credits',    icon: Coins,         color: 'text-gold border-gold/20 bg-gold/10' },
]

export default function ManagementDashboard() {
  const router = useRouter()
  const [tasks, setTasks]   = useState<DashTask[]>([])
  const [stats, setStats]   = useState<DashboardStats | null>(null)
  const [events, setEvents] = useState<DashEvent[]>([])
  const [recentLeads, setRecentLeads] = useState<DashLead[]>([])
  const [aiInput, setAiInput] = useState('')
  const [aiPending, setAiPending] = useState(false)
  const [greeting, setGreeting] = useState('')
  const [dateStr, setDateStr]   = useState('')
  const [aiMessages, setAiMessages] = useState<{ role: string; text: string }[]>([])

  useEffect(() => {
    const now  = new Date()
    const hour = now.getHours()
    setGreeting(hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening')
    setDateStr(now.toLocaleDateString('en-AE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Dubai' }))
  }, [])

  // Load real dashboard data.
  useEffect(() => {
    fetch('/api/freehold/dashboard/stats', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d) return
        setStats(d.stats)
        setTasks(d.tasks || [])
        setEvents(d.events || [])
        setRecentLeads(d.recentLeads || [])
        const s = d.stats
        if (s) {
          setAiMessages([{ role: 'assistant', text: `Here is your live briefing:\n\n**${s.newLeadsToday} new lead${s.newLeadsToday === 1 ? '' : 's'} today**${s.newLeadsDelta !== 0 ? ` (${s.newLeadsDelta > 0 ? '+' : ''}${s.newLeadsDelta} vs yesterday)` : ''}. Pipeline value is ${fmtAedShort(s.pipelineValueAed)} across approved deals, with **${s.dealsClosingWeek} deal${s.dealsClosingWeek === 1 ? '' : 's'} closed this week**. ${s.commissionOutstandingAed > 0 ? `Commission outstanding: ${fmtAedShort(s.commissionOutstandingAed)}. ` : ''}${s.openLeads} open lead${s.openLeads === 1 ? '' : 's'} in the pipeline.\n\nWhat would you like to focus on first?` }])
        }
      })
      .catch(() => {})
  }, [])

  const STAT_CARDS: { label: string; value: string; delta?: StatDelta; hint?: string; icon: LucideIcon }[] = stats ? [
    { label: 'New Leads Today', value: String(stats.newLeadsToday), delta: stats.newLeadsDelta !== 0 ? { value: `${stats.newLeadsDelta > 0 ? '+' : ''}${stats.newLeadsDelta}`, direction: stats.newLeadsDelta >= 0 ? 'up' : 'down' } : undefined, icon: Target },
    { label: 'Pipeline Value', value: fmtAedShort(stats.pipelineValueAed), hint: 'approved deals', icon: TrendingUp },
    { label: 'Deals Closed', value: String(stats.dealsClosingWeek), hint: 'this week', icon: Briefcase },
    { label: 'Open Leads', value: String(stats.openLeads), hint: 'in pipeline', icon: Megaphone },
    { label: 'Revenue MTD', value: fmtAedShort(stats.revenueMtdAed), hint: 'commission received', icon: DollarSign },
    { label: 'Team', value: String(stats.teamCount), hint: 'active members', icon: Users },
  ] : []

  function toggleTask(id: string) {
    let nextDone = false
    setTasks(t => t.map(task => {
      if (task.id !== id) return task
      nextDone = !task.done
      return { ...task, done: nextDone }
    }))
    fetch(`/api/freehold/tasks/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextDone ? 'done' : 'open' }),
    }).catch(() => {})
  }

  async function sendAi(e: React.FormEvent) {
    e.preventDefault()
    const message = aiInput.trim()
    if (!message || aiPending) return
    setAiInput('')
    setAiMessages(m => [...m, { role: 'user', text: message }])
    setAiPending(true)
    try {
      const res = await fetch('/api/freehold/server-ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, role: 'owner' }),
      })
      const data = await res.json()
      const answer = data?.data?.answer || data?.answer || data?.message || data?.reply ||
        'I reviewed the current data. Try one of the suggested prompts.'
      setAiMessages(m => [...m, { role: 'assistant', text: answer }])
    } catch {
      setAiMessages(m => [...m, { role: 'assistant', text: 'I could not reach the server right now. Try again in a moment.' }])
    } finally {
      setAiPending(false)
    }
  }

  return (
    <div className="pb-16">
      {/* Page header */}
      <div className="border-b border-white/[0.07] px-6 py-5">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-white">{greeting}</h1>
            <p className="mt-0.5 text-sm text-slate-500">{dateStr}</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-medium text-emerald-400">All systems live</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 pt-6 space-y-6">

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {(stats ? STAT_CARDS : Array.from({ length: 6 })).map((stat, i) => (
            stats && stat ? (
              <StatCard
                key={(stat as { label: string }).label}
                label={(stat as { label: string }).label}
                value={(stat as { value: string }).value}
                delta={(stat as { delta?: StatDelta }).delta}
                hint={(stat as { hint?: string }).hint}
                Icon={(stat as { icon: LucideIcon }).icon}
              />
            ) : (
              <div key={i} className="h-[88px] animate-pulse rounded-xl border border-white/[0.07] bg-surface-2" />
            )
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          {/* Left column — AI briefing + tasks + emails */}
          <div className="xl:col-span-2 space-y-6">

            {/* AI Morning Briefing chat */}
            <div className="rounded-xl border border-gold/20 bg-gradient-to-br from-gold/[0.07] via-gold/[0.03] to-transparent">
              <div className="flex items-center gap-3 border-b border-gold/15 px-5 py-3.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-gold/25 bg-gold/10">
                  <Sparkles className="h-3.5 w-3.5 text-gold" />
                </div>
                <span className="text-sm font-semibold text-white">AI Briefing</span>
                <span className="ml-auto text-xs text-slate-500">Updated 08:00 AM</span>
              </div>

              <div className="max-h-72 overflow-y-auto px-5 py-4 space-y-3">
                {aiMessages.map((msg, i) => (
                  <div key={i} className={['flex gap-3', msg.role === 'user' ? 'flex-row-reverse' : ''].join(' ')}>
                    <div className={[
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                      msg.role === 'assistant'
                        ? 'bg-gold/15 text-gold'
                        : 'bg-surface-3 text-slate-200',
                    ].join(' ')}>
                      {msg.role === 'assistant' ? <Sparkles className="h-3.5 w-3.5" /> : 'M'}
                    </div>
                    <div className={[
                      'max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed',
                      msg.role === 'assistant'
                        ? 'bg-surface-2 text-slate-200'
                        : 'bg-surface-3 text-white',
                    ].join(' ')}>
                      {msg.text.split('\n').map((line, j) => (
                        <span key={j}>
                          {line.replace(/\*\*(.*?)\*\*/g, '$1')}
                          {j < msg.text.split('\n').length - 1 && <br />}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                {aiPending && (
                  <div className="flex gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    <div className="max-w-[85%] rounded-xl bg-surface-2 px-4 py-2.5 text-sm leading-relaxed text-slate-400">
                      Thinking…
                    </div>
                  </div>
                )}
              </div>

              <form onSubmit={sendAi} className="flex gap-2 border-t border-gold/15 px-4 py-3">
                <input
                  value={aiInput}
                  onChange={e => setAiInput(e.target.value)}
                  placeholder="Ask about performance, decisions, market…"
                  className="flex-1 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-gold/40"
                />
                <button
                  type="submit"
                  disabled={!aiInput.trim() || aiPending}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold text-ink transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>

            {/* AI Task Planner */}
            <div className="rounded-xl border border-white/[0.07] bg-surface">
              <div className="flex items-center gap-3 border-b border-white/[0.07] px-5 py-3.5">
                <Zap className="h-4 w-4 text-gold" />
                <span className="text-sm font-semibold text-white">AI Task Planner</span>
                <span className="ml-auto text-xs text-slate-500">
                  {tasks.filter(t => !t.done).length} pending
                </span>
              </div>
              <div className="divide-y divide-white/[0.07]">
                {tasks.map(task => (
                  <div key={task.id} className="flex items-start gap-3 px-5 py-3.5">
                    <button
                      onClick={() => toggleTask(task.id)}
                      className={[
                        'mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border transition-colors',
                        task.done
                          ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-400'
                          : 'border-line-strong hover:border-slate-500',
                      ].join(' ')}
                    >
                      {task.done && <CheckCircle2 className="h-4 w-4" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={['text-sm', task.done ? 'line-through text-slate-600' : 'text-slate-200'].join(' ')}>
                        {task.text}
                      </p>
                    </div>
                    <span className={[
                      'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                      task.priority === 'high'   ? 'bg-red-500/15 text-red-400' :
                      task.priority === 'medium' ? 'bg-amber-500/15 text-amber-400' :
                                                    'bg-surface-3 text-slate-500',
                    ].join(' ')}>
                      {task.priority}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Latest Leads */}
            <div className="rounded-xl border border-white/[0.07] bg-surface">
              <div className="flex items-center gap-3 border-b border-white/[0.07] px-5 py-3.5">
                <Mail className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-semibold text-white">Latest Leads</span>
                <Link href="/freehold-intelligence/crm/leads" className="ml-auto flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300">
                  All <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="divide-y divide-white/[0.07]">
                {recentLeads.length === 0 ? (
                  <div className="px-5 py-8 text-center text-xs text-slate-600">No leads yet.</div>
                ) : recentLeads.map((lead, i) => {
                  const hot = lead.status === 'new' || lead.status === 'contacted'
                  return (
                    <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                      <div className={[
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                        hot ? 'bg-gold/15 text-gold' : 'bg-surface-2 text-slate-500',
                      ].join(' ')}>
                        {(lead.name || '?').slice(0, 1).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-100 truncate">{lead.name}</p>
                        <p className="text-xs text-slate-500 capitalize truncate">{lead.status}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Right column — quick nav, events, WhatsApp */}
          <div className="space-y-6">

            {/* Quick Navigation */}
            <div className="rounded-xl border border-white/[0.07] bg-surface">
              <div className="border-b border-white/[0.07] px-5 py-3.5">
                <p className="text-sm font-semibold text-white">Quick Access</p>
              </div>
              <div className="grid grid-cols-2 gap-2 p-3">
                {QUICK_NAV.map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex flex-col items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.03] p-3.5 transition hover:border-white/[0.15] hover:bg-white/[0.07]"
                  >
                    <div className={['flex h-8 w-8 items-center justify-center rounded-lg border', item.color].join(' ')}>
                      <item.icon className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-medium text-slate-300 group-hover:text-white">{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Live Events Feed */}
            <div className="rounded-xl border border-white/[0.07] bg-surface">
              <div className="flex items-center gap-3 border-b border-white/[0.07] px-5 py-3.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-sm font-semibold text-white">Live Events</span>
                <Link href="/freehold-intelligence/management/events" className="ml-auto flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors">
                  All <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="divide-y divide-white/[0.07]">
                {events.length === 0 ? (
                  <div className="px-5 py-8 text-center text-xs text-slate-600">No recent activity yet.</div>
                ) : events.map((ev, i) => (
                  <div key={i} className="px-5 py-3.5">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-semibold text-slate-400">{ev.user}</span>
                      <span className="text-xs text-slate-600">{ev.time}</span>
                    </div>
                    <p className="text-sm text-slate-300">{ev.action}</p>
                    <span className={['mt-1 inline-block text-xs font-medium', EVENT_COLOR[ev.tag] || 'text-slate-400'].join(' ')}>
                      #{ev.tag}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* WhatsApp Connector */}
            <div className="rounded-xl border border-white/[0.07] bg-surface">
              <div className="border-b border-white/[0.07] px-5 py-3.5">
                <p className="text-sm font-semibold text-white">WhatsApp Web</p>
              </div>
              <div className="px-5 py-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-500/15">
                    <MessageSquare className="h-4.5 w-4.5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-200">Not connected</p>
                    <p className="text-xs text-slate-500">Scan QR to sync inbox</p>
                  </div>
                  <div className="ml-auto">
                    <WifiOff className="h-4 w-4 text-slate-600" />
                  </div>
                </div>
                <button
                  onClick={() => router.push('/freehold-intelligence/integrations/whatsapp')}
                  className="w-full rounded-lg border border-white/[0.1] bg-white/[0.04] py-2.5 text-sm font-medium text-slate-300 transition hover:border-line-strong hover:bg-surface-2 hover:text-white">
                  Connect WhatsApp
                </button>
                <p className="mt-2.5 text-center text-xs text-slate-600">
                  Sync messages, templates & lead responses
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
