'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ArrowLeft, Megaphone,
  Activity, Building2,
  BarChart3, Zap,
  Monitor, ClipboardList, Crosshair, Palette,
  Search, Radio,
  FileText, FileCheck, Shield,
} from 'lucide-react'
import { useSessionGuard } from '@/lib/freehold/use-session'

// Full nav shown to managers
const MANAGER_NAV_SECTIONS = [
  {
    label: 'Pipeline',
    items: [
      { label: 'Pipeline',    href: '/freehold-intelligence/lead-machine',                exact: true, Icon: Activity    },
      { label: 'Listings',    href: '/freehold-intelligence/lead-machine/listings',                    Icon: Building2   },
    ],
  },
  {
    label: 'Campaigns',
    items: [
      { label: 'Campaigns',   href: '/freehold-intelligence/lead-machine/campaigns',      exact: true, Icon: Megaphone   },
      { label: 'Attribution', href: '/freehold-intelligence/lead-machine/campaigns/attribution',       Icon: BarChart3   },
      { label: 'Optimizer',   href: '/freehold-intelligence/lead-machine/campaigns/optimize',          Icon: Zap         },
    ],
  },
  {
    label: 'Creative',
    items: [
      { label: 'Landings',    href: '/freehold-intelligence/lead-machine/landings',                    Icon: Monitor     },
      { label: 'Forms',       href: '/freehold-intelligence/lead-machine/forms',                       Icon: ClipboardList},
      { label: 'Targeting',   href: '/freehold-intelligence/lead-machine/targeting',                   Icon: Crosshair   },
      { label: 'Creatives',   href: '/freehold-intelligence/lead-machine/creatives',                   Icon: Palette     },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Google Ads',  href: '/freehold-intelligence/lead-machine/google',                      Icon: Search      },
      { label: 'Live',        href: '/freehold-intelligence/ads-live',                                 Icon: Radio       },
      { label: 'Ad Requests', href: '/freehold-intelligence/lead-machine/ad-requests',                 Icon: FileText    },
      { label: 'Requirements',href: '/freehold-intelligence/lead-machine/requirements',                Icon: FileCheck   },
      { label: 'Permissions', href: '/freehold-intelligence/lead-machine/permissions',                 Icon: Shield      },
    ],
  },
]

// Brokers only see their own campaigns
const BROKER_NAV_SECTIONS = [
  {
    label: 'My Campaigns',
    items: [
      { label: 'Campaigns',   href: '/freehold-intelligence/lead-machine/campaigns', exact: true, Icon: Megaphone },
    ],
  },
]

const ALLOWED_ROLES = ['admin', 'sales_manager', 'director', 'ceo', 'marketing', 'broker'] as const

export default function LeadMachineLayout({ children }: { children: React.ReactNode }) {
  const { ready, user } = useSessionGuard([...ALLOWED_ROLES])
  const pathname        = usePathname()

  if (!ready) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-white/60" />
    </div>
  )

  const isBroker    = user?.role === 'broker'
  const navSections = isBroker ? BROKER_NAV_SECTIONS : MANAGER_NAV_SECTIONS
  const allTabs     = navSections.flatMap(s => s.items)

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  // Brokers return home to their workspace; managers go to the ads hub
  const backHref  = isBroker ? '/freehold-intelligence/agent' : '/freehold-intelligence/ads'
  const backLabel = isBroker ? 'My Workspace' : 'All ad tools'

  return (
    <div className="flex flex-col min-h-full">

      {/* App header */}
      <header data-coach="app-lead-machine" className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-4 border-b border-white/[0.07] bg-chrome/97 px-5 backdrop-blur-xl sm:px-6">
        <Link
          href={backHref}
          className="flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-slate-100 shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:block">{backLabel}</span>
        </Link>
        <div className="h-5 w-px bg-surface-3 shrink-0" />
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-gold/25 bg-gold/10">
            <Megaphone className="h-3.5 w-3.5 text-gold" />
          </div>
          <span className="text-sm font-semibold text-white">{isBroker ? 'My Campaigns' : 'Ads'}</span>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1">

        {/* Desktop sidebar */}
        <aside className="group/nav hidden lg:flex lg:flex-col sticky top-14 h-[calc(100vh-56px)] w-[52px] hover:w-56 shrink-0 transition-[width] duration-200 overflow-hidden border-r border-white/[0.07] bg-chrome">
          <nav className="flex-1 px-2 py-4 space-y-5 overflow-y-auto">
            {navSections.map((section) => (
              <div key={section.label}>
                <div className="mb-1.5 h-4 px-2.5">
                  <span className="block whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600 opacity-0 group-hover/nav:opacity-100 transition-opacity duration-150">
                    {section.label}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const active = isActive(item.href, (item as any).exact)
                    const Icon   = item.Icon
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={[
                          'flex items-center rounded-lg px-[13px] py-2 text-sm font-medium transition-colors',
                          active
                            ? 'bg-gold/10 text-white border border-gold/15'
                            : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.05] border border-transparent',
                        ].join(' ')}
                      >
                        <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-gold' : 'text-slate-500'}`} />
                        <span className="overflow-hidden whitespace-nowrap opacity-0 max-w-0 group-hover/nav:opacity-100 group-hover/nav:max-w-[160px] transition-all duration-150 ml-0 group-hover/nav:ml-2.5">
                          {item.label}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Mobile tabs */}
          <div className="lg:hidden sticky top-14 z-30 overflow-x-auto border-b border-white/[0.07] bg-chrome/95 backdrop-blur-xl">
            <nav className="flex min-w-max px-4">
              {allTabs.map((tab) => {
                const active = isActive(tab.href, (tab as any).exact)
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={[
                      'inline-flex items-center px-4 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                      active ? 'border-gold text-white' : 'border-transparent text-slate-400 hover:text-slate-200',
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
