'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  BookOpen, Compass, Play, Link2, Search, Sparkles, ChevronDown, Loader2,
  ArrowRight, Users, Megaphone, Package, DollarSign, TrendingUp, ShieldCheck,
  Settings, UserCircle, Rocket,
} from 'lucide-react'
import { useCoach } from '@/components/freehold/coach/coach-marks'
import { howtosForRole, type HowToFlow } from '@/lib/freehold/howto'
import { useSession } from '@/lib/freehold/use-session'
import { useT } from '@/lib/i18n/provider'

const FI = '/freehold-intelligence'

// ─── The Q&A catalogue — the full system, department by department ───────────
// Every answer either launches the REAL coach (the user does the thing, not
// just reads about it), links to the exact page, or both.

interface QA {
  q: string
  a: string
  /** HowTo flow id — renders the "Guide me step by step" coach button. */
  flow?: string
  /** Direct links rendered as chips. */
  links?: Array<{ label: string; href: string }>
  /** Restrict to roles (undefined = everyone). */
  roles?: string[]
}

interface QASection {
  id: string
  title: string
  Icon: typeof Users
  items: QA[]
}

const MGMT = ['admin', 'ceo', 'director', 'sales_manager']
const MGMT_MKT = [...MGMT, 'marketing']

const SECTIONS: QASection[] = [
  {
    id: 'start',
    title: 'Getting started & your account',
    Icon: Rocket,
    items: [
      { q: 'How do I sign in?', a: 'Go to the sign-in page, pick your profile and enter your password. "Keep me signed in" keeps the session for 30 days on that device.' },
      { q: 'Where do I change the language (English / العربية / Русский)?', a: 'Account menu (top-right) → Language. Arabic flips the whole layout right-to-left automatically. On a first visit the app opens in your device\'s language.', flow: 'personalize' },
      { q: 'How do I switch between Day and Night?', a: 'Account menu → the Day / Night screen-light toggle. Your choice is saved to your account.', flow: 'personalize' },
      { q: 'Will my settings follow me to another device?', a: 'Yes. Language, theme, dismissed notices, tour progress, even an unfinished campaign draft — all live on your ACCOUNT, not the browser. Sign in anywhere and it\'s your setup.' },
      { q: 'What is the gold AI button on every screen?', a: 'The Expert — press it (or ⌘J / Ctrl-J) and ask anything about your live data. Whatever it produces can be saved to the Notebook.', links: [{ label: 'Notebook', href: `${FI}/notebook` }] },
      { q: 'How do I replay a page\'s tour?', a: 'Account menu → "Take a tour" replays the guided tour for the app you\'re on. The walkthroughs on this page go deeper — across pages, task by task.' },
      { q: 'Where do I see what\'s new in the system?', a: 'Account menu → What\'s new. When something ships you\'ll also get a small corner note — dismissing it once dismisses it on all your devices.' },
    ],
  },
  {
    id: 'crm',
    title: 'CRM & leads',
    Icon: Users,
    items: [
      { q: 'How do I add a lead manually?', a: 'CRM → Leads → Add lead. Name and phone are enough to start.', flow: 'add-lead', links: [{ label: 'CRM → Leads', href: `${FI}/crm/leads` }] },
      { q: 'Where do new leads from ads arrive?', a: 'The CRM Inbox — the moment a Meta form or landing page captures someone, the lead appears there unassigned, with its source attached.', links: [{ label: 'CRM → Inbox', href: `${FI}/crm/inbox` }] },
      { q: 'How do I assign a lead to a broker?', a: 'From the Inbox or the Assignment screen — every broker shows live capacity so no one gets overloaded. The broker is emailed instantly.', flow: 'assign-lead', roles: MGMT_MKT },
      { q: 'How do I know which leads I\'m late on?', a: 'CRM → Follow-up. Every overdue lead is queued by urgency — start each morning at the top.', flow: 'follow-up', links: [{ label: 'Follow-up queue', href: `${FI}/crm/follow-up` }] },
      { q: 'How do I call or WhatsApp a lead?', a: 'Call and WhatsApp buttons sit on every lead row and inside the lead\'s 360° view. Every touch lands in the timeline automatically.', links: [{ label: 'CRM → Leads', href: `${FI}/crm/leads` }] },
      { q: 'How do I move a lead through the pipeline?', a: 'Drag it across the Board. Dropping it on Closed opens the deal window so the sale is recorded with its commission.', flow: 'close-deal', links: [{ label: 'CRM → Board', href: `${FI}/crm/board` }] },
      { q: 'What is the FH-#### code on each lead?', a: 'The lead\'s permanent serial code — use it in chats and reports so everyone knows exactly which lead you mean.' },
      { q: 'How do I find duplicate leads?', a: 'CRM → Duplicates lists likely matches (same phone/email) so you can merge or dismiss them.', links: [{ label: 'CRM → Duplicates', href: `${FI}/crm/duplicates` }] },
      { q: 'Where is a lead\'s full history?', a: 'Open the lead — the 360° view holds every call, message, note, status change, source page and deal in one timeline.' },
    ],
  },
  {
    id: 'ads',
    title: 'Ads, campaigns & landing pages',
    Icon: Megaphone,
    items: [
      { q: 'How do I run a Meta lead campaign?', a: 'The wizard walks you from project → creative → budget → launch. Launch paused first — nothing spends until you flip it live.', flow: 'meta-ad' },
      { q: 'How do I connect the company Meta ad account?', a: 'Integrations → Meta Ads has the exact steps ("How do I get this?") — create a System User token, paste it, pick the ad account and Page. It\'s validated with Meta before being stored encrypted.', links: [{ label: 'Integrations → Meta', href: `${FI}/integrations/meta` }] },
      { q: 'I have several ad accounts — how do I pick the active one?', a: 'On Integrations → Meta Ads every account shows as a card; press "Set active" on the one campaigns should use. The active one wears the gold border.', links: [{ label: 'Integrations → Meta', href: `${FI}/integrations/meta` }] },
      { q: 'How do I create and publish a landing page?', a: 'Lead Machine → Landing pages → Create. The page is generated from live project data and publishes at /lp/<name>.', flow: 'landing-page' },
      { q: 'How do I turn a landing page into a campaign?', a: 'Every landing-page row has a Campaign button — it opens the ad builder prefilled with that page as the ad\'s destination.', flow: 'landing-page' },
      { q: 'How do I generate ad copy with AI?', a: 'Lead Machine → Creatives → Generate. AI drafts headlines and copy from the real listing; refine and use it in the campaign builder.', flow: 'ai-creative' },
      { q: 'Can I upload my own ad image?', a: 'Yes — in the campaign wizard\'s Creative step: keep the property photo, upload your own, and the image is pushed to your Meta ad account on launch.', flow: 'meta-ad' },
      { q: 'How do I run a Google search campaign?', a: 'Connect Google Ads once, then build the campaign: project, keywords, budget — AI drafts the ad text.', flow: 'google-ad' },
      { q: 'Where do I watch spend and leads in real time?', a: 'Ads → Live. The green light up top means a platform is genuinely connected — the numbers are your real account\'s.', links: [{ label: 'Ads Live', href: `${FI}/ads-live` }] },
      { q: 'Why does Ads Live say "Not connected"?', a: 'No ad platform is connected yet. Connect Meta or Google in Integrations and the live numbers appear; campaigns built before connecting are kept as drafts.', links: [{ label: 'Integrations', href: `${FI}/integrations` }] },
      { q: 'How do I pause or resume a campaign?', a: 'Open the campaign from Ads Live or Lead Machine → Campaigns — Pause / Resume acts on the real platform campaign.', links: [{ label: 'Campaigns', href: `${FI}/lead-machine/campaigns` }] },
      { q: 'Where do leads from my ads go?', a: 'Straight into CRM → Inbox with the campaign and page attached — no exports, no copy-paste.', links: [{ label: 'CRM → Inbox', href: `${FI}/crm/inbox` }] },
    ],
  },
  {
    id: 'inventory',
    title: 'Inventory & projects',
    Icon: Package,
    items: [
      { q: 'Where do I see all projects?', a: 'Inventory → Projects — every project with its data-quality and ad-readiness scores.', links: [{ label: 'Inventory → Projects', href: `${FI}/inventory/projects` }] },
      { q: 'How do I advertise a project?', a: 'Open the project and start a campaign from it, or go straight to the campaign wizard — picking the project fills in the name, photo, price and landing page.', flow: 'advertise-project' },
      { q: 'What do the data-quality scores mean?', a: 'They grade how complete a project\'s data is (photos, prices, payment plan…). High scores make better ads and landing pages; the Data quality page shows exactly what\'s missing.', links: [{ label: 'Data quality', href: `${FI}/inventory/data-quality` }] },
    ],
  },
  {
    id: 'finance',
    title: 'Deals, commission & finance',
    Icon: DollarSign,
    items: [
      { q: 'How do I record a deal?', a: 'Close the lead on the CRM board (the deal window opens itself), or add it manually in Management → Deals — project and broker autofill.', flow: 'commission', roles: MGMT },
      { q: 'How is commission split?', a: 'The waterfall on each deal: agency commission → referral & cashback → expenses & growth fund → broker payout → company net. Finance rolls all approved deals into company totals.', links: [{ label: 'Finance', href: `${FI}/finance` }] },
      { q: 'How does deal approval work?', a: 'Two steps: the deal is submitted, management approves it, and only then does it count in Finance. Pending deals are clearly marked.', links: [{ label: 'Management → Deals', href: `${FI}/management/deals` }], roles: MGMT },
      { q: 'How do I give an agent ad credits?', a: 'Finance → Credits — pick the agent, set the amount, apply. Their available balance updates immediately.', links: [{ label: 'Finance → Credits', href: `${FI}/finance/credits` }], roles: MGMT },
      { q: 'Where do I pay out broker commissions?', a: 'Finance → Payments lists every outstanding payout per broker with a one-tap record-payment action.', links: [{ label: 'Finance → Payments', href: `${FI}/finance/payments` }], roles: MGMT },
    ],
  },
  {
    id: 'team',
    title: 'Team & management',
    Icon: Settings,
    items: [
      { q: 'How do I add a team member?', a: 'Settings → Team — add them with a role (broker, marketing, management). The role decides exactly which apps they see.', flow: 'invite-user', roles: MGMT },
      { q: 'How do I control what someone can see?', a: 'Roles do it: brokers see their workspace and CRM; marketing sees ads; management sees everything. Adjust in Settings → Roles.', links: [{ label: 'Settings → Roles', href: `${FI}/settings/roles` }], roles: MGMT },
      { q: 'Can leads route to brokers automatically?', a: 'Yes — Settings → Automation: rules by source, project or round-robin with capacity limits. Manual assignment always stays available.', links: [{ label: 'Settings → Automation', href: `${FI}/settings/automation` }], roles: MGMT },
      { q: 'Where is a broker\'s full profile?', a: 'Management → Team → open the broker: contact, leads, deals, commission — the complete record in one place.', links: [{ label: 'Management → Team', href: `${FI}/management/team` }], roles: MGMT },
    ],
  },
  {
    id: 'analytics',
    title: 'Analytics & reporting',
    Icon: TrendingUp,
    items: [
      { q: 'How do I see company performance?', a: 'Analytics opens on the Company lens — live leads, deals, spend and revenue from real records.', flow: 'team-performance', roles: MGMT_MKT },
      { q: 'How do I see one person\'s numbers?', a: 'Analytics → Team → open the member: leads handled, response times, deals closed, commission earned.', links: [{ label: 'Analytics → Team', href: `${FI}/analytics/team` }], roles: MGMT_MKT },
      { q: 'Which campaigns bring the best leads?', a: 'Analytics → Marketing breaks performance down by campaign and landing page — spend, leads, cost per lead, conversions.', links: [{ label: 'Analytics → Marketing', href: `${FI}/analytics/marketing` }], roles: MGMT_MKT },
    ],
  },
  {
    id: 'integrations',
    title: 'Integrations',
    Icon: ShieldCheck,
    items: [
      { q: 'How do I connect WhatsApp Business?', a: 'Integrations → WhatsApp — paste your Phone number ID and a permanent token; the page\'s "How do I get this?" steps show exactly where to find both.', links: [{ label: 'Integrations → WhatsApp', href: `${FI}/integrations/whatsapp` }] },
      { q: 'How do I connect HubSpot — and control the sync direction?', a: 'Integrations → HubSpot: paste a Private App token, then choose Push (Freehold → HubSpot), Pull, or Both. Each run reports exactly how many contacts moved.', links: [{ label: 'Integrations → HubSpot', href: `${FI}/integrations/hubspot` }] },
      { q: 'How do I connect Google Ads?', a: 'Integrations → Google Ads needs five values; the in-page guide walks through each one (developer token, OAuth client, refresh token, customer ID).', links: [{ label: 'Integrations → Google', href: `${FI}/integrations/google` }] },
      { q: 'Are my tokens and keys safe?', a: 'Every credential is validated live with the provider before saving, stored encrypted (AES-256), and never displayed again — pages only ever show that a connection exists.' },
      { q: 'Can I connect everything myself, without a developer?', a: 'Yes — that\'s the point. Every integration page has numbered "How do I get this?" steps written for non-technical users, and the Save button verifies your values before storing them.' , links: [{ label: 'All integrations', href: `${FI}/integrations` }] },
    ],
  },
  {
    id: 'broker',
    title: 'My Workspace (brokers)',
    Icon: UserCircle,
    items: [
      { q: 'How do I set up my Bio Link?', a: 'My Workspace → Bio Link: photo, contact buttons, featured projects — then share the link or QR in your Instagram / WhatsApp bio. Form fills become YOUR leads automatically.', flow: 'bio-link', roles: ['broker'] },
      { q: 'Where are my leads?', a: 'My Workspace → Leads shows only yours — assigned to you or captured by your bio page.', links: [{ label: 'My leads', href: `${FI}/agent/leads` }], roles: ['broker'] },
      { q: 'Where do I see my commission?', a: 'My Workspace → Account: gross, received and outstanding commission from your real deals.', links: [{ label: 'My account', href: `${FI}/agent/account` }], roles: ['broker'] },
    ],
  },
]

