'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Users, Zap, TrendingUp, Bot, DollarSign, Package,
  AlertCircle, CheckCircle2, ArrowUpRight, X, Sparkles,
} from 'lucide-react'
import { inventoryProperties, getInventoryStats } from '@/src/features/freehold-intelligence/inventory'
import { AiPrompt } from '@/components/freehold/ai-prompt'

const WEEKLY_LEADS = [
  { day: 'Mon', leads: 52 },
  { day: 'Tue', leads: 61 },
  { day: 'Wed', leads: 48 },
  { day: 'Thu', leads: 74 },
  { day: 'Fri', leads: 83 },
  { day: 'Sat', leads: 57 },
  { day: 'Sun', leads: 40 },
]
const MAX_LEADS = Math.max(...WEEKLY_LEADS.map((d) => d.leads))
const TODAY_IDX = (new Date().getDay() + 6) % 7

const ACTIVITY = [
  { time: '09:14',    label: 'New lead received',      detail: 'Palm Jumeirah — Meta Ads',                  type: 'lead'    },
  { time: '08:52',    label: 'Campaign paused',         detail: 'Off Plan Dubai 2025 — Google Search',        type: 'warning' },
  { time: '08:30',    label: 'Landing page published',  detail: 'JVC Investor Apartments · /lp/jvc-investor', type: 'success' },
  { time: 'Yesterday',label: '88 leads generated',     detail: 'Dubai Hills Yield Campaign — 24h window',    type: 'lead'    },
  { time: 'Yesterday',label: 'Invoice issued',          detail: 'INV-META-0526 · AED 18,420',                 type: 'info'    },
  { time: '2d ago',   label: 'Data quality alert',      detail: 'Marina Luxury Residences — adReadiness 12%',type: 'warning' },
]

const today = new Date().toLocaleDateString('en-AE', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
})

type ActivityFilter = 'all' | 'lead' | 'warning' | 'success' | 'info'

