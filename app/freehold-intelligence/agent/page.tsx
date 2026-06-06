'use client'

import Link from 'next/link'
import {
  Users, Wallet, Megaphone, BookOpen, Sparkles,
  Settings, ChevronRight, TrendingUp, Clock, Zap,
} from 'lucide-react'
import { agentProfile, agentPipelineLeads, agentWallet, agentLeadPool } from '@/src/features/freehold-intelligence/agent'

const criticalLeads   = agentPipelineLeads.filter((l) => l.urgency === 'critical').length
const activeLeads     = agentPipelineLeads.filter((l) => l.pipelineStage !== 'closed' && l.pipelineStage !== 'lost').length
const walletPending   = agentWallet.filter((w) => w.status !== 'paid' && w.amount > 0).reduce((s, w) => s + w.amount, 0)
const poolRemaining   = agentLeadPool.monthlyQuota - agentLeadPool.used
const offerLead       = agentPipelineLeads.find((l) => l.pipelineStage === 'offer')
const viewingLead     = agentPipelineLeads.find((l) => l.hasViewingScheduled)

const APPS = [
  {
    id:      'leads',
    label:   'My Leads',
    Icon:    Users,
    href:    '/freehold-intelligence/agent/leads',
    metric:  `${criticalLeads > 0 ? `${criticalLeads} critical · ` : ''}${activeLeads} active`,
    badge:   criticalLeads,
    accent:  criticalLeads > 0 ? 'red' : 'sky',
    sub:     'Pipeline',
  },
  {
    id:      'account',
    label:   'Account',
    Icon:    Wallet,
    href:    '/freehold-intelligence/agent/account',
    metric:  `AED ${(walletPending / 1000).toFixed(0)}K pending · ${agentProfile.tier}`,
    badge:   0,
    accent:  'gold',
    sub:     'Wallet & Profile',
  },
  {
    id:      'campaigns',
    label:   'Campaigns',
    Icon:    Megaphone,
    href:    '/freehold-intelligence/agent/campaigns',
    metric:  `AED ${agentProfile.adSpendOnLeads.toLocaleString()} this month`,
    badge:   0,
    accent:  'blue',
    sub:     'Ads & Spend',
  },
  {
    id:      'notebook',
    label:   'Inventory',
    Icon:    BookOpen,
    href:    '/freehold-intelligence/agent/notebook',
    metric:  '3 project notes · 6 sources',
    badge:   0,
    accent:  'violet',
    sub:     'NotebookLM',
  },
  {
    id:      'ai',
    label:   'My AI',
    Icon:    Sparkles,
    href:    '/freehold-intelligence/agent/ai',
    metric:  '7 connections active',
    badge:   0,
    accent:  'gold',
    sub:     'Agent Builder',
  },
  {
    id:      'settings',
    label:   'Settings',
    Icon:    Settings,
    href:    '/freehold-intelligence/agent',
    metric:  `Lead pool: ${poolRemaining} of ${agentLeadPool.monthlyQuota} left`,
    badge:   0,
    accent:  'gray',
    sub:     'Preferences',
  },
]

const ACCENT: Record<string, { icon: string; card: string; badge: string }> = {
  red:    { icon: 'text-red-400',      card: 'border-red-400/20 hover:border-red-400/35',     badge: 'bg-red-500'       },
  sky:    { icon: 'text-sky-400',      card: 'border-sky-400/15 hover:border-sky-400/30',     badge: 'bg-sky-500'       },
  gold:   { icon: 'text-[#D4AF37]',   card: 'border-[#D4AF37]/20 hover:border-[#D4AF37]/35', badge: 'bg-[#D4AF37]'     },
  blue:   { icon: 'text-blue-400',     card: 'border-blue-400/15 hover:border-blue-400/30',   badge: 'bg-blue-500'      },
  violet: { icon: 'text-violet-400',   card: 'border-violet-400/15 hover:border-violet-400/30',badge: 'bg-violet-500'   },
  gray:   { icon: 'text-white/35',     card: 'border-white/[0.08] hover:border-white/20',     badge: 'bg-white/30'      },
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const h = diff / 3_600_000
  if (h < 1)  return `${Math.round(h * 60)}m ago`
  if (h < 24) return `${Math.round(h)}h ago`
  return `${Math.round(h / 24)}d ago`
}