// ─── AI-generated steps (for anything not covered above) ─────────────────────

interface AiStep { title: string; detail: string; path?: string }

export default function HelpPage() {
  const t = useT()
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

  // Role-filtered sections; search filters across question + answer text.
  const visibleSections = useMemo(() => {
    const q = query.trim().toLowerCase()
    return SECTIONS.map((s) => ({
      ...s,
      items: s.items.filter((it) => {
        if (it.roles && (!role || !it.roles.includes(role))) return false
        if (!q) return true
        return it.q.toLowerCase().includes(q) || it.a.toLowerCase().includes(q)
      }),
    })).filter((s) => s.items.length > 0)
  }, [query, role])

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
      if (!res.ok) throw new Error(data?.error || 'Could not reach the guide')
      setAiAnswer({ answer: data.answer || '', steps: Array.isArray(data.steps) ? data.steps : [] })
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Could not reach the guide')
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
        <Play className="h-3 w-3" /> Guide me step by step
      </button>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-5 pb-24 pt-8 sm:px-8">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold/85">
        <BookOpen className="h-4 w-4" /> Help & guide
      </div>
      <h1 className="mt-3 text-[28px] font-semibold tracking-tight text-white">The whole system, question by question</h1>
      <p className="mt-1 max-w-[58ch] text-sm text-slate-400">
        Every answer can take you by the hand — press <b className="text-slate-200">Guide me</b> and the coach
        walks you through the real screens, where you do the real thing (create it, not just read about it).
      </p>

      {/* Search + AI ask */}
      <div className="sticky top-16 z-30 -mx-2 mt-6 rounded-2xl border border-line bg-surface/95 p-2 backdrop-blur">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setAiAnswer(null); setAiError(null) }}
            onKeyDown={(e) => { if (e.key === 'Enter' && matchCount === 0) askAi() }}
            placeholder="Search every question — or ask anything…"
            className="w-full rounded-xl border border-line bg-surface-2 py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-600 outline-none transition focus:border-gold/50"
          />
        </div>
        {query.trim() && (
          <div className="flex items-center justify-between gap-3 px-2 pt-2 pb-1">
            <span className="text-xs text-slate-500">
              {matchCount > 0 ? `${matchCount} answer${matchCount === 1 ? '' : 's'} below` : 'No built-in answer for that yet'}
            </span>
            <button
              onClick={askAi}
              disabled={aiLoading}
              className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold transition hover:bg-gold/20 disabled:opacity-60"
            >
              {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              Ask the AI guide
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
            <Sparkles className="h-3.5 w-3.5" /> AI guide
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
                        Open the page <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-3 text-[11px] text-slate-500">AI-generated from the live system map — the built-in answers above are the fully guided ones.</p>
        </div>
      )}

      {/* Guided walkthroughs strip */}
      {!query.trim() && (
        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
            <Compass className="h-4 w-4" /> Guided walkthroughs
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
          <p className="mt-2 text-xs text-slate-500">Each one moves through the real pages with you — you can act on every step.</p>
        </section>
      )}

      {/* Q&A — department by department */}
      {visibleSections.map((section) => (
        <section key={section.id} className="mt-10">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
            <section.Icon className="h-4 w-4" /> {section.title}
          </h2>
          <div className="space-y-2">
            {section.items.map((item) => {
              const id = `${section.id}:${item.q}`
              const open = openId === id
              return (
                <div key={id} className="overflow-hidden rounded-2xl border border-line bg-surface">
                  <button
                    onClick={() => setOpenId(open ? null : id)}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.03]"
                  >
                    <span className="flex-1 text-sm font-medium text-slate-100">{item.q}</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {open && (
                    <div className="border-t border-line px-4 py-3.5">
                      <p className="text-[13.5px] leading-relaxed text-slate-300">{item.a}</p>
                      {(item.flow || item.links?.length) && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {item.flow && <GuideButton flowId={item.flow} />}
                          {item.links?.map((l) => (
                            <Link key={l.href} href={l.href}
                              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3.5 py-1.5 text-xs text-slate-200 transition hover:border-gold/40 hover:text-white">
                              <Link2 className="h-3 w-3 text-gold" /> {l.label}
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
          <p className="text-sm text-slate-400">No built-in answer matches — ask the AI guide above and it will build the steps for you.</p>
        </div>
      )}
    </div>
  )
}
