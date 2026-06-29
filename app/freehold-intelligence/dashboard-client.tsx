'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertCircle, CheckCircle2, Activity,
  ArrowUpRight, X, Globe, Send, Clock, AlertTriangle,
  Sparkles,
} from 'lucide-react'
import { getInventoryStats, type InventoryProperty } from '@/src/features/freehold-intelligence/inventory'
import {
  serverSummary,
  type ServerActionCard,
} from '@/src/features/freehold-intelligence/server-session'
import { useSession } from '@/lib/freehold/use-session'
import { visibleApps } from '@/lib/freehold/apps'
import { Section, Panel, PanelHeader } from '@/components/freehold/ui'
import { useI18n } from '@/lib/i18n/provider'
import { sendToExpert } from '@/lib/freehold/expert-bus'

// app id → nav translation key (labels are shared with the nav spine)
const NAV_KEYS: Record<string, string> = {
  crm: 'nav.crm', ads: 'nav.ads', inventory: 'nav.inventory', finance: 'nav.finance',
  'ai-manager': 'nav.ai-manager', analytics: 'nav.analytics', notebook: 'nav.notebook',
  integrations: 'nav.integrations', settings: 'nav.settings', management: 'nav.management',
  agent: 'nav.agent',
}


type ActivityType = 'lead' | 'warning' | 'success' | 'info'
type ActivityRow = { time: string; label: string; detail: string; type: ActivityType }

// Static demo fallback — shown only until live CRM activity loads (or when the
// activity log is empty, e.g. a fresh workspace). Keyed so it localizes; the
// localized rows are built inside the component (see `fallbackActivity`).
type ActivityFallback = { time?: string; timeKey?: string; labelKey: string; detailKey: string; type: ActivityType }
const ACTIVITY_FALLBACK: ActivityFallback[] = [
  { time: '09:14',          labelKey: 'hub.demo.newLead.l',          detailKey: 'hub.demo.newLead.d',          type: 'lead'    },
  { time: '08:52',          labelKey: 'hub.demo.campaignPaused.l',   detailKey: 'hub.demo.campaignPaused.d',   type: 'warning' },
  { time: '08:30',          labelKey: 'hub.demo.landingPublished.l', detailKey: 'hub.demo.landingPublished.d', type: 'success' },
  { timeKey: 'hub.yesterday', labelKey: 'hub.demo.leads.l',           detailKey: 'hub.demo.leads.d',            type: 'lead'    },
  { timeKey: 'hub.yesterday', labelKey: 'hub.demo.invoice.l',         detailKey: 'hub.demo.invoice.d',          type: 'info'    },
]

// A normalized urgent card — live work tasks and the static demo summary both
// render through this shape.
type UrgentCard = { id: string; priority: ServerActionCard['priority']; title: string; body: string; meta?: string; due?: string }

