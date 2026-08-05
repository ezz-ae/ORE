'use client'

import { useState, useEffect, useMemo } from 'react'
import { BRAND } from '@/lib/freehold/brand'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertCircle, Activity, ArrowUpRight, X, Globe, Sparkles,
  Users, Radio, Inbox, CalendarClock, Handshake, TrendingUp, ArrowRight,
  Monitor, Wand2, Cloud, BookOpen, Bell,
} from 'lucide-react'
import { type InventoryProperty } from '@/src/features/freehold-intelligence/inventory'
import { useSession } from '@/lib/freehold/use-session'
import { Panel, PanelHeader, buttonClass } from '@/components/freehold/ui'
import { useI18n } from '@/lib/i18n/provider'
import { openWhatsNew } from '@/components/freehold/whats-new'
import { metaLeadCount } from '@/lib/meta/lead-count'
import { AiPrompt } from '@/components/freehold/ai-prompt'
import { sendToExpert } from '@/lib/freehold/expert-bus'
import { NotificationsBell } from '@/components/freehold/notifications-bell'

// ─── The hub is a briefing, not a menu ───────────────────────────────────────
// The nav spine already switches apps, and the Expert already answers
// questions — so the home page does neither. It reads the live system and
// says what's going on: what needs you (only when something does), and
// deep widgets for ads, leads, team and the site. Empty boxes don't render.

type ActivityType = 'lead' | 'warning' | 'success' | 'info'
type ActivityRow = { time: string; label: string; detail: string; type: ActivityType }

type Signal = {
  id: string
  sev: 'red' | 'amber' | 'gold'
  text: string
  href: string
  /** concrete instruction the "Ask AI" affordance sends to the Expert */
  ai: string
}

type AdRow = { id: string; name: string; active: boolean; spend: number; leads: number }
type AgentRow = { id: string; name: string; initials: string; totalLeads: number; hotLeads: number; utilization: number }

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

const FI = '/freehold-intelligence'
const sevDot = { red: 'bg-red-400', amber: 'bg-amber-400', gold: 'bg-gold' } as const

