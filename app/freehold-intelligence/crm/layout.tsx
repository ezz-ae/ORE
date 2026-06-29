'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  ArrowLeft, Users, Plus,
  LayoutGrid, Clock, TrendingUp,
  Inbox, Activity, BarChart3, Copy, ArrowRightLeft, UserCircle2, List,
} from 'lucide-react'
import { useSession } from '@/lib/freehold/use-session'
import { useLiveLeads } from '@/lib/freehold/use-live-leads'
import { useT } from '@/lib/i18n/provider'
import { AddLeadModal } from './_components/AddLeadModal'

// CRM sub-pages a broker may access (their own daily work). Everything else
// (assignment, agents, reports, duplicates, pipeline, activity) is management-only.
const BROKER_CRM_PREFIXES = [
  '/freehold-intelligence/crm',
  '/freehold-intelligence/crm/inbox',
  '/freehold-intelligence/crm/follow-up',
  '/freehold-intelligence/crm/board',
  '/freehold-intelligence/crm/leads',
]
function brokerCanAccess(pathname: string): boolean {
  if (pathname === '/freehold-intelligence/crm') return true
  return BROKER_CRM_PREFIXES.some((p) => p !== '/freehold-intelligence/crm' && (pathname === p || pathname.startsWith(p + '/')))
}

// ── Nav sections ──────────────────────────────────────────────────────────────