export default function AgentHomePage() {
  const now = new Date().toLocaleDateString('en-AE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Dubai' })

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 pt-6 sm:px-6 sm:pt-8">

      {/* Greeting */}
      <section>
        <div className="text-[13px] text-white/35">{now}</div>
        <h1 className="mt-2 text-[28px] font-semibold tracking-tight text-white/90">
          Good morning, {agentProfile.name.split(' ')[0]}.
        </h1>

        {/* Quick stats */}
        <div className="mt-5 flex flex-wrap gap-3">
          {[
            { Icon: TrendingUp, label: `AED ${(agentProfile.revMTD / 1_000_000).toFixed(1)}M MTD`, color: 'text-emerald-400' },
            { Icon: Clock,      label: `${agentProfile.avgResponseH}h avg response`,                color: 'text-[#D4AF37]'   },
            { Icon: Users,      label: `${agentProfile.leadToViewingPct}% viewing rate`,           color: 'text-sky-400'     },
            { Icon: Zap,        label: `${agentProfile.wins} wins this month`,                      color: 'text-[#D4AF37]'   },
          ].map(({ Icon, label, color }) => (
            <div key={label} className={`flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[12px] font-medium ${color}`}>
              <Icon className="h-3 w-3" />
              {label}
            </div>
          ))}
        </div>
      </section>

      {/* Today's Priority */}
      {(offerLead || viewingLead || criticalLeads > 0) && (
        <section className="mt-8">
          <div className="mb-3 text-[12px] font-medium uppercase tracking-[0.18em] text-white/30">Today's focus</div>
          <div className="space-y-2">
            {offerLead && (
              <Link
                href="/freehold-intelligence/agent/leads"
                className="group flex items-center gap-4 rounded-[18px] border border-[#D4AF37]/20 bg-[#D4AF37]/[0.04] px-5 py-4 transition hover:border-[#D4AF37]/35"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[#D4AF37]/15">
                  <span className="text-[16px]">🔥</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-white">{offerLead.name} — {offerLead.property}</div>
                  <div className="mt-0.5 text-[12px] text-white/45">{offerLead.note}</div>
                </div>
                <div className="flex items-center gap-1.5 text-[12px] font-medium text-[#D4AF37]">
                  Offer <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            )}
            {viewingLead && (
              <Link
                href="/freehold-intelligence/agent/leads"
                className="group flex items-center gap-4 rounded-[18px] border border-orange-400/20 bg-orange-400/[0.04] px-5 py-4 transition hover:border-orange-400/35"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-orange-400/10">
                  <span className="text-[16px]">📅</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-white">{viewingLead.name} — Viewing June 8</div>
                  <div className="mt-0.5 text-[12px] text-white/45">{viewingLead.property} · Confirm details + pre-arrival pack</div>
                </div>
                <div className="flex items-center gap-1.5 text-[12px] font-medium text-orange-400">
                  Viewing <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            )}
            {criticalLeads > 0 && (
              <Link
                href="/freehold-intelligence/agent/leads"
                className="group flex items-center gap-4 rounded-[18px] border border-red-400/15 bg-red-400/[0.03] px-5 py-4 transition hover:border-red-400/25"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-red-400/10">
                  <span className="text-[16px]">⚡</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-white">{criticalLeads} critical lead{criticalLeads !== 1 ? 's' : ''} need immediate action</div>
                  <div className="mt-0.5 text-[12px] text-white/45">Response delay detected — act before competitor contact</div>
                </div>
                <div className="flex items-center gap-1.5 text-[12px] font-medium text-red-400">
                  Leads <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            )}
          </div>
        </section>
      )}

      {/* App Grid */}
      <section className="mt-10">
        <div className="mb-4 text-[12px] font-medium uppercase tracking-[0.18em] text-white/30">My apps</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {APPS.map((app) => {
            const a = ACCENT[app.accent]
            return (
              <Link
                key={app.id}
                href={app.href}
                className={`group relative flex flex-col rounded-[22px] border bg-[#131B2B] p-5 transition ${a.card}`}
              >
                {app.badge > 0 && (
                  <span className={`absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-white ${a.badge}`}>
                    {app.badge}
                  </span>
                )}
                <div className={`flex h-10 w-10 items-center justify-center rounded-[14px] border border-white/[0.08] bg-white/[0.04] ${a.icon}`}>
                  <app.Icon className="h-5 w-5" />
                </div>
                <div className="mt-4">
                  <div className="text-[14px] font-semibold text-white group-hover:text-white/90">{app.label}</div>
                  <div className="mt-0.5 text-[11px] text-white/30">{app.sub}</div>
                </div>
                <div className={`mt-3 text-[12px] font-medium ${a.icon} opacity-80`}>{app.metric}</div>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Lead pool bar */}
      <section className="mt-8">
        <div className="rounded-[18px] border border-white/[0.08] bg-[#131B2B] p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[12px] font-medium text-white/35 uppercase tracking-[0.15em]">Lead Pool — {agentLeadPool.tier} Tier</div>
              <div className="mt-0.5 text-[13px] text-white/70">{agentLeadPool.used} used of {agentLeadPool.monthlyQuota} this month</div>
            </div>
            <div className="text-right">
              <div className="text-[22px] font-semibold text-[#D4AF37] tabular-nums">{poolRemaining}</div>
              <div className="text-[11px] text-white/30">remaining</div>
            </div>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-[#D4AF37] transition-all"
              style={{ width: `${(agentLeadPool.used / agentLeadPool.monthlyQuota) * 100}%` }}
            />
          </div>
          <div className="mt-1.5 text-[11px] text-white/25">Resets {new Date(agentLeadPool.resetAt).toLocaleDateString('en-AE', { day: 'numeric', month: 'long' })}</div>
        </div>
      </section>

      {/* Switch to manager view */}
      <div className="mt-8 flex justify-center">
        <Link
          href="/freehold-intelligence"
          className="text-[12px] text-white/20 transition hover:text-white/40"
        >
          Switch to manager view →
        </Link>
      </div>

    </div>
  )
}
