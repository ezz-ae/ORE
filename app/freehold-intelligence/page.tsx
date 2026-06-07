'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  AlertCircle, CheckCircle2, Activity,
  ArrowUpRight, X, Globe, ChevronRight, Send, Clock, AlertTriangle,
  Sparkles,
} from 'lucide-react'
import { inventoryProperties, getInventoryStats } from '@/src/features/freehold-intelligence/inventory'
import {
  serverSummary,
  currentServerUser,
  type ServerActionCard,
} from '@/src/features/freehold-intelligence/server-session'
import { useSession } from '@/lib/freehold/use-session'
import { visibleApps } from '@/lib/freehold/apps'

const stats          = getInventoryStats()
const totalVisitors  = inventoryProperties.reduce((s, p) => s + p.views30d, 0)
const avgDataQuality = Math.round(inventoryProperties.reduce((s, p) => s + p.dataQuality, 0) / inventoryProperties.length)

// Live values that override the registry's static defaults on the hub cards.
const DYNAMIC_META: Record<string, { metric?: string; badge?: number }> = {
  analytics:    { metric: `${(totalVisitors / 1000).toFixed(1)}K visitors · 30d` },
  'ai-manager': { metric: `Data quality ${avgDataQuality} · ${stats.total} listings`, badge: avgDataQuality < 70 ? 1 : 0 },
  inventory:    { metric: `${stats.total} properties · ${stats.missingLanding} missing`, badge: stats.missingLanding },
}

const ACTIVITY = [
  { time: '09:14',     label: 'New lead',         detail: 'Palm Jumeirah — Meta Ads',        type: 'lead'    },
  { time: '08:52',     label: 'Campaign paused',   detail: 'Off Plan Dubai 2025 — Google',    type: 'warning' },
  { time: '08:30',     label: 'Landing published', detail: 'JVC Investor · /lp/jvc-investor', type: 'success' },
  { time: 'Yesterday', label: '88 leads',          detail: 'Dubai Hills Yield — 24h',         type: 'lead'    },
  { time: 'Yesterday', label: 'Invoice issued',    detail: 'INV-META-0526 · AED 18,420',      type: 'info'    },
]

function getGreeting(name: string) {
  const h = new Date().getHours()
  const t = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return `${t}, ${name}.`
}

function urgentCardCls(p: ServerActionCard['priority']) {
  if (p === 'critical') return 'border-red-500/25 bg-red-500/[0.06]'
  if (p === 'high')     return 'border-amber-500/25 bg-amber-500/[0.06]'
  return 'border-white/[0.07] bg-white/[0.03]'
}
function urgentDotCls(p: ServerActionCard['priority']) {
  if (p === 'critical') return 'bg-red-500'
  if (p === 'high')     return 'bg-amber-400'
  return 'bg-white/30'
}
function urgentTitleCls(p: ServerActionCard['priority']) {
  if (p === 'critical') return 'text-red-400'
  if (p === 'high')     return 'text-amber-300'
  return 'text-slate-300'
}

