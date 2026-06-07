'use client'

import { useState } from 'react'
import {
  Megaphone, TrendingUp, TrendingDown, MessageSquare,
  Mail, Globe, Users, ArrowUpRight, ArrowDownRight,
  Sparkles, Calendar, ExternalLink, Play, Pause,
  AlertCircle, CheckCircle2, Clock,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type CampaignStatus = 'Active' | 'Paused' | 'Ended' | 'Draft'
type Platform = 'Meta' | 'Google' | 'TikTok' | 'WhatsApp' | 'Email'

interface Campaign {
  id: string
  name: string
  platform: Platform
  status: CampaignStatus
  budget: number
  spent: number
  leads: number
  cpl: number
  roas: number
}

interface LandingPage {
  id: number
  name: string
  url: string
  visitors: number
  leads: number
}

interface ContentItem {
  id: number
  date: string
  day: string
  platform: Platform
  type: string
  title: string
  status: 'Scheduled' | 'Draft' | 'Published'
}

// ─── Mock data ─────────────────────────────────────────────────────────────────

const CAMPAIGNS: Campaign[] = [
  {
    id: 'C-001', name: 'Dubai Hills Q3 — Luxury Villas',
    platform: 'Meta', status: 'Active',
    budget: 15000, spent: 12400, leads: 326, cpl: 38, roas: 4.8,
  },
  {
    id: 'C-002', name: 'Marina Residences — Summer',
    platform: 'Google', status: 'Paused',
    budget: 10000, spent: 8200, leads: 142, cpl: 58, roas: 2.9,
  },
  {
    id: 'C-003', name: 'Palm Summer Collection',
    platform: 'Meta', status: 'Active',
    budget: 8000, spent: 5600, leads: 198, cpl: 28, roas: 6.1,
  },
  {
    id: 'C-004', name: 'Downtown Penthouse Series',
    platform: 'Google', status: 'Active',
    budget: 6000, spent: 4100, leads: 89, cpl: 46, roas: 3.4,
  },
  {
    id: 'C-005', name: 'JVC Affordable Homes',
    platform: 'TikTok', status: 'Active',
    budget: 3000, spent: 1800, leads: 74, cpl: 24, roas: 5.2,
  },
  {
    id: 'C-006', name: 'Emaar Off-Plan Launch',
    platform: 'Meta', status: 'Draft',
    budget: 12000, spent: 0, leads: 0, cpl: 0, roas: 0,
  },
]

const LANDING_PAGES: LandingPage[] = [
  { id: 1, name: 'Palm Summer',        url: 'palmsummer.ae',         visitors: 3240, leads: 187 },
  { id: 2, name: 'Dubai Hills Estate', url: 'dubaihi.ae/q3',         visitors: 2810, leads: 156 },
  { id: 3, name: 'Marina Residences',  url: 'marinares.ae',          visitors: 1980, leads: 94 },
  { id: 4, name: 'Downtown Penthouse', url: 'dtpenthouse.ae',         visitors: 1450, leads: 63 },
  { id: 5, name: 'JVC Townhouses',     url: 'jvchomes.ae',           visitors: 940,  leads: 51 },
  { id: 6, name: 'Creek Harbour 2BR',  url: 'creekharbour.ae/2br',   visitors: 720,  leads: 29 },
]

const CONTENT_CALENDAR: ContentItem[] = [
  { id: 1, date: 'Mon Jun 9',  day: 'Mon', platform: 'Meta',      type: 'Image Ad',     title: 'Palm Jumeirah lifestyle reveal',          status: 'Scheduled' },
  { id: 2, date: 'Mon Jun 9',  day: 'Mon', platform: 'Email',     type: 'Newsletter',   title: 'Monthly market update — June 2026',       status: 'Draft' },
  { id: 3, date: 'Tue Jun 10', day: 'Tue', platform: 'TikTok',    type: 'Video Ad',     title: 'Dubai Hills walkthrough — 90s reel',      status: 'Scheduled' },
  { id: 4, date: 'Wed Jun 11', day: 'Wed', platform: 'WhatsApp',  type: 'Broadcast',    title: 'New Emaar units — VIP early access',      status: 'Scheduled' },
  { id: 5, date: 'Wed Jun 11', day: 'Wed', platform: 'Google',    type: 'Search Ad',    title: 'Updated Marina keywords — summer push',   status: 'Draft' },
  { id: 6, date: 'Thu Jun 12', day: 'Thu', platform: 'Meta',      type: 'Carousel',     title: 'Top 5 areas in Dubai 2026',               status: 'Draft' },
  { id: 7, date: 'Fri Jun 13', day: 'Fri', platform: 'Email',     type: 'Campaign',     title: 'Weekend open house invitations',          status: 'Scheduled' },
]

const DEMOGRAPHICS = [
  { label: 'Age 30–44',          value: 42 },
  { label: 'Age 45–60',          value: 31 },
  { label: 'Age 25–29',          value: 18 },
  { label: 'Age 60+',            value: 9  },
]

const LOCATIONS = [
  { name: 'Dubai Marina',      leads: 89,  pct: 27 },
  { name: 'Downtown Dubai',    leads: 74,  pct: 23 },
  { name: 'Palm Jumeirah',     leads: 62,  pct: 19 },
  { name: 'Dubai Hills Estate', leads: 53, pct: 16 },
  { name: 'Business Bay',      leads: 38,  pct: 12 },
  { name: 'JVC',               leads: 12,  pct: 4  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PLATFORM_STYLES: Record<Platform, { bg: string; text: string; border: string; dot: string }> = {
  Meta:      { bg: 'bg-blue-500/15',    text: 'text-blue-400',    border: 'border-blue-500/30',    dot: 'bg-blue-400' },
  Google:    { bg: 'bg-rose-500/15',    text: 'text-rose-400',    border: 'border-rose-500/30',    dot: 'bg-rose-400' },
  TikTok:    { bg: 'bg-pink-500/15',    text: 'text-pink-400',    border: 'border-pink-500/30',    dot: 'bg-pink-400' },
  WhatsApp:  { bg: 'bg-green-500/15',   text: 'text-green-400',   border: 'border-green-500/30',   dot: 'bg-green-400' },
  Email:     { bg: 'bg-amber-500/15',   text: 'text-amber-400',   border: 'border-amber-500/30',   dot: 'bg-amber-400' },
}

const STATUS_STYLES: Record<CampaignStatus, { bg: string; text: string; border: string }> = {
  Active: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  Paused: { bg: 'bg-amber-500/15',   text: 'text-amber-400',   border: 'border-amber-500/30' },
  Ended:  { bg: 'bg-slate-700/50',   text: 'text-slate-500',   border: 'border-slate-700' },
  Draft:  { bg: 'bg-slate-700/30',   text: 'text-slate-500',   border: 'border-slate-700/50' },
}

const CONTENT_STATUS_STYLES = {
  Scheduled: { bg: 'bg-sky-500/15',     text: 'text-sky-400',     border: 'border-sky-500/30' },
  Draft:     { bg: 'bg-slate-700/30',   text: 'text-slate-500',   border: 'border-slate-700/50' },
  Published: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
}

function fmt(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`
  return String(n)
}

function spendPct(c: Campaign) {
  return c.budget > 0 ? Math.round((c.spent / c.budget) * 100) : 0
}

function convPct(page: LandingPage) {
  return page.visitors > 0 ? ((page.leads / page.visitors) * 100).toFixed(1) : '0.0'
}

// ─── Platform summary cards data ──────────────────────────────────────────────

const PLATFORM_CARDS = [
  {
    name: 'Meta Ads' as const,
    platform: 'Meta' as Platform,
    icon: Globe,
    spend: 'AED 12,400',
    leads: '326',
    cpl: 'AED 38',
    extra: '4.8x ROAS',
    trend: '+14%',
    positive: true,
    detail: 'CPL improved from AED 52 last month',
  },
  {
    name: 'Google Ads' as const,
    platform: 'Google' as Platform,
    icon: TrendingUp,
    spend: 'AED 8,200',
    leads: '142',
    cpl: 'AED 58',
    extra: '2.9x ROAS',
    trend: '-8%',
    positive: false,
    detail: 'CTR dropped 15% — campaign paused for review',
  },
  {
    name: 'WhatsApp' as const,
    platform: 'WhatsApp' as Platform,
    icon: MessageSquare,
    spend: '3 broadcasts',
    leads: '87% open rate',
    cpl: '28 replies',
    extra: '340 contacts',
    trend: '+22%',
    positive: true,
    detail: 'Best open rate in 6 months',
  },
  {
    name: 'Email' as const,
    platform: 'Email' as Platform,
    icon: Mail,
    spend: '5 campaigns',
    leads: '24% open rate',
    cpl: '6.2% CTR',
    extra: '1,240 subs',
    trend: '+5%',
    positive: true,
    detail: 'Monthly newsletter performed above average',
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function MarketingPage() {
  const [campaignFilter, setCampaignFilter] = useState<'All' | CampaignStatus>('All')

  const totalSpend   = CAMPAIGNS.reduce((s, c) => s + c.spent, 0)
  const totalLeads   = CAMPAIGNS.reduce((s, c) => s + c.leads, 0)
  const avgCPL       = totalLeads > 0 ? Math.round(totalSpend / totalLeads) : 0
  const activeCamps  = CAMPAIGNS.filter(c => c.status === 'Active').length

  const filteredCampaigns = campaignFilter === 'All'
    ? CAMPAIGNS
    : CAMPAIGNS.filter(c => c.status === campaignFilter)

  return (
    <div className="min-h-screen bg-[#0D1117] pb-20">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 border-b border-slate-800 bg-[#090C12]/90 backdrop-blur-xl px-6 py-4">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-800">
              <Megaphone className="h-4 w-4 text-slate-300" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">Marketing</h1>
              <p className="mt-0.5 text-xs text-slate-500">
                {activeCamps} active campaigns &middot; AED {(totalSpend / 1000).toFixed(1)}K spent this month
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-xs text-slate-400">
              June 2026
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 pt-6 space-y-6">

        {/* ── Top-level metrics ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            { label: 'Total Ad Spend',   value: `AED ${(totalSpend / 1000).toFixed(1)}K`,  sub: 'across all platforms',     color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
            { label: 'Total Leads',      value: String(totalLeads),                         sub: 'from all campaigns',        color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
            { label: 'Blended CPL',      value: `AED ${avgCPL}`,                            sub: 'cost per lead',             color: 'text-sky-400',     bg: 'bg-sky-500/10 border-sky-500/20' },
            { label: 'Active Campaigns', value: String(activeCamps),                        sub: 'currently running',         color: 'text-[#D4AF37]',   bg: 'bg-[#D4AF37]/10 border-[#D4AF37]/20' },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className={['mb-3 inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium', s.bg, s.color].join(' ')}>
                {s.label}
              </div>
              <p className={['text-2xl font-semibold tabular-nums', s.color].join(' ')}>{s.value}</p>
              <p className="mt-1 text-xs text-slate-600">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* ── Platform summary cards ───────────────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {PLATFORM_CARDS.map(card => {
            const pStyle = PLATFORM_STYLES[card.platform]
            const TrendIcon = card.positive ? TrendingUp : TrendingDown
            return (
              <div
                key={card.name}
                className="rounded-xl border border-slate-800 bg-slate-900 p-5"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className={[
                      'flex h-7 w-7 items-center justify-center rounded-lg border',
                      pStyle.bg, pStyle.border,
                    ].join(' ')}>
                      <card.icon className={['h-3.5 w-3.5', pStyle.text].join(' ')} />
                    </div>
                    <span className="text-sm font-semibold text-white">{card.name}</span>
                  </div>
                  <div className={['flex items-center gap-1 text-xs font-medium', card.positive ? 'text-emerald-400' : 'text-red-400'].join(' ')}>
                    <TrendIcon className="h-3 w-3" />
                    {card.trend}
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Spend</span>
                    <span className="text-xs font-semibold text-slate-200">{card.spend}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Leads</span>
                    <span className={['text-xs font-semibold', pStyle.text].join(' ')}>{card.leads}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">CPL</span>
                    <span className="text-xs font-semibold text-slate-200">{card.cpl}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Perf.</span>
                    <span className="text-xs font-semibold text-slate-300">{card.extra}</span>
                  </div>
                </div>

                <p className="mt-3 border-t border-slate-800 pt-3 text-xs text-slate-500 leading-relaxed">
                  {card.detail}
                </p>
              </div>
            )
          })}
        </div>

        {/* ── Active campaigns table ───────────────────────────────────────── */}
        <div className="rounded-xl border border-slate-800 bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-3.5">
            <span className="text-sm font-semibold text-white">Active Campaigns</span>
            <div className="flex items-center gap-1">
              {(['All', 'Active', 'Paused', 'Draft', 'Ended'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setCampaignFilter(f)}
                  className={[
                    'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                    campaignFilter === f
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-500 hover:text-slate-300',
                  ].join(' ')}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Table header */}
          <div className="hidden lg:grid grid-cols-[1fr_90px_80px_90px_90px_60px_60px_80px] gap-3 border-b border-slate-800 px-5 py-2.5">
            {['Campaign', 'Platform', 'Status', 'Budget', 'Spent', 'Leads', 'CPL', 'ROAS'].map(h => (
              <span key={h} className="text-xs font-semibold uppercase tracking-wider text-slate-500">{h}</span>
            ))}
          </div>

          <div className="divide-y divide-slate-800">
            {filteredCampaigns.map(c => {
              const pStyle  = PLATFORM_STYLES[c.platform]
              const sStyle  = STATUS_STYLES[c.status]
              const budPct  = spendPct(c)
              return (
                <div key={c.id} className="group px-5 py-3.5 hover:bg-slate-800/30 transition-colors">
                  {/* Desktop */}
                  <div className="hidden lg:grid grid-cols-[1fr_90px_80px_90px_90px_60px_60px_80px] gap-3 items-center">
                    {/* Name */}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-100 truncate">{c.name}</p>
                      <p className="text-xs text-slate-600">{c.id}</p>
                    </div>
                    {/* Platform */}
                    <span className={[
                      'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium w-fit',
                      pStyle.bg, pStyle.text, pStyle.border,
                    ].join(' ')}>
                      <span className={['h-1.5 w-1.5 rounded-full', pStyle.dot].join(' ')} />
                      {c.platform}
                    </span>
                    {/* Status */}
                    <span className={[
                      'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium w-fit',
                      sStyle.bg, sStyle.text, sStyle.border,
                    ].join(' ')}>
                      {c.status === 'Active' ? <Play className="h-2.5 w-2.5" /> : <Pause className="h-2.5 w-2.5" />}
                      {c.status}
                    </span>
                    {/* Budget */}
                    <div>
                      <span className="text-xs text-slate-300 tabular-nums">AED {fmt(c.budget)}</span>
                    </div>
                    {/* Spent */}
                    <div>
                      <p className="text-xs text-slate-300 tabular-nums">AED {fmt(c.spent)}</p>
                      {c.budget > 0 && (
                        <div className="mt-1 h-1 w-14 rounded-full bg-slate-800">
                          <div
                            className={[
                              'h-full rounded-full',
                              budPct >= 90 ? 'bg-red-500' : budPct >= 70 ? 'bg-amber-500' : 'bg-emerald-500',
                            ].join(' ')}
                            style={{ width: `${budPct}%` }}
                          />
                        </div>
                      )}
                    </div>
                    {/* Leads */}
                    <span className="text-sm font-semibold text-emerald-400 tabular-nums">{c.leads || '—'}</span>
                    {/* CPL */}
                    <span className="text-xs text-slate-300 tabular-nums">{c.cpl ? `AED ${c.cpl}` : '—'}</span>
                    {/* ROAS */}
                    <span className={[
                      'text-sm font-semibold tabular-nums',
                      c.roas >= 4 ? 'text-emerald-400' : c.roas >= 2 ? 'text-amber-400' : c.roas === 0 ? 'text-slate-600' : 'text-red-400',
                    ].join(' ')}>
                      {c.roas ? `${c.roas}x` : '—'}
                    </span>
                  </div>

                  {/* Mobile */}
                  <div className="lg:hidden space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-slate-100">{c.name}</p>
                        <p className="text-xs text-slate-600">{c.id}</p>
                      </div>
                      <span className={[
                        'shrink-0 inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium',
                        sStyle.bg, sStyle.text, sStyle.border,
                      ].join(' ')}>
                        {c.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className={['rounded border px-2 py-0.5', pStyle.bg, pStyle.text, pStyle.border].join(' ')}>{c.platform}</span>
                      <span className="text-slate-400">Budget: AED {fmt(c.budget)}</span>
                      <span className="text-slate-400">Spent: AED {fmt(c.spent)}</span>
                      <span className="text-emerald-400 font-medium">{c.leads} leads</span>
                      {c.cpl > 0 && <span className="text-slate-400">CPL: AED {c.cpl}</span>}
                      {c.roas > 0 && <span className="font-semibold text-[#D4AF37]">{c.roas}x ROAS</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Audience + Landing Pages ─────────────────────────────────────── */}
        <div className="grid gap-6 xl:grid-cols-2">

          {/* Audience insights */}
          <div className="rounded-xl border border-slate-800 bg-slate-900">
            <div className="border-b border-slate-800 px-5 py-3.5">
              <p className="text-sm font-semibold text-white">Audience Insights</p>
              <p className="mt-0.5 text-xs text-slate-500">Lead demographics & top locations</p>
            </div>
            <div className="p-5 space-y-5">
              {/* Age demographics */}
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Age Distribution</p>
                <div className="space-y-2.5">
                  {DEMOGRAPHICS.map(d => (
                    <div key={d.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-400">{d.label}</span>
                        <span className="text-xs font-semibold text-slate-200">{d.value}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-[#D4AF37]/70"
                          style={{ width: `${d.value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top locations */}
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Top Locations</p>
                <div className="space-y-2">
                  {LOCATIONS.map(loc => (
                    <div key={loc.name} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-slate-300 truncate">{loc.name}</span>
                          <span className="text-xs text-slate-400 ml-2 shrink-0">{loc.leads} leads</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full bg-sky-500/60"
                            style={{ width: `${loc.pct}%` }}
                          />
                        </div>
                      </div>
                      <span className="shrink-0 w-8 text-right text-xs font-semibold text-sky-400">{loc.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Landing page performance */}
          <div className="rounded-xl border border-slate-800 bg-slate-900">
            <div className="border-b border-slate-800 px-5 py-3.5">
              <p className="text-sm font-semibold text-white">Landing Page Performance</p>
              <p className="mt-0.5 text-xs text-slate-500">Visitors, leads & conversion rates</p>
            </div>

            {/* Header */}
            <div className="grid grid-cols-[1fr_80px_60px_70px] gap-3 border-b border-slate-800 px-5 py-2.5">
              {['Page', 'Visitors', 'Leads', 'Conv %'].map(h => (
                <span key={h} className="text-xs font-semibold uppercase tracking-wider text-slate-500">{h}</span>
              ))}
            </div>

            <div className="divide-y divide-slate-800">
              {LANDING_PAGES.map(page => {
                const conv = parseFloat(convPct(page))
                return (
                  <div key={page.id} className="grid grid-cols-[1fr_80px_60px_70px] gap-3 items-center px-5 py-3 hover:bg-slate-800/30 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-100 truncate">{page.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <ExternalLink className="h-2.5 w-2.5 text-slate-600" />
                        <span className="text-xs text-slate-600 truncate">{page.url}</span>
                      </div>
                    </div>
                    <span className="text-sm tabular-nums text-slate-300">{fmt(page.visitors)}</span>
                    <span className="text-sm font-semibold tabular-nums text-emerald-400">{page.leads}</span>
                    <div>
                      <span className={[
                        'text-sm font-semibold tabular-nums',
                        conv >= 7 ? 'text-emerald-400' : conv >= 4 ? 'text-amber-400' : 'text-slate-400',
                      ].join(' ')}>
                        {conv}%
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Content calendar ─────────────────────────────────────────────── */}
        <div className="rounded-xl border border-slate-800 bg-slate-900">
          <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-5 py-3.5">
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-slate-400" />
              <span className="text-sm font-semibold text-white">Content Calendar</span>
            </div>
            <span className="text-xs text-slate-500">Week of Jun 9 – 13, 2026</span>
          </div>

          <div className="divide-y divide-slate-800">
            {CONTENT_CALENDAR.map(item => {
              const pStyle = PLATFORM_STYLES[item.platform]
              const sStyle = CONTENT_STATUS_STYLES[item.status]
              return (
                <div key={item.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-800/30 transition-colors">
                  {/* Date */}
                  <div className="w-[70px] shrink-0">
                    <p className="text-xs font-semibold text-slate-400">{item.date.split(' ').slice(0, 2).join(' ')}</p>
                  </div>

                  {/* Platform */}
                  <span className={[
                    'shrink-0 inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium',
                    pStyle.bg, pStyle.text, pStyle.border,
                  ].join(' ')}>
                    <span className={['h-1.5 w-1.5 rounded-full', pStyle.dot].join(' ')} />
                    {item.platform}
                  </span>

                  {/* Type */}
                  <span className="shrink-0 text-xs text-slate-500 w-[80px]">{item.type}</span>

                  {/* Title */}
                  <p className="flex-1 min-w-0 text-sm text-slate-200 truncate">{item.title}</p>

                  {/* Status */}
                  <span className={[
                    'shrink-0 inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium',
                    sStyle.bg, sStyle.text, sStyle.border,
                  ].join(' ')}>
                    {item.status === 'Scheduled' ? <Clock className="h-2.5 w-2.5" /> :
                     item.status === 'Published' ? <CheckCircle2 className="h-2.5 w-2.5" /> :
                                                    <AlertCircle className="h-2.5 w-2.5" />}
                    {item.status}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── AI Marketing Suggestion ──────────────────────────────────────── */}
        <div className="rounded-xl border border-[#D4AF37]/20 bg-[#D4AF37]/[0.03] p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/10">
              <Sparkles className="h-4.5 w-4.5 text-[#D4AF37]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-sm font-semibold text-white">AI Marketing Suggestion</p>
                <span className="rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2.5 py-0.5 text-xs font-medium text-[#D4AF37]">
                  High Confidence
                </span>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">
                Your Meta campaign <span className="font-semibold text-white">"Palm Summer"</span> has the lowest CPL at AED 28 and a strong 6.1x ROAS — significantly outperforming the Google campaign at AED 58 CPL. Recommend reallocating <span className="font-semibold text-white">AED 3,000</span> from the paused Google "Marina Residences" budget into Meta to capture the remaining June peak season. Target the <span className="font-semibold text-white">Dubai Marina</span> and <span className="font-semibold text-white">Palm Jumeirah</span> segments, which together account for 46% of total leads.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {['Reallocate Google Budget', 'Expand Palm Summer Reach', 'Target Marina Segment'].map(action => (
                  <button
                    key={action}
                    className="rounded-lg border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-3 py-1.5 text-xs font-medium text-[#D4AF37] transition hover:bg-[#D4AF37]/15"
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
