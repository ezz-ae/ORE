'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowLeft, Bell, ChevronRight, LogOut, Shield } from 'lucide-react'
import { agentProfile } from '@/src/features/freehold-intelligence/agent'
import { getSession, clearSession } from '@/lib/freehold/session'

const APP_LABELS: Record<string, string> = {
  '/freehold-intelligence/agent/leads':     'My Leads',
  '/freehold-intelligence/agent/account':   'Account',
  '/freehold-intelligence/agent/campaigns': 'My Campaigns',
  '/freehold-intelligence/agent/credits':   'Credits',
  '/freehold-intelligence/agent/notebook':  'Inventory',
  '/freehold-intelligence/agent/ai':        'My AI',
}

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const isHome   = pathname === '/freehold-intelligence/agent'
  const label    = APP_LABELS[pathname] ?? ''

  const [name, setName]       = useState(agentProfile.name)
  const [initials, setInitials] = useState(agentProfile.initials)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const s = getSession()
    if (s) {
      setName(s.name)
      setInitials(s.initials)
      setIsAdmin(s.role === 'admin')
    }
  }, [])

  function signOut() {
    clearSession()
    router.replace('/server')
  }

  return (
    <div className="min-h-screen bg-[#0D1117]">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#0D1117]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4 sm:px-6">
          {isHome ? (
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#D4AF37]/25 bg-[#D4AF37]/10">
                <span className="text-xs font-bold text-[#D4AF37]">F</span>
              </div>
              <span className="text-sm font-semibold text-slate-200">Freehold</span>
            </div>
          ) : (
            <Link
              href="/freehold-intelligence/agent"
              className="flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-slate-100"
            >
              <ArrowLeft className="h-4 w-4" /> Apps
            </Link>
          )}

          {label && (
            <div className="flex items-center gap-1.5 text-slate-600">
              <ChevronRight className="h-4 w-4" />
              <span className="text-sm font-semibold text-slate-200">{label}</span>
            </div>
          )}

          <div className="ml-auto flex items-center gap-3">
            {isAdmin && (
              <Link
                href="/management"
                className="hidden items-center gap-1.5 rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-3 py-1.5 text-xs font-medium text-[#D4AF37] transition-colors hover:border-[#D4AF37]/45 sm:flex"
              >
                <Shield className="h-3.5 w-3.5" /> Control panel
              </Link>
            )}
            <button className="relative flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-800/50 text-slate-400 transition-colors hover:border-slate-500 hover:text-slate-200">
              <Bell className="h-4 w-4" />
              <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">2</span>
            </button>
            <button
              onClick={signOut}
              title={`Sign out — ${name}`}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-800/50 text-slate-400 transition-colors hover:border-slate-500 hover:text-slate-200"
            >
              <LogOut className="h-4 w-4" />
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#D4AF37]/20 text-xs font-bold text-[#D4AF37]">
              {initials}
            </div>
          </div>
        </div>
      </header>

      <main>{children}</main>
    </div>
  )
}
