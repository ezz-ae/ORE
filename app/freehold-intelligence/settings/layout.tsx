'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft, Settings } from 'lucide-react'

const tabs = [
  { label: 'General',       href: '/freehold-intelligence/settings',            exact: true },
  { label: 'Team',          href: '/freehold-intelligence/settings/team' },
  { label: 'Roles',         href: '/freehold-intelligence/settings/roles' },
  { label: 'Billing',       href: '/freehold-intelligence/settings/billing' },
  { label: 'Security',      href: '/freehold-intelligence/settings/security' },
  { label: 'Notifications', href: '/freehold-intelligence/settings/notifications' },
  { label: 'API',           href: '/freehold-intelligence/settings/api' },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  function isActive(tab: typeof tabs[number]) {
    if (tab.exact) return pathname === tab.href
    return pathname === tab.href || pathname.startsWith(tab.href + '/')
  }

  return (
    <div className="flex flex-col min-h-full">

      {/* App header */}
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-slate-800 bg-[#0A0E14]/95 px-4 backdrop-blur-xl sm:px-6">
        <Link
          href="/freehold-intelligence"
          className="flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-slate-100 shrink-0"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:block">Apps</span>
        </Link>
        <div className="h-4 w-px bg-slate-800 shrink-0" />
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700 bg-slate-800/60">
            <Settings className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <span className="text-sm font-semibold text-white">Settings</span>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1">

        {/* Desktop sidebar */}
        <aside className="hidden lg:flex lg:flex-col sticky top-14 h-[calc(100vh-56px)] w-56 shrink-0 overflow-y-auto border-r border-slate-800 bg-[#0A0E14]">
          <nav className="flex-1 px-2 py-4 space-y-0.5">
            {tabs.map((tab) => {
              const active = isActive(tab)
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={[
                    'flex items-center px-3 py-2 rounded-lg text-sm font-medium transition',
                    active ? 'bg-slate-700/50 text-white' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60',
                  ].join(' ')}
                >
                  {tab.label}
                </Link>
              )
            })}
          </nav>
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Mobile tabs */}
          <div className="lg:hidden sticky top-14 z-30 overflow-x-auto border-b border-slate-800 bg-[#0A0E14]/90 backdrop-blur-xl">
            <nav className="flex min-w-max px-4">
              {tabs.map((tab) => {
                const active = isActive(tab)
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={[
                      'inline-flex items-center px-3 py-3.5 text-sm font-medium border-b-2 transition whitespace-nowrap',
                      active ? 'border-slate-400 text-white' : 'border-transparent text-slate-400 hover:text-slate-100',
                    ].join(' ')}
                  >
                    {tab.label}
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