// Map a raw CRM activity_type to a humane label + dot colour.
function activityKind(type: string): ActivityType {
  const t = type.toLowerCase()
  if (/(lost|fail|paused|reject|delay|miss)/.test(t)) return 'warning'
  if (/(deal|close|won|publish|approve|assign|stage|status)/.test(t)) return 'success'
  if (/(lead|call|whatsapp|email|meeting|viewing)/.test(t)) return 'lead'
  return 'info'
}
function humanize(type: string): string {
  return type.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function getGreeting(name: string, t: (k: string) => string) {
  const h = new Date().getHours()
  const greet = h < 12 ? t('hub.goodMorning') : h < 17 ? t('hub.goodAfternoon') : t('hub.goodEvening')
  return `${greet}, ${name}.`
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

export default function DashboardClient({ inventoryData }: { inventoryData: InventoryProperty[] }) {
  const stats          = getInventoryStats(inventoryData)
  const totalVisitors  = inventoryData.reduce((s, p) => s + p.views30d, 0)
  const avgDataQuality = inventoryData.length > 0
    ? Math.round(inventoryData.reduce((s, p) => s + p.dataQuality, 0) / inventoryData.length)
    : 0

  const [greeting, setGreeting]       = useState('')
  const [chatInput, setChatInput]     = useState('')
  const [dismissed, setDismissed]     = useState<Set<string>>(new Set())
  const [dateStr, setDateStr]         = useState('')
  const [liveActivity, setLiveActivity] = useState<ActivityRow[] | null>(null)
  const [liveUrgent, setLiveUrgent]   = useState<UrgentCard[] | null>(null)
  const [liveBlocked, setLiveBlocked] = useState<number | null>(null)
  const [livePending, setLivePending] = useState<number | null>(null)
  const { user }   = useSession()
  const role       = user?.role
  const router     = useRouter()
  const { t, locale } = useI18n()
  const localeTag  = locale === 'ar' ? 'ar-AE' : locale === 'ru' ? 'ru-RU' : 'en-AE'

  // Live values that override the registry's static defaults on the hub cards.
  const DYNAMIC_META: Record<string, { metric?: string; badge?: number }> = {
    analytics:    { metric: t('hub.metric.visitors', { count: (totalVisitors / 1000).toFixed(1) }) },
    'ai-manager': { metric: t('hub.metric.dataQuality', { score: avgDataQuality, count: stats.total }), badge: avgDataQuality < 70 ? 1 : 0 },
    inventory:    { metric: t('hub.metric.properties', { count: stats.total, missing: stats.missingLanding }), badge: stats.missingLanding },
  }

  useEffect(() => {
    setDateStr(new Date().toLocaleDateString(localeTag, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Dubai' }))
  }, [localeTag])

  useEffect(() => {
    if (!user?.name) return
    setGreeting(getGreeting(user.name, t))
  }, [user?.name, t])

  useEffect(() => {
    if (user?.role === 'broker') {
      router.replace('/freehold-intelligence/agent')
    }
  }, [user?.role])

  // ── Live briefing + activity ────────────────────────────────────────────────
  // Each fetch fails soft: on error or empty result we keep the static demo so
  // the hub never looks broken on a fresh workspace.
  useEffect(() => {
    if (role === 'broker') return  // brokers are redirected away

    const relTime = (iso: string) => {
      const d = new Date(iso)
      const now = new Date()
      const today = now.toDateString()
      const yest = new Date(now); yest.setDate(now.getDate() - 1)
      if (d.toDateString() === today) return d.toLocaleTimeString(localeTag, { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' })
      if (d.toDateString() === yest.toDateString()) return t('hub.yesterday')
      return d.toLocaleDateString(localeTag, { day: 'numeric', month: 'short', timeZone: 'Asia/Dubai' })
    }

    fetch('/api/freehold/tasks')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const tasks = d?.tasks as Array<{ id: string; title: string; description?: string; priority: UrgentCard['priority']; status: string; dueDate?: string | null }> | undefined
        if (!tasks) return
        const open = tasks.filter((tk) => tk.status !== 'done')
        setLiveUrgent(
          open
            .filter((tk) => tk.priority === 'critical' || tk.priority === 'high')
            .map((tk) => ({ id: tk.id, priority: tk.priority, title: tk.title, body: tk.description || '', due: tk.dueDate || undefined })),
        )
        setLiveBlocked(open.filter((tk) => tk.status === 'blocked').length)
      })
      .catch(() => {})

    fetch('/api/freehold/deals?status=pending_step2')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (Array.isArray(d?.deals)) setLivePending(d.deals.length) })
      .catch(() => {})

    fetch('/api/freehold/crm/activity')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const rows = d?.activity as Array<{ id: string; activity_type: string; description: string | null; created_at: string; lead_name: string | null }> | undefined
        if (!rows || rows.length === 0) return
        setLiveActivity(
          rows.slice(0, 6).map((a) => ({
            time: relTime(a.created_at),
            label: humanize(a.activity_type),
            detail: [a.lead_name, a.description].filter(Boolean).join(' — ') || '—',
            type: activityKind(a.activity_type),
          })),
        )
      })
      .catch(() => {})
  }, [role, localeTag, t])

  const apps = visibleApps(role)

  // Normalized urgent cards + counts — live work data when present, else the
  // static demo summary.
  const urgentCards: UrgentCard[] = liveUrgent ?? serverSummary.urgentTasks.map((tk) => ({
    id: tk.id, priority: tk.priority, title: tk.title, body: tk.body, meta: tk.app, due: tk.due,
  }))
  const blockedCount = liveBlocked ?? serverSummary.blockedItems.length
  const pendingCount = livePending ?? serverSummary.pendingApprovals.length
  const hasLive = liveUrgent !== null || liveBlocked !== null || livePending !== null

  // Live CRM activity when present, else the localized demo fallback.
  const fallbackActivity: ActivityRow[] = ACTIVITY_FALLBACK.map((a) => ({
    time: a.timeKey ? t(a.timeKey) : (a.time ?? ''),
    label: t(a.labelKey),
    detail: t(a.detailKey),
    type: a.type,
  }))
  const activity = liveActivity ?? fallbackActivity

  const lowAdReadiness  = inventoryData.filter((p) => p.adReadiness < 40)
  const missingLandings = inventoryData.filter((p) => p.landingStatus === 'missing')
  const noImages        = inventoryData.filter((p) => !p.hasImages)

  const priorities = [
    ...missingLandings.filter((p) => !dismissed.has(p.id)).map((p) => ({
      id: p.id, name: p.name,
      note: `${t('hub.note.noLanding')}${p.linkedCampaigns > 0 ? t('hub.note.campaignsPaused', { count: p.linkedCampaigns }) : ''}`,
      sev: 'red' as const, href: '/freehold-intelligence/inventory',
    })),
    ...lowAdReadiness.filter((p) => !dismissed.has(p.id)).map((p) => ({
      id: p.id, name: p.name,
      note: t('hub.note.adReadiness', { pct: p.adReadiness }),
      sev: 'amber' as const, href: '/freehold-intelligence/inventory',
    })),
    ...noImages.filter((p) => !missingLandings.includes(p) && !dismissed.has(p.id)).map((p) => ({
      id: p.id, name: p.name,
      note: t('hub.note.noImages'),
      sev: 'amber' as const, href: '/freehold-intelligence/inventory',
    })),
  ]



  // Send a prompt into the single docked Expert conversation, then clear input.
  function askExpert(message: string) {
    const msg = message.trim()
    if (!msg) return
    sendToExpert(msg)
    setChatInput('')
  }

  return (
    <div className="mx-auto max-w-5xl px-5 pb-24 pt-8 sm:px-8 sm:pt-10">

      {/* ── Morning Briefing ──────────────────────────────────────────────── */}
      <section data-coach="hub-briefing" className="mb-8 overflow-hidden rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/[0.09] via-gold/[0.03] to-transparent">
        <div className="p-6 sm:p-7">

          {/* Header row */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-gold/25 bg-gold/10">
                <Sparkles className="h-5 w-5 text-gold" />
              </div>
              <div>
                <div className="text-base font-semibold text-white">{greeting || t('hub.title')}</div>
                <div className="text-sm text-slate-400 mt-0.5">{dateStr}</div>
              </div>
            </div>
            {/* Stat chips */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-400">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                {urgentCards.length} {t('hub.urgent').toLowerCase()}
              </span>
              <span className="flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-400">
                {blockedCount} {t('hub.blocked')}
              </span>
              <span className="flex items-center gap-2 rounded-full border border-line-strong bg-surface-2 px-3 py-1.5 text-sm text-slate-400">
                {pendingCount} {t('hub.pending')}
              </span>
              <Link href="/" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors">
                <Globe className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">freeholdproperty.ae</span>
              </Link>
            </div>
          </div>

          {/* Summary text */}
          <p className="mt-5 text-sm leading-relaxed text-slate-300 max-w-2xl">
            {hasLive
              ? t('hub.briefingLive', { urgent: urgentCards.length, blocked: blockedCount, pending: pendingCount })
              : serverSummary.summaryText}
          </p>

          {/* Divider */}
          <div className="my-5 border-t border-line" />

          {/* AI prompt — routes into the single docked Expert conversation
              (one conversation for the whole workspace, not a separate chat). */}
          <div data-coach="hub-ai">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') askExpert(chatInput) }}
                placeholder={t('hub.askPlaceholder')}
                className="flex-1 rounded-xl border border-white/[0.1] bg-white/[0.05] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-gold/50 transition-colors"
              />
              <button
                type="button"
                onClick={() => askExpert(chatInput)}
                disabled={!chatInput.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold text-ink transition-opacity hover:opacity-85 disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>

            {/* Suggested questions — open + send into the Expert */}
            <div className="mt-3 flex flex-wrap gap-2">
              {serverSummary.askableQuestions.slice(0, 4).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendToExpert(q)}
                  className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-slate-400 transition-colors hover:border-white/[0.2] hover:text-slate-200"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Urgent actions ──────────────────────────────────────────────────── */}
      <Section
        className="mb-8"
        title={<><AlertTriangle className="inline h-3.5 w-3.5 text-red-400 mr-1.5 -mt-0.5" />{t('hub.urgent')}</>}
        action={<span className="text-xs text-slate-500">{urgentCards.length} {t('hub.open')}</span>}
      >
        {urgentCards.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-4">
            <CheckCircle2 className="h-4 w-4 text-gold" />
            <span className="text-sm text-slate-300">{t('hub.noUrgent')}</span>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {urgentCards.map((task) => (
              <div key={task.id} className={`rounded-xl border p-4 ${urgentCardCls(task.priority)}`}>
                <div className="flex items-start gap-3">
                  <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${urgentDotCls(task.priority)}`} />
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-semibold leading-snug ${urgentTitleCls(task.priority)}`}>
                      {task.title}
                    </div>
                    {task.body && <div className="mt-1 text-sm text-slate-400 leading-snug">{task.body}</div>}
                    {(task.meta || task.due) && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                        {task.meta && <span>{task.meta}</span>}
                        {task.meta && task.due && <span>·</span>}
                        {task.due && (
                          <>
                            <Clock className="h-3 w-3" />
                            <span>{task.due}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── App grid ──────────────────────────────────────────────────────────── */}
      <Section title={t('common.apps')}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {apps.map((app) => {
            // Only show the bottom line when it carries a LIVE metric (e.g.
            // inventory/analytics/web-studio). The static app.metric just
            // restated app.sub on most cards, so it's dropped to avoid the
            // duplicate descriptor under the title.
            const metric = DYNAMIC_META[app.id]?.metric ?? ''
            const badge  = DYNAMIC_META[app.id]?.badge ?? app.badge
            return (
              <Link
                key={app.id}
                href={app.href}
                className={`group relative flex flex-col rounded-xl border bg-surface p-5 transition-all duration-200 ${app.card}`}
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
                  <div className="text-sm font-semibold text-slate-100 group-hover:text-white">{NAV_KEYS[app.id] ? t(NAV_KEYS[app.id]) : app.label}</div>
                  <div className="mt-1 text-sm text-slate-400">{app.sub}</div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-slate-400 font-medium">
                    {metric}
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-600 transition-colors group-hover:text-gold" />
                </div>
              </Link>
            )
          })}
        </div>
      </Section>

      {/* ── Executive overview ─────────────────────────────────────────────── */}
      <div className="mt-8 grid gap-4 lg:grid-cols-2">

        {/* Priority queue */}
        <Panel>
          <PanelHeader
            title={t('hub.priorities')}
            icon={<AlertCircle className="h-4 w-4 text-amber-400" />}
            action={<span className="text-xs text-slate-500">{priorities.length} {t('hub.open')}</span>}
          />
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
                    {t('hub.fix')}
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
                <CheckCircle2 className="h-4 w-4 text-gold" />
                <span className="text-sm text-slate-300">{t('hub.allClear')}</span>
              </div>
            )}
          </div>
        </Panel>

        {/* Live activity */}
        <Panel>
          <PanelHeader title={t('hub.liveActivity')} icon={<Activity className="h-4 w-4" />} />
          <div className="divide-y divide-white/[0.06]">
            {activity.map((item, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                <span className={`h-2 w-2 shrink-0 rounded-full ${
                  item.type === 'lead'    ? 'bg-gold' :
                  item.type === 'warning' ? 'bg-amber-400' :
                  item.type === 'success' ? 'bg-emerald-400' : 'bg-surface-3'
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
        </Panel>

      </div>
    </div>
  )
}
