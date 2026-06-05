'use client'

import Link from 'next/link'
import {
  BarChart2, Zap, Users, Package, DollarSign, TrendingUp,
  Bot, AlertCircle, CheckCircle2, ArrowUpRight, Calendar, Activity,
} from 'lucide-react'
import { inventoryProperties, getInventoryStats } from '@/src/features/freehold-intelligence/inventory'

const today = new Date().toLocaleDateString('en-US', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

const kpis = [
  {
    label: 'Total Leads',
    sublabel: 'Last 30 days',
    value: '415',
    change: '+12%',
    positive: true,
    icon: Users,
    accent: 'text-[#D4AF37]',
    iconBg: 'bg-[#D4AF37]/10 border-[#D4AF37]/20',
  },
  {
    label: 'Ad Spend',
    sublabel: 'Last 30 days',
    value: 'AED 31,290',
    change: '73% budget used',
    positive: true,
    icon: DollarSign,
    accent: 'text-emerald-400',
    iconBg: 'bg-emerald-500/10 border-emerald-500/20',
  },
  {
    label: 'Avg CPL',
    sublabel: 'Cost per lead',
    value: 'AED 75.4',
    change: '-17% vs last month',
    positive: true,
    icon: TrendingUp,
    accent: 'text-sky-400',
    iconBg: 'bg-sky-500/10 border-sky-500/20',
  },
  {
    label: 'Inventory',
    sublabel: 'Active properties',
    value: '8',
    change: '3 live landings',
    positive: true,
    icon: Package,
    accent: 'text-violet-400',
    iconBg: 'bg-violet-500/10 border-violet-500/20',
  },
]

const quickActions = [
  { label: 'Inventory', href: '/freehold-intelligence/inventory', icon: Package, accent: 'text-sky-300', bg: 'bg-sky-500/10 border-sky-500/20', desc: 'Manage properties' },
  { label: 'Ads Live', href: '/freehold-intelligence/ads-live', icon: BarChart2, accent: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', desc: 'View campaigns' },
  { label: 'Finance', href: '/freehold-intelligence/finance', icon: DollarSign, accent: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', desc: 'Spend & billing' },
  { label: 'Analytics', href: '/freehold-intelligence/analytics', icon: TrendingUp, accent: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20', desc: 'Site traffic' },
  { label: 'AI Manager', href: '/freehold-intelligence/ai-manager', icon: Bot, accent: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20', desc: 'Content engine' },
  { label: 'CRM', href: '/freehold-intelligence/crm', icon: Users, accent: 'text-[#D4AF37]', bg: 'bg-[#D4AF37]/10 border-[#D4AF37]/20', desc: 'Lead pipeline' },
]

const recentActivity = [
  { time: '09:14', label: 'New lead received', detail: 'Palm Jumeirah — Meta Ads', type: 'lead' },
  { time: '08:52', label: 'Campaign paused', detail: 'Off Plan Dubai 2025 — Google Search', type: 'warning' },
  { time: '08:30', label: 'Landing page published', detail: 'JVC Investor Apartments · /lp/jvc-investor', type: 'success' },
  { time: 'Yesterday', label: '88 leads generated', detail: 'Dubai Hills Yield Campaign — 24h window', type: 'lead' },
  { time: 'Yesterday', label: 'Invoice issued', detail: 'INV-META-0526 · AED 18,420', type: 'info' },
  { time: '2d ago', label: 'Data quality alert', detail: 'Marina Luxury Residences — adReadiness 12%', type: 'warning' },
]

export default function IntelligenceDashboard() {
  const stats = getInventoryStats()

  const lowAdReadiness = inventoryProperties.filter((p) => p.adReadiness < 40)
  const missingLandings = inventoryProperties.filter((p) => p.landingStatus === 'missing')
  const noImages = inventoryProperties.filter((p) => !p.hasImages)

  const avgDataQuality = Math.round(
    inventoryProperties.reduce((s, p) => s + p.dataQuality, 0) / inventoryProperties.length
  )

  const totalVisitors30d = inventoryProperties.reduce((s, p) => s + p.views30d, 0)

  return (
    <div className="p-6 lg:p-8 space-y-8">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white/90">Intelligence Dashboard</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-white/40">
            <Calendar className="h-3.5 w-3.5" />
            {today}
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
          All systems live
        </div>
      </div>

      {/* ── Top KPI row ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <div
              key={kpi.label}
              className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-white/40 uppercase tracking-wider">{kpi.label}</span>
                <div className={`flex h-7 w-7 items-center justify-center rounded-xl border ${kpi.iconBg}`}>
                  <Icon className={`h-3.5 w-3.5 ${kpi.accent}`} />
                </div>
              </div>
              <div className="mt-3 text-2xl font-semibold tabular-nums text-white/90">{kpi.value}</div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-white/40">
                <span>{kpi.sublabel}</span>
                <span className="text-white/25">·</span>
                <span className={kpi.positive ? 'text-emerald-400' : 'text-red-400'}>{kpi.change}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── System Health ── */}
      <section>
        <div className="mb-4 text-xs font-medium uppercase tracking-widest text-white/40">System Health</div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {/* Live Landings */}
          <div className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-5">
            <div className="text-xs text-white/40 font-medium uppercase tracking-wider">Live Landings</div>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-3xl font-semibold tabular-nums text-white/90">{stats.live}</span>
              <span className="text-sm text-white/30">/ {stats.total}</span>
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-emerald-400"
                style={{ width: `${(stats.live / stats.total) * 100}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-white/35">{stats.missingLanding} missing pages</p>
          </div>

          {/* Ad Campaigns */}
          <div className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-5">
            <div className="text-xs text-white/40 font-medium uppercase tracking-wider">Ad Campaigns</div>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-3xl font-semibold tabular-nums text-white/90">6</span>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">Active</span>
            </div>
            <p className="mt-2 text-xs text-white/35">Meta (3) · Google (3)</p>
          </div>

          {/* Data Quality */}
          <div className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-5">
            <div className="text-xs text-white/40 font-medium uppercase tracking-wider">Data Quality</div>
            <div className="mt-3 text-3xl font-semibold tabular-nums text-white/90">{avgDataQuality}<span className="text-base text-white/30">/100</span></div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-[#D4AF37]"
                style={{ width: `${avgDataQuality}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-white/35">Avg across {stats.total} properties</p>
          </div>

          {/* Site Visitors */}
          <div className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-5">
            <div className="text-xs text-white/40 font-medium uppercase tracking-wider">Site Visitors</div>
            <div className="mt-3 text-3xl font-semibold tabular-nums text-white/90">
              {(totalVisitors30d / 1000).toFixed(1)}<span className="text-base text-white/30">k</span>
            </div>
            <p className="mt-2 text-xs text-white/35">Landing page views · 30d</p>
          </div>
        </div>
      </section>

      {/* ── Today's Priorities + Quick Actions ── */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* Today's Priorities */}
        <section>
          <div className="mb-4 text-xs font-medium uppercase tracking-widest text-white/40">Today's Priorities</div>
          <div className="rounded-2xl border border-white/[0.05] bg-white/[0.03] divide-y divide-white/[0.04]">

            {lowAdReadiness.map((p) => (
              <div key={p.id} className="flex items-start gap-3 p-4">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white/80 truncate">{p.name}</p>
                  <p className="mt-0.5 text-xs text-white/40">Ad readiness {p.adReadiness}% — needs creative & copy</p>
                </div>
                <Link href="/freehold-intelligence/inventory" className="shrink-0 rounded-xl border border-white/[0.07] bg-white/[0.04] px-2.5 py-1 text-xs text-white/50 hover:text-white/80 transition">Fix</Link>
              </div>
            ))}

            {missingLandings.map((p) => (
              <div key={p.id} className="flex items-start gap-3 p-4">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white/80 truncate">{p.name}</p>
                  <p className="mt-0.5 text-xs text-white/40">No landing page — {p.linkedCampaigns === 0 ? 'no active campaigns' : `${p.linkedCampaigns} campaign(s) paused`}</p>
                </div>
                <Link href="/freehold-intelligence/inventory" className="shrink-0 rounded-xl border border-white/[0.07] bg-white/[0.04] px-2.5 py-1 text-xs text-white/50 hover:text-white/80 transition">Create</Link>
              </div>
            ))}

            {noImages.filter((p) => !missingLandings.includes(p)).map((p) => (
              <div key={p.id} className="flex items-start gap-3 p-4">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white/80 truncate">{p.name}</p>
                  <p className="mt-0.5 text-xs text-white/40">No images uploaded — blocks ad creative generation</p>
                </div>
                <Link href="/freehold-intelligence/inventory" className="shrink-0 rounded-xl border border-white/[0.07] bg-white/[0.04] px-2.5 py-1 text-xs text-white/50 hover:text-white/80 transition">Upload</Link>
              </div>
            ))}

            <div className="flex items-start gap-3 p-4">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white/80">Sobha Hartland II Villas — fully ready</p>
                <p className="mt-0.5 text-xs text-white/40">Ad readiness 88% · 2 active campaigns · 67 leads (30d)</p>
              </div>
            </div>
          </div>
        </section>

        {/* Quick Actions */}
        <section>
          <div className="mb-4 text-xs font-medium uppercase tracking-widest text-white/40">Quick Actions</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {quickActions.map((qa) => {
              const Icon = qa.icon
              return (
                <Link
                  key={qa.href}
                  href={qa.href}
                  className="group rounded-2xl border border-white/[0.05] bg-white/[0.03] p-4 hover:border-white/10 hover:bg-white/[0.05] transition"
                >
                  <div className={`flex h-8 w-8 items-center justify-center rounded-xl border ${qa.bg}`}>
                    <Icon className={`h-4 w-4 ${qa.accent}`} />
                  </div>
                  <div className="mt-3 text-sm font-semibold text-white/80 group-hover:text-white/90">{qa.label}</div>
                  <div className="mt-0.5 text-xs text-white/35">{qa.desc}</div>
                  <div className="mt-2 flex items-center gap-1 text-xs text-[#D4AF37]/60 group-hover:text-[#D4AF37] transition">
                    Open <ArrowUpRight className="h-3 w-3" />
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      </div>

      {/* ── Recent Activity ── */}
      <section>
        <div className="mb-4 flex items-center gap-3">
          <div className="text-xs font-medium uppercase tracking-widest text-white/40">Recent Activity</div>
          <Activity className="h-3.5 w-3.5 text-white/25" />
        </div>
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.03] divide-y divide-white/[0.04]">
          {recentActivity.map((item, i) => (
            <div key={i} className="flex items-start gap-4 p-4">
              <div className="mt-0.5 shrink-0">
                {item.type === 'lead' && <span className="flex h-2 w-2 rounded-full bg-[#D4AF37]" />}
                {item.type === 'success' && <span className="flex h-2 w-2 rounded-full bg-emerald-400" />}
                {item.type === 'warning' && <span className="flex h-2 w-2 rounded-full bg-amber-400" />}
                {item.type === 'info' && <span className="flex h-2 w-2 rounded-full bg-sky-400" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white/75">{item.label}</p>
                <p className="mt-0.5 text-xs text-white/35">{item.detail}</p>
              </div>
              <span className="shrink-0 text-xs text-white/25">{item.time}</span>
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}
