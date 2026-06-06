'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { integrationSyncStatuses } from '@/src/features/freehold-intelligence/server-session'

const SPACES = [
  { label: 'Home',         href: '/freehold-intelligence',              match: (p: string) => p === '/freehold-intelligence' },
  { label: 'Lead Machine', href: '/freehold-intelligence/lead-machine', match: (p: string) => p.startsWith('/freehold-intelligence/lead-machine') },
  { label: 'CRM',          href: '/freehold-intelligence/crm',          match: (p: string) => p.startsWith('/freehold-intelligence/crm') },
  { label: 'Inventory',    href: '/freehold-intelligence/inventory',    match: (p: string) => p.startsWith('/freehold-intelligence/inventory') },
  { label: 'Notebook',     href: '/freehold-intelligence/notebook',     match: (p: string) => p.startsWith('/freehold-intelligence/notebook') },
  { label: 'Analytics',    href: '/freehold-intelligence/analytics',    match: (p: string) => p.startsWith('/freehold-intelligence/analytics') },
  { label: 'Integrations', href: '/freehold-intelligence/integrations', match: (p: string) => p.startsWith('/freehold-intelligence/integrations') },
  { label: 'Settings',     href: '/freehold-intelligence/settings',     match: (p: string) => p.startsWith('/freehold-intelligence/settings') },
]

function syncDotClass(status: string) {
  if (status === 'synced')  return 'bg-emerald-400'
  if (status === 'syncing') return 'bg-amber-400 animate-pulse'
  if (status === 'error')   return 'bg-red-400'
  return 'bg-white/[0.18]'
}

export function SpacesNav() {
  const pathname = usePathname()
  const errorCount   = integrationSyncStatuses.filter(s => s.status === 'error').length
  const syncedCount  = integrationSyncStatuses.filter(s => s.status === 'synced').length

  return (
    <div className="flex h-11 shrink-0 items-center border-b border-white/[0.06] bg-[#080C14]/95 backdrop-blur-xl">

      {/* Brand mark */}
      <Link
        href="/freehold-intelligence"
        className="flex h-full shrink-0 items-center gap-2 border-r border-white/[0.06] px-4 transition hover:bg-white/[0.03]"
      >
        <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" />
        <span className="hidden text-[12px] font-semibold tracking-tight text-white/55 sm:block">FI</span>
      </Link>

      {/* Spaces tabs */}
      <nav className="flex h-full flex-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        <div className="flex h-full min-w-max">
          {SPACES.map(space => {
            const active = space.match(pathname)
            return (
              <Link
                key={space.href}
                href={space.href}
                className={[
                  'flex h-full items-center border-b-2 px-3.5 text-[12px] font-medium whitespace-nowrap transition',
                  active
                    ? 'border-[#D4AF37] text-white'
                    : 'border-transparent text-white/30 hover:border-white/[0.10] hover:text-white/60',
                ].join(' ')}
              >
                {space.label}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Background sync status */}
      <div className="flex h-full shrink-0 items-center gap-2.5 border-l border-white/[0.06] px-3.5">
        <div className="flex items-center gap-1">
          {integrationSyncStatuses.map(s => (
            <span
              key={s.id}
              title={`${s.name}: ${s.status}${s.lastSyncAt ? ` · ${new Date(s.lastSyncAt).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })}` : ''}`}
              className={`h-[6px] w-[6px] rounded-full ${syncDotClass(s.status)}`}
            />
          ))}
        </div>
        <span className="hidden text-[11px] text-white/25 whitespace-nowrap md:block">
          {errorCount > 0
            ? <span className="text-red-400/80">{errorCount} error</span>
            : `${syncedCount} synced`}
        </span>
      </div>

    </div>
  )
}
