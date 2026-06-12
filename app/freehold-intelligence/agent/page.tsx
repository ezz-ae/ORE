'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  Users, Wallet, Megaphone, BookOpen, Sparkles,
  Settings, ChevronRight, Coins,
} from 'lucide-react'
import { useSession } from '@/lib/freehold/use-session'

const ACCENT: Record<string, { icon: string; card: string; badge: string }> = {
  red:    { icon: 'text-red-400',      card: 'border-red-400/20 hover:border-red-400/35',     badge: 'bg-red-500'       },
  sky:    { icon: 'text-sky-400',      card: 'border-sky-400/15 hover:border-sky-400/30',     badge: 'bg-sky-500'       },
  gold:   { icon: 'text-[#D4AF37]',   card: 'border-[#D4AF37]/20 hover:border-[#D4AF37]/35', badge: 'bg-[#D4AF37]'     },
  blue:   { icon: 'text-blue-400',     card: 'border-blue-400/15 hover:border-blue-400/30',   badge: 'bg-blue-500'      },
  violet: { icon: 'text-violet-400',   card: 'border-violet-400/15 hover:border-violet-400/30',badge: 'bg-violet-500'   },
  gray:   { icon: 'text-slate-400',    card: 'border-slate-700 hover:border-slate-500',        badge: 'bg-slate-500'     },
}


export default function AgentHomePage() {
  const { user } = useSession()
  const now = new Date().toLocaleDateString('en-AE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Dubai' })

  const [liveCritical, setLiveCritical] = useState<number | null>(null)
  const [liveActive,   setLiveActive]   = useState<number | null>(null)
  const [liveBalance,  setLiveBalance]  = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/freehold/crm/leads')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.leads) {
          setLiveCritical(d.leads.filter((l: any) => l.urgency === 'critical').length)
          setLiveActive(d.leads.filter((l: any) => l.pipelineStage !== 'closed' && l.pipelineStage !== 'lost').length)
        }
      })
      .catch(() => {})
    fetch('/api/freehold/credits/balance')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.balance?.balance != null) setLiveBalance(d.balance.balance) })
      .catch(() => {})
  }, [])

  const displayCritical = liveCritical ?? 0
  const displayActive   = liveActive   ?? 0
  const displayBalance  = liveBalance  ?? 0

  const APPS = useMemo(() => [
    {
      id:      'leads',
      label:   'My Leads',
      Icon:    Users,
      href:    '/freehold-intelligence/agent/leads',
      metric:  `${displayCritical > 0 ? `${displayCritical} critical · ` : ''}${displayActive} active`,
      badge:   displayCritical,
      accent:  displayCritical > 0 ? 'red' : 'sky',
      sub:     'Pipeline',
    },
    {
      id:      'account',
      label:   'Account',
      Icon:    Wallet,
      href:    '/freehold-intelligence/agent/account',
      metric:  'Wallet & commissions',
      badge:   0,
      accent:  'gold',
      sub:     'Wallet & Profile',
    },
    {
      id:      'campaigns',
      label:   'Campaigns',
      Icon:    Megaphone,
      href:    '/freehold-intelligence/agent/campaigns',
      metric:  'Ad performance',
      badge:   0,
      accent:  'blue',
      sub:     'Ads & Spend',
    },
    {
      id:      'credits',
      label:   'Credits',
      Icon:    Coins,
      href:    '/freehold-intelligence/agent/credits',
      metric:  displayBalance > 0 ? `${displayBalance.toLocaleString()} credits left` : 'Credit balance',
      badge:   0,
      accent:  'gold',
      sub:     'Ad Budget',
    },
    {
      id:      'inventory',
      label:   'Inventory',
      Icon:    BookOpen,
      href:    '/freehold-intelligence/agent/notebook',
      metric:  'Property & project data',
      badge:   0,
      accent:  'violet',
      sub:     'Research',
    },
    {
      id:      'ai',
      label:   'AI Assistant',
      Icon:    Sparkles,
      href:    '/freehold-intelligence/agent/ai',
      metric:  'Freehold Intelligence',
      badge:   0,
      accent:  'gold',
      sub:     'Powered by AI',
    },
    {
      id:      'settings',
      label:   'Settings',
      Icon:    Settings,
      href:    '/freehold-intelligence/agent',
      metric:  'Account preferences',
      badge:   0,
      accent:  'gray',
      sub:     'Preferences',
    },
  ], [displayCritical, displayActive, displayBalance])

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 pt-6 sm:px-6 sm:pt-8">

      {/* Greeting */}
      <section>
        <div className="text-sm text-slate-500">{now}</div>
        <h1 className="mt-2 text-[28px] font-semibold tracking-tight text-slate-100">
          Good morning, {(user?.name ?? '').split(' ')[0] || 'there'}.
        </h1>

      </section>

      {/* Today's Priority — only shown when there are real critical leads */}
      {displayCritical > 0 && (
        <section className="mt-8">
          <div className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Today's focus</div>
          <div className="space-y-2">
            <Link
              href="/freehold-intelligence/agent/leads"
              className="group flex items-center gap-4 rounded-[18px] border border-red-400/15 bg-red-400/[0.03] px-5 py-4 transition hover:border-red-400/25"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-red-400/10">
                <span className="text-[16px]">⚡</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-white">{displayCritical} critical lead{displayCritical !== 1 ? 's' : ''} need immediate action</div>
                <div className="mt-0.5 text-xs text-slate-400">Response delay detected — act before competitor contact</div>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-red-400">
                Leads <ChevronRight className="h-3.5 w-3.5" />
              </div>
            </Link>
          </div>
        </section>
      )}

      {/* App Grid */}
      <section className="mt-10">
        <div className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">My apps</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {APPS.map((app) => {
            const a = ACCENT[app.accent]
            return (
              <Link
                key={app.id}
                href={app.href}
                className={`group relative flex flex-col rounded-xl border bg-slate-900 p-5 transition ${a.card}`}
              >
                {app.badge > 0 && (
                  <span className={`absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white ${a.badge}`}>
                    {app.badge}
                  </span>
                )}
                <div className={`flex h-10 w-10 items-center justify-center rounded-[14px] border border-slate-800 bg-slate-800/50 ${a.icon}`}>
                  <app.Icon className="h-5 w-5" />
                </div>
                <div className="mt-4">
                  <div className="text-[14px] font-semibold text-white group-hover:text-white">{app.label}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{app.sub}</div>
                </div>
                <div className={`mt-3 text-xs font-medium ${a.icon} opacity-80`}>{app.metric}</div>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Switch to manager view */}
      <div className="mt-8 flex justify-center">
        <Link
          href="/freehold-intelligence"
          className="text-xs text-slate-600 transition hover:text-slate-400"
        >
          Switch to manager view →
        </Link>
      </div>

    </div>
  )
}
