'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft, UsersRound, Users, ScrollText } from 'lucide-react'
import { useSessionGuard } from '@/lib/freehold/use-session'
import { rolesForApp } from '@/lib/freehold/apps'
import { useT } from '@/lib/i18n/provider'
import { tabLinkClass } from '@/components/freehold/ui'

/**
 * Team — one app, four screens:
 *   /team            the roster (status strip + one row per person)
 *   /team/[agentId]  everything about one person, in tabs
 *   /team/teams      the org chart — who leads whom
 *   /team/log        the authority record — who did what, and what was refused
 *
 * These three DO earn a nav row: they are peers you move between while doing
 * the same job (deciding something about a person), not separate destinations.
 * That is the test for a second level — the All-tools popup already reaches
 * everything, so chrome here has to pay for itself in the flow.
 *
 * The guard reads the SAME role list the app registry publishes, so nav
 * visibility and route access can never drift apart.
 */
export default function TeamLayout({ children }: { children: React.ReactNode }) {
  const { ready } = useSessionGuard(rolesForApp('team'))
  const t = useT()
  const pathname = usePathname()

  const tabs = [
    { href: '/freehold-intelligence/team',       label: t('team.nav.roster'), Icon: UsersRound, exact: true },
    { href: '/freehold-intelligence/team/teams', label: t('team.nav.teams'),  Icon: Users },
    { href: '/freehold-intelligence/team/log',   label: t('team.nav.log'),    Icon: ScrollText },
  ]
  // A person's page (/team/<id>) is a detail view, not a peer of these tabs —
  // lighting "Roster" there would be wrong, so nothing is lit.
  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/')

  if (!ready) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-white/60" />
    </div>
  )

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-4 border-b border-white/[0.07] bg-chrome/97 px-5 backdrop-blur-xl sm:px-6">
        <Link
          href="/freehold-intelligence"
          className="flex shrink-0 items-center gap-2 text-sm text-slate-400 transition-colors hover:text-slate-100"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          <span className="hidden sm:block">{t('team.back')}</span>
        </Link>
        <div className="h-5 w-px shrink-0 bg-surface-3" />
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-teal-400/25 bg-teal-400/10">
            <UsersRound className="h-3.5 w-3.5 text-teal-400" />
          </div>
          <span className="text-sm font-semibold text-white">{t('team.app.title')}</span>
          <span className="hidden text-xs text-slate-500 sm:block">· {t('team.app.tag')}</span>
        </div>

        <nav className="ms-auto flex items-center gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {tabs.map((tab) => (
            <Link key={tab.href} href={tab.href} className={tabLinkClass(isActive(tab.href, tab.exact))}>
              <tab.Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </Link>
          ))}
        </nav>
      </header>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
