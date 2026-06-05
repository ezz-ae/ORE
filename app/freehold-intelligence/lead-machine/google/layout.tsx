'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const BASE = '/freehold-intelligence/lead-machine/google'

const tabs = [
  { label: 'Overview',   href: BASE },
  { label: 'Campaigns',  href: `${BASE}/campaigns` },
  { label: 'Keywords',   href: `${BASE}/keywords` },
  { label: 'Ads',        href: `${BASE}/ads` },
  { label: 'Audiences',  href: `${BASE}/audiences` },
  { label: 'Extensions', href: `${BASE}/extensions` },
  { label: 'Reports',    href: `${BASE}/reports` },
]

export default function GoogleAdsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <>
      {/* Google Ads sub-nav */}
      <div className="border-b border-white/[0.04] bg-[#04060A]">
        <div className="mx-auto max-w-5xl overflow-x-auto px-6">
          <nav className="flex min-w-max gap-0">
            {tabs.map((tab) => {
              const isActive =
                tab.href === BASE
                  ? pathname === BASE
                  : pathname.startsWith(tab.href)

              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={[
                    'inline-flex shrink-0 items-center gap-1.5 px-4 py-2.5 text-[12px] font-medium transition',
                    isActive
                      ? 'border-b-2 border-[#4285F4] text-white'
                      : 'border-b-2 border-transparent text-white/35 hover:text-white/60',
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
