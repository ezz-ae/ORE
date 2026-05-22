import Link from 'next/link'
import { ArrowUpRight, Sparkles, Zap, Users, BookOpen, ShieldCheck } from 'lucide-react'
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

const apps = [
  {
    href: '/freehold-intelligence/lead-machine',
    label: 'Lead Machine',
    blurb: 'Listings, landings, ad requests, approvals.',
    hint: 'Operate',
    icon: Zap,
    accent: 'from-[#D4AF37]/20 via-[#D4AF37]/[0.07] to-transparent',
    iconColor: 'text-[#D4AF37]',
    iconBg: 'bg-[#D4AF37]/10 border-[#D4AF37]/20',
  },
  {
    href: '/freehold-intelligence/crm',
    label: 'CRM Intelligence',
    blurb: 'Refined leads, intent scoring, agent signals.',
    hint: 'Operate',
    icon: Users,
    accent: 'from-emerald-500/20 via-emerald-500/[0.06] to-transparent',
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/10 border-emerald-500/20',
  },
  {
    href: '/freehold-intelligence/notebook',
    label: 'Notebook',
    blurb: 'AI briefs, drafts, message scripts, exports.',
    hint: 'Create',
    icon: BookOpen,
    accent: 'from-sky-500/20 via-sky-500/[0.06] to-transparent',
    iconColor: 'text-sky-400',
    iconBg: 'bg-sky-500/10 border-sky-500/20',
  },
  {
    href: '/freehold-intelligence/integrations',
    label: 'Integrations',
    blurb: 'HubSpot, Meta, WhatsApp, tracking status.',
    hint: 'Govern',
    icon: ShieldCheck,
    accent: 'from-violet-500/20 via-violet-500/[0.06] to-transparent',
    iconColor: 'text-violet-400',
    iconBg: 'bg-violet-500/10 border-violet-500/20',
  },
]

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

  const allStories = [
    ...serverSummary.urgentTasks,
    ...serverSummary.blockedItems,
    ...serverSummary.pendingApprovals,
  ]
  const hero = allStories.find((s) => s.priority === 'critical') ?? allStories[0]
  const supporting = allStories.filter((s) => s.id !== hero?.id).slice(0, 2)

  return (
    <div className="mx-auto max-w-7xl px-4 pb-32 pt-10 sm:px-6 sm:pt-14 lg:pt-16">
      <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-10 xl:grid-cols-[1fr_400px] xl:gap-16">

        {/* ══════════════════════ MAIN COLUMN ══════════════════════ */}
        <div className="min-w-0">

          {/* GREETING */}
          <section>
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-white/35">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
              {date} · {currentServerUser.accountLevel} session
            </div>
            <h1 className="mt-4 text-[40px] font-semibold leading-[1.02] tracking-tight text-white sm:text-[52px] lg:text-[60px]">
              {greeting},
              <br />
              <span className="text-white/35">{currentServerUser.name.split(' ')[0]}.</span>
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-[1.6] text-white/60 sm:text-[19px] lg:text-[20px]">
              {serverSummary.summaryText}
            </p>
          </section>

          {/* MOBILE ONLY: AI prompt inline */}
          <section className="mt-10 lg:hidden">
            <AiPrompt
              placeholder="Ask anything about your business"
              suggestions={serverSummary.askableQuestions.slice(0, 3)}
            />
          </section>

          {/* HERO STORY */}
          {hero && (
            <section className="mt-12 lg:mt-14">
              <div className="mb-4 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
                <Sparkles className="h-3 w-3" /> Today, in one move
              </div>
              <Link
                href="/freehold-intelligence/review-requests"
                className="group relative block overflow-hidden rounded-[24px] border border-white/[0.06] lg:rounded-[32px]"
              >
                {/* Image — portrait on mobile, cinematic on desktop */}
                <div
                  className="aspect-[4/5] bg-cover bg-center transition duration-700 group-hover:scale-[1.015] sm:aspect-[16/9] lg:aspect-[21/9]"
                  style={{ backgroundImage: `url(${HERO_IMAGE})` }}
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#06080A] via-[#06080A]/50 to-transparent" />
                <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-9 lg:p-12">
                  <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]">
                    {hero.app} · {hero.priority} priority
                  </div>
                  <h2 className="mt-3 max-w-2xl text-2xl font-semibold leading-[1.1] tracking-tight text-white sm:text-3xl lg:text-[40px]">
                    {hero.title}
                  </h2>
                  <p className="mt-3 max-w-xl text-[14px] leading-[1.6] text-white/70 sm:text-[15px] lg:text-base">
                    {hero.body}
                  </p>
                  <div className="mt-6 inline-flex items-center gap-2 self-start rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#06080A] transition group-hover:gap-3">
                    Resolve now <ArrowUpRight className="h-4 w-4" />
                  </div>
                </div>
              </Link>
            </section>
          )}

          {/* SUPPORTING STORIES */}
          {supporting.length > 0 && (
            <section className="mt-5 lg:mt-6">
              <div className="mb-4 text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">Also today</div>
              <div className="grid gap-4 sm:grid-cols-2">
                {supporting.map((s, i) => (
                  <Link
                    key={s.id}
                    href="/freehold-intelligence/review-requests"
                    className="group relative block overflow-hidden rounded-[20px] border border-white/[0.06] lg:rounded-[24px]"
                  >
                    <div
                      className="aspect-[4/3] bg-cover bg-center transition duration-700 group-hover:scale-[1.015] sm:aspect-[16/10]"
                      style={{ backgroundImage: `url(${STORY_IMAGES[i % STORY_IMAGES.length]})` }}
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#06080A] via-[#06080A]/55 to-transparent" />
                    <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-6 lg:p-7">
                      <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/60">{s.app}</div>
                      <h3 className="mt-1.5 text-lg font-semibold leading-tight text-white sm:text-xl lg:text-2xl">
                        {s.title}
                      </h3>
                      <p className="mt-1.5 line-clamp-2 text-[12px] leading-snug text-white/60 sm:text-[13px]">
                        {s.body}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* EDITORIAL NOTE */}
          <section className="mt-10 lg:mt-12">
            <div className="mb-4 text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">A note for today</div>
            <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.018] px-6 py-7 lg:rounded-[28px] lg:px-10 lg:py-9">
              {/* Desktop: side accent line */}
              <div className="hidden lg:flex lg:gap-7">
                <div className="w-0.5 shrink-0 rounded-full bg-[#D4AF37]/40" />
                <div>
                  <p className="text-[17px] font-medium leading-[1.65] text-white/85 lg:text-[18px]">
                    {serverSummary.recommendedActions[0]?.body || 'Approving the landing review queue first unlocks campaign packaging and removes the highest-value blocker.'}
                  </p>
                  <p className="mt-4 text-[15px] leading-[1.7] text-white/50 lg:text-[15px]">
                    The strongest CRM signal today is delayed response, not lead volume. Push the high-intent follow-ups before assigning new ones.
                  </p>
                </div>
              </div>
              {/* Mobile: no accent line */}
              <div className="lg:hidden">
                <p className="text-[16px] font-medium leading-[1.65] text-white/85">
                  {serverSummary.recommendedActions[0]?.body || 'Approving the landing review queue first unlocks campaign packaging and removes the highest-value blocker.'}
                </p>
                <p className="mt-3 text-[14px] leading-[1.7] text-white/50">
                  The strongest CRM signal today is delayed response, not lead volume.
                </p>
              </div>
            </div>
          </section>

          {/* APP TILES */}
          <section className="mt-10 lg:mt-12">
            <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">Open in app</div>
            <h2 className="mb-5 text-xl font-semibold tracking-tight text-white lg:text-2xl">Where to go from here</h2>
            {/* 2 cols on mobile, 4 on desktop */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
              {apps.map((app) => {
                const Icon = app.icon
                return (
                  <Link
                    key={app.href}
                    href={app.href}
                    className="group relative overflow-hidden rounded-[20px] border border-white/[0.06] bg-[#0A0D10] p-5 transition hover:border-[#D4AF37]/20 lg:rounded-[24px] lg:p-6"
                  >
                    <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${app.accent} opacity-60 transition group-hover:opacity-100`} />
                    <div className="relative flex flex-col gap-4 lg:gap-5">
                      {/* Icon — only shown on desktop */}
                      <div className={`hidden h-9 w-9 items-center justify-center rounded-xl border ${app.iconBg} lg:flex`}>
                        <Icon className={`h-4 w-4 ${app.iconColor}`} />
                      </div>
                      <div>
                        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">{app.hint}</div>
                        <div className="mt-1 text-[14px] font-semibold tracking-tight text-white lg:text-[15px]">{app.label}</div>
                        <p className="mt-1 hidden text-[12px] leading-snug text-white/50 lg:block">{app.blurb}</p>
                      </div>
                      <div className="inline-flex items-center gap-1 text-[11px] font-medium text-[#D4AF37]/70 transition group-hover:gap-1.5 group-hover:text-[#D4AF37]">
                        Open <ArrowUpRight className="h-3 w-3" />
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>

          {/* AMBIENT FOOTER */}
          <footer className="mt-20 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/[0.05] pt-7 text-[11px] text-white/30">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
              Server live
            </span>
            {totalProjects != null && <span>{Number(totalProjects).toLocaleString()} projects</span>}
            {openTasks != null && <span>{openTasks} open tasks</span>}
            <span className={openBlockers > 0 ? 'text-red-300/60' : ''}>
              {openBlockers} critical {openBlockers === 1 ? 'blocker' : 'blockers'}
            </span>
            {auditEvents != null && <span>{auditEvents} audit · 24h</span>}
          </footer>
        </div>

        {/* ══════════════════════ SIDEBAR (lg+) ══════════════════════ */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 space-y-3">

            {/* Stat tiles row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[18px] border border-white/[0.06] bg-[#0A0D10] px-4 py-4">
                <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">Blockers</div>
                <div className={`mt-2 flex items-baseline gap-2`}>
                  <span className={`text-[32px] font-semibold leading-none tabular-nums ${openBlockers > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {openBlockers}
                  </span>
                  <span className={`h-2 w-2 rounded-full ${openBlockers > 0 ? 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)]' : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'}`} />
                </div>
                <p className="mt-0.5 text-[11px] text-white/35">
                  {openBlockers > 0 ? 'Need resolution' : 'All clear'}
                </p>
              </div>

              <div className="rounded-[18px] border border-white/[0.06] bg-[#0A0D10] px-4 py-4">
                <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">Projects</div>
                <div className="mt-2">
                  <span className="text-[32px] font-semibold leading-none tabular-nums text-white">
                    {totalProjects != null ? Number(totalProjects).toLocaleString() : '—'}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-white/35">Live inventory</p>
              </div>
            </div>

            {/* Open tasks pill */}
            {openTasks != null && (
              <div className="flex items-center justify-between rounded-[14px] border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <span className="text-[12px] text-white/55">Open tasks</span>
                <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[12px] font-semibold text-white/85">{openTasks}</span>
              </div>
            )}

            {/* AI Prompt */}
            <AiPrompt
              placeholder="Ask anything about your business"
              suggestions={serverSummary.askableQuestions.slice(0, 4)}
            />

            {/* Quick nav */}
            <div className="rounded-[18px] border border-white/[0.06] bg-[#0A0D10] p-4">
              <div className="mb-3 text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">Quick navigate</div>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { label: 'Tasks', href: '/freehold-intelligence/tasks' },
                  { label: 'Milestones', href: '/freehold-intelligence/milestones' },
                  { label: 'Security', href: '/freehold-intelligence/security' },
                  { label: 'Settings', href: '/freehold-intelligence/settings' },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center justify-between rounded-[10px] border border-white/[0.04] bg-white/[0.025] px-3 py-2 text-[12px] text-white/55 transition hover:border-white/10 hover:text-white/80"
                  >
                    {item.label}
                    <ArrowUpRight className="h-2.5 w-2.5 opacity-50" />
                  </Link>
                ))}
              </div>
            </div>

          </div>
        </aside>

      </div>
    </div>
  )
}
