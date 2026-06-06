'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Users, Zap, Megaphone, TrendingUp, Bot, DollarSign, Package,
  ShieldCheck, Settings, AlertCircle, CheckCircle2, Activity,
  ArrowUpRight, X, Sparkles, Globe, ChevronRight,
} from 'lucide-react'
import { inventoryProperties, getInventoryStats } from '@/src/features/freehold-intelligence/inventory'

const stats = getInventoryStats()
const totalVisitors = inventoryProperties.reduce((s, p) => s + p.views30d, 0)
const avgDataQuality = Math.round(inventoryProperties.reduce((s, p) => s + p.dataQuality, 0) / inventoryProperties.length)

const APPS = [
  {
    id:     'crm',
    label:  'CRM',
    sub:    'Leads · Agents · Pipeline',
    href:   '/freehold-intelligence/crm',
    Icon:   Users,
    metric: '415 leads · 12 urgent',
    badge:  12,
    accent: '#D4AF37',
    card:   'border-[#D4AF37]/15 hover:border-[#D4AF37]/35',
    icon:   'text-[#D4AF37] bg-[#D4AF37]/10 border-[#D4AF37]/20',
  },
  {
    id:     'lead-machine',
    label:  'Lead Machine',
    sub:    'Campaigns · Ads · Attribution',
    href:   '/freehold-intelligence/lead-machine',
    Icon:   Zap,
    metric: '6 campaigns · AED 31K/mo',
    badge:  0,
    accent: '#60A5FA',
    card:   'border-blue-400/15 hover:border-blue-400/30',
    icon:   'text-blue-400 bg-blue-400/10 border-blue-400/20',
  },
  {
    id:     'ads-live',
    label:  'Ads Live',
    sub:    'Meta · Google · Live preview',
    href:   '/freehold-intelligence/ads-live',
    Icon:   Megaphone,
    metric: '3 platforms · 6 live ads',
    badge:  0,
    accent: '#F472B6',
    card:   'border-pink-400/15 hover:border-pink-400/30',
    icon:   'text-pink-400 bg-pink-400/10 border-pink-400/20',
  },
  {
    id:     'finance',
    label:  'Finance',
    sub:    'Invoices · Payments · Agent Credits',
    href:   '/freehold-intelligence/finance',
    Icon:   DollarSign,
    metric: 'AED 31.3K · 73% budget',
    badge:  1,
    accent: '#34D399',
    card:   'border-emerald-400/15 hover:border-emerald-400/30',
    icon:   'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  },
  {
    id:     'analytics',
    label:  'Analytics',
    sub:    'Traffic · Conversions · Pages',
    href:   '/freehold-intelligence/analytics',
    Icon:   TrendingUp,
    metric: `${(totalVisitors / 1000).toFixed(1)}K visitors · 30d`,
    badge:  0,
    accent: '#A78BFA',
    card:   'border-violet-400/15 hover:border-violet-400/30',
    icon:   'text-violet-400 bg-violet-400/10 border-violet-400/20',
  },
  {
    id:     'ai-manager',
    label:  'AI Manager',
    sub:    'Data quality · SEO · Auto-content',
    href:   '/freehold-intelligence/ai-manager',
    Icon:   Bot,
    metric: `Data quality ${avgDataQuality} · ${stats.total} listings`,
    badge:  avgDataQuality < 70 ? 1 : 0,
    accent: '#38BDF8',
    card:   'border-sky-400/15 hover:border-sky-400/30',
    icon:   'text-sky-400 bg-sky-400/10 border-sky-400/20',
  },
  {
    id:     'inventory',
    label:  'Inventory',
    sub:    'Properties · Projects · Off-plan',
    href:   '/freehold-intelligence/inventory',
    Icon:   Package,
    metric: `${stats.total} properties · ${stats.missingLanding} missing`,
    badge:  stats.missingLanding,
    accent: '#FBBF24',
    card:   'border-amber-400/15 hover:border-amber-400/30',
    icon:   'text-amber-400 bg-amber-400/10 border-amber-400/20',
  },
  {
    id:     'integrations',
    label:  'Integrations',
    sub:    'Meta · Google · HubSpot · Zapier',
    href:   '/freehold-intelligence/integrations',
    Icon:   ShieldCheck,
    metric: '8 connected · 2 pending',
    badge:  0,
    accent: 'rgba(255,255,255,0.4)',
    card:   'border-white/[0.07] hover:border-white/[0.15]',
    icon:   'text-white/50 bg-white/[0.05] border-white/[0.08]',
  },
  {
    id:     'settings',
    label:  'Settings',
    sub:    'Team · Roles · Billing',
    href:   '/freehold-intelligence/settings',
    Icon:   Settings,
    metric: '3 users active',
    badge:  0,
    accent: 'rgba(255,255,255,0.4)',
    card:   'border-white/[0.07] hover:border-white/[0.15]',
    icon:   'text-white/50 bg-white/[0.05] border-white/[0.08]',
  },
]

const ACTIVITY = [
  { time: '09:14',     label: 'New lead',          detail: 'Palm Jumeirah — Meta Ads',        type: 'lead'    },
  { time: '08:52',     label: 'Campaign paused',    detail: 'Off Plan Dubai 2025 — Google',    type: 'warning' },
  { time: '08:30',     label: 'Landing published',  detail: 'JVC Investor · /lp/jvc-investor', type: 'success' },
  { time: 'Yesterday', label: '88 leads',           detail: 'Dubai Hills Yield — 24h',         type: 'lead'    },
  { time: 'Yesterday', label: 'Invoice issued',     detail: 'INV-META-0526 · AED 18,420',      type: 'info'    },
]

export default function IntelligenceLauncher() {
  const lowAdReadiness  = inventoryProperties.filter((p) => p.adReadiness < 40)
  const missingLandings = inventoryProperties.filter((p) => p.landingStatus === 'missing')
  const noImages        = inventoryProperties.filter((p) => !p.hasImages)

  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const priorities = [
    ...missingLandings.filter((p) => !dismissed.has(p.id)).map((p) => ({
      id: p.id, name: p.name,
      note: `No landing page${p.linkedCampaigns > 0 ? ` — ${p.linkedCampaigns} campaign(s) paused` : ''}`,
      sev: 'red' as const, href: '/freehold-intelligence/inventory',
    })),
    ...lowAdReadiness.filter((p) => !dismissed.has(p.id)).map((p) => ({
      id: p.id, name: p.name,
      note: `Ad readiness ${p.adReadiness}% — needs creative & copy`,
      sev: 'amber' as const, href: '/freehold-intelligence/inventory',
    })),
    ...noImages.filter((p) => !missingLandings.includes(p) && !dismissed.has(p.id)).map((p) => ({
      id: p.id, name: p.name,
      note: 'No images — blocks ad creative generation',
      sev: 'amber' as const, href: '/freehold-intelligence/inventory',
    })),
  ]

  const now     = new Date()
  const dateStr = now.toLocaleDateString('en-AE', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="mx-auto max-w-5xl px-5 pb-20 pt-6 sm:px-8 sm:pt-8">

      {/* ── Header bar ── */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/10">
            <Sparkles className="h-4 w-4 text-[#D4AF37]" />
          </div>
          <div>
            <div className="text-[16px] font-semibold text-white">Freehold Intelligence</div>
            <div className="text-[12px] text-white/30">{dateStr}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[12px] text-white/25">
            <span className="h-1.5 w-1.5 rounded-full bg-[#D4AF37] shadow-[0_0_6px_rgba(212,175,55,0.8)]" />
            6 live
          </div>
          <div className="hidden sm:block h-4 w-px bg-white/[0.08]" />
          <Link href="/" className="hidden sm:flex items-center gap-1.5 text-[12px] text-white/25 hover:text-white/50 transition">
            <Globe className="h-3.5 w-3.5" />
            freeholdproperty.ae
          </Link>
          <Link href="/freehold-intelligence/agent"
            className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[12px] text-white/40 transition hover:border-white/20 hover:text-white/70">
            Agent view <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* ── App grid ── */}
      <section>
        <div className="mb-4 text-[11px] font-medium uppercase tracking-[0.2em] text-white/25">Apps</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {APPS.map((app) => (
            <Link
              key={app.id}
              href={app.href}
              className={`group relative flex flex-col rounded-[22px] border bg-[#131B2B] p-5 transition ${app.card}`}
            >
              {app.badge > 0 && (
                <span className="absolute right-4 top-4 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {app.badge}
                </span>
              )}
              <div className={`flex h-11 w-11 items-center justify-center rounded-[14px] border ${app.icon}`}>
                <app.Icon className="h-5 w-5" />
              </div>
              <div className="mt-4 flex-1">
                <div className="text-[15px] font-semibold text-white/90 group-hover:text-white">{app.label}</div>
                <div className="mt-0.5 text-[11px] text-white/28">{app.sub}</div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="text-[12px] font-medium text-white/45" style={{ color: `${app.accent}99` }}>
                  {app.metric}
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-white/15 transition group-hover:text-white/40" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Executive overview ── */}
      <section className="mt-10 grid gap-4 lg:grid-cols-2">

        {/* Priority queue */}
        <div className="rounded-[18px] border border-white/[0.07] bg-[#131B2B] overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
            <div className="flex items-center gap-2 text-[13px] font-medium text-white/50">
              <AlertCircle className="h-3.5 w-3.5 text-amber-400/70" />
              Priorities
            </div>
            <span className="text-[12px] text-white/20">{priorities.length} open</span>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {priorities.slice(0, 3).map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${p.sev === 'red' ? 'bg-red-400' : 'bg-amber-400'}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-white/75 truncate">{p.name}</div>
                  <div className="text-[11px] text-white/30 truncate">{p.note}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Link href={p.href}
                    className="rounded-md border border-white/[0.07] px-2.5 py-1 text-[12px] text-white/40 transition hover:text-white/70">
                    Fix
                  </Link>
                  <button type="button" onClick={() => setDismissed((s) => new Set([...s, p.id]))}
                    className="p-1 text-white/15 hover:text-white/40 transition">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
            {priorities.length === 0 && (
              <div className="flex items-center gap-3 px-5 py-4">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#D4AF37]/50" />
                <span className="text-[13px] text-white/45">All clear — no open priorities</span>
              </div>
            )}
          </div>
        </div>

        {/* Live activity */}
        <div className="rounded-[18px] border border-white/[0.07] bg-[#131B2B] overflow-hidden">
          <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-3 text-[13px] font-medium text-white/50">
            <Activity className="h-3.5 w-3.5" />
            Live activity
          </div>
          <div className="divide-y divide-white/[0.04]">
            {ACTIVITY.map((item, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  item.type === 'lead' ? 'bg-[#D4AF37]' :
                  item.type === 'warning' ? 'bg-amber-400' :
                  item.type === 'success' ? 'bg-emerald-400' : 'bg-white/20'
                }`} />
                <div className="min-w-0 flex-1">
                  <span className="text-[13px] font-medium text-white/70">{item.label}</span>
                  <span className="text-white/15 mx-1.5">·</span>
                  <span className="text-[12px] text-white/30">{item.detail}</span>
                </div>
                <span className="shrink-0 text-[11px] text-white/20 tabular-nums">{item.time}</span>
              </div>
            ))}
          </div>
        </div>

      </section>
    </div>
  )
}
