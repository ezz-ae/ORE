'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  BookOpen, Compass, Play, Link2, Search, Sparkles, ChevronDown, Loader2,
  ArrowRight, Users, Megaphone, Package, DollarSign, TrendingUp, ShieldCheck,
  Settings, UserCircle, Rocket, CheckCircle2, Circle,
} from 'lucide-react'
import { useCoach } from '@/components/freehold/coach/coach-marks'
import { howtosForRole, ESSENTIAL_HOWTOS, type HowToFlow } from '@/lib/freehold/howto'
import { loadAccountMemory, saveAccountMemory } from '@/lib/freehold/account-memory'
import { useSession } from '@/lib/freehold/use-session'
import { useI18n } from '@/lib/i18n/provider'
import { p_help } from '@/lib/i18n/dictionaries/p_help'

const ESSENTIALS_PREF_KEY = 'helpEssentialsDone'

const FI = '/freehold-intelligence'

// ─── The Q&A catalogue — the full system, department by department ───────────
// Fully trilingual: every question, answer and link label is an i18n key in
// lib/i18n/dictionaries/p_help.ts (namespace `help.`), resolved with t() at
// render. Every answer either launches the REAL coach (the user does the
// thing, not just reads about it), links to the exact page, or both.

interface QA {
  /** i18n key of the question. */
  q: string
  /** i18n key of the answer. */
  a: string
  /** HowTo flow id — renders the "Guide me step by step" coach button. */
  flow?: string
  /** Direct links rendered as chips (label is an i18n key). */
  links?: Array<{ label: string; href: string }>
  /** Restrict to roles (undefined = everyone). */
  roles?: string[]
}

interface QASection {
  id: string
  /** i18n key of the section title. */
  title: string
  Icon: typeof Users
  items: QA[]
}

const MGMT = ['admin', 'ceo', 'director', 'sales_manager']
const MGMT_MKT = [...MGMT, 'marketing']

