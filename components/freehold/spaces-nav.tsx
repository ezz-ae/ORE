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
  return 'bg-slate-600'
}

export function SpacesNav() {
  const pathname = usePathname()
  const errorCount  = integrationSyncStatuses.filter(s => s.status === 'error').length
  const syncedCount = integrationSyncStatuses.filter(s => s.status === 'synced').length

  return (
    <div className="flex h-14 shrink-0 items-center border-b border-slate-800 bg-[#090D16] backdrop-blur-xl">

      {/* Brand */}
      <Link
        href="/freehold-intelligence"
        className="flex h-full shrink-0 items-center gap-2.5 border-r border-slate-800 px-5 transition hover:bg-slate-800/40"
      >
        <Sparkles className="h-4 w-4 text-[#D4AF37]" />
        <span className="hidden text-sm font-semibold tracking-tight text-white sm:block">
          Freehold
          <span className="ml-1 text-[#D4AF37]">Intelligence</span>
        </span>
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
                  'flex h-full items-center border-b-2 px-4 text-sm font-medium whitespace-nowrap transition-colors',
                  active
                    ? 'border-[#D4AF37] text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-100 hover:border-slate-600',
                ].join(' ')}
              >
                {space.label}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Sync status */}
      <div className="flex h-full shrink-0 items-center gap-3 border-l border-slate-800 px-4">
        <div className="flex items-center gap-1.5">
          {integrationSyncStatuses.map(s => (
            <span
              key={s.id}
              title={`${s.name}: ${s.status}${s.lastSyncAt ? ` · ${new Date(s.lastSyncAt).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })}` : ''}`}
              className={`h-1.5 w-1.5 rounded-full ${syncDotClass(s.status)}`}
            />
          ))}
        </div>
        <span className="hidden text-xs text-slate-500 whitespace-nowrap md:block">
          {errorCount > 0
            ? <span className="text-red-400">{errorCount} error</span>
            : `${syncedCount} synced`}
        </span>
      </div>

    </div>
  )
}