export default function DashboardClient({ inventoryData }: { inventoryData: InventoryProperty[] }) {
  const totalViews30d = inventoryData.reduce((s, p) => s + p.views30d, 0)
  const topViewed = [...inventoryData].sort((a, b) => b.views30d - a.views30d).slice(0, 3)
  const missingLandings = inventoryData.filter((p) => p.landingStatus === 'missing')
  const lowAdReadiness = inventoryData.filter((p) => p.adReadiness < 40)
  const noImages = inventoryData.filter((p) => !p.hasImages)

  const [greeting, setGreeting] = useState('')
  const [dateStr, setDateStr] = useState('')
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  // Live counters — null until (and unless) their fetch succeeds.
  const [urgentTasks, setUrgentTasks] = useState<number | null>(null)
  const [pendingDeals, setPendingDeals] = useState<number | null>(null)
  const [payoutsAed, setPayoutsAed] = useState<number | null>(null)
  const [crm, setCrm] = useState<{ total: number; fresh: number; hot: number; overdue: number } | null>(null)
  const [activity, setActivity] = useState<ActivityRow[]>([])
  const [ads, setAds] = useState<{ connected: boolean; rows: AdRow[]; spend: number; leads: number } | null>(null)
  const [agents, setAgents] = useState<AgentRow[]>([])

  const { user } = useSession()
  const role = user?.role
  const router = useRouter()
  const { t, locale } = useI18n()
  const localeTag = locale === 'ar' ? 'ar-AE' : locale === 'ru' ? 'ru-RU' : 'en-AE'

  useEffect(() => {
    setDateStr(new Date().toLocaleDateString(localeTag, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Dubai' }))
  }, [localeTag])

  useEffect(() => {
    if (!user?.name) return
    setGreeting(getGreeting(user.name, t))
  }, [user?.name, t])

  useEffect(() => {
    if (user?.role === 'broker') router.replace(`${FI}/agent`)
  }, [user?.role])

  // ── Live reads (every box below only renders from what actually loads) ────
  useEffect(() => {
    if (role === 'broker') return

    const relTime = (iso: string) => {
      const d = new Date(iso)
      const now = new Date()
      const yest = new Date(now); yest.setDate(now.getDate() - 1)
      if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString(localeTag, { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' })
      if (d.toDateString() === yest.toDateString()) return t('hub.yesterday')
      return d.toLocaleDateString(localeTag, { day: 'numeric', month: 'short', timeZone: 'Asia/Dubai' })
    }

    fetch('/api/freehold/tasks')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const tasks = d?.tasks as Array<{ priority: string; status: string }> | undefined
        if (!tasks) return
        setUrgentTasks(tasks.filter((tk) => tk.status !== 'done' && (tk.priority === 'critical' || tk.priority === 'high')).length)
      })
      .catch(() => {})

    fetch('/api/freehold/deals?status=pending_step2')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (Array.isArray(d?.deals)) setPendingDeals(d.deals.length) })
      .catch(() => {})

    fetch('/api/freehold/finance/entries')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const payouts = d?.payouts as Array<{ outstandingAed: number }> | undefined
        if (!payouts) return
        setPayoutsAed(payouts.reduce((s, p) => s + (Number(p.outstandingAed) || 0), 0))
      })
      .catch(() => {})

    fetch('/api/freehold/crm/summary')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const s = d?.summary
        if (!s) return
        setCrm({ total: s.totalLeads ?? 0, fresh: s.newLeads ?? 0, hot: s.hotLeads ?? 0, overdue: s.urgentFollowUps ?? 0 })
      })
      .catch(() => {})

    fetch('/api/freehold/crm/activity')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const rows = d?.activity as Array<{ activity_type: string; description: string | null; created_at: string; lead_name: string | null }> | undefined
        if (!rows?.length) return
        // Humanize for the feed: drop machine ids, prettify slugs, cap length,
        // and collapse consecutive duplicates — a briefing, not a log file.
        const clean = (s: string) => s
          .replace(/\b[A-Za-z0-9_-]{16,}\b/g, '')
          .replace(/\bfreehold-([a-z0-9-]+)/gi, (_, x: string) => x.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()))
          .replace(/\s*[·—-]\s*(?=\s*[·—-]|$)/g, '')
          .replace(/\s{2,}/g, ' ')
          .trim()
        const mapped = rows.slice(0, 12).map((a) => ({
          time: relTime(a.created_at),
          label: humanize(a.activity_type),
          detail: clean([a.lead_name, a.description].filter(Boolean).join(' — ')).slice(0, 110) || '—',
          type: activityKind(a.activity_type),
        }))
        setActivity(mapped.filter((r, i) => i === 0 || r.detail !== mapped[i - 1].detail || r.label !== mapped[i - 1].label).slice(0, 6))
      })
      .catch(() => {})

    fetch('/api/meta/campaigns', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d || d.demo || !Array.isArray(d.campaigns)) { setAds({ connected: false, rows: [], spend: 0, leads: 0 }); return }
        const rows: AdRow[] = d.campaigns.map((c: { id: string; name: string; status: string; insights?: { spend?: string; actions?: Array<{ action_type: string; value: string }> } }) => ({
          id: c.id,
          name: c.name,
          active: c.status === 'ACTIVE',
          spend: Number(c.insights?.spend) || 0,
          leads: metaLeadCount(c.insights?.actions),
        }))
        setAds({
          connected: true,
          rows: rows.sort((a, b) => b.spend - a.spend).slice(0, 3),
          spend: rows.reduce((s, r) => s + r.spend, 0),
          leads: rows.reduce((s, r) => s + r.leads, 0),
        })
      })
      .catch(() => {})

    fetch('/api/freehold/crm/agents')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const rows = d?.agents as Array<{ id: string; name: string; initials: string; totalLeads: number; hotLeads: number; utilization: number }> | undefined
        if (!rows?.length) return
        setAgents(rows.slice(0, 4).map((a) => ({
          id: a.id, name: a.name, initials: a.initials,
          totalLeads: a.totalLeads, hotLeads: a.hotLeads, utilization: Math.min(100, a.utilization),
        })))
      })
      .catch(() => {})
  }, [role, localeTag, t])

  // ── "Needs your attention" — real signals only; empty ⇒ the box is gone ───
  const signals: Signal[] = useMemo(() => {
    const s: Signal[] = []
    if (crm && crm.overdue > 0) s.push({ id: 'overdue', sev: 'red', text: t('hub.sig.overdue', { n: crm.overdue }), href: `${FI}/crm/follow-up`, ai: t('hub.ai.overdue') })
    if (urgentTasks && urgentTasks > 0) s.push({ id: 'tasks', sev: 'red', text: t('hub.sig.tasks', { n: urgentTasks }), href: `${FI}/tasks`, ai: t('hub.ai.tasks') })
    if (crm && crm.fresh > 0) s.push({ id: 'inbox', sev: 'gold', text: t('hub.sig.inbox', { n: crm.fresh }), href: `${FI}/crm/inbox`, ai: t('hub.ai.inbox') })
    if (pendingDeals && pendingDeals > 0) s.push({ id: 'deals', sev: 'amber', text: t('hub.sig.deals', { n: pendingDeals }), href: `${FI}/management/deals`, ai: t('hub.ai.deals') })
    if (payoutsAed && payoutsAed > 0) s.push({ id: 'payouts', sev: 'amber', text: t('hub.sig.payouts', { amount: Math.round(payoutsAed).toLocaleString() }), href: `${FI}/finance/payments`, ai: t('hub.ai.payouts') })
    if (missingLandings.length > 0) s.push({ id: 'landings', sev: 'amber', text: t('hub.sig.landings', { n: missingLandings.length }), href: `${FI}/inventory/landings`, ai: t('hub.ai.landings') })
    return s
  }, [crm, urgentTasks, pendingDeals, payoutsAed, missingLandings.length, t])

  // Screen-aware AI suggestions — grounded in the live signals, so tapping one
  // runs a concrete action loop in the Expert (not a generic prompt).
  const aiSuggestions = useMemo(() => {
    const out = signals.slice(0, 3).map((x) => x.ai)
    out.push(t('hub.ai.focus'))
    return Array.from(new Set(out)).slice(0, 4)
  }, [signals, t])

  // Inventory fix-list (dismissable) — only rendered when non-empty.
  const priorities = [
    ...missingLandings.filter((p) => !dismissed.has(p.id)).map((p) => ({
      id: p.id, name: p.name,
      note: `${t('hub.note.noLanding')}${p.linkedCampaigns > 0 ? t('hub.note.campaignsPaused', { count: p.linkedCampaigns }) : ''}`,
      sev: 'red' as const, href: `${FI}/inventory`,
    })),
    ...lowAdReadiness.filter((p) => !dismissed.has(p.id)).map((p) => ({
      id: p.id, name: p.name, note: t('hub.note.adReadiness', { pct: p.adReadiness }),
      sev: 'amber' as const, href: `${FI}/inventory`,
    })),
    ...noImages.filter((p) => !missingLandings.includes(p) && !dismissed.has(p.id)).map((p) => ({
      id: p.id, name: p.name, note: t('hub.note.noImages'),
      sev: 'amber' as const, href: `${FI}/inventory`,
    })),
  ]

  // Deep entry points — not the nav again; each goes INSIDE an app.
  const deepLinks: Array<{ key: string; Icon: typeof Users; label: string; href?: string; onClick?: () => void }> = [
    { key: 'team', href: `${FI}/management/team`, Icon: Users, label: t('hub.go.team') },
    { key: 'ads', href: `${FI}/ads-live`, Icon: Radio, label: t('hub.go.liveAds') },
    { key: 'inbox', href: `${FI}/crm/inbox`, Icon: Inbox, label: t('hub.go.inbox') },
    { key: 'followup', href: `${FI}/crm/follow-up`, Icon: CalendarClock, label: t('hub.go.followup') },
    { key: 'deals', href: `${FI}/management/deals`, Icon: Handshake, label: t('hub.go.deals') },
    { key: 'site', href: `${FI}/analytics/marketing`, Icon: TrendingUp, label: t('hub.go.site') },
    // From Drive — the same rooms/nav entries, surfaced as one-tap shortcuts.
    { key: 'webDesigner', href: `${FI}/drive/web`, Icon: Monitor, label: t('drive.room.web.title') },
    { key: 'editor', href: `${FI}/drive/editor`, Icon: Wand2, label: t('drive.nav.editor') },
    { key: 'studio', href: `${FI}/drive/create`, Icon: Sparkles, label: t('drive.room.studio.title') },
    { key: 'cloud', href: `${FI}/cloud`, Icon: Cloud, label: t('drive.room.cloud.title') },
    { key: 'whatsNew', onClick: openWhatsNew, Icon: Bell, label: t('whatsnew.menu') },
    { key: 'guide', href: `${FI}/help`, Icon: BookOpen, label: t('hub.go.guide') },
  ]

  return (
    <div className="mx-auto max-w-5xl px-5 pb-24 pt-8 sm:px-8 sm:pt-10">

      {/* ── Greeting — slim, no box ──────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">{greeting || t('hub.title')}</h1>
          <div className="mt-0.5 text-sm text-slate-400">{dateStr}</div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-300">
            <Globe className="h-3.5 w-3.5" /> {BRAND.domain}
          </Link>
          <NotificationsBell />
        </div>
      </div>

      {/* ── AI composer — home is the main AI of the day. Type here → the one
          docked Expert opens and runs the action loop, grounded in live data. ── */}
      <div className="mb-6" data-coach="hub-ai">
        <AiPrompt placeholder={t('hub.ai.placeholder')} suggestions={aiSuggestions} />
      </div>

      {/* ── Needs your attention — exists ONLY when something does ──────────── */}
      {signals.length > 0 && (
        <section data-coach="hub-briefing" className="mb-6 overflow-hidden rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/[0.08] via-gold/[0.02] to-transparent">
          <div className="flex items-center gap-2.5 border-b border-line px-5 py-3.5">
            <Sparkles className="h-4 w-4 text-gold" />
            <span className="text-sm font-semibold text-white">{t('hub.attention')}</span>
            <span className="ml-auto text-xs text-slate-500">{signals.length}</span>
          </div>
          <div className="divide-y divide-white/[0.05]">
            {signals.map((s) => (
              <div key={s.id} className="group flex items-center gap-3 px-5 py-3 transition hover:bg-white/[0.03]">
                <span className={`h-2 w-2 shrink-0 rounded-full ${sevDot[s.sev]}`} />
                <Link href={s.href} className="flex-1 text-sm text-slate-200 transition hover:text-white">{s.text}</Link>
                {/* Ask AI — hand this signal to the Expert as a concrete task */}
                <button
                  type="button"
                  onClick={() => sendToExpert(s.ai)}
                  title={t('hub.askAi')}
                  aria-label={t('hub.askAi')}
                  className="shrink-0 rounded-full border border-gold/25 bg-gold/[0.06] p-1.5 text-gold/80 transition hover:bg-gold/15 hover:text-gold"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                </button>
                <Link href={s.href} aria-label={t('hub.w.open')} className="shrink-0 text-slate-600 transition group-hover:text-gold">
                  <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Deep entry points — a button group, not the nav again ───────────── */}
      <div className="mb-8 flex flex-wrap gap-2">
        {deepLinks.map((l, i) => {
          // LITE: phones show the 4 essentials; the rest are desktop depth.
          const cls = buttonClass('secondary', 'sm', `gap-2${i >= 4 ? ' max-sm:hidden' : ''}`)
          return l.href ? (
            <Link key={l.key} href={l.href} className={cls}>
              <l.Icon className="h-3.5 w-3.5 text-gold" /> {l.label}
            </Link>
          ) : (
            <button key={l.key} type="button" onClick={l.onClick} className={cls}>
              <l.Icon className="h-3.5 w-3.5 text-gold" /> {l.label}
            </button>
          )
        })}
      </div>

      {/* ── Live widgets — desktop depth; phones keep only what needs you.
          (The bottom tabs are the phone's way into Leads / Ads / Inventory.) ── */}
      <div className="grid gap-4 max-md:hidden lg:grid-cols-2">

        {/* Leads */}
        {crm && crm.total > 0 && (
          <Panel>
            <PanelHeader
              title={t('hub.w.leads')}
              icon={<Users className="h-4 w-4 text-gold" />}
              action={<Link href={`${FI}/crm`} className="flex items-center gap-1 text-xs text-slate-500 transition hover:text-slate-300">{t('hub.w.open')} <ArrowUpRight className="h-3 w-3" /></Link>}
            />
            <div className="grid grid-cols-4 divide-x divide-white/[0.06]">
              {[
                { label: t('hub.w.leadsTotal'), value: crm.total, href: `${FI}/crm` },
                { label: t('hub.w.leadsNew'), value: crm.fresh, href: `${FI}/crm/inbox`, gold: crm.fresh > 0 },
                { label: t('hub.w.leadsHot'), value: crm.hot, href: `${FI}/crm` },
                { label: t('hub.w.overdueShort'), value: crm.overdue, href: `${FI}/crm/follow-up`, red: crm.overdue > 0 },
              ].map((k) => (
                <Link key={k.label} href={k.href} className="px-4 py-4 text-center transition hover:bg-white/[0.03]">
                  <div className={`text-xl font-semibold leading-none ${k.red ? 'text-red-400' : k.gold ? 'text-gold' : 'text-white'}`}>{k.value}</div>
                  <div className="mt-1.5 text-[11px] uppercase tracking-wider text-slate-500">{k.label}</div>
                </Link>
              ))}
            </div>
          </Panel>
        )}

        {/* Live ads — only when a platform is genuinely connected */}
        {ads?.connected && (
          <Panel>
            <PanelHeader
              title={t('hub.w.liveAds')}
              icon={<Radio className="h-4 w-4 text-gold" />}
              action={<Link href={`${FI}/ads-live`} className="flex items-center gap-1 text-xs text-slate-500 transition hover:text-slate-300">{t('hub.w.open')} <ArrowUpRight className="h-3 w-3" /></Link>}
            />
            {ads.rows.length === 0 ? (
              <div className="px-5 py-4 text-sm text-slate-400">{t('hub.w.noCampaigns')}</div>
            ) : (
              <>
                <div className="divide-y divide-white/[0.06]">
                  {ads.rows.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${c.active ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-200">{c.name}</span>
                      <span className="shrink-0 text-xs text-slate-400">{c.spend > 0 ? `AED ${c.spend.toLocaleString()}` : '—'}</span>
                      <span className={`w-10 shrink-0 text-end text-sm font-semibold ${c.leads > 0 ? 'text-gold' : 'text-slate-600'}`}>{c.leads || '—'}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t border-line px-5 py-2.5 text-xs text-slate-500">
                  <span>{t('hub.w.spend')}: <span className="text-slate-300">AED {ads.spend.toLocaleString()}</span></span>
                  <span>{t('hub.w.leadsCount')}: <span className="text-gold">{ads.leads}</span></span>
                </div>
              </>
            )}
          </Panel>
        )}

        {/* Team load */}
        {agents.length > 0 && (
          <Panel>
            <PanelHeader
              title={t('hub.w.team')}
              icon={<Users className="h-4 w-4 text-gold" />}
              action={<Link href={`${FI}/management/team`} className="flex items-center gap-1 text-xs text-slate-500 transition hover:text-slate-300">{t('hub.w.open')} <ArrowUpRight className="h-3 w-3" /></Link>}
            />
            <div className="divide-y divide-white/[0.06]">
              {agents.map((a) => (
                <div key={a.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface-2 text-[10px] font-bold text-slate-300">{a.initials}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-200">{a.name}</span>
                  <div className="hidden w-24 shrink-0 sm:block">
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                      <div className={`h-full rounded-full ${a.utilization >= 90 ? 'bg-red-400' : a.utilization >= 65 ? 'bg-amber-400' : 'bg-gold'}`} style={{ width: `${a.utilization}%` }} />
                    </div>
                  </div>
                  <span className="w-14 shrink-0 text-end text-xs text-slate-400">{t('hub.w.leadsN', { n: a.totalLeads })}</span>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {/* Website — last 30 days */}
        {totalViews30d > 0 && (
          <Panel>
            <PanelHeader
              title={t('hub.w.site')}
              icon={<TrendingUp className="h-4 w-4 text-gold" />}
              action={<Link href={`${FI}/analytics`} className="flex items-center gap-1 text-xs text-slate-500 transition hover:text-slate-300">{t('hub.w.open')} <ArrowUpRight className="h-3 w-3" /></Link>}
            />
            <div className="px-5 py-3">
              <div className="text-2xl font-semibold text-white">{totalViews30d.toLocaleString()}</div>
              <div className="mt-0.5 text-xs uppercase tracking-wider text-slate-500">{t('hub.w.projectViews')}</div>
            </div>
            <div className="divide-y divide-white/[0.06] border-t border-line">
              {topViewed.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-300">{p.name}</span>
                  <span className="shrink-0 text-xs tabular-nums text-slate-500">{t('hub.w.views', { n: p.views30d.toLocaleString() })}</span>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {/* Inventory fixes */}
        {priorities.length > 0 && (
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
                    <div className="truncate text-sm font-medium text-slate-200">{p.name}</div>
                    <div className="truncate text-sm text-slate-400">{p.note}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Link href={p.href}
                      className="rounded-lg border border-white/[0.1] px-3 py-1 text-sm text-slate-300 transition-colors hover:border-white/[0.25] hover:text-white">
                      {t('hub.fix')}
                    </Link>
                    <button type="button" onClick={() => setDismissed((s) => new Set([...s, p.id]))}
                      className="p-1 text-slate-600 transition-colors hover:text-slate-300">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {/* Live activity — real events only, no demo fallback */}
        {activity.length > 0 && (
          <Panel>
            <PanelHeader title={t('hub.liveActivity')} icon={<Activity className="h-4 w-4" />} />
            <div className="divide-y divide-white/[0.06]">
              {activity.map((item, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${
                    item.type === 'lead' ? 'bg-gold' :
                    item.type === 'warning' ? 'bg-amber-400' :
                    item.type === 'success' ? 'bg-emerald-400' : 'bg-surface-3'
                  }`} />
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium text-slate-200">{item.label}</span>
                    <span className="mx-2 text-slate-600">·</span>
                    <span className="text-sm text-slate-400">{item.detail}</span>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-slate-500">{item.time}</span>
                </div>
              ))}
            </div>
          </Panel>
        )}

      </div>
    </div>
  )
}
