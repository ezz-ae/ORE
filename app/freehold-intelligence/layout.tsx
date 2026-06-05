'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, Zap, TrendingUp, Bot, DollarSign,
  Package, Settings, Globe, Sparkles, Menu, X, Megaphone, ShieldCheck,
} from 'lucide-react'

const BASE = '/freehold-intelligence'

const WORKSPACES = [
  { label: 'Overview',     href: BASE,                    icon: LayoutDashboard, exact: true },
  { label: 'CRM',          href: `${BASE}/crm`,           icon: Users },
  { label: 'Lead Machine', href: `${BASE}/lead-machine`,  icon: Zap },
  { label: 'Ads Live',     href: `${BASE}/ads-live`,      icon: Megaphone },
  { label: 'Analytics',    href: `${BASE}/analytics`,     icon: TrendingUp },
  { label: 'AI Manager',   href: `${BASE}/ai-manager`,    icon: Bot },
  { label: 'Finance',      href: `${BASE}/finance`,       icon: DollarSign },
  { label: 'Inventory',    href: `${BASE}/inventory`,     icon: Package },
]

const UTILITY = [
  { label: 'Integrations', href: `${BASE}/integrations`,    icon: ShieldCheck },
  { label: 'Settings',     href: `${BASE}/settings`,        icon: Settings },
]

export default function FreeholdIntelligenceLayout({ children }: { children: React.ReactNode }) {
  const pathname   = usePathname()
  const [open, setOpen] = useState(false)

  function isActive(ws: typeof WORKSPACES[number]) {
    if (ws.exact) return pathname === ws.href
    return pathname === ws.href || pathname.startsWith(ws.href + '/')
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#0B0F1A] text-[#F7F2E7] antialiased">
      <style>{`
        body > div > header,
        body > div > footer { display: none !important; }
        html { scroll-behavior: smooth; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 2px; }
        .fi-content {
          background:
            radial-gradient(ellipse 90% 40% at 50% 0%, rgba(212,175,55,0.06) 0%, transparent 55%),
            radial-gradient(ellipse 60% 30% at 100% 100%, rgba(212,175,55,0.03) 0%, transparent 50%);
        }
      `}</style>

      {/* ── Command bar ── */}
      <header className="flex h-[56px] shrink-0 items-center border-b border-white/[0.07] px-6 gap-6">

        {/* Brand */}
        <Link
          href={BASE}
          className="flex shrink-0 items-center gap-2.5 text-[15px] font-semibold text-white tracking-tight"
        >
          <Sparkles className="h-[15px] w-[15px] text-[#D4AF37]" />
          <span className="hidden sm:block">Freehold Intelligence</span>
          <span className="sm:hidden">FI</span>
        </Link>

        {/* Workspace tabs — desktop */}
        <nav className="hidden xl:flex flex-1 items-center gap-0.5 overflow-x-auto">
          {WORKSPACES.map((ws) => {
            const active = isActive(ws)
            return (
              <Link
                key={ws.href}
                href={ws.href}
                className={[
                  'px-3.5 py-2 rounded-lg text-[14px] font-medium whitespace-nowrap transition-all',
                  active
                    ? 'bg-white/[0.08] text-white'
                    : 'text-white/45 hover:text-white/75 hover:bg-white/[0.04]',
                ].join(' ')}
              >
                {ws.label}
              </Link>
            )
          })}
        </nav>

        {/* Workspace tabs — large but not xl */}
        <nav className="hidden lg:flex xl:hidden flex-1 items-center gap-0.5 overflow-x-auto">
          {WORKSPACES.slice(0, 6).map((ws) => {
            const active = isActive(ws)
            return (
              <Link
                key={ws.href}
                href={ws.href}
                className={[
                  'px-3 py-2 rounded-lg text-[13px] font-medium whitespace-nowrap transition-all',
                  active
                    ? 'bg-white/[0.08] text-white'
                    : 'text-white/45 hover:text-white/75 hover:bg-white/[0.04]',
                ].join(' ')}
              >
                {ws.label}
              </Link>
            )
          })}
        </nav>

        {/* Right controls */}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <Link
            href="/"
            className="hidden lg:flex items-center gap-1.5 text-[12px] text-white/30 hover:text-white/55 transition"
          >
            <Globe className="h-[13px] w-[13px]" />
            freeholdproperty.ae
          </Link>
          <div className="hidden lg:block w-px h-4 bg-white/[0.08] mx-1" />
          {UTILITY.map((u) => {
            const Icon = u.icon
            const active = pathname.startsWith(u.href)
            return (
              <Link
                key={u.href}
                href={u.href}
                title={u.label}
                className={[
                  'flex h-8 w-8 items-center justify-center rounded-lg transition',
                  active
                    ? 'bg-white/[0.08] text-white/80'
                    : 'text-white/35 hover:text-white/65 hover:bg-white/[0.05]',
                ].join(' ')}
              >
                <Icon className="h-[15px] w-[15px]" />
              </Link>
            )
          })}

          {/* Mobile trigger */}
          <button
            className="lg:hidden flex h-8 w-8 items-center justify-center rounded-lg text-white/50 hover:text-white transition"
            onClick={() => setOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* ── Mobile workspace drawer ── */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-[300px] bg-[#0B0F1A] border-r border-white/[0.07] flex flex-col">
            <div className="flex h-[56px] shrink-0 items-center justify-between border-b border-white/[0.07] px-5">
              <div className="flex items-center gap-2 text-[15px] font-semibold text-white">
                <Sparkles className="h-4 w-4 text-[#D4AF37]" />
                Workspaces
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-white/40 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
              {WORKSPACES.map((ws) => {
                const Icon = ws.icon
                const active = isActive(ws)
                return (
                  <Link
                    key={ws.href}
                    href={ws.href}
                    onClick={() => setOpen(false)}
                    className={[
                      'flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-[15px] font-medium transition',
                      active
                        ? 'bg-white/[0.08] text-white'
                        : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]',
                    ].join(' ')}
                  >
                    <Icon className={`h-[17px] w-[17px] ${active ? 'text-[#D4AF37]' : 'opacity-50'}`} />
                    {ws.label}
                  </Link>
                )
              })}
              <div className="pt-3 mt-3 border-t border-white/[0.08] space-y-1">
                {UTILITY.map((u) => {
                  const Icon = u.icon
                  return (
                    <Link
                      key={u.href}
                      href={u.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3.5 px-4 py-3 rounded-xl text-[14px] font-medium text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition"
                    >
                      <Icon className="h-4 w-4 opacity-60" />
                      {u.label}
                    </Link>
                  )
                })}
              </div>
            </nav>
            <div className="border-t border-white/[0.07] px-5 py-4">
              <Link href="/" className="flex items-center gap-2 text-[13px] text-white/30 hover:text-white/55 transition">
                <Globe className="h-3.5 w-3.5" />
                freeholdproperty.ae
              </Link>
            </div>
          </aside>
        </div>
      )}

      {/* ── Workspace content ── */}
      <main className="fi-content flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
