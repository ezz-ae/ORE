'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { label: 'Leads', href: '/freehold-intelligence/crm' },
  { label: 'Inbox', href: '/freehold-intelligence/crm/inbox' },
  { label: 'Follow-up', href: '/freehold-intelligence/crm/follow-up' },
  { label: 'Assignment', href: '/freehold-intelligence/crm/assignment' },
  { label: 'Activity', href: '/freehold-intelligence/crm/activity' },
  { label: 'Duplicates', href: '/freehold-intelligence/crm/duplicates' },
  { label: 'Pipeline', href: '/freehold-intelligence/crm/pipeline' },
  { label: 'Agents', href: '/freehold-intelligence/crm/agents' },
  { label: 'Reports', href: '/freehold-intelligence/crm/reports' },
]

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <>
      <div className="sticky top-[53px] z-30 border-b border-white/[0.06] bg-[#06080A]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl overflow-x-auto px-6">
          <nav className="flex min-w-max gap-0">
            {tabs.map((tab) => {
              const isActive =
                tab.href === '/freehold-intelligence/crm'
                  ? pathname === '/freehold-intelligence/crm'
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
