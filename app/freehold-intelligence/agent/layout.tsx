'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft, Bell, ChevronRight } from 'lucide-react'
import { agentProfile } from '@/src/features/freehold-intelligence/agent'

const APP_LABELS: Record<string, string> = {
  '/freehold-intelligence/agent/leads':     'My Leads',
  '/freehold-intelligence/agent/account':   'Account',
  '/freehold-intelligence/agent/campaigns': 'My Campaigns',
  '/freehold-intelligence/agent/notebook':  'Inventory',
  '/freehold-intelligence/agent/ai':        'My AI',
}

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isHome   = pathname === '/freehold-intelligence/agent'
  const label    = APP_LABELS[pathname] ?? ''

  return (
    <div className="min-h-screen bg-[#0B0F1A]">
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0B0F1A]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4 sm:px-6">
          {isHome ? (
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#D4AF37]/25 bg-[#D4AF37]/10">
                <span className="text-[11px] font-bold text-[#D4AF37]">F</span>
              </div>
              <span className="text-[13px] font-semibold text-white/75">Freehold</span>
            </div>
          ) : (
            <Link
              href="/freehold-intelligence/agent"
              className="flex items-center gap-1.5 text-[13px] text-white/40 transition hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Apps
            </Link>
          )}

          {label && (
            <div className="flex items-center gap-1 text-white/20">
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="text-[13px] font-semibold text-white/80">{label}</span>
            </div>
          )}

          <div className="ml-auto flex items-center gap-3">
            <button className="relative flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-white/40 transition hover:border-white/20 hover:text-white/70">
              <Bell className="h-3.5 w-3.5" />
              <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">2</span>
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#D4AF37]/20 text-[12px] font-bold text-[#D4AF37]">
              {agentProfile.initials}
            </div>
          </div>
        </div>
      </header>

      <main>{children}</main>
    </div>
  )
}
