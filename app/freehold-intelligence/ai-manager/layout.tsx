'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { label: 'Overview',    href: '/freehold-intelligence/ai-manager' },
  { label: 'Listings',    href: '/freehold-intelligence/ai-manager/listings' },
  { label: 'Areas',       href: '/freehold-intelligence/ai-manager/areas' },
  { label: 'Developers',  href: '/freehold-intelligence/ai-manager/developers' },
  { label: 'Pages',       href: '/freehold-intelligence/ai-manager/pages' },
  { label: 'Topics',      href: '/freehold-intelligence/ai-manager/topics' },
  { label: 'Insights',    href: '/freehold-intelligence/ai-manager/insights' },
]

export default function AiManagerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <>
      <div className="sticky top-[56px] z-30 border-b border-white/[0.08] bg-[#111318]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl overflow-x-auto px-6">
          <nav className="flex min-w-max gap-0">
            {tabs.map((tab) => {
              const isActive =
                tab.href === '/freehold-intelligence/ai-manager'
                  ? pathname === '/freehold-intelligence/ai-manager'
                  : pathname.startsWith(tab.href)

              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={[
                    'inline-flex shrink-0 items-center px-4 py-3 text-[13px] font-medium transition',
                    isActive
                      ? 'border-b-2 border-rose-400 text-white'
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
