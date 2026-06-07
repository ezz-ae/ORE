'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ArrowLeft, Settings,
  Settings2, Users, Shield, CreditCard,
  ShieldCheck, Bell, Code,
} from 'lucide-react'

const NAV_SECTIONS = [
  {
    label: 'Workspace',
    items: [
      { label: 'General',       href: '/freehold-intelligence/settings',                    exact: true, Icon: Settings2  },
      { label: 'Team',          href: '/freehold-intelligence/settings/team',                            Icon: Users      },
      { label: 'Roles',         href: '/freehold-intelligence/settings/roles',                           Icon: Shield     },
      { label: 'Billing',       href: '/freehold-intelligence/settings/billing',                         Icon: CreditCard },
    ],
  },
  {
    label: 'Security',
    items: [
      { label: 'Security',      href: '/freehold-intelligence/settings/security',                        Icon: ShieldCheck },
      { label: 'Notifications', href: '/freehold-intelligence/settings/notifications',                   Icon: Bell        },
    ],
  },
  {
    label: 'Developer',
    items: [
      { label: 'API',           href: '/freehold-intelligence/settings/api',                             Icon: Code        },
    ],
  },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  const allTabs = NAV_SECTIONS.flatMap(s => s.items)

  return (
    <div className="flex flex-col min-h-full">

      {/* App header */}
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.07] bg-chrome/97 px-4 backdrop-blur-xl sm:px-6">
        <Link
          href="/freehold-intelligence"
          className="flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-slate-100 shrink-0"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:block">Apps</span>
        </Link>
        <div className="h-4 w-px bg-surface-2 shrink-0" />
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-line-strong bg-surface-2">
            <Settings className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <span className="text-sm font-semibold text-white">Settings</span>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1">

        {/* Desktop sidebar — auto-collapse */}
        <aside className="group/nav hidden lg:flex lg:flex-col sticky top-14 h-[calc(100vh-56px)] w-[52px] hover:w-56 shrink-0 transition-[width] duration-200 overflow-hidden border-r border-white/[0.07] bg-chrome">
          <nav className="flex-1 px-2 py-4 space-y-5">
            {NAV_SECTIONS.map((section) => (
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
                          'flex items-center rounded-lg px-[13px] py-2 text-sm font-medium transition',
                          active ? 'bg-gold/10 text-white border border-gold/15' : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.05] border border-transparent',
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
                      'inline-flex items-center px-3 py-3.5 text-sm font-medium border-b-2 transition whitespace-nowrap',
                      active ? 'border-slate-400 text-white' : 'border-transparent text-slate-400 hover:text-slate-100',
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
