'use client'

import { useState } from 'react'
import { Sparkles, Loader2, Bot, TrendingDown, AlertTriangle, TrendingUp, MessageCircle, Gauge, Home, BarChart3, CheckCircle2 } from 'lucide-react'
import { inventoryProperties, getInventoryStats } from '@/src/features/freehold-intelligence/inventory'
import { financeSummary } from '@/src/features/freehold-intelligence/finance'
import { siteAnalytics } from '@/src/features/freehold-intelligence/analytics'

// ─── derived values ────────────────────────────────────────────────────────────
const stats = getInventoryStats()

const kpiCards = [
  {
    label: 'Total Ad Spend (30d)',
    value: `AED ${financeSummary.totalSpend30d.toLocaleString()}`,
    sub: 'Combined Meta + Google',
  },
  {
    label: 'Avg Cost Per Lead',
    value: `AED ${financeSummary.avgCpl30d}`,
    sub: 'Down 17% vs last month',
  },
  {
    label: 'Total Leads (30d)',
    value: financeSummary.totalLeads30d.toLocaleString(),
    sub: 'Across all campaigns',
  },
  {
    label: 'Site Visitors (30d)',
    value: siteAnalytics.totalUniqueSessions.toLocaleString(),
    sub: 'Unique sessions',
  },
  {
    label: 'Ad-Ready Properties',
    value: `${stats.adReady} / ${stats.total}`,
    sub: 'Readiness score ≥ 70%',
  },
  {
    label: 'Live Landing Pages',
    value: String(stats.live),
    sub: `${stats.missingLanding} missing`,
  },
]

// ─── insight types ─────────────────────────────────────────────────────────────
type Priority = 'Critical' | 'High' | 'Opportunity' | 'Info'

interface Insight {
  icon: React.ElementType
  title: string
  detail: string
  priority: Priority
  time: string
}

const insights: Insight[] = [
  {
    icon: TrendingDown,
    title: 'CPL dropped 17% month-over-month',
    detail:
      'Cost per lead fell from AED 91.3 to AED 75.4. Golden Visa targeting driving cheaper GCC leads. Recommend increasing Google budget by 20%.',
    priority: 'Opportunity',
    time: '2 hours ago',
  },
  {
    icon: AlertTriangle,
    title: 'Marina Luxury Residences: 0 leads, adReadiness 12%',
    detail:
      'No landing page, no images, no campaigns. Complete setup required before any ad spend.',
    priority: 'Critical',
    time: '3 hours ago',
  },
  {
    icon: TrendingUp,
    title: 'JVC Apartments ROI 8.1% — highest in portfolio',
    detail:
      'Highest yielding property generates only 56 leads/month vs Palm Jumeirah at 94. ROI story undertold in current ad copy.',
    priority: 'Opportunity',
    time: '5 hours ago',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp referrals convert at 7.1%',
    detail:
      'WhatsApp referral traffic converts at 7.1% — 2.5x better than Google Ads (3.7%) and 2x Meta (3.4%). Consider a WhatsApp-first campaign strategy.',
    priority: 'High',
    time: '6 hours ago',
  },
  {
    icon: Gauge,
    title: 'Budget utilization optimal at 72%',
    detail:
      'Meta at 73.7%, Google at 71.5%. Headroom exists for scale. Recommend testing Sobha Hartland and Creek Harbour before end of month.',
    priority: 'Info',
    time: '8 hours ago',
  },
  {
    icon: Home,
    title: '3 properties missing landing pages',
    detail:
      'Marina Luxury Residences, Creek Harbour Tower, and RAK Waterfront have no live landing pages. Combined potential: 14 available units. Estimated 30 additional leads/month if live.',
    priority: 'High',
    time: '12 hours ago',
  },
]

const priorityConfig: Record<Priority, { label: string; className: string }> = {
  Critical:    { label: 'Critical',    className: 'bg-red-500/10 border border-red-500/25 text-red-400' },
  High:        { label: 'High',        className: 'bg-amber-500/10 border border-amber-500/25 text-amber-400' },
  Opportunity: { label: 'Opportunity', className: 'bg-[#D4AF37]/10 border border-emerald-500/25 text-[#D4AF37]' },
  Info:        { label: 'Info',        className: 'bg-sky-500/10 border border-sky-500/25 text-white/55' },
}

// ─── content performance table ─────────────────────────────────────────────────
const contentRows = [
  { section: 'Property Listings',  items: 8,  published: 4, avgSeo: 81, status: 'Good' },
  { section: 'Area Guides',        items: 12, published: 7, avgSeo: 75, status: 'Needs work' },
  { section: 'Developer Profiles', items: 10, published: 6, avgSeo: 74, status: 'Needs work' },
  { section: 'Website Pages',      items: 10, published: 7, avgSeo: 70, status: 'Review' },
  { section: 'Blog Topics',        items: 12, published: 3, avgSeo: 77, status: 'Good' },
]

function seoColor(score: number) {
  if (score >= 80) return 'text-[#D4AF37]'
  if (score >= 60) return 'text-[#D4AF37]'
  return 'text-red-400'
}

function statusBadge(status: string) {
  if (status === 'Good')       return 'bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-[#D4AF37]'
  if (status === 'Needs work') return 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
  return 'bg-white/[0.05] border border-white/10 text-white/50'
}

