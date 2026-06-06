'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft, ShieldCheck } from 'lucide-react'

const tabs = [
  { label: 'Overview',  href: '/freehold-intelligence/integrations',            exact: true },
  { label: 'Meta',      href: '/freehold-intelligence/integrations/meta' },
  { label: 'Google',    href: '/freehold-intelligence/integrations/google' },
  { label: 'HubSpot',   href: '/freehold-intelligence/integrations/hubspot' },
  { label: 'WhatsApp',  href: '/freehold-intelligence/integrations/whatsapp' },
  { label: 'GitHub',    href: '/freehold-intelligence/integrations/github' },
]

export default function IntegrationsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  function isActive(tab: typeof tabs[number]) {
    if (tab.exact) return pathname === tab.href
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
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-600 bg-slate-700/50">
            <ShieldCheck className="h-3.5 w-3.5 text-slate-300" />
          </div>
          <span className="text-sm font-semibold text-white">Integrations</span>
        </div>
        <div className="ml-auto text-sm text-slate-400">8 connected · 2 pending</div>
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
                      active ? 'border-slate-400 text-white' : 'border-transparent text-slate-400 hover:text-slate-200',
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
