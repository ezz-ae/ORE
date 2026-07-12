'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft, Megaphone } from 'lucide-react'
import { useSessionGuard } from '@/lib/freehold/use-session'
import { NON_BROKER_ROLES } from '@/lib/freehold/apps'
import { useT } from '@/lib/i18n/provider'

const tabs = [
  { labelKey: 'lm.live.nav.overview', href: '/freehold-intelligence/ads-live',         exact: true },
  { labelKey: 'lm.live.nav.meta',     href: '/freehold-intelligence/ads-live/meta' },
  { labelKey: 'lm.live.nav.google',   href: '/freehold-intelligence/ads-live/google' },
  { labelKey: 'lm.live.nav.build',    href: '/freehold-intelligence/lead-machine', divider: true },
]

export default function AdsLiveLayout({ children }: { children: React.ReactNode }) {
  const t = useT()
  const pathname = usePathname()
  const { ready } = useSessionGuard(NON_BROKER_ROLES)

  // The green light means LIVE — a real connected ad platform, verified
  // against the same source of truth as the Integrations page. Never shown
  // when nothing is connected: null = checking, false = not connected.
  const [live, setLive] = useState<boolean | null>(null)
  useEffect(() => {
    let cancelled = false
    fetch('/api/freehold/integrations/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return
        const ads = (d?.statuses ?? []).filter((s: { id: string }) => s.id === 'meta-ads' || s.id === 'google-ads')
        setLive(ads.some((s: { state: string }) => s.state === 'connected'))
      })
      .catch(() => { if (!cancelled) setLive(false) })
    return () => { cancelled = true }
  }, [])

  function isActive(tab: typeof tabs[number]) {
    if (tab.exact) return pathname === tab.href
    return pathname === tab.href || pathname.startsWith(tab.href + '/')
  }

  if (!ready) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-white/60" />
    </div>
  )

  return (
    <div className="flex flex-col min-h-full">

      {/* App header */}
      <header data-coach="app-ads" className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-4 border-b border-white/[0.07] bg-chrome/97 px-5 backdrop-blur-xl sm:px-6">
        <Link
          href="/freehold-intelligence/ads"
          className="flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-slate-100 shrink-0"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          <span className="hidden sm:block">{t('lm.live.allTools')}</span>
        </Link>
        <div className="h-5 w-px bg-surface-3 shrink-0" />
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-gold/25 bg-gold/10">
            <Megaphone className="h-3.5 w-3.5 text-gold" />
          </div>
          <span className="text-sm font-semibold text-white">{t('lm.live.appName')} <span className="text-slate-500 font-normal">{t('lm.live.appMode')}</span></span>
        </div>
        <div className="ml-auto">
          {live === true && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)] animate-pulse" />
              {t('lm.live.badgeLive')}
            </div>
          )}
          {live === false && (
            <Link
              href="/freehold-intelligence/integrations"
              className="flex items-center gap-2 text-sm text-slate-400 transition hover:text-slate-200"
            >
              <span className="h-2 w-2 rounded-full bg-slate-500" />
              {t('lm.live.badgeOffline')}
            </Link>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1">

        {/* Desktop sidebar */}
        <aside className="hidden lg:flex lg:flex-col sticky top-14 h-[calc(100vh-56px)] w-56 shrink-0 overflow-y-auto border-r border-white/[0.07] bg-chrome">
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
                      ? 'bg-gold/10 text-white border border-gold/15'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.05] border border-transparent',
                  ].join(' ')}
                >
                  {t(tab.labelKey)}
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
                      active ? 'border-pink-400 text-white' : 'border-transparent text-slate-400 hover:text-slate-200',
                    ].join(' ')}
                  >
                    {t(tab.labelKey)}
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
