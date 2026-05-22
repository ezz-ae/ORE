'use client'
import Link from 'next/link'
import {
  AppWindow,
  Bot,
  Brain,
  CheckCircle2,
  Flag,
  LockKeyhole,
  NotebookTabs,
  Settings,
  ShieldCheck,
  Users,
  Zap,
} from 'lucide-react'
import { NavLink, SmallNavLink } from '@/components/freehold/nav-link'
import { currentServerUser, getVisibleServerApps, serverSummary } from '@/src/features/freehold-intelligence/server-session'

const primaryNav = [
  { label: 'AI Home',      href: '/freehold-intelligence',             icon: Bot,          exact: true  },
  { label: 'Apps',         href: '/freehold-intelligence/apps',        icon: AppWindow                  },
  { label: 'CRM',          href: '/freehold-intelligence/crm',         icon: Users                      },
  { label: 'Integrations', href: '/freehold-intelligence/integrations',icon: Zap                        },
  { label: 'Notebook',     href: '/freehold-intelligence/notebook',    icon: NotebookTabs               },
]

const adminNav = [
  { label: 'Milestones',   href: '/freehold-intelligence/milestones',  icon: Flag         },
  { label: 'Server Status',href: '/freehold-intelligence/server-status',icon: ShieldCheck  },
  { label: 'Security',     href: '/freehold-intelligence/security',    icon: LockKeyhole  },
  { label: 'Settings',     href: '/freehold-intelligence/settings',    icon: Settings     },
]

export default function FreeholdIntelligenceLayout({ children }: { children: React.ReactNode }) {
  const shortcuts = getVisibleServerApps(currentServerUser.role).slice(0, 6)
  const pendingCount = serverSummary.pendingApprovals.length
  const urgentCount = serverSummary.urgentTasks.length + serverSummary.blockedItems.length

  return (
    <main className="fixed inset-0 z-[100] min-h-screen overflow-hidden bg-[#050807] text-[#F7F2E7]">
      <style>{`
        body > div > header,
        body > div > footer {
          display: none !important;
        }
      `}</style>
      <div className="grid h-screen grid-cols-1 lg:grid-cols-[272px_minmax(0,1fr)]">

        {/* ── Sidebar ──────────────────────────────────────────── */}
        <aside className="hidden border-r border-[#D4AF37]/12 bg-[#07110D]/95 lg:flex lg:flex-col">

          {/* Logo */}
          <div className="border-b border-[#D4AF37]/12 p-5">
            <Link href="/freehold-intelligence" className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center border border-[#D4AF37]/40 bg-[#D4AF37]/10 text-sm font-bold text-[#D4AF37]">
                FI
              </div>
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-white">Free Hold Server</div>
                <div className="mt-0.5 text-[11px] text-white/40">Freehold Intelligence</div>
              </div>
            </Link>
          </div>

          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">

            {/* Session card */}
            <div className="border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-white">{currentServerUser.name}</div>
                  <div className="mt-0.5 text-xs capitalize text-[#D4AF37]">
                    {currentServerUser.accountLevel} · {currentServerUser.role.replace('_', ' ')}
                  </div>
                </div>
                <div className="flex h-6 items-center gap-1.5 border border-emerald-300/25 bg-emerald-400/10 px-2 text-[10px] text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  live
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-300/70">
                <Brain className="h-3.5 w-3.5" />
                AI operating session active
              </div>
              {(urgentCount > 0 || pendingCount > 0) && (
                <div className="mt-3 flex gap-2">
                  {urgentCount > 0 && (
                    <span className="border border-red-300/25 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-200">
                      {urgentCount} urgent
                    </span>
                  )}
                  {pendingCount > 0 && (
                    <span className="border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-2 py-0.5 text-[10px] font-semibold text-[#F8E7AE]">
                      {pendingCount} approval{pendingCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Primary nav */}
            <nav className="grid gap-0.5">
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/25">Navigation</div>
              {primaryNav.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} exact={item.exact} />
              ))}
            </nav>

            {/* App shortcuts */}
            <section>
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/25">App shortcuts</div>
              <div className="grid gap-0.5">
                {shortcuts.map((app) => (
                  <SmallNavLink key={app.id} href={app.href} label={app.name} badge={app.urgentCount} />
                ))}
              </div>
            </section>

            {/* Pending approvals */}
            {pendingCount > 0 && (
              <section>
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/25">Pending approvals</div>
                <div className="grid gap-0.5">
                  {serverSummary.pendingApprovals.map((item) => (
                    <Link
                      key={item.id}
                      href="/freehold-intelligence/review-requests"
                      className="flex items-center justify-between border border-[#D4AF37]/12 bg-[#D4AF37]/[0.04] px-3 py-2 text-xs text-[#F8E7AE]/70 transition hover:border-[#D4AF37]/30 hover:text-[#F8E7AE]"
                    >
                      <span className="truncate">{item.title}</span>
                      <CheckCircle2 className="ml-2 h-3 w-3 shrink-0 text-[#D4AF37]/50" />
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Admin nav */}
            <nav className="grid gap-0.5">
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/25">Admin</div>
              {adminNav.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} />
              ))}
            </nav>

          </div>
        </aside>

        {/* ── Content ──────────────────────────────────────────── */}
        <section className="flex min-h-0 flex-col">
          {/* Mobile header */}
          <header className="border-b border-white/10 bg-[#07110D]/90 px-4 py-3 backdrop-blur lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <Link href="/freehold-intelligence" className="text-sm font-semibold uppercase tracking-[0.16em] text-white">
                Free Hold Server
              </Link>
              <Link href="/freehold-intelligence/apps" className="text-xs text-[#D4AF37]">Apps</Link>
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {children}
          </div>
        </section>
      </div>
    </main>
  )
}
