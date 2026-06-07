'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard, Activity, Users, Megaphone, DollarSign,
  Briefcase, Building2, TrendingUp, FileBarChart2, Bot,
  LogOut, Shield, ChevronRight, Menu, X, Coins, ArrowLeft,
} from 'lucide-react'
import { clearSession } from '@/lib/freehold/session'
import { useSessionGuard } from '@/lib/freehold/use-session'
import { ROLE_LABELS } from '@/lib/freehold/session-types'

const BASE = '/freehold-intelligence/management'

const NAV = [
  { href: BASE,                   label: 'Dashboard',  icon: LayoutDashboard, exact: true },
  { href: `${BASE}/events`,       label: 'Events Log', icon: Activity },
  { href: `${BASE}/team`,         label: 'Team',       icon: Users },
  { href: `${BASE}/marketing`,    label: 'Marketing',  icon: Megaphone },
  { href: `${BASE}/finance`,      label: 'Finance',    icon: DollarSign },
  { href: `${BASE}/credits`,      label: 'Credits',    icon: Coins },
  { href: `${BASE}/deals`,        label: 'Deals',      icon: Briefcase },
  { href: `${BASE}/inventory`,    label: 'Inventory',  icon: Building2 },
  { href: `${BASE}/roi`,          label: 'ROI',        icon: TrendingUp },
  { href: `${BASE}/reports`,      label: 'Reports',    icon: FileBarChart2 },
  { href: `${BASE}/ai`,           label: 'AI Chat',    icon: Bot },
]

export default function ManagementLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const { ready, user } = useSessionGuard(['admin', 'ceo', 'director'])
  const [mobileOpen, setMobileOpen] = useState(false)

  function isActive(item: typeof NAV[0]) {
    return item.exact ? pathname === item.href : pathname.startsWith(item.href)
  }

  async function handleLogout() {
    await clearSession()
    router.replace('/server')
  }

  if (!ready) return (
    <div className="flex min-h-screen items-center justify-center bg-[#0D1117]">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-700 border-t-[#D4AF37]" />
    </div>
  )

  const Sidebar = ({ onClose }: { onClose?: () => void }) => (
    <div className="flex h-full flex-col">
      {/* Identity */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-800 px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#D4AF37]/25 bg-[#D4AF37]/10">
          <Shield className="h-3.5 w-3.5 text-[#D4AF37]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="truncate text-sm font-semibold text-white">{user?.name ?? 'Freehold'}</div>
          <div className="text-xs text-[#D4AF37]">{user?.role ? ROLE_LABELS[user.role] : 'Management'}</div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {/* Back to hub */}
        <Link
          href="/freehold-intelligence"
          onClick={() => onClose?.()}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-800/60 hover:text-slate-300 mb-1"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          All Apps
        </Link>
        <div className="mb-3 border-t border-slate-800/60" />

        {NAV.map(item => {
          const active = isActive(item)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => onClose?.()}
              className={[
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-slate-700/60 text-white'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100',
              ].join(' ')}
            >
              <item.icon className={['h-4 w-4 shrink-0', active ? 'text-[#D4AF37]' : 'text-slate-500'].join(' ')} />
              {item.label}
              {active && <ChevronRight className="ml-auto h-3.5 w-3.5 text-slate-600" />}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-slate-800 px-3 py-4">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-800/60 hover:text-slate-300"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-[#0D1117]">
      <style>{`
        body > div > header,
        body > div > footer { display: none !important; }
      `}</style>
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-60 border-r border-slate-800 bg-[#090C12] lg:block">
        <Sidebar />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-slate-800 bg-[#090C12]">
            <Sidebar onClose={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <header className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-slate-800 bg-[#090C12]/95 px-4 backdrop-blur-xl lg:hidden">
        <button onClick={() => setMobileOpen(true)} className="text-slate-400 hover:text-slate-200">
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md border border-[#D4AF37]/25 bg-[#D4AF37]/10">
            <Shield className="h-3 w-3 text-[#D4AF37]" />
          </div>
          <span className="text-sm font-semibold text-white">
            {user?.name ?? 'Freehold'} <span className="text-[#D4AF37]">{user?.role ? ROLE_LABELS[user.role] : 'Management'}</span>
          </span>
        </div>
      </header>

      <div className="flex-1 lg:ml-60 pt-14 lg:pt-0">
        {children}
      </div>
    </div>
  )
}
