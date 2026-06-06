'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft, Bot } from 'lucide-react'

const tabs = [
  { label: 'Overview',   href: '/freehold-intelligence/ai-manager',             exact: true },
  { label: 'Listings',   href: '/freehold-intelligence/ai-manager/listings' },
  { label: 'Areas',      href: '/freehold-intelligence/ai-manager/areas' },
  { label: 'Developers', href: '/freehold-intelligence/ai-manager/developers' },
  { label: 'Pages',      href: '/freehold-intelligence/ai-manager/pages' },
  { label: 'Topics',     href: '/freehold-intelligence/ai-manager/topics' },
  { label: 'Insights',   href: '/freehold-intelligence/ai-manager/insights' },
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
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.07] bg-[#0B0F1A]/95 px-4 backdrop-blur-xl sm:px-6">
        <Link
          href="/freehold-intelligence"
          className="flex items-center gap-1.5 text-[13px] text-white/55 transition hover:text-white/85 shrink-0"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:block">Apps</span>
        </Link>
        <div className="h-4 w-px bg-white/[0.07] shrink-0" />
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-sky-400/20 bg-sky-400/10">
            <Bot className="h-3.5 w-3.5 text-sky-400" />
          </div>
          <span className="text-[14px] font-semibold text-white">AI Manager</span>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1">

        {/* Desktop sidebar */}
        <aside className="hidden lg:flex lg:flex-col sticky top-14 h-[calc(100vh-56px)] w-52 shrink-0 overflow-y-auto border-r border-white/[0.07] bg-[#0B0F1A]">
          <nav className="flex-1 px-3 py-4 space-y-0.5">
            {tabs.map((tab) => {
              const active = isActive(tab)
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={[
                    'flex items-center px-3 py-2.5 rounded-lg text-[13px] font-medium transition',
                    active ? 'bg-white/[0.08] text-white' : 'text-white/58 hover:text-white/85 hover:bg-white/[0.05]',
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
          <div className="lg:hidden sticky top-14 z-30 overflow-x-auto border-b border-white/[0.07] bg-[#0B0F1A]/90 backdrop-blur-xl">
            <nav className="flex min-w-max px-4">
              {tabs.map((tab) => {
                const active = isActive(tab)
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={[
                      'inline-flex items-center px-3 py-3.5 text-[13px] font-medium border-b-2 transition whitespace-nowrap',
                      active ? 'border-sky-400 text-white' : 'border-transparent text-white/55 hover:text-white/80',
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
