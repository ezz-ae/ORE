'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import {
  X,
  Sparkles,
  Inbox,
  Users,
  Zap,
  BookOpen,
  Flag,
  ShieldCheck,
  Lock,
  Settings,
  CheckSquare,
  type LucideIcon,
} from 'lucide-react'

type AppEntry = {
  href: string
  label: string
  blurb: string
  icon: LucideIcon
  tint: string
}

const operate: AppEntry[] = [
  { href: '/freehold-intelligence/lead-machine', label: 'Lead Machine', blurb: 'Listings, landings, ads, approvals.', icon: Zap,        tint: 'from-[#D4AF37]/30 to-transparent' },
  { href: '/freehold-intelligence/crm',          label: 'CRM',          blurb: 'Refined leads, intent, signals.',  icon: Users,      tint: 'from-emerald-500/25 to-transparent' },
  { href: '/freehold-intelligence/notebook',     label: 'Notebook',     blurb: 'AI briefs, drafts, exports.',      icon: BookOpen,   tint: 'from-sky-500/25 to-transparent' },
  { href: '/freehold-intelligence/review-requests', label: 'Reviews',   blurb: 'Approvals and review queue.',      icon: CheckSquare,tint: 'from-orange-500/25 to-transparent' },
]

const govern: AppEntry[] = [
  { href: '/freehold-intelligence/integrations',  label: 'Integrations', blurb: 'CRM, ads, messaging, tracking.', icon: Inbox,       tint: 'from-violet-500/25 to-transparent' },
  { href: '/freehold-intelligence/milestones',    label: 'Milestones',   blurb: 'Delivery plan and health.',      icon: Flag,        tint: 'from-rose-500/25 to-transparent' },
  { href: '/freehold-intelligence/server-status', label: 'Server',       blurb: 'Infra, data, deploy health.',    icon: ShieldCheck, tint: 'from-cyan-500/25 to-transparent' },
  { href: '/freehold-intelligence/security',      label: 'Security',     blurb: 'Roles, access, audit trail.',    icon: Lock,        tint: 'from-red-500/25 to-transparent' },
  { href: '/freehold-intelligence/settings',      label: 'Settings',     blurb: 'Workspace preferences.',         icon: Settings,    tint: 'from-white/15 to-transparent' },
]

function Tile({ entry, onClose }: { entry: AppEntry; onClose: () => void }) {
  const Icon = entry.icon
  return (
    <Link
      href={entry.href}
      onClick={onClose}
      className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-800 bg-[#0A0D10] p-5 transition hover:border-[#D4AF37]/30 hover:bg-[#0E1216]"
    >
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${entry.tint} opacity-60 transition group-hover:opacity-90`} />
      <div className="relative">
        <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-slate-800/40 backdrop-blur">
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
      <div className="relative mt-10">
        <div className="text-base font-semibold tracking-tight text-white">{entry.label}</div>
        <div className="mt-1 text-sm leading-snug text-slate-400">{entry.blurb}</div>
      </div>
    </Link>
  )
}

export function AppSwitcher({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[110] overflow-y-auto bg-slate-900/85 backdrop-blur-2xl">
      <div className="mx-auto max-w-5xl px-6 pb-24 pt-16 sm:pt-20">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-[#D4AF37]/90">
              <Sparkles className="h-3.5 w-3.5" /> Freehold Intelligence
            </div>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">Where do you want to go?</h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-400">
              Pick a surface. The AI follows you between them and keeps state.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-slate-800/40 text-slate-300 transition hover:border-white/25 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <section className="mt-12">
          <div className="mb-4 text-xs font-medium uppercase tracking-[0.22em] text-slate-500">Operate</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {operate.map((entry) => <Tile key={entry.href} entry={entry} onClose={onClose} />)}
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-4 text-xs font-medium uppercase tracking-[0.22em] text-slate-500">Govern</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {govern.map((entry) => <Tile key={entry.href} entry={entry} onClose={onClose} />)}
          </div>
        </section>
      </div>
    </div>
  )
}
