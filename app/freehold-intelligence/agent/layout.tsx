'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft, Bell, ChevronRight, UserCircle } from 'lucide-react'

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
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#0D1117]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-12 max-w-5xl items-center gap-2 px-4 sm:px-6">

          {isHome ? (
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg border border-[#D4AF37]/25 bg-[#D4AF37]/10">
                <UserCircle className="h-3.5 w-3.5 text-[#D4AF37]" />
              </div>
              <span className="text-sm font-semibold text-slate-200">My Workspace</span>
            </div>
          ) : (
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
              <ChevronRight className="h-4 w-4" />
              <span className="text-sm font-semibold text-slate-200">{label}</span>
            </div>
          )}

          <div className="ml-auto">
            <button
              className="relative flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-800/50 text-slate-400 transition-colors hover:border-slate-500 hover:text-slate-200"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">2</span>
            </button>
          </div>

        </div>
      </header>

      <main>{children}</main>
    </div>
  )
}
