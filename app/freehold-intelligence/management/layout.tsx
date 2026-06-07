'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Activity, Users, Briefcase,
  TrendingUp, FileBarChart2, ChevronRight, BarChart3,
} from 'lucide-react'
import { useSessionGuard } from '@/lib/freehold/use-session'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'

const BASE = '/freehold-intelligence/management'

const NAV = [
  { href: BASE,              label: 'Dashboard',  icon: LayoutDashboard, exact: true },
  { href: `${BASE}/events`,  label: 'Events Log', icon: Activity },
  { href: `${BASE}/team`,    label: 'Team',       icon: Users },
  { href: `${BASE}/deals`,   label: 'Deals',      icon: Briefcase },
  { href: `${BASE}/roi`,     label: 'ROI',        icon: TrendingUp },
  { href: `${BASE}/reports`, label: 'Reports',    icon: FileBarChart2 },
]

export default function ManagementLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { ready } = useSessionGuard(MANAGEMENT_ROLES)

  function isActive(item: typeof NAV[0]) {
    return item.exact ? pathname === item.href : pathname.startsWith(item.href)
  }

  if (!ready) return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-700 border-t-[#D4AF37]" />
    </div>
  )

  return (
    <div className="flex flex-col min-h-full">

      {/* App header — consistent with every other app layout */}
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-4 border-b border-white/[0.07] bg-[#06090F]/97 px-5 backdrop-blur-xl sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#D4AF37]/25 bg-[#D4AF37]/10">
            <BarChart3 className="h-3.5 w-3.5 text-[#D4AF37]" />
          </div>
          <span className="text-sm font-semibold text-white">Management</span>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1">

        {/* Desktop sidebar — sticky within scroll container, no viewport escape */}
        <aside className="hidden lg:flex lg:flex-col sticky top-14 h-[calc(100vh-56px)] w-56 shrink-0 overflow-y-auto border-r border-white/[0.07] bg-[#060910]">
          <nav className="flex-1 px-2 py-4 space-y-0.5">
            {NAV.map((item) => {
              const active = isActive(item)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-[#D4AF37]/10 text-white border border-[#D4AF37]/15'
                      : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-100 border border-transparent',
                  ].join(' ')}
                >
                  <item.icon className={['h-4 w-4 shrink-0', active ? 'text-[#D4AF37]' : 'text-slate-500'].join(' ')} />
                  {item.label}
                  {active && <ChevronRight className="ml-auto h-3.5 w-3.5 text-slate-600" />}
                </Link>
              )
            })}
          </nav>
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0">

          {/* Mobile tabs */}
          <div className="lg:hidden sticky top-14 z-30 overflow-x-auto border-b border-white/[0.07] bg-[#06090F]/95 backdrop-blur-xl">
            <nav className="flex min-w-max px-4">
              {NAV.map((item) => {
                const active = isActive(item)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      'inline-flex items-center px-4 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                      active ? 'border-[#D4AF37] text-white' : 'border-transparent text-slate-400 hover:text-slate-200',
                    ].join(' ')}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </div>

          {children}
        </div>

      </div>
    </div>
  )
}
