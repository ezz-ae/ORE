'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AdsConversationSidebar } from '@/components/google/ads-conversation-sidebar'
import { AdsContextProvider } from '@/lib/google/ads-context'

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
    <AdsContextProvider>
    <div className="flex flex-col min-h-full">
      {/* Google Ads sub-nav */}
      <div className="border-b border-line bg-[#04060A]">
        <div className="overflow-x-auto px-6">
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
                    'inline-flex shrink-0 items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition',
                    isActive
                      ? 'border-b-2 border-[#4285F4] text-white'
                      : 'border-b-2 border-transparent text-slate-500 hover:text-slate-400',
                  ].join(' ')}
                >
                  {tab.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Two-column: scrollable main content + sticky conversation sidebar */}
      <div className="flex flex-1 min-h-0">
        <main className="flex-1 min-w-0 overflow-y-auto">
          {children}
        </main>
        <AdsConversationSidebar />
      </div>
    </div>
    </AdsContextProvider>
  )
}