export default function IntelligenceLauncher() {
  const [greeting, setGreeting]       = useState('')
  const [chatInput, setChatInput]     = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatReply, setChatReply]     = useState<string | null>(null)
  const [dismissed, setDismissed]     = useState<Set<string>>(new Set())
  const [dateStr, setDateStr]         = useState('')
  const { user }   = useSession()
  const role       = user?.role
  const sessionRef = useRef(`server-${Math.random().toString(36).slice(2)}`)

  useEffect(() => {
    const displayName = user?.name ?? currentServerUser.name
    setGreeting(getGreeting(displayName))
    setDateStr(new Date().toLocaleDateString('en-AE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Dubai' }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.name])

  const apps = visibleApps(role)

  const lowAdReadiness  = inventoryProperties.filter((p) => p.adReadiness < 40)
  const missingLandings = inventoryProperties.filter((p) => p.landingStatus === 'missing')
  const noImages        = inventoryProperties.filter((p) => !p.hasImages)

  const priorities = [
    ...missingLandings.filter((p) => !dismissed.has(p.id)).map((p) => ({
      id: p.id, name: p.name,
      note: `No landing page${p.linkedCampaigns > 0 ? ` — ${p.linkedCampaigns} campaign(s) paused` : ''}`,
      sev: 'red' as const, href: '/freehold-intelligence/inventory',
    })),
    ...lowAdReadiness.filter((p) => !dismissed.has(p.id)).map((p) => ({
      id: p.id, name: p.name,
      note: `Ad readiness ${p.adReadiness}% — needs creative & copy`,
      sev: 'amber' as const, href: '/freehold-intelligence/inventory',
    })),
    ...noImages.filter((p) => !missingLandings.includes(p) && !dismissed.has(p.id)).map((p) => ({
      id: p.id, name: p.name,
      note: 'No images — blocks ad creative generation',
      sev: 'amber' as const, href: '/freehold-intelligence/inventory',
    })),
  ]



  const aiContext = {
    urgentTasks:        serverSummary.urgentTasks.map(t => ({ title: t.title, body: t.body, priority: t.priority, app: t.app, due: t.due })),
    blockedItems:       serverSummary.blockedItems.map(t => ({ title: t.title, body: t.body })),
    crmAlerts:          serverSummary.crmAlerts.map(t => ({ title: t.title, body: t.body })),
    leadMachineAlerts:  serverSummary.leadMachineAlerts.map(t => ({ title: t.title, body: t.body })),
    pendingApprovals:   serverSummary.pendingApprovals.map(t => ({ title: t.title, app: t.app })),
    recommendedActions: serverSummary.recommendedActions.map(t => ({ title: t.title, body: t.body })),
  }

  async function sendChat(message: string) {
    const msg = message.trim()
    if (!msg || chatLoading) return
    setChatInput('')
    setChatLoading(true)
    setChatReply(null)
    try {
      const res  = await fetch('/api/freehold/server/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: msg, sessionId: sessionRef.current, context: aiContext }),
      })
      const data = await res.json() as { answer?: string; error?: string }
      setChatReply(data.answer ?? data.error ?? '(no response)')
    } catch {
      setChatReply('Unable to reach the Intelligence Server AI.')
    } finally {
      setChatLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-5 pb-24 pt-8 sm:px-8 sm:pt-10">

      {/* ── Morning Briefing ──────────────────────────────────────────────── */}
      <section className="mb-8 overflow-hidden rounded-2xl border border-[#D4AF37]/20 bg-gradient-to-br from-[#D4AF37]/[0.09] via-[#D4AF37]/[0.03] to-transparent">
        <div className="p-6 sm:p-7">

          {/* Header row */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/10">
                <Sparkles className="h-5 w-5 text-[#D4AF37]" />
              </div>
              <div>
                <div className="text-base font-semibold text-white">{greeting || 'Freehold Intelligence'}</div>
                <div className="text-sm text-slate-400 mt-0.5">{dateStr}</div>
              </div>
            </div>
            {/* Stat chips */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-400">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                {serverSummary.urgentTasks.length} urgent
              </span>
              <span className="flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-400">
                {serverSummary.blockedItems.length} blocked
              </span>
              <span className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-sm text-slate-400">
                {serverSummary.pendingApprovals.length} pending
              </span>
              <Link href="/" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors">
                <Globe className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">freeholdproperty.ae</span>
              </Link>
            </div>
          </div>

          {/* Summary text */}
          <p className="mt-5 text-sm leading-relaxed text-slate-300 max-w-2xl">
            {serverSummary.summaryText}
          </p>

          {/* Divider */}
          <div className="my-5 border-t border-slate-800" />

          {/* AI Chat */}
          <div>
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendChat(chatInput)}
                placeholder="Ask anything about today's priorities…"
                className="flex-1 rounded-xl border border-white/[0.1] bg-white/[0.05] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#D4AF37]/50 transition-colors"
              />
              <button
                type="button"
                onClick={() => sendChat(chatInput)}
                disabled={chatLoading || !chatInput.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#D4AF37] text-[#0D1117] transition-opacity hover:opacity-85 disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>

            {/* Suggested questions */}
            <div className="mt-3 flex flex-wrap gap-2">
              {serverSummary.askableQuestions.slice(0, 4).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendChat(q)}
                  disabled={chatLoading}
                  className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-slate-400 transition-colors hover:border-white/[0.2] hover:text-slate-200 disabled:opacity-40"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* AI response */}
            {(chatLoading || chatReply) && (
              <div className="mt-4 rounded-xl border border-[#D4AF37]/20 bg-[#D4AF37]/[0.04] p-4">
                {chatLoading ? (
                  <div className="flex items-center gap-3 text-sm text-slate-400">
                    <span className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <span key={i} className="h-1.5 w-1.5 rounded-full bg-[#D4AF37]/60 animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </span>
                    Thinking…
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {chatReply}
                    </p>
                    <div className="mt-3 flex items-center justify-between border-t border-slate-700 pt-3">
                      <Link href="/freehold-intelligence/agent"
                        className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200 transition-colors">
                        Full conversation <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                      <button type="button" onClick={() => setChatReply(null)}
                        className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
                        Dismiss
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Urgent actions ──────────────────────────────────────────────────── */}
      <section className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
            Urgent
          </div>
          <span className="text-sm text-slate-500">{serverSummary.urgentTasks.length} open</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {serverSummary.urgentTasks.map((task) => (
            <div key={task.id} className={`rounded-xl border p-4 ${urgentCardCls(task.priority)}`}>
              <div className="flex items-start gap-3">
                <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${urgentDotCls(task.priority)}`} />
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-semibold leading-snug ${urgentTitleCls(task.priority)}`}>
                    {task.title}
                  </div>
                  <div className="mt-1 text-sm text-slate-400 leading-snug">{task.body}</div>
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                    <span>{task.app}</span>
                    {task.due && (
                      <>
                        <span>·</span>
                        <Clock className="h-3 w-3" />
                        <span>{task.due}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── App grid ──────────────────────────────────────────────────────────── */}
      <section>
        <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Apps</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {apps.map((app) => {
            const metric = DYNAMIC_META[app.id]?.metric ?? app.metric
            const badge  = DYNAMIC_META[app.id]?.badge ?? app.badge
            return (
              <Link
                key={app.id}
                href={app.href}
                className={`group relative flex flex-col rounded-xl border bg-[#0D1520] p-5 transition-all duration-200 ${app.card}`}
              >
                {badge > 0 && (
                  <span className="absolute right-4 top-4 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
                    {badge}
                  </span>
                )}
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl border ${app.icon}`}>
                  <app.Icon className="h-5 w-5" />
                </div>
                <div className="mt-4 flex-1">
                  <div className="text-sm font-semibold text-slate-100 group-hover:text-white">{app.label}</div>
                  <div className="mt-1 text-sm text-slate-400">{app.sub}</div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-slate-400 font-medium">
                    {metric}
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-slate-600 transition-colors group-hover:text-[#D4AF37]" />
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      {/* ── Executive overview ─────────────────────────────────────────────── */}
      <section className="mt-8 grid gap-4 lg:grid-cols-2">

        {/* Priority queue */}
        <div className="rounded-xl border border-white/[0.07] bg-[#0D1520] overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-3.5">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
              <AlertCircle className="h-4 w-4 text-amber-400" />
              Priorities
            </div>
            <span className="text-sm text-slate-500">{priorities.length} open</span>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {priorities.slice(0, 3).map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className={`h-2 w-2 shrink-0 rounded-full ${p.sev === 'red' ? 'bg-red-400' : 'bg-amber-400'}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-200 truncate">{p.name}</div>
                  <div className="text-sm text-slate-400 truncate">{p.note}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Link href={p.href}
                    className="rounded-lg border border-white/[0.1] px-3 py-1 text-sm text-slate-300 transition-colors hover:text-white hover:border-white/[0.25]">
                    Fix
                  </Link>
                  <button type="button" onClick={() => setDismissed((s) => new Set([...s, p.id]))}
                    className="p-1 text-slate-600 hover:text-slate-300 transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            {priorities.length === 0 && (
              <div className="flex items-center gap-3 px-5 py-4">
                <CheckCircle2 className="h-4 w-4 text-[#D4AF37]" />
                <span className="text-sm text-slate-300">All clear — no open priorities</span>
              </div>
            )}
          </div>
        </div>

        {/* Live activity */}
        <div className="rounded-xl border border-white/[0.07] bg-[#0D1520] overflow-hidden">
          <div className="flex items-center gap-2 border-b border-white/[0.07] px-5 py-3.5 text-sm font-medium text-slate-300">
            <Activity className="h-4 w-4" />
            Live activity
          </div>
          <div className="divide-y divide-white/[0.06]">
            {ACTIVITY.map((item, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                <span className={`h-2 w-2 shrink-0 rounded-full ${
                  item.type === 'lead'    ? 'bg-[#D4AF37]' :
                  item.type === 'warning' ? 'bg-amber-400' :
                  item.type === 'success' ? 'bg-emerald-400' : 'bg-slate-600'
                }`} />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-slate-200">{item.label}</span>
                  <span className="text-slate-600 mx-2">·</span>
                  <span className="text-sm text-slate-400">{item.detail}</span>
                </div>
                <span className="shrink-0 text-xs text-slate-500 tabular-nums">{item.time}</span>
              </div>
            ))}
          </div>
        </div>

      </section>
    </div>
  )
}
