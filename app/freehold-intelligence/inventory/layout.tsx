'use client'

import Link from 'next/link'
import { tabLinkClass } from '@/components/freehold/ui'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowLeft, Package } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

const tabs = [
  { key: 'inv.tab.allUnits',     href: '/freehold-intelligence/inventory',                  exact: true },
  { key: 'inv.tab.projects',     href: '/freehold-intelligence/inventory/projects' },
  { key: 'inv.tab.offPlan',      href: '/freehold-intelligence/inventory/off-plan' },
  { key: 'inv.tab.ready',        href: '/freehold-intelligence/inventory/ready' },
  { key: 'inv.tab.dataQuality',  href: '/freehold-intelligence/inventory/data-quality' },
]

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const t = useT()

  // Trust rule: the off-plan tab only appears once we confirm off-plan inventory
  // actually exists — a permanently-empty "0 projects" tab reads as broken.
  const [hasOffPlan, setHasOffPlan] = useState<boolean | null>(null)
  useEffect(() => {
    let cancelled = false
    fetch('/api/freehold/inventory')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return
        const props: Array<{ status: string; handoverYear?: number | null }> = Array.isArray(d?.properties) ? d.properties : []
        const yr = new Date().getFullYear()
        const n = props.filter((p) =>
          ['off_plan', 'under_construction', 'coming_soon'].includes(p.status) ||
          (p.handoverYear != null && p.handoverYear >= yr && p.status !== 'ready' && p.status !== 'sold_out'),
        ).length
        setHasOffPlan(n > 0)
      })
      .catch(() => { if (!cancelled) setHasOffPlan(false) })
    return () => { cancelled = true }
  }, [])

  const onOffPlan = pathname.startsWith('/freehold-intelligence/inventory/off-plan')
  const visibleTabs = tabs.filter((tab) => tab.key !== 'inv.tab.offPlan' || hasOffPlan === true || onOffPlan)

  function isActive(tab: typeof tabs[number]) {
    if (tab.exact) return pathname === tab.href
    return pathname === tab.href || pathname.startsWith(tab.href + '/')
  }

  return (
    <div className="flex flex-col min-h-full">

      {/* App header */}
      <header data-coach="app-inventory" className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-4 border-b border-white/[0.07] bg-chrome/97 px-5 backdrop-blur-xl sm:px-6">
        <Link
          href="/freehold-intelligence"
          className="flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-slate-100 shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:block">{t('inv.apps')}</span>
        </Link>
        <div className="h-5 w-px bg-surface-3 shrink-0" />
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-400/25 bg-amber-400/10">
            <Package className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <span className="text-sm font-semibold text-white">{t('inv.inventory')}</span>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1">

        {/* Desktop sidebar */}
        <aside className="hidden lg:flex lg:flex-col sticky top-14 h-[calc(100vh-56px)] w-56 shrink-0 overflow-y-auto border-r border-white/[0.07] bg-chrome">
          <nav className="flex-1 px-2 py-4 space-y-0.5">
            {visibleTabs.map((tab) => {
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
                  {t(tab.key)}
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
              {visibleTabs.map((tab) => {
                const active = isActive(tab)
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={tabLinkClass(active)}
                  >
                    {t(tab.key)}
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