const NAV_SECTIONS = [
  {
    label: 'Daily work',
    labelKey: 'crm.nav.dailyWork',
    items: [
      { label: 'All Leads',  labelKey: 'crm.nav.allLeads',  href: '/freehold-intelligence/crm',            exact: true, Icon: List        },
      { label: 'Inbox',      labelKey: 'crm.inbox',         href: '/freehold-intelligence/crm/inbox',                   Icon: Inbox       },
      { label: 'Follow-up',  labelKey: 'crm.followUp',      href: '/freehold-intelligence/crm/follow-up',               Icon: Clock       },
      { label: 'Board',      labelKey: 'crm.board',         href: '/freehold-intelligence/crm/board',                   Icon: LayoutGrid  },
    ],
  },
  {
    label: 'Pipeline',
    labelKey: 'crm.nav.pipeline',
    items: [
      { label: 'Pipeline',   labelKey: 'crm.nav.pipeline',   href: '/freehold-intelligence/crm/pipeline',                Icon: TrendingUp      },
      { label: 'Assignment', labelKey: 'crm.nav.assignment', href: '/freehold-intelligence/crm/assignment',               Icon: ArrowRightLeft  },
    ],
  },
  {
    label: 'Team & Insights',
    labelKey: 'crm.nav.teamInsights',
    items: [
      { label: 'Agents',     labelKey: 'crm.agents',     href: '/freehold-intelligence/crm/agents',                  Icon: UserCircle2 },
      { label: 'Activity',   labelKey: 'crm.activity',   href: '/freehold-intelligence/crm/activity',                Icon: Activity    },
      { label: 'Reports',    labelKey: 'crm.reports',    href: '/freehold-intelligence/crm/reports',                 Icon: BarChart3   },
      { label: 'Duplicates', labelKey: 'crm.duplicates', href: '/freehold-intelligence/crm/duplicates',              Icon: Copy        },
    ],
  },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  const { user } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const t = useT()

  const [addLeadOpen, setAddLeadOpen] = useState(false)
  // Live badge counts derived from real DB leads (no seed/mock).
  const { leads } = useLiveLeads()
  const newLeads      = leads.filter(l => l.pipelineStage === 'new').length
  const criticalCount = leads.filter(l => l.urgency === 'critical').length
  const BADGES: Record<string, number | undefined> = {
    '/freehold-intelligence/crm':            leads.length > 0 ? leads.length : undefined,
    '/freehold-intelligence/crm/inbox':      newLeads > 0 ? newLeads : undefined,
    '/freehold-intelligence/crm/follow-up':  criticalCount > 0 ? criticalCount : undefined,
  }

  // Brokers may only reach their own daily-work CRM pages; bounce deep-links to
  // management-only sub-pages back to their leads.
  const brokerBlocked = user?.role === 'broker' && !brokerCanAccess(pathname)
  useEffect(() => {
    if (brokerBlocked) router.replace('/freehold-intelligence/crm')
  }, [brokerBlocked, router])

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href || pathname.startsWith('/freehold-intelligence/crm/leads')
    return pathname === href || pathname.startsWith(href + '/')
  }

  // Brokers only see their own daily work — hide pipeline/team sections
  const navSections = user?.role === 'broker'
    ? NAV_SECTIONS.filter(s => s.label === 'Daily work')
    : NAV_SECTIONS

  // Flat tab list for mobile scroll nav
  const allTabs = navSections.flatMap(s => s.items)

  if (brokerBlocked) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-white/60" />
    </div>
  )

  return (
    <div className="flex flex-col min-h-full">

      {/* ── App header ─────────────────────────────────────────────────────── */}
      <header data-coach="app-crm" className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.07] bg-chrome/97 px-4 backdrop-blur-xl sm:px-6">
        <Link
          href="/freehold-intelligence"
          className="flex items-center gap-2 shrink-0 text-sm text-slate-400 transition-colors hover:text-slate-100"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:block">{t('crm.apps')}</span>
        </Link>

        <div className="h-5 w-px shrink-0 bg-surface-3" />

        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-gold/25 bg-gold/10">
            <Users className="h-3.5 w-3.5 text-gold" />
          </div>
          <span className="text-sm font-semibold text-white">{t('crm.crm')}</span>
        </div>

        {/* Live pulse chip */}
        <div className="hidden items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/[0.06] px-2.5 py-1 sm:flex">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          <span className="text-xs text-emerald-300/80">{t('crm.leadsLive', { count: leads.length })}</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setAddLeadOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface-2 px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:border-gold/30 hover:text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:block">{t('crm.addLead')}</span>
          </button>
        </div>
      </header>

      <AddLeadModal open={addLeadOpen} onClose={() => setAddLeadOpen(false)} />

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-1">

        {/* Desktop sidebar — auto-collapse: icon-only at rest, full width on hover */}
        <aside className="group/nav hidden lg:flex lg:flex-col sticky top-14 h-[calc(100vh-56px)] w-[52px] hover:w-56 shrink-0 transition-[width] duration-200 overflow-hidden border-r border-white/[0.07] bg-chrome">
          <nav className="flex-1 px-2 py-4 space-y-5">
            {navSections.map((section) => (
              <div key={section.label}>
                {/* Section label — fades in on hover */}
                <div className="mb-1.5 h-4 px-2.5">
                  <span className="block whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600 opacity-0 group-hover/nav:opacity-100 transition-opacity duration-150">
                    {t(section.labelKey)}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const active  = isActive(item.href, (item as any).exact)
                    const badge   = BADGES[item.href]
                    const Icon    = item.Icon
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
                          {t(item.labelKey)}
                        </span>
                        {badge !== undefined && (
                          <span className={[
                            'ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums overflow-hidden max-w-0 opacity-0 group-hover/nav:max-w-[3rem] group-hover/nav:opacity-100 transition-all duration-150',
                            item.href.includes('follow-up') && criticalCount > 0
                              ? 'bg-red-400/15 text-red-300'
                              : active
                                ? 'bg-gold/20 text-gold'
                                : 'bg-surface-3 text-slate-400',
                          ].join(' ')}>
                            {badge}
                          </span>
                        )}
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
                const badge  = BADGES[tab.href]
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={[
                      'inline-flex items-center gap-1.5 px-3.5 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                      active ? 'border-gold text-white' : 'border-transparent text-slate-400 hover:text-slate-200',
                    ].join(' ')}
                  >
                    {t(tab.labelKey)}
                    {badge !== undefined && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${active ? 'bg-gold/20 text-gold' : 'bg-surface-3 text-slate-500'}`}>
                        {badge}
                      </span>
                    )}
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
