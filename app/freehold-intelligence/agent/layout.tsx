'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft, ChevronRight } from 'lucide-react'

const APP_LABELS: Record<string, string> = {
  '/freehold-intelligence/agent/leads':     'My Leads',
  '/freehold-intelligence/agent/account':   'Account',
  '/freehold-intelligence/agent/campaigns': 'My Campaigns',
  '/freehold-intelligence/agent/credits':   'Credits',
  '/freehold-intelligence/agent/notebook':  'Research',
  '/freehold-intelligence/agent/ai':        'My AI',
}

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isHome   = pathname === '/freehold-intelligence/agent'
  const label    = APP_LABELS[pathname] ?? ''

  return (
    <div className="min-h-full">

      {/* Lightweight secondary breadcrumb bar — identity/sign-out are in SpacesNav */}
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-chrome/95 backdrop-blur-xl">
        <div className="mx-auto flex h-12 max-w-5xl items-center gap-2 px-4 sm:px-6">

          {!isHome && (
            <Link
              href="/freehold-intelligence/agent"
              className="flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-slate-100"
            >
              <ArrowLeft className="h-4 w-4" />
              My Workspace
            </Link>
          )}

          {label && (
            <div className="flex items-center gap-1.5 text-slate-600">
              {!isHome && <ChevronRight className="h-4 w-4" />}
              <span className="text-sm font-semibold text-slate-200">{label}</span>
            </div>
          )}

        </div>
      </header>

      <main>{children}</main>
    </div>
  )
}
