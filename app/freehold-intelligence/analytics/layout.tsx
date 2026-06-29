'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft, TrendingUp, Building2, Users, Globe2, Megaphone } from 'lucide-react'
import { useSessionGuard } from '@/lib/freehold/use-session'
import { rolesForApp } from '@/lib/freehold/apps'
import type { Role } from '@/lib/freehold/session-types'
import { useT } from '@/lib/i18n/provider'

const BASE = '/freehold-intelligence/analytics'

// Role-scoped sections. Management (admin/ceo/director) sees everything;
// sales_manager sees Company + Team; marketing sees Market + Marketing.
type Tab = { id: string; href: string; labelKey: string; Icon: typeof Building2; roles: Role[] }
const TABS: Tab[] = [
  { id: 'company',   href: BASE,               labelKey: 'analytics.tab.company',   Icon: Building2, roles: ['admin', 'ceo', 'director', 'sales_manager'] },
  { id: 'team',      href: `${BASE}/team`,      labelKey: 'analytics.tab.team',      Icon: Users,     roles: ['admin', 'ceo', 'director', 'sales_manager'] },
  { id: 'market',    href: `${BASE}/market`,    labelKey: 'analytics.tab.market',    Icon: Globe2,    roles: ['admin', 'ceo', 'director', 'marketing'] },
  { id: 'marketing', href: `${BASE}/marketing`, labelKey: 'analytics.tab.marketing', Icon: Megaphone, roles: ['admin', 'ceo', 'director', 'marketing'] },
]

function tabIdFor(pathname: string): string {
  if (pathname === BASE) return 'company'
  const seg = pathname.slice(BASE.length + 1).split('/')[0]
  return TABS.some((t) => t.id === seg) ? seg : 'company'
}

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const t = useT()
  const { ready, user } = useSessionGuard(rolesForApp('analytics'))
  const role = user?.role

  const allowedTabs = TABS.filter((tab) => role && tab.roles.includes(role))
  const currentTab = tabIdFor(pathname)
  const currentAllowed = allowedTabs.some((tab) => tab.id === currentTab)

  // If a role lands on a section they can't see (e.g. marketing hitting the
  // Company default), send them to their first allowed section.
  useEffect(() => {
    if (ready && role && !currentAllowed && allowedTabs[0]) {
      router.replace(allowedTabs[0].href)
    }
  }, [ready, role, currentAllowed, allowedTabs, router])

  if (!ready || !currentAllowed) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-white/60" />
    </div>
  )

  return (
    <div className="flex flex-col min-h-full">

      {/* App header */}
      <header data-coach="app-analytics" className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-4 border-b border-white/[0.07] bg-chrome/97 px-5 backdrop-blur-xl sm:px-6">
        <Link
          href="/freehold-intelligence"
          className="flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-slate-100 shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:block">{t('common.apps')}</span>
        </Link>
        <div className="h-5 w-px bg-surface-3 shrink-0" />
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-violet-400/25 bg-violet-400/10">
            <TrendingUp className="h-3.5 w-3.5 text-violet-400" />
          </div>
          <span className="text-sm font-semibold text-white">{t('analytics.title')}</span>
        </div>
        <div className="ml-auto flex items-center gap-2 text-sm text-slate-400">
          <span className="h-2 w-2 rounded-full bg-violet-400 animate-pulse" />
          {t('analytics.live')}
        </div>
      </header>

      {/* Section sub-nav */}
      <nav className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-white/[0.07] bg-chrome/60 px-3 sm:px-5" style={{ scrollbarWidth: 'none' }}>
        {allowedTabs.map((tab) => {
          const active = tab.id === currentTab
          const Icon = tab.Icon
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={[
                'flex items-center gap-1.5 border-b-2 px-3.5 py-3 text-sm font-medium whitespace-nowrap transition-colors',
                active
                  ? 'border-violet-400 text-white'
                  : 'border-transparent text-slate-400 hover:text-white hover:border-white/20',
              ].join(' ')}
            >
              <Icon className="h-3.5 w-3.5" />
              {t(tab.labelKey)}
            </Link>
          )
        })}
      </nav>

      <div className="flex-1">{children}</div>
    </div>
  )
}