const SECTIONS: QASection[] = [
  {
    id: 'start',
    title: 'help.start.title',
    Icon: Rocket,
    items: [
      { q: 'help.start.q1', a: 'help.start.a1' },
      { q: 'help.start.q2', a: 'help.start.a2', flow: 'personalize' },
      { q: 'help.start.q3', a: 'help.start.a3', flow: 'personalize' },
      { q: 'help.start.q4', a: 'help.start.a4' },
      { q: 'help.start.q5', a: 'help.start.a5', links: [{ label: 'help.start.l5', href: `${FI}/notebook` }] },
      { q: 'help.start.q6', a: 'help.start.a6' },
      { q: 'help.start.q7', a: 'help.start.a7' },
    ],
  },
  {
    id: 'crm',
    title: 'help.crm.title',
    Icon: Users,
    items: [
      { q: 'help.crm.q1', a: 'help.crm.a1', flow: 'add-lead', links: [{ label: 'help.crm.l1', href: `${FI}/crm/leads` }] },
      { q: 'help.crm.q2', a: 'help.crm.a2', links: [{ label: 'help.crm.l2', href: `${FI}/crm/inbox` }] },
      { q: 'help.crm.q3', a: 'help.crm.a3', flow: 'assign-lead', roles: MGMT_MKT },
      { q: 'help.crm.q4', a: 'help.crm.a4', flow: 'follow-up', links: [{ label: 'help.crm.l4', href: `${FI}/crm/follow-up` }] },
      { q: 'help.crm.q5', a: 'help.crm.a5', links: [{ label: 'help.crm.l5', href: `${FI}/crm/leads` }] },
      { q: 'help.crm.q6', a: 'help.crm.a6', flow: 'close-deal', links: [{ label: 'help.crm.l6', href: `${FI}/crm/board` }] },
      { q: 'help.crm.q7', a: 'help.crm.a7' },
      { q: 'help.crm.q8', a: 'help.crm.a8', links: [{ label: 'help.crm.l8', href: `${FI}/crm/duplicates` }] },
      { q: 'help.crm.q9', a: 'help.crm.a9' },
    ],
  },
  {
    id: 'ads',
    title: 'help.ads.title',
    Icon: Megaphone,
    items: [
      { q: 'help.ads.q1', a: 'help.ads.a1', links: [{ label: 'help.ads.l1', href: '/freehold-intelligence/lead-machine/ads-machine' }], roles: MGMT_MKT },
      { q: 'help.ads.q2', a: 'help.ads.a2', links: [{ label: 'help.ads.l2', href: '/freehold-intelligence/lead-machine/forms' }], roles: MGMT_MKT },
      { q: 'help.ads.q3', a: 'help.ads.a3', links: [{ label: 'help.ads.l3', href: '/freehold-intelligence/lead-machine/audiences' }], roles: MGMT_MKT },
      { q: 'help.ads.q4', a: 'help.ads.a4', links: [{ label: 'help.ads.l4', href: '/freehold-intelligence/lead-machine/campaigns/new' }], roles: MGMT_MKT },
      { q: 'help.ads.q5', a: 'help.ads.a5', roles: MGMT_MKT },
      { q: 'help.ads.q6', a: 'help.ads.a6', roles: MGMT_MKT },
      { q: 'help.ads.q7', a: 'help.ads.a7', flow: 'meta-ad' },
      { q: 'help.ads.q8', a: 'help.ads.a8', links: [{ label: 'help.ads.l8', href: `${FI}/integrations/meta` }] },
      { q: 'help.ads.q9', a: 'help.ads.a9', links: [{ label: 'help.ads.l9', href: `${FI}/integrations/meta` }] },
      { q: 'help.ads.q10', a: 'help.ads.a10', flow: 'landing-page' },
      { q: 'help.ads.q11', a: 'help.ads.a11', flow: 'landing-page' },
      { q: 'help.ads.q12', a: 'help.ads.a12', flow: 'ai-creative' },
      { q: 'help.ads.q13', a: 'help.ads.a13', flow: 'meta-ad' },
      { q: 'help.ads.q14', a: 'help.ads.a14', flow: 'google-ad' },
      { q: 'help.ads.q15', a: 'help.ads.a15', links: [{ label: 'help.ads.l15', href: `${FI}/ads-live` }] },
      { q: 'help.ads.q16', a: 'help.ads.a16', links: [{ label: 'help.ads.l16', href: `${FI}/integrations` }] },
      { q: 'help.ads.q17', a: 'help.ads.a17', links: [{ label: 'help.ads.l17', href: `${FI}/lead-machine/campaigns` }] },
      { q: 'help.ads.q18', a: 'help.ads.a18', links: [{ label: 'help.ads.l18', href: `${FI}/crm/inbox` }] },
      { q: 'help.ads.q19', a: 'help.ads.a19', roles: MGMT_MKT },
      { q: 'help.ads.q20', a: 'help.ads.a20', roles: MGMT_MKT },
      { q: 'help.ads.q21', a: 'help.ads.a21', links: [{ label: 'help.ads.l21', href: `${FI}/ads-live` }] },
      { q: 'help.ads.q22', a: 'help.ads.a22', roles: MGMT_MKT },
    ],
  },
  {
    id: 'inventory',
    title: 'help.inventory.title',
    Icon: Package,
    items: [
      { q: 'help.inventory.q1', a: 'help.inventory.a1', links: [{ label: 'help.inventory.l1', href: `${FI}/inventory/projects` }] },
      { q: 'help.inventory.q2', a: 'help.inventory.a2', flow: 'advertise-project' },
      { q: 'help.inventory.q3', a: 'help.inventory.a3', links: [{ label: 'help.inventory.l3', href: `${FI}/inventory/data-quality` }] },
      { q: 'help.inventory.q4', a: 'help.inventory.a4', links: [{ label: 'help.inventory.l4', href: `${FI}/inventory/new` }] },
      { q: 'help.inventory.q5', a: 'help.inventory.a5' },
    ],
  },
  {
    id: 'finance',
    title: 'help.finance.title',
    Icon: DollarSign,
    items: [
      { q: 'help.finance.q1', a: 'help.finance.a1', flow: 'commission', roles: MGMT },
      { q: 'help.finance.q2', a: 'help.finance.a2', links: [{ label: 'help.finance.l2', href: `${FI}/finance` }] },
      { q: 'help.finance.q3', a: 'help.finance.a3', links: [{ label: 'help.finance.l3', href: `${FI}/management/deals` }], roles: MGMT },
      { q: 'help.finance.q4', a: 'help.finance.a4', links: [{ label: 'help.finance.l4', href: `${FI}/finance/credits` }], roles: MGMT },
      { q: 'help.finance.q5', a: 'help.finance.a5', links: [{ label: 'help.finance.l5', href: `${FI}/finance/payments` }], roles: MGMT },
      { q: 'help.finance.q6', a: 'help.finance.a6', links: [{ label: 'help.finance.l6', href: `${FI}/finance` }], roles: MGMT },
    ],
  },
  {
    id: 'team',
    title: 'help.team.title',
    Icon: Settings,
    items: [
      { q: 'help.team.q1', a: 'help.team.a1', flow: 'invite-user', roles: MGMT },
      { q: 'help.team.q2', a: 'help.team.a2', links: [{ label: 'help.team.l2', href: `${FI}/settings/roles` }], roles: MGMT },
      { q: 'help.team.q3', a: 'help.team.a3', links: [{ label: 'help.team.l3', href: `${FI}/settings/automation` }], roles: MGMT },
      { q: 'help.team.q4', a: 'help.team.a4', links: [{ label: 'help.team.l4', href: `${FI}/management/team` }], roles: MGMT },
    ],
  },
  {
    id: 'analytics',
    title: 'help.analytics.title',
    Icon: TrendingUp,
    items: [
      { q: 'help.analytics.q1', a: 'help.analytics.a1', flow: 'team-performance', roles: MGMT_MKT },
      { q: 'help.analytics.q2', a: 'help.analytics.a2', links: [{ label: 'help.analytics.l2', href: `${FI}/analytics/team` }], roles: MGMT_MKT },
      { q: 'help.analytics.q3', a: 'help.analytics.a3', links: [{ label: 'help.analytics.l3', href: `${FI}/analytics/marketing` }], roles: MGMT_MKT },
    ],
  },
  {
    id: 'integrations',
    title: 'help.integrations.title',
    Icon: ShieldCheck,
    items: [
      { q: 'help.integrations.q1', a: 'help.integrations.a1', links: [{ label: 'help.integrations.l1', href: `${FI}/integrations/whatsapp` }] },
      { q: 'help.integrations.q2', a: 'help.integrations.a2', links: [{ label: 'help.integrations.l2', href: `${FI}/integrations/hubspot` }] },
      { q: 'help.integrations.q3', a: 'help.integrations.a3', links: [{ label: 'help.integrations.l3', href: `${FI}/integrations/google` }] },
      { q: 'help.integrations.q4', a: 'help.integrations.a4' },
      { q: 'help.integrations.q5', a: 'help.integrations.a5', links: [{ label: 'help.integrations.l5', href: `${FI}/integrations` }] },
    ],
  },
  {
    id: 'broker',
    title: 'help.broker.title',
    Icon: UserCircle,
    items: [
      { q: 'help.broker.q1', a: 'help.broker.a1', flow: 'bio-link', roles: ['broker'] },
      { q: 'help.broker.q2', a: 'help.broker.a2', links: [{ label: 'help.broker.l2', href: `${FI}/agent/leads` }], roles: ['broker'] },
      { q: 'help.broker.q3', a: 'help.broker.a3', links: [{ label: 'help.broker.l3', href: `${FI}/agent/account` }], roles: ['broker'] },
    ],
  },
]

