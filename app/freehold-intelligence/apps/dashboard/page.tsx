import Link from 'next/link'
import { ArrowUpRight, BarChart3, Bot, FolderKanban, LayoutDashboard, UserCog } from 'lucide-react'

const dashboardApps = [
  {
    href: '/freehold-intelligence/apps/dashboard/overview',
    label: 'Operating Overview',
    icon: LayoutDashboard,
    description: 'Command metrics, server health, and daily snapshot across all surfaces.',
    status: 'live',
    tone: 'from-[#D4AF37]/20 via-[#D4AF37]/[0.05] to-transparent',
    iconColor: 'text-[#D4AF37]',
    iconBg: 'bg-[#D4AF37]/10 border-[#D4AF37]/20',
  },
  {
    href: '/freehold-intelligence/apps/dashboard/projects',
    label: 'Projects Admin',
    icon: FolderKanban,
    description: 'Full inventory management, status control, and editorial review for all projects.',
    status: 'live',
    tone: 'from-emerald-500/20 via-emerald-500/[0.05] to-transparent',
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/10 border-emerald-500/20',
  },
  {
    href: '/freehold-intelligence/apps/dashboard/analytics',
    label: 'Analytics',
    icon: BarChart3,
    description: 'Business and channel performance — traffic, leads, conversions, revenue attribution.',
    status: 'in_progress',
    tone: 'from-sky-500/20 via-sky-500/[0.05] to-transparent',
    iconColor: 'text-sky-400',
    iconBg: 'bg-sky-500/10 border-sky-500/20',
  },
  {
    href: '/freehold-intelligence/apps/dashboard/ai-assistant',
    label: 'AI Assistant',
    icon: Bot,
    description: 'Internal AI for command workflows — briefings, summaries, ad copy, follow-up scripts.',
    status: 'live',
    tone: 'from-violet-500/20 via-violet-500/[0.05] to-transparent',
    iconColor: 'text-violet-400',
    iconBg: 'bg-violet-500/10 border-violet-500/20',
  },
  {
    href: '/freehold-intelligence/apps/dashboard/profile',
    label: 'Profile & Access',
    icon: UserCog,
    description: 'Account configuration, role scope, team access, and operator-level permissions.',
    status: 'in_progress',
    tone: 'from-rose-500/20 via-rose-500/[0.05] to-transparent',
    iconColor: 'text-rose-400',
    iconBg: 'bg-rose-500/10 border-rose-500/20',
  },
]

const statusMap: Record<string, { dot: string; label: string; text: string }> = {
  live:        { dot: 'bg-emerald-400', label: 'Live',        text: 'text-emerald-300' },
  in_progress: { dot: 'bg-[#D4AF37]',   label: 'In progress', text: 'text-[#F8E7AE]'   },
  planned:     { dot: 'bg-sky-400',     label: 'Planned',     text: 'text-sky-200'      },
}

export default function ControlRoomDashboardAppPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 pb-32 pt-12 sm:pt-16">

      <section>
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">Dashboard App</div>
        <h1 className="mt-5 text-[40px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[52px]">
          Command surfaces
          <br />
          <span className="text-white/40">in one place.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-[17px] leading-[1.65] text-white/60">
          {dashboardApps.length} focused workspaces — each one a distinct operating layer. The AI follows context between them.
        </p>
      </section>

      <section className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {dashboardApps.map((app) => {
          const Icon = app.icon
          const tone = statusMap[app.status] ?? statusMap.planned
          return (
            <Link
              key={app.href}
              href={app.href}
              className="group relative overflow-hidden rounded-[24px] border border-white/[0.06] bg-[#0A0D10] p-6 transition hover:border-[#D4AF37]/25 lg:rounded-[28px]"
            >
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${app.tone} opacity-60 transition group-hover:opacity-100`} />
              <div className="relative flex flex-col gap-5">
                <div className="flex items-start justify-between">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${app.iconBg}`}>
                    <Icon className={`h-4.5 w-4.5 ${app.iconColor}`} />
                  </div>
                  <span className={`flex items-center gap-1.5 text-[11px] ${tone.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                    {tone.label}
                  </span>
                </div>
                <div>
                  <h2 className="text-[15px] font-semibold tracking-tight text-white">{app.label}</h2>
                  <p className="mt-1.5 text-[13px] leading-snug text-white/50">{app.description}</p>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-medium text-[#D4AF37]/60 transition group-hover:gap-1.5 group-hover:text-[#D4AF37]">
                  Open <ArrowUpRight className="h-3 w-3" />
                </div>
              </div>
            </Link>
          )
        })}
      </section>

    </div>
  )
}
