'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Zap } from 'lucide-react'

const tabs = [
  { label: 'Overview',     href: '/freehold-intelligence/lead-machine', exact: true },
  { label: 'Listings',     href: '/freehold-intelligence/lead-machine/listings' },
  { label: 'Campaigns',    href: '/freehold-intelligence/lead-machine/campaigns' },
  { label: 'Attribution',  href: '/freehold-intelligence/lead-machine/campaigns/attribution' },
  { label: 'Optimizer',   href: '/freehold-intelligence/lead-machine/campaigns/optimize' },
  { label: 'Landings',     href: '/freehold-intelligence/lead-machine/landings' },
  { label: 'Forms',        href: '/freehold-intelligence/lead-machine/forms' },
  { label: 'Targeting',    href: '/freehold-intelligence/lead-machine/targeting' },
  { label: 'Creatives',    href: '/freehold-intelligence/lead-machine/creatives' },
  { label: 'Google Ads',   href: '/freehold-intelligence/lead-machine/google' },
  { label: 'Ad Requests',  href: '/freehold-intelligence/lead-machine/ad-requests' },
  { label: 'Requirements', href: '/freehold-intelligence/lead-machine/requirements' },
]

export default function LeadMachineLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  function isActive(tab: typeof tabs[number]) {
    if (tab.exact) return pathname === tab.href
    return pathname === tab.href || pathname.startsWith(tab.href + '/')
  }

  return (
    <div className="flex min-h-full">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col sticky top-0 h-[calc(100vh-56px)] w-[200px] shrink-0 overflow-y-auto border-r border-white/[0.07] bg-[#0B0F1A]">
        <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-4 py-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#D4AF37]/20 bg-[#D4AF37]/10">
            <Zap className="h-3.5 w-3.5 text-[#D4AF37]" />
          </div>
          <span className="text-[13px] font-semibold text-white">Lead Machine</span>
        </div>
        <nav className="flex-1 px-3 py-3 space-y-0.5">
          {tabs.map((tab) => {
            const active = isActive(tab)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={[
                  'flex items-center px-3 py-2.5 rounded-lg text-[13px] font-medium transition',
                  active
                    ? 'bg-white/[0.08] text-white'
                    : 'text-white/45 hover:text-white/75 hover:bg-white/[0.04]',
                ].join(' ')}
              >
                {tab.label}
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Mobile horizontal tabs */}
        <div className="lg:hidden sticky top-0 z-30 border-b border-white/[0.07] bg-[#0B0F1A]/90 backdrop-blur-xl overflow-x-auto">
          <nav className="flex min-w-max px-4">
            {tabs.map((tab) => {
              const active = isActive(tab)
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={[
                    'inline-flex items-center px-3 py-3 text-[13px] font-medium border-b-2 transition whitespace-nowrap',
                    active
                      ? 'border-[#D4AF37] text-white'
                      : 'border-transparent text-white/40 hover:text-white/65',
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
  )
}