// Page chrome — i18n keys resolved with t() at render.
const UI = {
  eyebrow: 'help.ui.eyebrow',
  title: 'help.ui.title',
  intro1: 'help.ui.intro1',
  introBtn: 'help.ui.introBtn',
  intro2: 'help.ui.intro2',
  searchPlaceholder: 'help.ui.searchPlaceholder',
  matches: 'help.ui.matches',
  noBuiltIn: 'help.ui.noBuiltIn',
  askAi: 'help.ui.askAi',
  aiTitle: 'help.ui.aiTitle',
  openPage: 'help.ui.openPage',
  aiNote: 'help.ui.aiNote',
  aiError: 'help.ui.aiError',
  essentialsTitle: 'help.ui.essentialsTitle',
  essentialsSub: 'help.ui.essentialsSub',
  essentialsDone: 'help.ui.essentialsDone',
  essentialsAllDone: 'help.ui.essentialsAllDone',
  markDone: 'help.ui.markDone',
  markNotDone: 'help.ui.markNotDone',
  walkthroughs: 'help.ui.walkthroughs',
  walkthroughsNote: 'help.ui.walkthroughsNote',
  guideMe: 'help.ui.guideMe',
  noMatchCard: 'help.ui.noMatchCard',
}

interface AiStep { title: string; detail: string; path?: string }