export default function IntelligenceDashboard() {
  const stats = getInventoryStats()

  const lowAdReadiness  = inventoryProperties.filter((p) => p.adReadiness < 40)
  const missingLandings = inventoryProperties.filter((p) => p.landingStatus === 'missing')
  const noImages        = inventoryProperties.filter((p) => !p.hasImages)
  const avgDataQuality  = Math.round(
    inventoryProperties.reduce((s, p) => s + p.dataQuality, 0) / inventoryProperties.length
  )
  const totalVisitors30d = inventoryProperties.reduce((s, p) => s + p.views30d, 0)

  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  function dismissPriority(id: string) {
    setDismissedIds((prev: Set<string>) => new Set([...prev, id]))
  }

  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all')
  const filteredActivity = activityFilter === 'all'
    ? ACTIVITY
    : ACTIVITY.filter((a) => a.type === activityFilter)

  const alertCount = [
    ...lowAdReadiness.filter((p) => !dismissedIds.has(p.id)),
    ...missingLandings.filter((p) => !dismissedIds.has(p.id)),
    ...noImages.filter((p) => !missingLandings.includes(p) && !dismissedIds.has(p.id)),
  ].length

  const workspaces = [
    {
      label: 'CRM',
      desc:  'Lead pipeline & agent management',
      href:  '/freehold-intelligence/crm',
      icon:  Users,
      headline: '415',
      unit: 'leads',
      metrics: ['12 urgent · needs follow-up', '3 agents available', 'AED 18.7 avg cost per lead'],
      alert: true,
    },
    {
      label: 'Lead Machine',
      desc:  'Campaigns & inbound generation',
      href:  '/freehold-intelligence/lead-machine',
      icon:  Zap,
      headline: '6',
      unit: 'campaigns',
      metrics: ['415 leads generated this month', 'AED 31,290 total spend', 'All campaigns running'],
      alert: false,
    },
    {
      label: 'Analytics',
      desc:  'Traffic, conversions & performance',
      href:  '/freehold-intelligence/analytics',
      icon:  TrendingUp,
      headline: `${(totalVisitors30d / 1000).toFixed(1)}k`,
      unit: 'visitors',
      metrics: ['Last 30 days across all pages', `${stats.total} landing pages tracked`, 'Conversion pipeline live'],
      alert: false,
    },
    {
      label: 'AI Manager',
      desc:  'Content intelligence & enrichment',
      href:  '/freehold-intelligence/ai-manager',
      icon:  Bot,
      headline: String(avgDataQuality),
      unit: '/ 100',
      metrics: [`Average data quality · ${stats.total} properties`, '3 listings need enrichment', 'Area & developer pages active'],
      alert: avgDataQuality < 70,
    },
    {
      label: 'Finance',
      desc:  'Ad spend, billing & budget',
      href:  '/freehold-intelligence/finance',
      icon:  DollarSign,
      headline: '73%',
      unit: 'budget used',
      metrics: ['AED 31,290 spent this month', 'AED 42,840 allocated budget', 'INV-META-0526 pending'],
      alert: false,
    },
    {
      label: 'Inventory',
      desc:  'Properties & landing pages',
      href:  '/freehold-intelligence/inventory',
      icon:  Package,
      headline: String(stats.total),
      unit: 'properties',
      metrics: [
        `${stats.live} live · ${stats.missingLanding} missing landing pages`,
        `${lowAdReadiness.length} below 40% ad readiness`,
        `${noImages.length} without images`,
      ],
      alert: stats.missingLanding > 0 || lowAdReadiness.length > 0,
    },
  ] as const

  return (
    <div className="px-6 lg:px-10 pb-24 pt-10 space-y-14">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-[13px] text-white/35 font-medium">
            <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]/60" />
            {today}
          </div>
          <h1 className="mt-4 text-[40px] sm:text-[56px] font-semibold tracking-tight text-white leading-[1.0]">
            Intelligence<br />
            <span className="text-white/25">Command Center</span>
          </h1>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#1A1F2A] px-5 py-3.5 text-[14px] font-medium text-white/55">
          <span className="h-2 w-2 rounded-full bg-[#D4AF37] shadow-[0_0_10px_rgba(212,175,55,0.55)]" />
          {workspaces.length} workspaces live
          {alertCount > 0 && (
            <span className="rounded-full bg-red-500/15 px-2.5 py-0.5 text-[12px] font-semibold text-red-400">
              {alertCount} alerts
            </span>
          )}
        </div>
      </div>

      {/* ── Workspace launchers ── */}
      <section>
        <div className="mb-7 text-[12px] font-medium uppercase tracking-[0.22em] text-white/30">
          Workspaces
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((ws) => {
            const Icon = ws.icon
            return (
              <Link
                key={ws.href}
                href={ws.href}
                className={[
                  'group relative rounded-2xl border p-7 transition-all duration-200',
                  'hover:border-white/[0.16] hover:bg-white/[0.03]',
                  ws.alert
                    ? 'border-amber-500/20 bg-[#1C1A14]'
                    : 'border-white/[0.08] bg-[#1A1F2A]',
                ].join(' ')}
              >
                {/* Workspace label */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.05]">
                      <Icon className="h-[18px] w-[18px] text-[#D4AF37]" />
                    </div>
                    <div>
                      <div className="text-[16px] font-semibold text-white">{ws.label}</div>
                      <div className="text-[13px] text-white/40 leading-snug">{ws.desc}</div>
                    </div>
                  </div>
                  {ws.alert && (
                    <AlertCircle className="h-[17px] w-[17px] shrink-0 text-amber-400/70 mt-0.5" />
                  )}
                </div>

                {/* Headline metric */}
                <div className="mt-6 flex items-baseline gap-2">
                  <span className="text-[44px] font-semibold leading-none tabular-nums text-white tracking-tight">
                    {ws.headline}
                  </span>
                  <span className="text-[17px] font-medium text-white/30">{ws.unit}</span>
                </div>

                {/* Supporting metrics */}
                <div className="mt-4 space-y-2">
                  {ws.metrics.map((m, i) => (
                    <div key={i} className="text-[13px] leading-snug text-white/45">
                      {m}
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <div className="mt-6 flex items-center gap-1.5 text-[13px] font-medium text-[#D4AF37]/40 transition group-hover:text-[#D4AF37]">
                  Open workspace <ArrowUpRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      {/* ── Lead trend ── */}
      <section>
        <div className="mb-7 text-[12px] font-medium uppercase tracking-[0.22em] text-white/30">
          Lead Trend — This Week
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-[#1A1F2A] p-7">
          <div className="flex items-end justify-between gap-6 mb-8">
            <div>
              <div className="text-[40px] font-semibold tabular-nums text-white leading-none">415</div>
              <div className="mt-2 text-[15px] text-white/45">leads generated this week</div>
            </div>
            <div className="text-right">
              <div className="text-[18px] font-semibold text-[#D4AF37]">+11%</div>
              <div className="text-[13px] text-white/40">vs last week</div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <svg viewBox="0 0 600 96" className="w-full min-w-[340px]" preserveAspectRatio="xMidYMid meet">
              {WEEKLY_LEADS.map((d, i) => {
                const barW    = 56
                const gap     = (600 - WEEKLY_LEADS.length * barW) / (WEEKLY_LEADS.length + 1)
                const x       = gap + i * (barW + gap)
                const barH    = (d.leads / MAX_LEADS) * 68
                const y       = 72 - barH
                const isToday = i === TODAY_IDX
                return (
                  <g key={d.day}>
                    <rect x={x} y={y} width={barW} height={barH} rx="7"
                      fill={isToday ? '#D4AF37' : 'rgba(255,255,255,0.07)'}
                    />
                    <text x={x + barW / 2} y={90} textAnchor="middle" fontSize="12"
                      fill="rgba(255,255,255,0.28)" fontFamily="system-ui,sans-serif">
                      {d.day}
                    </text>
                    <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize="12"
                      fill={isToday ? '#D4AF37' : 'rgba(255,255,255,0.38)'} fontFamily="system-ui,sans-serif">
                      {d.leads}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
        </div>
      </section>

      {/* ── Priorities + Activity ── */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* Today's Priorities */}
        <section>
          <div className="mb-7 text-[12px] font-medium uppercase tracking-[0.22em] text-white/30">
            Today's Priorities
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-[#1A1F2A] divide-y divide-white/[0.06]">

            {lowAdReadiness.map((p) => !dismissedIds.has(p.id) && (
              <div key={p.id} className="flex items-start gap-4 p-6">
                <AlertCircle className="mt-0.5 h-[18px] w-[18px] shrink-0 text-amber-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium text-white/85 truncate">{p.name}</p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-white/45">
                    Ad readiness {p.adReadiness}% — needs creative & copy
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href="/freehold-intelligence/inventory"
                    className="rounded-lg border border-white/[0.09] bg-white/[0.05] px-3 py-1.5 text-[13px] text-white/55 hover:text-white/85 transition"
                  >
                    Fix
                  </Link>
                  <button
                    type="button"
                    onClick={() => dismissPriority(p.id)}
                    className="rounded-lg border border-white/[0.09] bg-white/[0.05] p-1.5 text-white/30 hover:text-white/65 transition"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {missingLandings.map((p) => !dismissedIds.has(p.id) && (
              <div key={p.id} className="flex items-start gap-4 p-6">
                <AlertCircle className="mt-0.5 h-[18px] w-[18px] shrink-0 text-red-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium text-white/85 truncate">{p.name}</p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-white/45">
                    No landing page — {p.linkedCampaigns === 0 ? 'no active campaigns' : `${p.linkedCampaigns} campaign(s) paused`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href="/freehold-intelligence/inventory"
                    className="rounded-lg border border-white/[0.09] bg-white/[0.05] px-3 py-1.5 text-[13px] text-white/55 hover:text-white/85 transition"
                  >
                    Create
                  </Link>
                  <button
                    type="button"
                    onClick={() => dismissPriority(p.id)}
                    className="rounded-lg border border-white/[0.09] bg-white/[0.05] p-1.5 text-white/30 hover:text-white/65 transition"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {noImages.filter((p) => !missingLandings.includes(p)).map((p) => !dismissedIds.has(p.id) && (
              <div key={p.id} className="flex items-start gap-4 p-6">
                <AlertCircle className="mt-0.5 h-[18px] w-[18px] shrink-0 text-amber-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium text-white/85 truncate">{p.name}</p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-white/45">
                    No images uploaded — blocks ad creative generation
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href="/freehold-intelligence/inventory"
                    className="rounded-lg border border-white/[0.09] bg-white/[0.05] px-3 py-1.5 text-[13px] text-white/55 hover:text-white/85 transition"
                  >
                    Upload
                  </Link>
                  <button
                    type="button"
                    onClick={() => dismissPriority(p.id)}
                    className="rounded-lg border border-white/[0.09] bg-white/[0.05] p-1.5 text-white/30 hover:text-white/65 transition"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}

            <div className="flex items-start gap-4 p-6">
              <CheckCircle2 className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#D4AF37]/65" />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium text-white/85">Sobha Hartland II Villas — fully ready</p>
                <p className="mt-1.5 text-[13px] text-white/45">Ad readiness 88% · 2 active campaigns · 67 leads (30d)</p>
              </div>
            </div>
          </div>
        </section>

        {/* Recent Activity */}
        <section>
          <div className="mb-7 flex items-center justify-between gap-4">
            <div className="text-[12px] font-medium uppercase tracking-[0.22em] text-white/30">
              Recent Activity
            </div>
            <div className="flex items-center gap-1.5">
              {(['all', 'lead', 'warning', 'success'] as ActivityFilter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setActivityFilter(f)}
                  className={[
                    'rounded-lg border px-3 py-1.5 text-[12px] font-medium capitalize transition',
                    activityFilter === f
                      ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]'
                      : 'border-white/[0.07] text-white/35 hover:text-white/55',
                  ].join(' ')}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-[#1A1F2A] divide-y divide-white/[0.06]">
            {filteredActivity.map((item, i) => (
              <div key={i} className="flex items-start gap-4 p-6">
                <div className="mt-2 shrink-0">
                  {item.type === 'lead'    && <span className="flex h-2 w-2 rounded-full bg-[#D4AF37]" />}
                  {item.type === 'success' && <span className="flex h-2 w-2 rounded-full bg-white/45" />}
                  {item.type === 'warning' && <span className="flex h-2 w-2 rounded-full bg-amber-400" />}
                  {item.type === 'info'    && <span className="flex h-2 w-2 rounded-full bg-white/20" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium text-white/80">{item.label}</p>
                  <p className="mt-1 text-[13px] text-white/40">{item.detail}</p>
                </div>
                <span className="shrink-0 text-[12px] text-white/25">{item.time}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ── AI prompt ── */}
      <section>
        <AiPrompt
          placeholder="Ask about performance, leads, campaigns…"
          suggestions={[
            'What needs attention first today?',
            'How did this week compare to last?',
            'Which properties have the lowest ad readiness?',
            "Summarise today's lead pipeline.",
          ]}
        />
      </section>

    </div>
  )
}
