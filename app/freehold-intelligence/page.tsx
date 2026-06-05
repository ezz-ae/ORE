'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Users, Zap, TrendingUp, Bot, DollarSign, Package,
  AlertCircle, CheckCircle2, ArrowUpRight, X,
  Activity, Clock,
} from 'lucide-react'
import { inventoryProperties, getInventoryStats } from '@/src/features/freehold-intelligence/inventory'
import { AiPrompt } from '@/components/freehold/ai-prompt'

const WEEKLY_LEADS = [
  { day: 'M', leads: 52 },
  { day: 'T', leads: 61 },
  { day: 'W', leads: 48 },
  { day: 'T', leads: 74 },
  { day: 'F', leads: 83 },
  { day: 'S', leads: 57 },
  { day: 'S', leads: 40 },
]
const MAX_LEADS = Math.max(...WEEKLY_LEADS.map((d) => d.leads))
const TODAY_IDX = (new Date().getDay() + 6) % 7

const ACTIVITY = [
  { time: '09:14',     label: 'New lead',           detail: 'Palm Jumeirah — Meta Ads',         type: 'lead'    },
  { time: '08:52',     label: 'Campaign paused',     detail: 'Off Plan Dubai 2025 — Google',     type: 'warning' },
  { time: '08:30',     label: 'Landing published',   detail: 'JVC Investor · /lp/jvc-investor',  type: 'success' },
  { time: 'Yesterday', label: '88 leads',            detail: 'Dubai Hills Yield — 24h',          type: 'lead'    },
  { time: 'Yesterday', label: 'Invoice issued',      detail: 'INV-META-0526 · AED 18,420',       type: 'info'    },
  { time: '2d ago',    label: 'Data quality alert',  detail: 'Marina Luxury — adReadiness 12%',  type: 'warning' },
]

type ActivityFilter = 'all' | 'lead' | 'warning'

