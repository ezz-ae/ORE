'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ArrowLeft, Users, Plus,
  LayoutGrid, Clock, TrendingUp,
  Inbox, Activity, BarChart3, Copy, ArrowRightLeft, UserCircle2, List,
} from 'lucide-react'
import { crmLeads, crmFollowUpQueue } from '@/src/features/freehold-intelligence/server-session'

// ── Nav sections ──────────────────────────────────────────────────────────────

const NAV_SECTIONS = [
  {
    label: 'Daily work',
    items: [
      { label: 'All Leads',  href: '/freehold-intelligence/crm',            exact: true, Icon: List        },
      { label: 'Inbox',      href: '/freehold-intelligence/crm/inbox',                   Icon: Inbox       },
      { label: 'Follow-up',  href: '/freehold-intelligence/crm/follow-up',               Icon: Clock       },
      { label: 'Board',      href: '/freehold-intelligence/crm/board',                   Icon: LayoutGrid  },
    ],
  },
  {
    label: 'Pipeline',
    items: [
      { label: 'Pipeline',   href: '/freehold-intelligence/crm/pipeline',                Icon: TrendingUp      },
      { label: 'Assignment', href: '/freehold-intelligence/crm/assignment',               Icon: ArrowRightLeft  },
    ],
  },
  {
    label: 'Team & Insights',
    items: [
      { label: 'Agents',     href: '/freehold-intelligence/crm/agents',                  Icon: UserCircle2 },
      { label: 'Activity',   href: '/freehold-intelligence/crm/activity',                Icon: Activity    },
      { label: 'Reports',    href: '/freehold-intelligence/crm/reports',                 Icon: BarChart3   },
      { label: 'Duplicates', href: '/freehold-intelligence/crm/duplicates',              Icon: Copy        },
    ],
  },
]

// ── Live badges ───────────────────────────────────────────────────────────────

const newLeads      = crmLeads.filter(l => l.pipelineStage === 'new').length
const criticalCount = crmFollowUpQueue.filter(l => l.urgency === 'critical').length

const BADGES: Record<string, number | undefined> = {
  '/freehold-intelligence/crm':            crmLeads.length,
  '/freehold-intelligence/crm/inbox':      newLeads > 0 ? newLeads : undefined,
  '/freehold-intelligence/crm/follow-up':  criticalCount > 0 ? criticalCount : undefined,
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href || pathname.startsWith('/freehold-intelligence/crm/leads')
    return pathname === href || pathname.startsWith(href + '/')
  }

  // Flat tab list for mobile scroll nav
  const allTabs = NAV_SECTIONS.flatMap(s => s.items)

  return (
    <div className="flex flex-col min-h-full">

      {/* ── App header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.07] bg-chrome/97 px-4 backdrop-blur-xl sm:px-6">
        <Link
          href="/freehold-intelligence"
          className="flex items-center gap-2 shrink-0 text-sm text-slate-400 transition-colors hover:text-slate-100"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:block">Apps</span>
        </Link>

        <div className="h-5 w-px shrink-0 bg-surface-3" />

        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-gold/25 bg-gold/10">
            <Users className="h-3.5 w-3.5 text-gold" />
          </div>
          <span className="text-sm font-semibold text-white">CRM</span>
        </div>

        {/* Live pulse chip */}
        <div className="hidden items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/[0.06] px-2.5 py-1 sm:flex">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          <span className="text-xs text-emerald-300/80">{crmLeads.length} leads live</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/freehold-intelligence/crm/inbox"
            className="flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface-2 px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:border-gold/30 hover:text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:block">Add Lead</span>
          </Link>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-1">

        {/* Desktop sidebar */}
        <aside className="hidden lg:flex lg:flex-col sticky top-14 h-[calc(100vh-56px)] w-56 shrink-0 overflow-y-auto border-r border-white/[0.07] bg-chrome">
          <nav className="flex-1 px-3 py-4 space-y-5">
            {NAV_SECTIONS.map((section) => (
              <div key={section.label}>
                <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                  {section.label}
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
                          'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                          active
                            ? 'bg-gold/10 text-white border border-gold/15'
                            : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.05] border border-transparent',
                        ].join(' ')}
                      >
                        <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-gold' : 'text-slate-500'}`} />
                        <span className="flex-1 truncate">{item.label}</span>
                        {badge !== undefined && (
                          <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                            item.href.includes('follow-up') && criticalCount > 0
                              ? 'bg-red-400/15 text-red-300'
                              : active
                                ? 'bg-gold/20 text-gold'
                                : 'bg-surface-3 text-slate-400'
                          }`}>
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
                    {tab.label}
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
