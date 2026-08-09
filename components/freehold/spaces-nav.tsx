'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { Sparkles, ChevronDown, LogOut, Home } from 'lucide-react'
import { spineApps } from '@/lib/freehold/apps'
import { useBrand } from '@/components/whitelabel/brand-provider'
import { useSession } from '@/lib/freehold/use-session'
import { clearSession } from '@/lib/freehold/session'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/freehold/session-types'
import { agentWaiting, onAgentWaiting, shouldFlash, markFlashed, type AgentWaiting } from '@/lib/freehold/agent-signal'
import { useT } from '@/lib/i18n/provider'
import { LanguageSwitcher } from '@/components/freehold/language-switcher'
import { useCoach } from '@/components/freehold/coach/coach-marks'
import { Compass, Sun, Moon, Waves } from 'lucide-react'
import { useThemeMode } from '@/lib/freehold/use-theme-mode'
import { WhatsNew, WhatsNewMenuButton } from '@/components/freehold/whats-new'
import { PrefsSync, saveUserPref } from '@/components/freehold/prefs-sync'
import { CommandNav } from '@/components/freehold/command-nav'
import { Monogram } from '@/components/freehold/monogram'

const HOME_HREF = '/freehold-intelligence'

// Map an app id to its nav translation key; falls back to the app's own label.
const NAV_KEYS: Record<string, string> = {
  crm: 'nav.crm', ads: 'nav.ads', inventory: 'nav.inventory', finance: 'nav.finance',
  'ai-manager': 'nav.ai-manager', analytics: 'nav.analytics', notebook: 'nav.notebook',
  drive: 'nav.drive', team: 'nav.team',
  integrations: 'nav.integrations', settings: 'nav.settings', management: 'nav.management',
  agent: 'nav.agent', calendar: 'nav.calendar',
}

