'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { label: 'Overview', href: '/freehold-intelligence/lead-machine' },
  { label: 'Listings', href: '/freehold-intelligence/lead-machine/listings' },
  { label: 'Landings', href: '/freehold-intelligence/lead-machine/landings' },
  { label: 'Ad Requests', href: '/freehold-intelligence/lead-machine/ad-requests' },
  { label: 'Requirements', href: '/freehold-intelligence/lead-machine/requirements' },
]

export default function LeadMachineLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <>
      <div className="sticky top-[53px] z-30 border-b border-white/[0.06] bg-[#06080A]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-5xl overflow-x-auto px-6">
          <nav className="flex min-w-max gap-0">
            {tabs.map((tab) => {
              const isActive =
                tab.href === '/freehold-intelligence/lead-machine'
                  ? pathname === '/freehold-intelligence/lead-machine'
                  : pathname.startsWith(tab.href)

              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={[
                    'inline-flex shrink-0 items-center px-4 py-3 text-[13px] font-medium transition',
                    isActive
                      ? 'border-b-2 border-[#D4AF37] text-white'
                      : 'border-b-2 border-transparent text-white/45 hover:text-white/70',
                  ].join(' ')}
                >
                  {tab.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>

      {children}
    </>
  )
}