export default function IntelligenceDashboard() {
  const stats            = getInventoryStats()
  const lowAdReadiness   = inventoryProperties.filter((p) => p.adReadiness < 40)
  const missingLandings  = inventoryProperties.filter((p) => p.landingStatus === 'missing')
  const noImages         = inventoryProperties.filter((p) => !p.hasImages)
  const avgDataQuality   = Math.round(inventoryProperties.reduce((s, p) => s + p.dataQuality, 0) / inventoryProperties.length)
  const totalVisitors30d = inventoryProperties.reduce((s, p) => s + p.views30d, 0)

  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  function dismiss(id: string) { setDismissed((p) => new Set([...p, id])) }

  const [actFilter, setActFilter] = useState<ActivityFilter>('all')
  const filteredActivity = actFilter === 'all' ? ACTIVITY : ACTIVITY.filter((a) => a.type === actFilter)

  const priorities = [
    ...lowAdReadiness.filter((p) => !dismissed.has(p.id)).map((p) => ({
      id: p.id, name: p.name,
      note: `Ad readiness ${p.adReadiness}% — needs creative & copy`,
      sev: 'amber' as const, action: 'Fix', href: '/freehold-intelligence/inventory',
    })),
    ...missingLandings.filter((p) => !dismissed.has(p.id)).map((p) => ({
      id: p.id, name: p.name,
      note: `No landing page${p.linkedCampaigns > 0 ? ` — ${p.linkedCampaigns} campaign(s) paused` : ''}`,
      sev: 'red' as const, action: 'Create', href: '/freehold-intelligence/inventory',
    })),
    ...noImages.filter((p) => !missingLandings.includes(p) && !dismissed.has(p.id)).map((p) => ({
      id: p.id, name: p.name,
      note: 'No images — blocks ad creative generation',
      sev: 'amber' as const, action: 'Upload', href: '/freehold-intelligence/inventory',
    })),
  ]

  const now    = new Date()
  const dateStr = now.toLocaleDateString('en-AE', { weekday: 'short', day: 'numeric', month: 'short' })
  const timeStr = now.toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit', hour12: false })

  return (
    <div className="px-5 lg:px-8 pb-16 pt-5 space-y-5">

      {/* ── Status strip ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-1">
        <div className="flex items-center gap-3 text-[13px] text-white/40">
          <span className="font-medium text-white/65">{dateStr}</span>
          <span className="text-white/15">·</span>
          <span>{timeStr} GST</span>
          <span className="text-white/15">·</span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#D4AF37] shadow-[0_0_6px_rgba(212,175,55,0.8)]" />
            6 live
          </span>
        </div>
        {priorities.length > 0 && (
          <Link href="/freehold-intelligence/inventory"
            className="flex items-center gap-1.5 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] px-3 py-1 text-[12px] font-medium text-amber-300 transition hover:border-amber-400/35">
            <AlertCircle className="h-3 w-3" />
            {priorities.length} items need attention
          </Link>
        )}
      </div>

      {/* ── Bento grid ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">

        {/* CRM */}
        <Link href="/freehold-intelligence/crm"
          className="group rounded-2xl border border-white/[0.08] bg-[#131B2B] p-5 transition hover:border-[#D4AF37]/20 hover:bg-[#1A2338]">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#D4AF37]/20 bg-[#D4AF37]/10">
                <Users className="h-[15px] w-[15px] text-[#D4AF37]" />
              </div>
              <span className="text-[14px] font-semibold text-white">CRM</span>
            </div>
            <AlertCircle className="h-3.5 w-3.5 text-amber-400/60 mt-0.5" />
          </div>
          <div className="mt-5 flex items-baseline gap-1.5">
            <span className="text-[38px] font-semibold leading-none tabular-nums text-white tracking-tight">415</span>
            <span className="text-[13px] text-white/30 mb-0.5">leads</span>
          </div>
          <div className="mt-2.5 space-y-1.5">
            <div className="text-[12px] text-white/45">12 urgent · 3 agents available</div>
            <div className="text-[12px] text-white/30">AED 18.7 avg CPL</div>
          </div>
          <div className="mt-4 flex items-center gap-1 text-[12px] text-[#D4AF37]/40 group-hover:text-[#D4AF37] transition">
            Open workspace <ArrowUpRight className="h-3 w-3" />
          </div>
        </Link>

        {/* Lead Machine */}
        <Link href="/freehold-intelligence/lead-machine"
          className="group rounded-2xl border border-white/[0.08] bg-[#131B2B] p-5 transition hover:border-[#D4AF37]/20 hover:bg-[#1A2338]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#D4AF37]/20 bg-[#D4AF37]/10">
              <Zap className="h-[15px] w-[15px] text-[#D4AF37]" />
            </div>
            <span className="text-[14px] font-semibold text-white">Lead Machine</span>
          </div>
          <div className="mt-5 flex items-baseline gap-1.5">
            <span className="text-[38px] font-semibold leading-none tabular-nums text-white tracking-tight">6</span>
            <span className="text-[13px] text-white/30 mb-0.5">campaigns</span>
          </div>
          <div className="mt-2.5 space-y-1.5">
            <div className="text-[12px] text-white/45">415 leads / month</div>
            <div className="text-[12px] text-white/30">AED 31,290 spend</div>
          </div>
          <div className="mt-4 flex items-center gap-1 text-[12px] text-[#D4AF37]/40 group-hover:text-[#D4AF37] transition">
            Open workspace <ArrowUpRight className="h-3 w-3" />
          </div>
        </Link>

        {/* Lead trend chart */}
        <div className="col-span-2 lg:col-span-1 rounded-2xl border border-white/[0.08] bg-[#131B2B] p-5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[13px] font-medium text-white/50">Lead trend · 7 days</span>
          </div>
          <div className="flex items-baseline gap-1.5 mb-4">
            <span className="text-[28px] font-semibold tabular-nums text-white">415</span>
            <span className="text-[13px] text-[#D4AF37] font-medium">+11%</span>
          </div>
          <svg viewBox="0 0 280 52" className="w-full" preserveAspectRatio="xMidYMid meet">
            {WEEKLY_LEADS.map((d, i) => {
              const bw = 28, gap = (280 - 7 * bw) / 8
              const x  = gap + i * (bw + gap)
              const bh = (d.leads / MAX_LEADS) * 44
              const y  = 48 - bh
              return (
                <g key={i}>
                  <rect x={x} y={y} width={bw} height={bh} rx="4"
                    fill={i === TODAY_IDX ? '#D4AF37' : 'rgba(255,255,255,0.07)'} />
                  <text x={x + bw/2} y={51} textAnchor="middle" fontSize="8"
                    fill="rgba(255,255,255,0.22)" fontFamily="system-ui,sans-serif">{d.day}</text>
                </g>
              )
            })}
          </svg>
        </div>

        {/* Analytics */}
        <Link href="/freehold-intelligence/analytics"
          className="group rounded-2xl border border-white/[0.08] bg-[#131B2B] p-5 transition hover:border-[#D4AF37]/20 hover:bg-[#1A2338]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.09] bg-white/[0.05]">
              <TrendingUp className="h-[15px] w-[15px] text-[#D4AF37]" />
            </div>
            <span className="text-[14px] font-semibold text-white">Analytics</span>
          </div>
          <div className="mt-5 flex items-baseline gap-1.5">
            <span className="text-[38px] font-semibold leading-none tabular-nums text-white tracking-tight">
              {(totalVisitors30d / 1000).toFixed(1)}k
            </span>
            <span className="text-[13px] text-white/30 mb-0.5">visitors</span>
          </div>
          <div className="mt-2.5 text-[12px] text-white/40">30 days · {stats.total} pages</div>
          <div className="mt-4 flex items-center gap-1 text-[12px] text-[#D4AF37]/40 group-hover:text-[#D4AF37] transition">
            Open workspace <ArrowUpRight className="h-3 w-3" />
          </div>
        </Link>

        {/* Finance */}
        <Link href="/freehold-intelligence/finance"
          className="group rounded-2xl border border-white/[0.08] bg-[#131B2B] p-5 transition hover:border-[#D4AF37]/20 hover:bg-[#1A2338]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.09] bg-white/[0.05]">
              <DollarSign className="h-[15px] w-[15px] text-[#D4AF37]" />
            </div>
            <span className="text-[14px] font-semibold text-white">Finance</span>
          </div>
          <div className="mt-5 flex items-baseline gap-1.5">
            <span className="text-[38px] font-semibold leading-none tabular-nums text-white tracking-tight">73%</span>
            <span className="text-[13px] text-white/30 mb-0.5">budget</span>
          </div>
          <div className="mt-2.5 space-y-1.5">
            <div className="text-[12px] text-white/45">AED 31,290 / 42,840</div>
            <div className="text-[12px] text-white/30">INV-META-0526 pending</div>
          </div>
          <div className="mt-4 flex items-center gap-1 text-[12px] text-[#D4AF37]/40 group-hover:text-[#D4AF37] transition">
            Open workspace <ArrowUpRight className="h-3 w-3" />
          </div>
        </Link>

        {/* AI Manager + Inventory stacked */}
        <div className="col-span-2 lg:col-span-1 grid grid-cols-2 lg:grid-cols-1 gap-4">
          <Link href="/freehold-intelligence/ai-manager"
            className="group flex items-center justify-between rounded-2xl border border-white/[0.08] bg-[#131B2B] p-4 transition hover:border-[#D4AF37]/20 hover:bg-[#1A2338]">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.09] bg-white/[0.05]">
                <Bot className="h-[15px] w-[15px] text-[#D4AF37]" />
              </div>
              <div>
                <div className="text-[13px] font-semibold text-white">AI Manager</div>
                <div className="text-[11px] text-white/35">Data quality</div>
              </div>
            </div>
            <div className={`text-[24px] font-semibold tabular-nums ${avgDataQuality >= 70 ? 'text-[#D4AF37]' : 'text-amber-400'}`}>
              {avgDataQuality}
            </div>
          </Link>

          <Link href="/freehold-intelligence/inventory"
            className="group flex items-center justify-between rounded-2xl border border-white/[0.08] bg-[#131B2B] p-4 transition hover:border-[#D4AF37]/20 hover:bg-[#1A2338]">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.09] bg-white/[0.05]">
                <Package className="h-[15px] w-[15px] text-[#D4AF37]" />
              </div>
              <div>
                <div className="text-[13px] font-semibold text-white">Inventory</div>
                <div className="text-[11px] text-white/35">{stats.live} live · {stats.missingLanding} missing</div>
              </div>
            </div>
            <div className="text-[24px] font-semibold tabular-nums text-white">
              {stats.total}
            </div>
          </Link>
        </div>

      </div>

      {/* ── Priority queue + Live activity ── */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Priority queue */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#131B2B] overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
            <div className="flex items-center gap-2 text-[13px] font-medium text-white/55">
              <AlertCircle className="h-3.5 w-3.5 text-amber-400/70" />
              Priority queue
            </div>
            <span className="text-[12px] text-white/25">{priorities.length} open</span>
          </div>
          <div className="divide-y divide-white/[0.05]">
            {priorities.slice(0, 4).map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${p.sev === 'red' ? 'bg-red-400' : 'bg-amber-400'}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-white/80 truncate">{p.name}</div>
                  <div className="text-[12px] text-white/35 truncate">{p.note}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Link href={p.href}
                    className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[12px] text-white/45 hover:text-white/75 transition">
                    {p.action}
                  </Link>
                  <button type="button" onClick={() => dismiss(p.id)}
                    className="p-1 text-white/20 hover:text-white/50 transition">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
            {priorities.length === 0 && (
              <div className="px-5 py-4 flex items-center gap-3">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#D4AF37]/60" />
                <span className="text-[13px] text-white/55">All clear — no open priorities</span>
              </div>
            )}
            <div className="px-5 py-3 flex items-center gap-3">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#D4AF37]/50" />
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-white/65">Sobha Hartland II Villas — ready</div>
                <div className="text-[12px] text-white/30">88% readiness · 2 campaigns · 67 leads (30d)</div>
              </div>
            </div>
          </div>
        </div>

        {/* Live activity */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#131B2B] overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
            <div className="flex items-center gap-2 text-[13px] font-medium text-white/55">
              <Activity className="h-3.5 w-3.5" />
              Live activity
            </div>
            <div className="flex items-center gap-1">
              {(['all', 'lead', 'warning'] as ActivityFilter[]).map((f) => (
                <button key={f} type="button" onClick={() => setActFilter(f)}
                  className={[
                    'rounded-md border px-2 py-0.5 text-[11px] font-medium capitalize transition',
                    actFilter === f
                      ? 'border-[#D4AF37]/35 bg-[#D4AF37]/10 text-[#D4AF37]'
                      : 'border-white/[0.07] text-white/30 hover:text-white/55',
                  ].join(' ')}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="divide-y divide-white/[0.05]">
            {filteredActivity.map((item, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <div className="shrink-0">
                  {item.type === 'lead'    && <span className="flex h-1.5 w-1.5 rounded-full bg-[#D4AF37]" />}
                  {item.type === 'warning' && <span className="flex h-1.5 w-1.5 rounded-full bg-amber-400" />}
                  {item.type === 'success' && <span className="flex h-1.5 w-1.5 rounded-full bg-white/40" />}
                  {item.type === 'info'    && <span className="flex h-1.5 w-1.5 rounded-full bg-white/15" />}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[13px] font-medium text-white/75">{item.label}</span>
                  <span className="text-white/20 mx-1.5">·</span>
                  <span className="text-[12px] text-white/35">{item.detail}</span>
                </div>
                <span className="shrink-0 text-[11px] text-white/25 tabular-nums whitespace-nowrap">{item.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── AI prompt ── */}
      <AiPrompt
        placeholder="Ask about performance, leads, campaigns…"
        suggestions={[
          'What needs attention first today?',
          'How did this week compare to last?',
          "Summarise today's lead pipeline.",
        ]}
      />

    </div>
  )
}
