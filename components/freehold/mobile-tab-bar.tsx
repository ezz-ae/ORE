'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Sparkles, LayoutGrid, X, BookOpen } from 'lucide-react'
import { spineApps } from '@/lib/freehold/apps'
import { useSession } from '@/lib/freehold/use-session'
import { openExpert } from '@/lib/freehold/expert-bus'
import { useT } from '@/lib/i18n/provider'

const HOME_HREF = '/freehold-intelligence'

const NAV_KEYS: Record<string, string> = {
  crm: 'nav.crm', ads: 'nav.ads', inventory: 'nav.inventory', finance: 'nav.finance',
  'ai-manager': 'nav.ai-manager', analytics: 'nav.analytics', notebook: 'nav.notebook',
  integrations: 'nav.integrations', settings: 'nav.settings', management: 'nav.management',
  agent: 'nav.agent',
}

/**
 * Phone-only bottom tab bar — the app-like way in. Five thumb-height slots:
 * Home, the role's two main apps, the Expert, and an Apps sheet with
 * everything else. The desktop top spine hides on phones; this replaces it.
 */
export function MobileTabBar() {
  const pathname = usePathname()
  const { user } = useSession()
  const role = user?.role
  const t = useT()
  const [sheetOpen, setSheetOpen] = useState(false)

  const apps = spineApps(role)
  const label = (id: string, fallback: string) => (NAV_KEYS[id] ? t(NAV_KEYS[id]) : fallback)
  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/')

  // Direct slots: Home (non-broker) + the first apps of the role's spine.
  const direct = role === 'broker' ? apps.slice(0, 3) : apps.slice(0, 2)

  const slot = 'flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors'

  return (
    <>
      {/* Apps sheet — every app the role can use, reachable with one thumb */}
      {sheetOpen && (
        <div className="fixed inset-0 z-[150] md:hidden" role="dialog" aria-modal="true">
          <button aria-label={t('common.close')} onClick={() => setSheetOpen(false)} className="absolute inset-0 bg-black/60" />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-line bg-surface pb-[calc(76px+env(safe-area-inset-bottom))] shadow-[0_-24px_60px_rgba(0,0,0,0.6)]">
            <div className="flex items-center justify-between px-5 pt-4">
              <span className="text-sm font-semibold text-white">{t('common.apps')}</span>
              <button onClick={() => setSheetOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-white/[0.06] hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2 p-4">
              {apps.map((app) => {
                const active = isActive(app.href)
                return (
                  <Link
                    key={app.id}
                    href={app.href}
                    onClick={() => setSheetOpen(false)}
                    className={[
                      'flex flex-col items-center gap-1.5 rounded-2xl border px-1 py-3 text-center transition',
                      active ? 'border-gold/40 bg-gold/10' : 'border-line bg-surface-2',
                    ].join(' ')}
                  >
                    <app.Icon className={`h-5 w-5 ${active ? 'text-gold' : 'text-slate-300'}`} />
                    <span className={`text-[10px] font-medium leading-tight ${active ? 'text-white' : 'text-slate-400'}`}>
                      {label(app.id, app.label)}
                    </span>
                  </Link>
                )
              })}
              <Link
                href={`${HOME_HREF}/help`}
                onClick={() => setSheetOpen(false)}
                className="flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-surface-2 px-1 py-3 text-center transition"
              >
                <BookOpen className="h-5 w-5 text-slate-300" />
                <span className="text-[10px] font-medium leading-tight text-slate-400">{t('common.help')}</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* The bar itself */}
      {/* Below the Expert overlay (z-200): opening the Expert covers the tabs. */}
      <nav
        className="z-[120] flex shrink-0 items-stretch border-t border-white/[0.08] bg-chrome/97 backdrop-blur-xl md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {role !== 'broker' && (
          <Link href={HOME_HREF} className={`${slot} ${isActive(HOME_HREF, true) ? 'text-gold' : 'text-slate-400'}`}>
            <Home className="h-5 w-5" />
            {t('nav.home')}
          </Link>
        )}
        {direct.map((app) => (
          <Link key={app.id} href={app.href} className={`${slot} ${isActive(app.href) ? 'text-gold' : 'text-slate-400'}`}>
            <app.Icon className="h-5 w-5" />
            {label(app.id, app.label)}
          </Link>
        ))}
        <button onClick={() => { setSheetOpen(false); openExpert() }} className={`${slot} text-slate-400`}>
          <span className="grid h-5 w-5 place-items-center rounded-full bg-gold/15 ring-1 ring-gold/30">
            <Sparkles className="h-3 w-3 text-gold" />
          </span>
          {t('nav.expert')}
        </button>
        <button onClick={() => setSheetOpen((o) => !o)} className={`${slot} ${sheetOpen ? 'text-gold' : 'text-slate-400'}`}>
          <LayoutGrid className="h-5 w-5" />
          {t('common.apps')}
        </button>
      </nav>
    </>
  )
}