export default function HelpPage() {
  const { t, locale } = useI18n()
  const coach = useCoach()
  const { user } = useSession()
  const role = user?.role

  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiAnswer, setAiAnswer] = useState<{ answer: string; steps: AiStep[] } | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)

  const flows = useMemo(() => howtosForRole(role), [role])
  const flowById = useMemo(() => new Map(flows.map((f) => [f.id, f] as [string, HowToFlow])), [flows])

  // The shared "Start here" essentials — same for everyone, universal flows only.
  const essentials = useMemo(
    () => ESSENTIAL_HOWTOS.map((id) => flowById.get(id)).filter((f): f is HowToFlow => !!f),
    [flowById],
  )
  // Completion ticks persist on the ACCOUNT (follow the user to any device).
  const [done, setDone] = useState<Set<string>>(new Set())
  useEffect(() => {
    loadAccountMemory()
      .then((m) => {
        const raw = (m as Record<string, unknown>)[ESSENTIALS_PREF_KEY]
        if (Array.isArray(raw)) setDone(new Set(raw.filter((x): x is string => typeof x === 'string')))
      })
      .catch(() => {})
  }, [])
  function toggleDone(id: string) {
    setDone((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveAccountMemory({ [ESSENTIALS_PREF_KEY]: [...next] })
      return next
    })
  }
  const doneCount = essentials.reduce((n, f) => n + (done.has(f.id) ? 1 : 0), 0)

  // Role-filtered sections; search filters across question + answer text in
  // the ACTIVE language (plus English as a fallback net).
  const visibleSections = useMemo(() => {
    const q = query.trim().toLowerCase()
    return SECTIONS.map((s) => ({
      ...s,
      items: s.items.filter((it) => {
        if (it.roles && (!role || !it.roles.includes(role))) return false
        if (!q) return true
        return (
          t(it.q).toLowerCase().includes(q) || t(it.a).toLowerCase().includes(q) ||
          (p_help.en[it.q] || '').toLowerCase().includes(q) || (p_help.en[it.a] || '').toLowerCase().includes(q)
        )
      }),
    })).filter((s) => s.items.length > 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, role, locale])

  const matchCount = visibleSections.reduce((n, s) => n + s.items.length, 0)

  async function askAi() {
    const question = query.trim()
    if (!question || aiLoading) return
    setAiLoading(true)
    setAiError(null)
    setAiAnswer(null)
    try {
      const res = await fetch('/api/freehold/help/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || t(UI.aiError))
      setAiAnswer({ answer: data.answer || '', steps: Array.isArray(data.steps) ? data.steps : [] })
    } catch (err) {
      setAiError(err instanceof Error ? err.message : t(UI.aiError))
    } finally {
      setAiLoading(false)
    }
  }

  function GuideButton({ flowId }: { flowId: string }) {
    const flow = flowById.get(flowId)
    if (!flow) return null
    return (
      <button
        onClick={() => coach.startHowTo(flowId)}
        className="inline-flex items-center gap-1.5 rounded-full bg-gold px-3.5 py-1.5 text-xs font-semibold text-ink transition hover:opacity-90"
      >
        <Play className="h-3 w-3" /> {t(UI.guideMe)}
      </button>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-5 pb-24 pt-8 sm:px-8">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold/85">
        <BookOpen className="h-4 w-4" /> {t(UI.eyebrow)}
      </div>
      <h1 className="mt-3 text-[28px] font-semibold tracking-tight text-white">{t(UI.title)}</h1>
      <p className="mt-1 max-w-[58ch] text-sm text-slate-400">
        {t(UI.intro1)}<b className="text-slate-200">{t(UI.introBtn)}</b>{t(UI.intro2)}
      </p>

      {/* Search + AI ask */}
      <div className="sticky top-16 z-30 -mx-2 mt-6 rounded-2xl border border-line bg-surface/95 p-2 backdrop-blur">
        <div className="relative">
          <Search className="absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setAiAnswer(null); setAiError(null) }}
            onKeyDown={(e) => { if (e.key === 'Enter' && matchCount === 0) askAi() }}
            placeholder={t(UI.searchPlaceholder)}
            className="w-full rounded-xl border border-line bg-surface-2 py-2.5 ps-10 pe-4 text-sm text-slate-100 placeholder:text-slate-600 outline-none transition focus:border-gold/50"
          />
        </div>
        {query.trim() && (
          <div className="flex items-center justify-between gap-3 px-2 pt-2 pb-1">
            <span className="text-xs text-slate-500">
              {matchCount > 0 ? `${matchCount} ${t(UI.matches)}` : t(UI.noBuiltIn)}
            </span>
            <button
              onClick={askAi}
              disabled={aiLoading}
              className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold transition hover:bg-gold/20 disabled:opacity-60"
            >
              {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              {t(UI.askAi)}
            </button>
          </div>
        )}
      </div>

      {/* AI answer */}
      {aiError && (
        <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/[0.05] px-4 py-3 text-sm text-red-300">{aiError}</div>
      )}
      {aiAnswer && (
        <div className="mt-4 rounded-2xl border border-gold/25 bg-gold/[0.04] p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold">
            <Sparkles className="h-3.5 w-3.5" /> {t(UI.aiTitle)}
          </div>
          {aiAnswer.answer && <p className="mt-2 text-sm leading-relaxed text-slate-200">{aiAnswer.answer}</p>}
          {aiAnswer.steps.length > 0 && (
            <ol className="mt-3 space-y-2.5">
              {aiAnswer.steps.map((s, i) => (
                <li key={i} className="flex gap-3 rounded-xl border border-line bg-surface p-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gold/15 text-xs font-bold text-gold">{i + 1}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white">{s.title}</div>
                    {s.detail && <p className="mt-0.5 text-[13px] leading-relaxed text-slate-400">{s.detail}</p>}
                    {s.path && (
                      <Link href={s.path} className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-gold hover:opacity-80">
                        {t(UI.openPage)} <ArrowRight className="h-3 w-3 rtl:rotate-180" />
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-3 text-[11px] text-slate-500">{t(UI.aiNote)}</p>
        </div>
      )}

      {/* Start here — the essentials (shared do-it-yourself checklist) */}
      {!query.trim() && essentials.length > 0 && (
        <section className="mt-8 rounded-2xl border border-gold/25 bg-gold/[0.04] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gold/90">
              <Rocket className="h-4 w-4" /> {t(UI.essentialsTitle)}
            </h2>
            <span className="text-xs font-medium tabular-nums text-slate-400">
              {doneCount} / {essentials.length} {t(UI.essentialsDone)}
            </span>
          </div>
          <p className="mt-1 max-w-[58ch] text-xs text-slate-400">{t(UI.essentialsSub)}</p>
          {/* Progress bar */}
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gold transition-all"
              style={{ width: `${Math.round((doneCount / essentials.length) * 100)}%` }}
            />
          </div>
          <ol className="mt-4 space-y-2">
            {essentials.map((flow, i) => {
              const isDone = done.has(flow.id)
              return (
                <li
                  key={flow.id}
                  className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-3"
                >
                  <button
                    onClick={() => toggleDone(flow.id)}
                    aria-label={isDone ? t(UI.markNotDone) : t(UI.markDone)}
                    className="shrink-0 text-gold transition hover:opacity-80"
                  >
                    {isDone ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5 text-slate-500" />}
                  </button>
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/[0.06] text-xs font-bold text-slate-400">
                    {i + 1}
                  </span>
                  <span className={`min-w-0 flex-1 text-sm font-medium ${isDone ? 'text-slate-500 line-through' : 'text-slate-100'}`}>
                    {t(flow.titleKey)}
                  </span>
                  <button
                    onClick={() => coach.startHowTo(flow.id)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gold px-3.5 py-1.5 text-xs font-semibold text-ink transition hover:opacity-90"
                  >
                    <Play className="h-3 w-3" /> {t(UI.guideMe)}
                  </button>
                </li>
              )
            })}
          </ol>
          {doneCount === essentials.length && (
            <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-gold">
              <CheckCircle2 className="h-3.5 w-3.5" /> {t(UI.essentialsAllDone)}
            </p>
          )}
        </section>
      )}

      {/* Guided walkthroughs strip */}
      {!query.trim() && (
        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
            <Compass className="h-4 w-4" /> {t(UI.walkthroughs)}
          </h2>
          <div className="flex flex-wrap gap-2">
            {flows.map((flow) => (
              <button
                key={flow.id}
                onClick={() => coach.startHowTo(flow.id)}
                className="inline-flex items-center gap-2 rounded-full border border-gold/25 bg-gold/[0.06] px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-gold/[0.14]"
              >
                <Play className="h-3.5 w-3.5 text-gold" /> {t(flow.titleKey)}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">{t(UI.walkthroughsNote)}</p>
        </section>
      )}

      {/* Q&A — department by department */}
      {visibleSections.map((section) => (
        <section key={section.id} className="mt-10">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
            <section.Icon className="h-4 w-4" /> {t(section.title)}
          </h2>
          <div className="space-y-2">
            {section.items.map((item) => {
              const id = `${section.id}:${item.q}`
              const open = openId === id
              return (
                <div key={id} className="overflow-hidden rounded-2xl border border-line bg-surface">
                  <button
                    onClick={() => setOpenId(open ? null : id)}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-start transition hover:bg-white/[0.03]"
                  >
                    <span className="flex-1 text-sm font-medium text-slate-100">{t(item.q)}</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {open && (
                    <div className="border-t border-line px-4 py-3.5">
                      <p className="text-[13.5px] leading-relaxed text-slate-300">{t(item.a)}</p>
                      {(item.flow || item.links?.length) && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {item.flow && <GuideButton flowId={item.flow} />}
                          {item.links?.map((l) => (
                            <Link key={l.href} href={l.href}
                              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3.5 py-1.5 text-xs text-slate-200 transition hover:border-gold/40 hover:text-white">
                              <Link2 className="h-3 w-3 text-gold" /> {t(l.label)}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      ))}

      {/* Nothing matched at all */}
      {query.trim() && matchCount === 0 && !aiAnswer && !aiLoading && (
        <div className="mt-8 rounded-2xl border border-line bg-surface px-5 py-6 text-center">
          <p className="text-sm text-slate-400">{t(UI.noMatchCard)}</p>
        </div>
      )}
    </div>
  )
}