// ─── recommended actions ───────────────────────────────────────────────────────
const actions = [
  {
    n: 1,
    title: 'Launch Creek Harbour campaign',
    detail:
      'Set up landing page (readiness 35%), link 1 Meta + 1 Google campaign. Est. 20 leads/month.',
  },
  {
    n: 2,
    title: 'Fix Marina property data',
    detail:
      'Upload images, write description, set ad-readiness. Currently blocking AED 4.8M inventory from any campaign.',
  },
  {
    n: 3,
    title: 'Scale JVC budget',
    detail:
      'Increase JVC Investor campaign budget from AED 200/day to AED 350/day. ROI 8.1% makes this the highest yield play.',
  },
]

// ─── page ──────────────────────────────────────────────────────────────────────
export default function InsightsPage() {
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated]   = useState(false)

  function handleGenerate() {
    if (generating) return
    setGenerating(true)
    setGenerated(false)
    setTimeout(() => {
      setGenerating(false)
      setGenerated(true)
    }, 1500)
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-10 sm:px-6 sm:pt-14">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 text-[13px] font-medium uppercase tracking-[0.22em] text-white/55/80">
        <Bot className="h-3.5 w-3.5" />
        AI Manager · Insights
      </div>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[30px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[40px]">
            AI System Insights
          </h1>
          <p className="mt-2 max-w-xl text-sm text-white/50">
            Machine-generated analysis across inventory, ad spend, site traffic, and lead performance
          </p>
        </div>

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="mt-1 flex shrink-0 items-center gap-2 self-start rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-sm font-medium text-white/55 transition hover:bg-rose-500/20 disabled:opacity-60"
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              {generated ? 'Report Ready' : 'Generate Report'}
            </>
          )}
        </button>
      </div>

      {generated && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#D4AF37]/20 bg-[#D4AF37]/10 px-4 py-3 text-sm text-[#D4AF37]">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Report generated — insights refreshed from latest data.
        </div>
      )}

      {/* ── Section 1: System Snapshot ─────────────────────────────────────── */}
      <section className="mt-10">
        <div className="flex items-center gap-2 mb-5">
          <BarChart3 className="h-4 w-4 text-white/55" />
          <h2 className="text-sm font-semibold text-white/90 uppercase tracking-wider">System Snapshot</h2>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {kpiCards.map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-5"
            >
              <div className="text-[13px] font-medium uppercase tracking-widest text-white/35">
                {card.label}
              </div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-white">
                {card.value}
              </div>
              <div className="mt-1 text-xs text-white/40">{card.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Section 2: AI Insights Feed ────────────────────────────────────── */}
      <section className="mt-12">
        <div className="flex items-center gap-2 mb-5">
          <Sparkles className="h-4 w-4 text-white/55" />
          <h2 className="text-sm font-semibold text-white/90 uppercase tracking-wider">AI Insights Feed</h2>
        </div>

        <div className="flex flex-col gap-3">
          {insights.map((insight) => {
            const Icon   = insight.icon
            const badge  = priorityConfig[insight.priority]
            return (
              <div
                key={insight.title}
                className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-5"
              >
                <div className="flex items-start gap-4">
                  {/* rose sparkles icon */}
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10">
                    <Sparkles className="h-4 w-4 text-white/55" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-white/90">{insight.title}</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold uppercase tracking-wider ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-white/55">{insight.detail}</p>
                    <p className="mt-2 text-[13px] text-white/25">{insight.time}</p>
                  </div>

                  {/* contextual insight icon */}
                  <div className="hidden shrink-0 sm:block">
                    <Icon className="h-4 w-4 text-white/20" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Section 3: Content Performance by Section ──────────────────────── */}
      <section className="mt-12">
        <div className="flex items-center gap-2 mb-5">
          <BarChart3 className="h-4 w-4 text-white/55" />
          <h2 className="text-sm font-semibold text-white/90 uppercase tracking-wider">Content Performance by Section</h2>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/[0.05] bg-white/[0.03]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.05]">
                {['Section', 'Items', 'Published', 'Avg SEO', 'Status'].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3.5 text-left text-[13px] font-semibold uppercase tracking-widest text-white/30"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contentRows.map((row, i) => (
                <tr
                  key={row.section}
                  className={[
                    'transition hover:bg-white/[0.02]',
                    i !== contentRows.length - 1 ? 'border-b border-white/[0.04]' : '',
                  ].join(' ')}
                >
                  <td className="px-5 py-4 font-medium text-white/80">{row.section}</td>
                  <td className="px-5 py-4 text-white/50">{row.items}</td>
                  <td className="px-5 py-4 text-white/50">{row.published}</td>
                  <td className={`px-5 py-4 font-semibold ${seoColor(row.avgSeo)}`}>
                    {row.avgSeo}/100
                  </td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-2.5 py-0.5 text-[13px] font-medium ${statusBadge(row.status)}`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Section 4: Recommended Actions ────────────────────────────────── */}
      <section className="mt-12">
        <div className="flex items-center gap-2 mb-5">
          <CheckCircle2 className="h-4 w-4 text-white/55" />
          <h2 className="text-sm font-semibold text-white/90 uppercase tracking-wider">Recommended Actions</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {actions.map((action) => (
            <div
              key={action.n}
              className="flex flex-col gap-4 rounded-2xl border border-white/[0.05] bg-white/[0.03] p-5"
            >
              {/* number badge */}
              <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-sm font-bold text-white/55">
                {action.n}
              </div>
              <div>
                <div className="text-sm font-semibold text-white/90">{action.title}</div>
                <p className="mt-1.5 text-xs leading-relaxed text-white/50">{action.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}
