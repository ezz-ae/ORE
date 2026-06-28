'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { Sparkles, ChevronDown, LogOut, Home } from 'lucide-react'
import { spineApps } from '@/lib/freehold/apps'
import { BRAND } from '@/lib/freehold/brand'
import { useSession } from '@/lib/freehold/use-session'
import { clearSession } from '@/lib/freehold/session'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/freehold/session-types'
import { useT } from '@/lib/i18n/provider'
import { LanguageSwitcher } from '@/components/freehold/language-switcher'
import { useCoach } from '@/components/freehold/coach/coach-marks'
import { Compass } from 'lucide-react'

const HOME_HREF = '/freehold-intelligence'

// Map an app id to its nav translation key; falls back to the app's own label.
const NAV_KEYS: Record<string, string> = {
  crm: 'nav.crm', ads: 'nav.ads', inventory: 'nav.inventory', finance: 'nav.finance',
  'ai-manager': 'nav.ai-manager', analytics: 'nav.analytics', notebook: 'nav.notebook',
  integrations: 'nav.integrations', settings: 'nav.settings', management: 'nav.management',
  agent: 'nav.agent',
}

export function SpacesNav() {
  const pathname = usePathname()
  const router   = useRouter()
  const { user } = useSession()
  const role     = user?.role
  const t        = useT()
  const coach    = useCoach()

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // App tabs are role-aware and read from the single app registry.
  const apps = spineApps(role)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  async function signOut() {
    await clearSession()
    router.replace('/server')
  }

  function isActive(href: string, exact = false) {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <div className="flex h-14 shrink-0 items-center border-b border-white/[0.07] bg-chrome backdrop-blur-xl">

      {/* Brand */}
      <Link
        href={HOME_HREF}
        className="flex h-full shrink-0 items-center gap-2.5 border-r border-white/[0.07] px-5 transition hover:bg-white/[0.04]"
      >
        <Sparkles className="h-4 w-4 text-gold" />
        <span className="hidden text-sm font-semibold tracking-tight text-white sm:block">
          {BRAND.company}
          <span className="ml-1 text-gold">{BRAND.product}</span>
        </span>
      </Link>

      {/* App spine — role-aware, single source of truth */}
      <nav data-coach="nav-spine" className="flex h-full flex-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        <div className="flex h-full min-w-max">
          {/* Home — hidden for brokers (they use My Workspace tab) */}
          {role !== 'broker' && (
            <Link
              href={HOME_HREF}
              data-coach="nav-home"
              className={[
                'flex h-full items-center gap-1.5 border-b-2 px-4 text-sm font-medium whitespace-nowrap transition-colors',
                isActive(HOME_HREF, true)
                  ? 'border-gold text-white'
                  : 'border-transparent text-slate-400 hover:text-white hover:border-white/[0.2]',
              ].join(' ')}
            >
              <Home className="h-3.5 w-3.5" />
              {t('nav.home')}
            </Link>
          )}

          {apps.map((app) => {
            const active = isActive(app.href)
            const key = NAV_KEYS[app.id]
            return (
              <Link
                key={app.id}
                href={app.href}
                data-coach={`nav-${app.id}`}
                className={[
                  'flex h-full items-center border-b-2 px-4 text-sm font-medium whitespace-nowrap transition-colors',
                  active
                    ? 'border-gold text-white'
                    : 'border-transparent text-slate-400 hover:text-white hover:border-white/[0.2]',
                ].join(' ')}
              >
                {key ? t(key) : app.label}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* User menu — identity, role, sign-out */}
      <div ref={menuRef} className="relative flex h-full shrink-0 items-center border-l border-white/[0.07] px-3">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          data-coach="user-menu"
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.06]"
        >
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
            style={{ backgroundColor: role ? `${ROLE_COLORS[role]}22` : '#33415544', color: role ? ROLE_COLORS[role] : '#94A3B8' }}
          >
            {user?.initials ?? '··'}
          </span>
          <span className="hidden text-left sm:block">
            <span className="block text-xs font-semibold leading-tight text-slate-100">{user?.name ?? 'Account'}</span>
            <span className="block text-[10px] leading-tight" style={{ color: role ? ROLE_COLORS[role] : '#64748B' }}>
              {role ? ROLE_LABELS[role] : ''}
            </span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
        </button>

        {menuOpen && (
          <div className="absolute right-2 top-12 z-50 w-56 overflow-hidden rounded-xl border border-white/[0.12] bg-[#08111C] shadow-[0_24px_60px_rgba(0,0,0,0.75)]">
            <div className="border-b border-white/[0.07] px-4 py-3">
              <div className="text-sm font-semibold text-white">{user?.name ?? 'Account'}</div>
              <div className="text-xs text-slate-500">{user?.email ?? ''}</div>
              {role && (
                <span
                  className="mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{ backgroundColor: `${ROLE_COLORS[role]}22`, color: ROLE_COLORS[role] }}
                >
                  {ROLE_LABELS[role]}
                </span>
              )}
            </div>
            {role !== 'broker' && (
              <Link
                href="/freehold-intelligence/settings"
                onClick={() => setMenuOpen(false)}
                className="block px-4 py-2.5 text-sm text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                {t('nav.settings')}
              </Link>
            )}
            {/* Language */}
            <div className="border-t border-white/[0.07] px-4 py-3">
              <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">{t('common.language')}</div>
              <LanguageSwitcher variant="inline" />
            </div>
            {coach.available && (
              <button
                onClick={() => { setMenuOpen(false); coach.start() }}
                className="flex w-full items-center gap-2 border-t border-white/[0.07] px-4 py-2.5 text-sm text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                <Compass className="h-4 w-4" />
                {t('coach.ui.replay')}
              </button>
            )}
            <button
              onClick={signOut}
              className="flex w-full items-center gap-2 border-t border-white/[0.07] px-4 py-2.5 text-sm text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              {t('common.signOut')}
            </button>
          </div>
        )}
      </div>

    </div>
  )
}
