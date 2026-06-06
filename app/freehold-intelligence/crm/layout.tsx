'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft, Users, UserPlus } from 'lucide-react'

const tabs = [
  { label: 'Leads',      href: '/freehold-intelligence/crm',            exact: true },
  { label: 'Board',      href: '/freehold-intelligence/crm/board' },
  { label: 'Pipeline',   href: '/freehold-intelligence/crm/pipeline' },
  { label: 'Inbox',      href: '/freehold-intelligence/crm/inbox' },
  { label: 'Follow-up',  href: '/freehold-intelligence/crm/follow-up' },
  { label: 'Assignment', href: '/freehold-intelligence/crm/assignment' },
  { label: 'Activity',   href: '/freehold-intelligence/crm/activity' },
  { label: 'Duplicates', href: '/freehold-intelligence/crm/duplicates' },
  { label: 'Agents',     href: '/freehold-intelligence/crm/agents' },
  { label: 'Reports',    href: '/freehold-intelligence/crm/reports' },
]

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  function isActive(tab: typeof tabs[number]) {
    if (tab.exact) return pathname === tab.href || pathname.startsWith('/freehold-intelligence/crm/leads')
    return pathname === tab.href || pathname.startsWith(tab.href + '/')
  }

  return (
    <div className="flex flex-col min-h-full">

      {/* App header */}
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-4 border-b border-slate-800 bg-[#0D1117]/95 px-5 backdrop-blur-xl sm:px-6">
        <Link
          href="/freehold-intelligence"
          className="flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-slate-100 shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:block">Apps</span>
        </Link>
        <div className="h-5 w-px bg-slate-700 shrink-0" />
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#D4AF37]/25 bg-[#D4AF37]/10">
            <Users className="h-3.5 w-3.5 text-[#D4AF37]" />
          </div>
          <span className="text-sm font-semibold text-white">CRM</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/freehold-intelligence/crm/agents"
            className="flex items-center gap-1.5 rounded-lg border border-[#D4AF37]/25 bg-[#D4AF37]/[0.08] px-3 py-1.5 text-sm font-medium text-[#D4AF37] transition-colors hover:bg-[#D4AF37]/15"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span className="hidden sm:block">New Agent</span>
          </Link>
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
                    'flex items-center px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                    active
                      ? 'bg-slate-700/50 text-white'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60',
                  ].join(' ')}
                >
                  {tab.label}
                  {tab.label === 'Agents' && (
                    <span className="ml-auto text-xs font-semibold text-[#D4AF37]">3</span>
                  )}
                </Link>
              )
            })}
          </nav>
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Mobile tabs */}
          <div className="lg:hidden sticky top-14 z-30 overflow-x-auto border-b border-slate-800 bg-[#0D1117]/95 backdrop-blur-xl">
            <nav className="flex min-w-max px-4">
              {tabs.map((tab) => {
                const active = isActive(tab)
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={[
                      'inline-flex items-center px-4 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                      active ? 'border-[#D4AF37] text-white' : 'border-transparent text-slate-400 hover:text-slate-200',
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
