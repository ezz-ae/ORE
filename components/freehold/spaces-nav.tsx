'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { Sparkles, ChevronDown, LogOut, Home } from 'lucide-react'
import { spineApps } from '@/lib/freehold/apps'
import { useSession } from '@/lib/freehold/use-session'
import { clearSession } from '@/lib/freehold/session'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/freehold/session-types'

const HOME_HREF = '/freehold-intelligence'

export function SpacesNav() {
  const pathname = usePathname()
  const router   = useRouter()
  const { user } = useSession()
  const role     = user?.role

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
    <div className="flex h-14 shrink-0 items-center border-b border-slate-800 bg-[#090D16] backdrop-blur-xl">

      {/* Brand */}
      <Link
        href={HOME_HREF}
        className="flex h-full shrink-0 items-center gap-2.5 border-r border-slate-800 px-5 transition hover:bg-slate-800/40"
      >
        <Sparkles className="h-4 w-4 text-[#D4AF37]" />
        <span className="hidden text-sm font-semibold tracking-tight text-white sm:block">
          Freehold
          <span className="ml-1 text-[#D4AF37]">Intelligence</span>
        </span>
      </Link>

      {/* App spine — role-aware, single source of truth */}
      <nav className="flex h-full flex-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        <div className="flex h-full min-w-max">
          {/* Home */}
          <Link
            href={HOME_HREF}
            className={[
              'flex h-full items-center gap-1.5 border-b-2 px-4 text-sm font-medium whitespace-nowrap transition-colors',
              isActive(HOME_HREF, true)
                ? 'border-[#D4AF37] text-white'
                : 'border-transparent text-slate-400 hover:text-slate-100 hover:border-slate-600',
            ].join(' ')}
          >
            <Home className="h-3.5 w-3.5" />
            Home
          </Link>

          {apps.map((app) => {
            const active = isActive(app.href)
            return (
              <Link
                key={app.id}
                href={app.href}
                className={[
                  'flex h-full items-center border-b-2 px-4 text-sm font-medium whitespace-nowrap transition-colors',
                  active
                    ? 'border-[#D4AF37] text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-100 hover:border-slate-600',
                ].join(' ')}
              >
                {app.label}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* User menu — identity, role, sign-out */}
      <div ref={menuRef} className="relative flex h-full shrink-0 items-center border-l border-slate-800 px-3">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-800/60"
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
          <div className="absolute right-2 top-12 z-50 w-56 overflow-hidden rounded-xl border border-slate-700 bg-[#0D1117] shadow-2xl">
            <div className="border-b border-slate-800 px-4 py-3">
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
            <Link
              href="/freehold-intelligence/settings"
              onClick={() => setMenuOpen(false)}
              className="block px-4 py-2.5 text-sm text-slate-300 transition-colors hover:bg-slate-800/60 hover:text-white"
            >
              Settings
            </Link>
            <button
              onClick={signOut}
              className="flex w-full items-center gap-2 border-t border-slate-800 px-4 py-2.5 text-sm text-slate-300 transition-colors hover:bg-slate-800/60 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        )}
      </div>

    </div>
  )
}