export function SpacesNav() {
  // What the agent is waiting to say, if anything. Read from the browser
  // rather than fetched: this is "have YOU seen it", not a fact about the
  // account, and it must not follow someone onto a machine they are not at.
  const [waiting, setWaiting] = useState<AgentWaiting | null>(null)
  const [flashNow, setFlashNow] = useState(false)

  useEffect(() => {
    // Tracked and cleared: an untracked timer holding a setter fires after
    // unmount (signing out replaces the route inside 1.9s), and a second
    // signal would otherwise have its flash cut short by the first one's
    // timer still counting down.
    let timer: ReturnType<typeof setTimeout> | null = null
    const sync = () => {
      const w = agentWaiting()
      setWaiting(w)
      if (w && shouldFlash(w.signature)) {
        markFlashed(w.signature)
        setFlashNow(true)
        if (timer) clearTimeout(timer)
        // Two flashes, then stop animating and stay lit. Kept short on
        // purpose: motion that outlasts its message becomes a fidget.
        timer = setTimeout(() => setFlashNow(false), 1900)
      }
    }
    sync()
    const off = onAgentWaiting(sync)
    return () => { if (timer) clearTimeout(timer); off() }
  }, [])

  const pathname = usePathname()
  const router   = useRouter()
  const { user } = useSession()
  const role     = user?.role
  const brand    = useBrand()
  const t        = useT()
  const coach    = useCoach()
  const theme    = useThemeMode()

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
        {brand.logo === '/api/wl/logo' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.logo} alt="" className="h-5 w-auto max-w-[120px] object-contain" />
        ) : (
          <Sparkles className="h-4 w-4 text-gold" />
        )}
        <span className="text-sm font-semibold tracking-tight text-white">
          {brand.company}
          <span className="ml-1 text-gold">{brand.product}</span>
        </span>
      </Link>

      {/* All tools — the popup that holds the whole system + global search.
          Sits beside the brand on every screen size, so the depth of the
          product is one click (or ⌘K) away without any page growing a second
          and third permanent nav rail. */}
      <CommandNav />

      {/* Mobile spacer — keeps brand left, account right while the spine is hidden */}
      <div className="flex-1 md:hidden" />

      {/* App spine — role-aware, single source of truth. Hidden on phones:
          the bottom tab bar takes over there, so the top stays calm. */}
      <nav data-coach="nav-spine" className="hidden h-full flex-1 overflow-x-auto md:flex" style={{ scrollbarWidth: 'none' }}>
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
            // `match` prefixes let a tab stay lit across relocated routes
            // (e.g. Drive while inside Notebook).
            const active = app.match ? app.match.some((p) => isActive(p)) : isActive(app.href)
            const key = NAV_KEYS[app.id]
            // The chat's own entry carries the signal. WE NEVER OPEN THE CHAT
            // ON SOMEONE'S BEHALF — a window that opens by itself reads as
            // something going wrong, even when the news is good.
            const lit = app.id === 'notebook' && !!waiting && !active
            return (
              <Link
                key={app.id}
                href={app.href}
                data-coach={`nav-${app.id}`}
                title={lit ? waiting?.line : undefined}
                className={[
                  'relative flex h-full items-center border-b-2 px-4 text-sm font-medium whitespace-nowrap transition-colors',
                  active
                    ? 'border-gold text-white'
                    : lit
                      ? 'border-transparent text-slate-300 hover:text-white'
                      : 'border-transparent text-slate-400 hover:text-white hover:border-white/[0.2]',
                ].join(' ')}
              >
                {key ? t(key) : app.label}
                {lit && (
                  // Two soft flashes, then it simply stays lit. The flash is
                  // missable — someone is looking elsewhere, or is not at the
                  // desk — so the steady light is what actually carries it.
                  <span
                    aria-hidden
                    className={`ms-2 h-1.5 w-1.5 rounded-full bg-emerald-400 ${flashNow ? 'agent-flash' : 'opacity-70'}`}
                  />
                )}
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
          <Monogram name={user?.name ?? 'Account'} size={28} />
          <span className="hidden text-start sm:block">
            <span className="block text-xs font-semibold leading-tight text-slate-100">{user?.name ?? 'Account'}</span>
            <span className="block text-[10px] leading-tight" style={{ color: role ? ROLE_COLORS[role] : '#64748B' }}>
              {role ? ROLE_LABELS[role] : ''}
            </span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
        </button>

        {menuOpen && (
          <div className="absolute end-2 top-12 z-50 w-56 overflow-hidden rounded-xl border border-white/[0.12] bg-surface shadow-[0_24px_60px_rgba(0,0,0,0.75)]">
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
            {/* Connect AI — personal, per-user surface open to every role. */}
            <Link
              href="/freehold-intelligence/settings/connect"
              onClick={() => setMenuOpen(false)}
              className="block px-4 py-2.5 text-sm text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              {t('nav.connectAi')}
            </Link>
            {/* Language */}
            <div className="border-t border-white/[0.07] px-4 py-3">
              <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">{t('common.language')}</div>
              <LanguageSwitcher variant="inline" />
            </div>
            {/* Appearance (light / dark) */}
            <div className="border-t border-white/[0.07] px-4 py-3">
              <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">{t('theme.appearance')}</div>
              <div className="flex gap-1.5 rounded-lg bg-white/[0.04] p-1">
                <button
                  onClick={() => { theme.setMode('dark'); saveUserPref({ theme: 'dark' }) }}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition ${theme.mode === 'dark' ? 'bg-white/[0.10] text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  <Moon className="h-3.5 w-3.5" /> {t('theme.dark')}
                </button>
                <button
                  onClick={() => { theme.setMode('light'); saveUserPref({ theme: 'light' }) }}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition ${theme.mode === 'light' ? 'bg-white/[0.10] text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  <Sun className="h-3.5 w-3.5" /> {t('theme.light')}
                </button>
                <button
                  onClick={() => { theme.setMode('mint'); saveUserPref({ theme: 'mint' }) }}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition ${theme.mode === 'mint' ? 'bg-white/[0.10] text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  <Waves className="h-3.5 w-3.5" /> {t('theme.mint')}
                </button>
              </div>
            </div>
            {/* Help & user guide */}
            <Link
              href="/freehold-intelligence/help"
              onClick={() => setMenuOpen(false)}
              className="block border-t border-white/[0.07] px-4 py-2.5 text-sm text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              {t('common.help')}
            </Link>
            {/* What's new */}
            <WhatsNewMenuButton onClick={() => setMenuOpen(false)} />
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

      {/* What's-new panel — auto-opens once per new feature version, then on demand */}
      <WhatsNew />
      {/* Account memory: apply this account's saved settings on any device */}
      <PrefsSync />

      <style jsx global>{`
        @keyframes agentFlash {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50%      { opacity: 1;    transform: scale(1.35); }
        }
        .agent-flash { animation: agentFlash 0.85s ease-in-out 2; }
        @media (prefers-reduced-motion: reduce) {
          /* The light still arrives — it just does not move. The signal was
             never the motion; the motion was only to catch an eye. */
          .agent-flash { animation: none; opacity: 1; }
        }
      `}</style>

    </div>
  )
}
