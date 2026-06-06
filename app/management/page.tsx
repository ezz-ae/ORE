'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Sparkles, Activity, Users, Megaphone, DollarSign,
  Briefcase, Building2, TrendingUp, FileBarChart2, Bot,
  MessageSquare, Phone, Mail, Clock, CheckCircle2, AlertCircle,
  ArrowUpRight, Send, Wifi, WifiOff, ChevronRight, Bell,
  Target, Star, Zap, Calendar,
} from 'lucide-react'

const now = new Date()
const hour = now.getHours()
const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
const dateStr = now.toLocaleDateString('en-AE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

const STATS = [
  { label: 'New Leads Today',   value: '14',     delta: '+3',   positive: true,  icon: Target },
  { label: 'Pipeline Value',    value: 'AED 8.4M', delta: '+12%', positive: true,  icon: TrendingUp },
  { label: 'Deals Closing',     value: '3',       delta: 'this week', positive: true, icon: Briefcase },
  { label: 'Ad Spend Today',    value: 'AED 2,180', delta: '-4%', positive: false, icon: Megaphone },
  { label: 'Revenue MTD',       value: 'AED 320K', delta: '+18%', positive: true,  icon: DollarSign },
  { label: 'Team Online',       value: '7 / 12',  delta: 'agents', positive: true, icon: Users },
]

const TASKS = [
  { id: 1, priority: 'high',   text: 'Review 3 new leads from Meta campaign — follow-up due today', done: false },
  { id: 2, priority: 'high',   text: 'Approve invoices for 2 closed deals before 12:00 PM', done: false },
  { id: 3, priority: 'medium', text: 'Check Google Ads campaign performance — CTR dropped 15%', done: false },
  { id: 4, priority: 'medium', text: 'Schedule team briefing for Q3 targets', done: false },
  { id: 5, priority: 'low',    text: 'Review new inventory listings from Emaar — 6 units added', done: true },
  { id: 6, priority: 'low',    text: 'Update ROI report for last month', done: true },
]

const EVENTS = [
  { id: 1, time: '08:47',  user: 'Sara Al Mansoori', action: 'Closed deal on Dubai Hills villa', tag: 'deal',   color: 'text-emerald-400' },
  { id: 2, time: '08:31',  user: 'Meta Ads',          action: 'CPL dropped to AED 38 — best this month',        tag: 'ads',    color: 'text-violet-400' },
  { id: 3, time: '08:15',  user: 'Ahmad Khalil',      action: 'Logged in · 6 leads followed up',                tag: 'sales',  color: 'text-sky-400' },
  { id: 4, time: '07:55',  user: 'System',            action: 'Nightly sync complete — 2,813 listings indexed',  tag: 'system', color: 'text-slate-400' },
  { id: 5, time: '07:40',  user: 'Google Ads',        action: 'New campaign "Palm Q3" went live',                tag: 'ads',    color: 'text-violet-400' },
]

const EMAILS = [
  { id: 1, from: 'Emaar Properties',    subject: '6 new off-plan units available — Downtown',    urgent: true },
  { id: 2, from: 'DLD Portal',          subject: 'Transaction report ready — May 2026',           urgent: true },
  { id: 3, from: 'Client: Ahmed Hassan', subject: 'Re: Palm Jumeirah offer — counter proposal',   urgent: false },
  { id: 4, from: 'Google Ads',          subject: 'Monthly performance report — May 2026',         urgent: false },
]

const QUICK_NAV = [
  { href: '/management/events',    label: 'Events Log',  icon: Activity,       color: 'text-sky-400 border-sky-400/20 bg-sky-400/10' },
  { href: '/management/team',      label: 'Team',        icon: Users,          color: 'text-violet-400 border-violet-400/20 bg-violet-400/10' },
  { href: '/management/deals',     label: 'Deals',       icon: Briefcase,      color: 'text-emerald-400 border-emerald-400/20 bg-emerald-400/10' },
  { href: '/management/marketing', label: 'Marketing',   icon: Megaphone,      color: 'text-orange-400 border-orange-400/20 bg-orange-400/10' },
  { href: '/management/finance',   label: 'Finance',     icon: DollarSign,     color: 'text-green-400 border-green-400/20 bg-green-400/10' },
  { href: '/management/ai',        label: 'AI Chat',     icon: Bot,            color: 'text-[#D4AF37] border-[#D4AF37]/20 bg-[#D4AF37]/10' },
  { href: '/management/inventory', label: 'Inventory',   icon: Building2,      color: 'text-slate-300 border-slate-700 bg-slate-800/50' },
  { href: '/management/reports',   label: 'Reports',     icon: FileBarChart2,  color: 'text-pink-400 border-pink-400/20 bg-pink-400/10' },
]

export default function ManagementDashboard() {
  const [tasks, setTasks]   = useState(TASKS)
  const [aiInput, setAiInput] = useState('')
  const [aiMessages, setAiMessages] = useState([
    { role: 'assistant', text: `Good morning. Here is your briefing:\n\n**3 urgent deals** need attention before end of day. Your best agent Sara closed a villa in Dubai Hills — congratulations to her. Meta ad spend is performing well today with CPL at AED 38. Google Ads CTR dropped 15% — worth reviewing.\n\nWhat would you like to focus on first?` },
  ])

  function toggleTask(id: number) {
    setTasks(t => t.map(task => task.id === id ? { ...task, done: !task.done } : task))
  }

  function sendAi(e: React.FormEvent) {
    e.preventDefault()
    if (!aiInput.trim()) return
    const msg = aiInput.trim()
    setAiInput('')
    setAiMessages(m => [
      ...m,
      { role: 'user', text: msg },
      { role: 'assistant', text: `Analyzing your query about "${msg}"…\n\nBased on current data: your pipeline shows AED 8.4M in active deals with 3 closing this week. Marketing performance is strong with Meta CPL at AED 38. I recommend prioritizing the Palm Jumeirah counter-proposal from Ahmed Hassan today.` },
    ])
  }

  return (
    <div className="min-h-screen pb-16">
      {/* Page header */}
      <div className="border-b border-slate-800 bg-[#090C12]/80 px-6 py-5 backdrop-blur-xl sticky top-0 z-30">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-white">{greeting}</h1>
            <p className="mt-0.5 text-sm text-slate-500">{dateStr}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-emerald-400">All systems live</span>
            </div>
            <button className="relative flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-800/50 text-slate-400 hover:text-slate-200">
              <Bell className="h-4 w-4" />
              <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">5</span>
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 pt-6 space-y-6">

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {STATS.map((stat) => (
            <div key={stat.label} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <stat.icon className="h-4 w-4 text-slate-500" />
                <span className={['text-xs font-medium', stat.positive ? 'text-emerald-400' : 'text-red-400'].join(' ')}>
                  {stat.delta}
                </span>
              </div>
              <p className="text-xl font-semibold text-white tabular-nums">{stat.value}</p>
              <p className="mt-1 text-xs text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          {/* Left column — AI briefing + tasks + emails */}
          <div className="xl:col-span-2 space-y-6">

            {/* AI Morning Briefing chat */}
            <div className="rounded-xl border border-[#D4AF37]/20 bg-[#D4AF37]/[0.03]">
              <div className="flex items-center gap-3 border-b border-[#D4AF37]/15 px-5 py-3.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#D4AF37]/25 bg-[#D4AF37]/10">
                  <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" />
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
                        ? 'bg-[#D4AF37]/15 text-[#D4AF37]'
                        : 'bg-slate-700 text-slate-200',
                    ].join(' ')}>
                      {msg.role === 'assistant' ? <Sparkles className="h-3.5 w-3.5" /> : 'M'}
                    </div>
                    <div className={[
                      'max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed',
                      msg.role === 'assistant'
                        ? 'bg-slate-800/60 text-slate-200'
                        : 'bg-slate-700/60 text-white',
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
              </div>

              <form onSubmit={sendAi} className="flex gap-2 border-t border-[#D4AF37]/15 px-4 py-3">
                <input
                  value={aiInput}
                  onChange={e => setAiInput(e.target.value)}
                  placeholder="Ask about performance, decisions, market…"
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-[#D4AF37]/40"
                />
                <button
                  type="submit"
                  disabled={!aiInput.trim()}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#D4AF37] text-[#0D1117] transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>

            {/* AI Task Planner */}
            <div className="rounded-xl border border-slate-800 bg-slate-900">
              <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-3.5">
                <Zap className="h-4 w-4 text-[#D4AF37]" />
                <span className="text-sm font-semibold text-white">AI Task Planner</span>
                <span className="ml-auto text-xs text-slate-500">
                  {tasks.filter(t => !t.done).length} pending
                </span>
              </div>
              <div className="divide-y divide-slate-800">
                {tasks.map(task => (
                  <div key={task.id} className="flex items-start gap-3 px-5 py-3.5">
                    <button
                      onClick={() => toggleTask(task.id)}
                      className={[
                        'mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border transition-colors',
                        task.done
                          ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-400'
                          : 'border-slate-700 hover:border-slate-500',
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
                                                    'bg-slate-700/50 text-slate-500',
                    ].join(' ')}>
                      {task.priority}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Emails Scanner */}
            <div className="rounded-xl border border-slate-800 bg-slate-900">
              <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-3.5">
                <Mail className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-semibold text-white">AI Emails Scanner</span>
                <span className="ml-auto rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-400">
                  2 urgent
                </span>
              </div>
              <div className="divide-y divide-slate-800">
                {EMAILS.map(email => (
                  <div key={email.id} className="flex items-center gap-4 px-5 py-3.5">
                    <div className={[
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                      email.urgent ? 'bg-red-500/15 text-red-400' : 'bg-slate-800 text-slate-500',
                    ].join(' ')}>
                      {email.urgent ? <AlertCircle className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-100 truncate">{email.from}</p>
                      <p className="text-xs text-slate-500 truncate">{email.subject}</p>
                    </div>
                    {email.urgent && (
                      <span className="shrink-0 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-400">Urgent</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column — quick nav, events, WhatsApp */}
          <div className="space-y-6">

            {/* Quick Navigation */}
            <div className="rounded-xl border border-slate-800 bg-slate-900">
              <div className="border-b border-slate-800 px-5 py-3.5">
                <p className="text-sm font-semibold text-white">Quick Access</p>
              </div>
              <div className="grid grid-cols-2 gap-2 p-3">
                {QUICK_NAV.map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex flex-col items-center gap-2 rounded-lg border border-slate-800 bg-slate-800/30 p-3.5 transition hover:border-slate-700 hover:bg-slate-800/60"
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
            <div className="rounded-xl border border-slate-800 bg-slate-900">
              <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-3.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-sm font-semibold text-white">Live Events</span>
                <Link href="/management/events" className="ml-auto flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors">
                  All <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="divide-y divide-slate-800">
                {EVENTS.map(ev => (
                  <div key={ev.id} className="px-5 py-3.5">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-semibold text-slate-400">{ev.user}</span>
                      <span className="text-xs text-slate-600">{ev.time}</span>
                    </div>
                    <p className="text-sm text-slate-300">{ev.action}</p>
                    <span className={['mt-1 inline-block text-xs font-medium', ev.color].join(' ')}>
                      #{ev.tag}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* WhatsApp Connector */}
            <div className="rounded-xl border border-slate-800 bg-slate-900">
              <div className="border-b border-slate-800 px-5 py-3.5">
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
                <button className="w-full rounded-lg border border-slate-700 bg-slate-800/50 py-2.5 text-sm font-medium text-slate-300 transition hover:border-slate-600 hover:bg-slate-800 hover:text-white">
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
