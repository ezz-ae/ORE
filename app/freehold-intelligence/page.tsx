import Link from 'next/link'
import { ArrowUpRight, Sparkles } from 'lucide-react'
import {
  currentServerUser,
  serverSummary,
} from '@/src/features/freehold-intelligence/server-session'
import { executeTool } from '@/lib/freehold/mcp/execute-tool'
import { AiPrompt } from '@/components/freehold/ai-prompt'

const HERO_IMAGE = '/images/property-beach-villa.jpg'
const STORY_IMAGES = ['/images/property-city-loft.jpg', '/images/property-lakefront-modern.jpg']

function greetingFor(hour: number) {
  if (hour < 5)  return 'Working late'
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  if (hour < 22) return 'Good evening'
  return 'Still up'
}

export default async function FreeholdIntelligenceHome() {
  const [serverRes, blockRes] = await Promise.all([
    executeTool({ tool: 'server_summary', role: 'owner' }),
    executeTool({ tool: 'launch_blockers', role: 'owner' }),
  ])

  const live = serverRes.data
  const openBlockers: number = blockRes.data?.criticalCount ?? 0
  const totalProjects = live?.publicData?.totalProjects
  const openTasks = live?.privateServer?.openTasks
  const auditEvents = live?.privateServer?.auditEvents24h

  const hour = new Date().getHours()
  const greeting = greetingFor(hour)
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  // Pick the single most important story
  const allStories = [
    ...serverSummary.urgentTasks,
    ...serverSummary.blockedItems,
    ...serverSummary.pendingApprovals,
  ]
  const hero = allStories.find((s) => s.priority === 'critical') ?? allStories[0]
  const supporting = allStories.filter((s) => s.id !== hero?.id).slice(0, 2)

  const apps = [
    {
      href: '/freehold-intelligence/lead-machine',
      label: 'Lead Machine',
      blurb: 'Listings, landings, ad requests, approvals.',
      hint: 'Operate',
      accent: 'from-[#D4AF37]/20 via-[#D4AF37]/[0.08] to-transparent',
    },
    {
      href: '/freehold-intelligence/crm',
      label: 'CRM Intelligence',
      blurb: 'Refined leads, intent scoring, agent signals.',
      hint: 'Operate',
      accent: 'from-emerald-500/20 via-emerald-500/[0.06] to-transparent',
    },
    {
      href: '/freehold-intelligence/notebook',
      label: 'Notebook',
      blurb: 'Conversations, briefs, exports, drafts.',
      hint: 'Create',
      accent: 'from-sky-500/20 via-sky-500/[0.06] to-transparent',
    },
  ]

  return (
    <div className="mx-auto max-w-3xl px-6 pb-32 pt-12 sm:pt-20">

      {/* ─────────────────────────── GREETING ─────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-white/35">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)]" />
          {date} · {currentServerUser.accountLevel} session
        </div>
        <h1 className="mt-5 text-[44px] font-semibold leading-[1.02] tracking-tight text-white sm:text-6xl">
          {greeting},
          <br />
          <span className="text-white/40">{currentServerUser.name.split(' ')[0]}.</span>
        </h1>
        <p className="mt-7 max-w-2xl text-[19px] leading-[1.55] text-white/65 sm:text-[21px] sm:leading-[1.55]">
          {serverSummary.summaryText}
        </p>
      </section>

      {/* ─────────────────────────── AI PROMPT ─────────────────────────── */}
      <section className="mt-12">
        <AiPrompt
          placeholder="Ask anything about your business"
          suggestions={serverSummary.askableQuestions.slice(0, 4)}
        />
      </section>

      {/* ─────────────────────────── HERO STORY ─────────────────────────── */}
      {hero && (
        <section className="mt-20">
          <div className="mb-5 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
            <Sparkles className="h-3 w-3" /> Today, in one move
          </div>
          <Link
            href="/freehold-intelligence/review-requests"
            className="group relative block overflow-hidden rounded-[28px] border border-white/[0.06]"
          >
            <div
              className="aspect-[4/5] bg-cover bg-center transition duration-700 group-hover:scale-[1.02] sm:aspect-[16/10]"
              style={{ backgroundImage: `url(${HERO_IMAGE})` }}
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#06080A] via-[#06080A]/40 to-transparent" />
            <div className="absolute inset-0 flex flex-col justify-end p-8 sm:p-12">
              <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]">
                {hero.app} · {hero.priority} priority
              </div>
              <h2 className="mt-3 max-w-2xl text-3xl font-semibold leading-[1.1] tracking-tight text-white sm:text-[40px]">
                {hero.title}
              </h2>
              <p className="mt-4 max-w-xl text-[15px] leading-[1.6] text-white/75 sm:text-base">
                {hero.body}
              </p>
              <div className="mt-7 inline-flex items-center gap-2 self-start rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#06080A] transition group-hover:gap-3">
                Resolve now <ArrowUpRight className="h-4 w-4" />
              </div>
            </div>
          </Link>
        </section>
      )}

      {/* ─────────────────────────── ALSO TODAY ─────────────────────────── */}
      {supporting.length > 0 && (
        <section className="mt-16">
          <div className="mb-5 text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">Also today</div>
          <div className="grid gap-5 sm:grid-cols-2">
            {supporting.map((s, i) => (
              <Link
                key={s.id}
                href="/freehold-intelligence/review-requests"
                className="group relative block overflow-hidden rounded-[24px] border border-white/[0.06]"
              >
                <div
                  className="aspect-[4/5] bg-cover bg-center transition duration-700 group-hover:scale-[1.02]"
                  style={{ backgroundImage: `url(${STORY_IMAGES[i % STORY_IMAGES.length]})` }}
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#06080A] via-[#06080A]/60 to-transparent" />
                <div className="absolute inset-0 flex flex-col justify-end p-6">
                  <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/70">
                    {s.app}
                  </div>
                  <h3 className="mt-2 text-xl font-semibold leading-tight text-white sm:text-2xl">
                    {s.title}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-[13px] leading-snug text-white/65">
                    {s.body}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ─────────────────────────── ESSAY / EDITORIAL ─────────────────────────── */}
      <section className="mt-20">
        <div className="mb-5 text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">A note for today</div>
        <div className="rounded-[28px] border border-white/[0.06] bg-white/[0.02] px-7 py-8 sm:px-10 sm:py-10">
          <p className="text-[17px] font-medium leading-[1.65] text-white/85 sm:text-lg">
            {serverSummary.recommendedActions[0]?.body || 'Approving the landing review queue first unlocks campaign packaging and removes the highest-value blocker.'}
          </p>
          <p className="mt-5 text-[15px] leading-[1.7] text-white/55">
            The strongest CRM signal today is delayed response, not lead volume. Push the high-intent follow-ups before assigning new ones, and let the Lead Machine package the campaign-ready Palm and Hills listings while you do.
          </p>
        </div>
      </section>

      {/* ─────────────────────────── APPS (App Store style) ─────────────────────────── */}
      <section className="mt-20">
        <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">Open in app</div>
        <h2 className="mb-6 text-2xl font-semibold tracking-tight text-white">Where to go from here</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => (
            <Link
              key={app.href}
              href={app.href}
              className="group relative overflow-hidden rounded-3xl border border-white/[0.06] bg-[#0A0D10] p-6 transition hover:border-[#D4AF37]/25"
            >
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${app.accent} opacity-70 transition group-hover:opacity-100`} />
              <div className="relative">
                <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/45">{app.hint}</div>
                <div className="mt-8 text-lg font-semibold tracking-tight text-white">{app.label}</div>
                <p className="mt-1 text-[13px] leading-snug text-white/55">{app.blurb}</p>
                <div className="mt-5 inline-flex items-center gap-1 text-[12px] font-medium text-[#D4AF37] transition group-hover:gap-2">
                  Open <ArrowUpRight className="h-3 w-3" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ─────────────────────────── AMBIENT FOOTER ─────────────────────────── */}
      <footer className="mt-24 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-white/[0.05] pt-8 text-[12px] text-white/30">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
          Server live
        </span>
        {totalProjects != null && <span>{Number(totalProjects).toLocaleString()} projects</span>}
        {openTasks != null && <span>{openTasks} open tasks</span>}
        <span className={openBlockers > 0 ? 'text-red-300/70' : ''}>
          {openBlockers} critical {openBlockers === 1 ? 'blocker' : 'blockers'}
        </span>
        {auditEvents != null && <span>{auditEvents} audit · 24h</span>}
      </footer>
    </div>
  )
}
