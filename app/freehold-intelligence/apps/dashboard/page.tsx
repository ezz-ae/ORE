import Link from 'next/link'
import { ArrowUpRight, BarChart3, Bot, FolderKanban, LayoutDashboard, UserCog } from 'lucide-react'

const dashboardApps = [
  {
    href:        '/freehold-intelligence/apps/dashboard/overview',
    label:       'Operating Overview',
    icon:        LayoutDashboard,
    description: 'Command metrics, server health, and daily snapshot across all surfaces.',
    status:      'live',
  },
  {
    href:        '/freehold-intelligence/apps/dashboard/projects',
    label:       'Projects Admin',
    icon:        FolderKanban,
    description: 'Full inventory management, status control, and editorial review for all projects.',
    status:      'live',
  },
  {
    href:        '/freehold-intelligence/apps/dashboard/analytics',
    label:       'Analytics',
    icon:        BarChart3,
    description: 'Business and channel performance — traffic, leads, conversions, revenue attribution.',
    status:      'in_progress',
  },
  {
    href:        '/freehold-intelligence/apps/dashboard/ai-assistant',
    label:       'AI Assistant',
    icon:        Bot,
    description: 'Internal AI for command workflows — briefings, summaries, ad copy, follow-up scripts.',
    status:      'live',
  },
  {
    href:        '/freehold-intelligence/apps/dashboard/profile',
    label:       'Profile & Access',
    icon:        UserCog,
    description: 'Account configuration, role scope, team access, and operator-level permissions.',
    status:      'in_progress',
  },
] as const

function StatusBadge({ status }: { status: string }) {
  if (status === 'live') {
    return (
      <span className="flex items-center gap-1.5 text-sm text-[#D4AF37]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#D4AF37]" />
        Live
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1.5 text-sm text-slate-500">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-600" />
      In progress
    </span>
  )
}

export default function ControlRoomDashboardAppPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 pb-16 pt-6 sm:pt-16">

      <section>
        <div className="text-xs font-semibold uppercase tracking-wider text-[#D4AF37]/85">
          Dashboard App
        </div>
        <h1 className="mt-5 text-[40px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[52px]">
          Command surfaces
          <br />
          <span className="text-slate-500">in one place.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-400">
          {dashboardApps.length} focused workspaces — each one a distinct operating layer.
          The AI follows context between them.
        </p>
      </section>

      <section className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {dashboardApps.map((app) => {
          const Icon = app.icon
          return (
            <Link
              key={app.href}
              href={app.href}
              className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-7 transition hover:border-[#D4AF37]/25 hover:bg-slate-800/50"
            >
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#D4AF37]/[0.07] to-transparent opacity-0 transition group-hover:opacity-100" />
              <div className="relative flex flex-col gap-6">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#D4AF37]/20 bg-[#D4AF37]/10">
                    <Icon className="h-[18px] w-[18px] text-[#D4AF37]" />
                  </div>
                  <StatusBadge status={app.status} />
                </div>
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-white">{app.label}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{app.description}</p>
                </div>
                <div className="flex items-center gap-1.5 text-sm font-medium text-[#D4AF37]/45 transition group-hover:text-[#D4AF37]">
                  Open workspace <ArrowUpRight className="h-3.5 w-3.5" />
                </div>
              </div>
            </Link>
          )
        })}
      </section>

    </div>
  )
}
