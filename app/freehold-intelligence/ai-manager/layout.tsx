'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ArrowLeft, Bot,
  LayoutDashboard, Building2, MapPin, HardHat, Globe, Hash, Lightbulb,
} from 'lucide-react'

const tabs = [
  { label: 'Overview',   href: '/freehold-intelligence/ai-manager',             exact: true, Icon: LayoutDashboard },
  { label: 'Listings',   href: '/freehold-intelligence/ai-manager/listings',                 Icon: Building2       },
  { label: 'Areas',      href: '/freehold-intelligence/ai-manager/areas',                    Icon: MapPin          },
  { label: 'Developers', href: '/freehold-intelligence/ai-manager/developers',               Icon: HardHat         },
  { label: 'Pages',      href: '/freehold-intelligence/ai-manager/pages',                    Icon: Globe           },
  { label: 'Topics',     href: '/freehold-intelligence/ai-manager/topics',                   Icon: Hash            },
  { label: 'Insights',   href: '/freehold-intelligence/ai-manager/insights',                 Icon: Lightbulb       },
]

export default function AiManagerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  function isActive(tab: typeof tabs[number]) {
    if (tab.exact) return pathname === tab.href
    return pathname === tab.href || pathname.startsWith(tab.href + '/')
  }

  return (
    <div className="flex flex-col min-h-full">

      {/* App header */}
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-4 border-b border-white/[0.07] bg-chrome/97 px-5 backdrop-blur-xl sm:px-6">
        <Link
          href="/freehold-intelligence"
          className="flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-slate-100 shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:block">Apps</span>
        </Link>
        <div className="h-5 w-px bg-surface-3 shrink-0" />
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-sky-400/25 bg-sky-400/10">
            <Bot className="h-3.5 w-3.5 text-sky-400" />
          </div>
          <span className="text-sm font-semibold text-white">AI Manager</span>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1">

        {/* Desktop sidebar — auto-collapse */}
        <aside className="group/nav hidden lg:flex lg:flex-col sticky top-14 h-[calc(100vh-56px)] w-[52px] hover:w-56 shrink-0 transition-[width] duration-200 overflow-hidden border-r border-white/[0.07] bg-chrome">
          <nav className="flex-1 px-2 py-4 space-y-0.5">
            {tabs.map((tab) => {
              const active = isActive(tab)
              const Icon   = tab.Icon
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={[
                    'flex items-center rounded-md px-[13px] py-2.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-gold/10 text-white border border-gold/15'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.05] border border-transparent',
                  ].join(' ')}
                >
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-gold' : 'text-slate-500'}`} />
                  <span className="overflow-hidden whitespace-nowrap opacity-0 max-w-0 group-hover/nav:opacity-100 group-hover/nav:max-w-[160px] transition-all duration-150 ml-0 group-hover/nav:ml-2.5">
                    {tab.label}
                  </span>
                </Link>
              )
            })}
          </nav>
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Mobile tabs */}
          <div className="lg:hidden sticky top-14 z-30 overflow-x-auto border-b border-white/[0.07] bg-chrome/95 backdrop-blur-xl">
            <nav className="flex min-w-max px-4">
              {tabs.map((tab) => {
                const active = isActive(tab)
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={[
                      'inline-flex items-center px-4 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                      active ? 'border-sky-400 text-white' : 'border-transparent text-slate-400 hover:text-slate-200',
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
