'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft, Megaphone } from 'lucide-react'

const tabs = [
  { label: 'Overview',   href: '/freehold-intelligence/ads-live',         exact: true },
  { label: 'Meta Ads',   href: '/freehold-intelligence/ads-live/meta' },
  { label: 'Google Ads', href: '/freehold-intelligence/ads-live/google' },
  { label: 'Ad Preview', href: '/freehold-intelligence/ads-live/preview' },
]

export default function AdsLiveLayout({ children }: { children: React.ReactNode }) {
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
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-pink-400/25 bg-pink-400/10">
            <Megaphone className="h-3.5 w-3.5 text-pink-400" />
          </div>
          <span className="text-[15px] font-semibold text-white">Ads Live</span>
        </div>
        <div className="ml-auto">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)] animate-pulse" />
            Live
          </div>
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
                      active ? 'border-pink-400 text-white' : 'border-transparent text-slate-400 hover:text-slate-200',
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
