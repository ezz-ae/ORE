'use client'

import Link from 'next/link'
import { tabLinkClass } from '@/components/freehold/ui'
import { usePathname } from 'next/navigation'
import {
  ArrowLeft, Megaphone,
  Activity,
  BarChart3, Zap,
  Monitor, ClipboardList, Crosshair, Palette, Users,
  Search, Radio, Bot,
  FileText, FileCheck, Shield,
} from 'lucide-react'
import { useSessionGuard } from '@/lib/freehold/use-session'
import { useT } from '@/lib/i18n/provider'

// The nav mirrors the loop the app exists for: run ads → generate leads →
// learn from each step. The Machine (the AI that closes that loop) leads;
// Launch holds the manual campaign tools; Sources feed the launches; Ops is
// paperwork. "Readiness" is the honest name for the old Pipeline tab — the
// page scores inventory/landing readiness, it never showed a lead pipeline.
const MANAGER_NAV_SECTIONS = [
  {
    key: 'lm.nav.sec.machine',
    items: [
      { key: 'lm.nav.adsMachine',  href: '/freehold-intelligence/lead-machine/ads-machine',                 Icon: Bot         },
      { key: 'lm.nav.optimizer',   href: '/freehold-intelligence/lead-machine/campaigns/optimize',          Icon: Zap         },
      { key: 'lm.nav.attribution', href: '/freehold-intelligence/lead-machine/campaigns/attribution',       Icon: BarChart3   },
      { key: 'lm.nav.live',        href: '/freehold-intelligence/ads-live',                                 Icon: Radio       },
    ],
  },
  {
    key: 'lm.nav.sec.launch',
    items: [
      { key: 'lm.nav.campaigns',   href: '/freehold-intelligence/lead-machine/campaigns',      exact: true, Icon: Megaphone   },
      { key: 'lm.nav.creative',    href: '/freehold-intelligence/lead-machine/creatives',                   Icon: Palette     },
      { key: 'lm.nav.forms',       href: '/freehold-intelligence/lead-machine/forms',                       Icon: ClipboardList},
      { key: 'lm.nav.targeting',   href: '/freehold-intelligence/lead-machine/targeting',                   Icon: Crosshair   },
      { key: 'lm.nav.audiences',   href: '/freehold-intelligence/lead-machine/audiences',                   Icon: Users,       coach: 'lm-audiences' },
      { key: 'lm.nav.google',      href: '/freehold-intelligence/lead-machine/google',                      Icon: Search      },
    ],
  },
  {
    key: 'lm.nav.sec.sources',
    items: [
      { key: 'lm.nav.pipeline',    href: '/freehold-intelligence/lead-machine',                exact: true, Icon: Activity    },
      { key: 'lm.nav.landings',    href: '/freehold-intelligence/lead-machine/landings',                    Icon: Monitor     },
    ],
  },
  {
    key: 'lm.nav.sec.ops',
    items: [
      { key: 'lm.nav.adRequests',  href: '/freehold-intelligence/lead-machine/ad-requests',                 Icon: FileText    },
      { key: 'lm.nav.requirements', href: '/freehold-intelligence/lead-machine/requirements',               Icon: FileCheck   },
      { key: 'lm.nav.permissions', href: '/freehold-intelligence/lead-machine/permissions',                 Icon: Shield      },
    ],
  },
]

// Brokers only see their own campaigns
const BROKER_NAV_SECTIONS = [
  {
    key: 'lm.nav.sec.myCampaigns',
    items: [
      { key: 'lm.nav.campaigns',   href: '/freehold-intelligence/lead-machine/campaigns', exact: true, Icon: Megaphone },
    ],
  },
]

const ALLOWED_ROLES = ['admin', 'sales_manager', 'director', 'ceo', 'marketing', 'broker'] as const

export default function LeadMachineLayout({ children }: { children: React.ReactNode }) {
  const { ready, user } = useSessionGuard([...ALLOWED_ROLES])
  const pathname        = usePathname()
  const t               = useT()

  if (!ready) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-white/60" />
    </div>
  )

  const isBroker    = user?.role === 'broker'
  const navSections = isBroker ? BROKER_NAV_SECTIONS : MANAGER_NAV_SECTIONS
  const allTabs     = navSections.flatMap(s => s.items)

  // Nav already hides these from brokers; the guard makes the DIRECT URL match
  // what the nav says (the data APIs are role-gated separately either way).
  if (isBroker && navSections === BROKER_NAV_SECTIONS) {
    const brokerAllowed = allTabs.some(tab => pathname === tab.href || pathname.startsWith(tab.href + '/'))
    const isHub = pathname === '/freehold-intelligence/lead-machine'
    if (!brokerAllowed && !isHub && typeof window !== 'undefined') {
      window.location.replace('/freehold-intelligence/lead-machine')
      return null
    }
  }

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  // Brokers return home to their workspace; managers go to the ads hub
  const backHref  = isBroker ? '/freehold-intelligence/agent' : '/freehold-intelligence'
  const backLabel = isBroker ? t('lm.nav.backBroker') : t('lm.nav.backManager')

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
          <span className="text-sm font-semibold text-white">{isBroker ? t('lm.nav.appTitleBroker') : t('lm.nav.appTitle')}</span>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1">

        {/* Desktop sidebar */}
        <aside className="group/nav hidden lg:flex lg:flex-col sticky top-14 h-[calc(100vh-56px)] w-[52px] hover:w-56 shrink-0 transition-[width] duration-200 overflow-hidden border-r border-white/[0.07] bg-chrome">
          <nav className="flex-1 px-2 py-4 space-y-5 overflow-y-auto">
            {navSections.map((section) => (
              <div key={section.key}>
                <div className="mb-1.5 h-4 px-2.5">
                  <span className="block whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600 opacity-0 group-hover/nav:opacity-100 transition-opacity duration-150">
                    {t(section.key)}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const active = isActive(item.href, (item as any).exact)
                    const Icon   = item.Icon
                    return (
                      <Link
                        key={item.href}
                        data-coach={(item as { coach?: string }).coach}
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
                          {t(item.key)}
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
