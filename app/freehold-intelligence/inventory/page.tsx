'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search, LayoutGrid, ArrowUpRight, Sparkles, TrendingUp, Wrench, Rocket, AlertTriangle } from 'lucide-react'
import {
  inventoryProperties,
  getInventoryStats,
  getInventoryAnalysis,
  type InventoryProperty,
  type PropertyStatus,
  type LandingStatus,
  type AdCandidate,
  type AdVerdict,
} from '@/src/features/freehold-intelligence/inventory'
import { AiPrompt } from '@/components/freehold/ai-prompt'

function formatPrice(n: number | null): string {
  if (n === null) return '—'
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`
  return `AED ${(n / 1_000).toFixed(0)}K`
}

function statusBadge(status: PropertyStatus) {
  switch (status) {
    case 'active':
    case 'ready':
      return 'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/20'
    case 'off_plan':
      return 'bg-blue-400/10 text-blue-300 border-blue-400/20'
    case 'under_construction':
      return 'bg-amber-400/10 text-amber-300 border-amber-400/20'
    case 'sold_out':
      return 'bg-red-400/10 text-red-300 border-red-400/20'
    case 'coming_soon':
      return 'bg-violet-400/10 text-white/55 border-violet-400/20'
    default:
      return 'bg-white/[0.04] text-white/40 border-white/[0.08]'
  }
}

function statusLabel(status: PropertyStatus): string {
  switch (status) {
    case 'active': return 'Active'
    case 'ready': return 'Ready'
    case 'off_plan': return 'Off Plan'
    case 'under_construction': return 'Under Construction'
    case 'sold_out': return 'Sold Out'
    case 'coming_soon': return 'Coming Soon'
  }
}

function landingBadge(status: LandingStatus) {
  switch (status) {
    case 'live':
      return 'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/20'
    case 'draft':
      return 'bg-amber-400/10 text-amber-300 border-amber-400/20'
    case 'pending_review':
      return 'bg-blue-400/10 text-blue-300 border-blue-400/20'
    case 'missing':
      return 'bg-rose-400/10 text-white/55 border-rose-400/20'
  }
}

function landingLabel(status: LandingStatus): string {
  switch (status) {
    case 'live': return 'Live'
    case 'draft': return 'Draft'
    case 'pending_review': return 'Pending Review'
    case 'missing': return 'Missing'
  }
}

function readinessBar(value: number) {
  if (value >= 80) return 'bg-[#D4AF37]'
  if (value >= 50) return 'bg-[#D4AF37]'
  return 'bg-red-400'
}

type FilterStatus = 'all' | PropertyStatus

const FILTERS: { value: FilterStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'off_plan', label: 'Off Plan' },
  { value: 'ready', label: 'Ready' },
  { value: 'under_construction', label: 'Under Construction' },
  { value: 'coming_soon', label: 'Coming Soon' },
]

const VERDICT_META: Record<AdVerdict, { label: string; cls: string; Icon: typeof Rocket }> = {
  scale:     { label: 'Scale',     cls: 'border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-300', Icon: TrendingUp },
  launch:    { label: 'Launch',    cls: 'border-[#D4AF37]/25 bg-[#D4AF37]/[0.07] text-[#F8E7AE]',       Icon: Rocket },
  fix_first: { label: 'Fix first', cls: 'border-amber-400/25 bg-amber-400/[0.06] text-amber-300',        Icon: Wrench },
  hold:      { label: 'Hold',      cls: 'border-white/[0.1] bg-white/[0.03] text-white/45',              Icon: AlertTriangle },
}

function CandidateCard({ c }: { c: AdCandidate }) {
  const m = VERDICT_META[c.verdict]
  return (
    <div className="flex flex-col rounded-[16px] border border-white/[0.07] bg-[#131B2B] p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold text-white/90">{c.name}</div>
          <div className="mt-0.5 truncate text-[11px] text-white/35">{c.area} · {c.developer}</div>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${m.cls}`}>
          <m.Icon className="h-3 w-3" /> {m.label}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-3 text-[11px] text-white/40">
        <span className="font-semibold tabular-nums text-white/70">{c.score}<span className="text-white/30">/100</span></span>
        {c.roi !== null && <span className="text-[#D4AF37]/80">{c.roi.toFixed(1)}% ROI</span>}
        <span>{c.leads30d} leads</span>
      </div>

      <ul className="mt-3 space-y-1">
        {c.reasons.slice(0, 2).map((r, i) => (
          <li key={i} className="flex gap-1.5 text-[11px] leading-snug text-white/45">
            <span className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-white/25" />{r}
          </li>
        ))}
      </ul>

      <div className="mt-3 border-t border-white/[0.05] pt-2.5 text-[11px] text-[#D4AF37]/75">{c.nextAction}</div>
    </div>
  )
}

export default function InventoryPage() {
  const stats = getInventoryStats()
  const analysis = getInventoryAnalysis()
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [query, setQuery] = useState('')

  const filtered = inventoryProperties
    .filter((p) => filter === 'all' || p.status === filter)
    .filter((p) => {
      if (!query.trim()) return true
      const q = query.toLowerCase()
      return (
        p.name.toLowerCase().includes(q) ||
        p.area.toLowerCase().includes(q) ||
        p.developer.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => b.adReadiness - a.adReadiness)

  return (
    <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      {/* Header */}
      <section>
        <div className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-wider text-[#D4AF37]/85">
          <LayoutGrid className="h-3.5 w-3.5" /> Freehold Intelligence
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white/90">
          Inventory
        </h1>

        {/* Stats row */}
        <div className="mt-6 flex flex-wrap gap-3">
          {[
            { label: 'Total properties', value: stats.total },
            { label: 'Live landings', value: stats.live, accent: 'text-[#D4AF37]' },
            { label: 'Missing landing', value: stats.missingLanding, accent: 'text-white/55' },
            { label: 'Ad-ready', value: stats.adReady, accent: 'text-[#D4AF37]' },
          ].map(({ label, value, accent }) => (
            <div
              key={label}
              className="rounded-[14px] border border-white/[0.08] bg-white/[0.03] px-4 py-3"
            >
              <div className="text-[12px] font-medium uppercase tracking-[0.18em] text-white/35">{label}</div>
              <div className={`mt-1 text-[24px] font-semibold tabular-nums leading-none ${accent ?? 'text-white'}`}>
                {value}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Ad-readiness analysis ─────────────────────────────────────────── */}
      <section className="mt-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-wider text-[#D4AF37]/85">
            <Sparkles className="h-3.5 w-3.5" /> Which to advertise
          </div>
          <div className="flex items-center gap-3 text-[11px] text-white/35">
            <span className="text-emerald-300">{analysis.counts.scale} scale</span>
            <span className="text-[#F8E7AE]">{analysis.counts.launch} launch</span>
            <span className="text-amber-300">{analysis.counts.fixFirst} fix first</span>
          </div>
        </div>
        <p className="mt-1.5 text-[12px] text-white/35">
          Ranked by a composite of ad readiness, ROI, lead momentum, data quality and landing status.
        </p>

        {/* Top picks */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {analysis.topPicks.map((c) => <CandidateCard key={c.id} c={c} />)}
        </div>

        {/* Fix-first + missed opportunities */}
        {(analysis.fixFirst.length > 0 || analysis.missedOpportunities.length > 0) && (
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {analysis.fixFirst.length > 0 && (
              <div className="rounded-[16px] border border-amber-400/15 bg-amber-400/[0.03] p-4">
                <div className="flex items-center gap-1.5 text-[12px] font-medium text-amber-300/90">
                  <Wrench className="h-3.5 w-3.5" /> Fix first — high potential, blocked
                </div>
                <ul className="mt-3 space-y-2">
                  {analysis.fixFirst.map((c) => (
                    <li key={c.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-medium text-white/80">{c.name}</div>
                        <div className="truncate text-[11px] text-white/35">{c.nextAction}</div>
                      </div>
                      <Link href={`/freehold-intelligence/inventory/${c.id}`} className="shrink-0 text-[11px] text-[#D4AF37]/70 hover:text-[#D4AF37]">Open</Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {analysis.missedOpportunities.length > 0 && (
              <div className="rounded-[16px] border border-rose-400/15 bg-rose-400/[0.03] p-4">
                <div className="flex items-center gap-1.5 text-[12px] font-medium text-rose-300/90">
                  <AlertTriangle className="h-3.5 w-3.5" /> Missed — high ROI, no landing page
                </div>
                <ul className="mt-3 space-y-2">
                  {analysis.missedOpportunities.map((c) => (
                    <li key={c.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-medium text-white/80">{c.name}</div>
                        <div className="truncate text-[11px] text-white/35">{c.roi?.toFixed(1)}% ROI · build landing to capture demand</div>
                      </div>
                      <Link href={`/freehold-intelligence/inventory/${c.id}/generate`} className="shrink-0 text-[11px] text-[#D4AF37]/70 hover:text-[#D4AF37]">Build LP</Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Web Designer AI */}
        <div className="mt-5 rounded-[18px] border border-[#D4AF37]/12 bg-gradient-to-br from-[#D4AF37]/[0.04] to-transparent p-5">
          <div className="mb-3 flex items-center gap-2 text-[12px] font-medium uppercase tracking-wider text-[#D4AF37]/80">
            <Sparkles className="h-3.5 w-3.5" /> Web Designer
          </div>
          <AiPrompt
            skill="web_designer"
            placeholder="Ask the Web Designer which properties to advertise, or to design a landing page…"
            suggestions={[
              'Which 3 properties should we advertise this week, and why?',
              'Design a landing page hero for the top pick.',
              'Which listings are wasting budget and should pause?',
              'What single fix unblocks the most properties?',
            ]}
            context={{
              topPicks: analysis.topPicks.map((c) => ({ name: c.name, area: c.area, score: c.score, roi: c.roi, leads30d: c.leads30d, landing: c.landingStatus, verdict: c.verdict })),
              fixFirst: analysis.fixFirst.map((c) => ({ name: c.name, nextAction: c.nextAction })),
              missedOpportunities: analysis.missedOpportunities.map((c) => ({ name: c.name, roi: c.roi })),
              counts: analysis.counts,
            }}
          />
        </div>
      </section>

      {/* Controls */}
      <div className="mt-10 flex flex-wrap items-center gap-3">
        {/* Filter pills */}
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={[
                'rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition',
                filter === f.value
                  ? 'border-[#D4AF37]/40 bg-[#D4AF37]/[0.1] text-[#F8E7AE]'
                  : 'border-white/[0.07] bg-white/[0.02] text-white/50 hover:border-white/20 hover:text-white/80',
              ].join(' ')}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />
          <input
            type="text"
            placeholder="Search name, area, developer…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-[12px] border border-white/[0.07] bg-white/[0.03] py-2 pl-8 pr-4 text-[13px] text-white placeholder:text-white/25 focus:border-[#D4AF37]/35 focus:outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="mt-5 overflow-x-auto rounded-[20px] border border-white/[0.08] bg-white/[0.02]">
        <table className="w-full min-w-[1060px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-white/[0.05]">
              {[
                'Name',
                'Area / Developer',
                'Status',
                'Starting Price',
                'Bedrooms',
                'ROI %',
                'Landing',
                'Data Quality',
                'Ad Readiness',
                'Leads 30d',
                'Actions',
              ].map((col) => (
                <th
                  key={col}
                  className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-[0.18em] text-white/35 first:pl-5 last:pr-5"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-16 text-center text-[13px] text-white/25">
                  No properties match your filters.
                </td>
              </tr>
            ) : (
              filtered.map((prop) => (
                <PropertyRow key={prop.id} prop={prop} />
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[13px] text-white/25">
        {filtered.length} of {inventoryProperties.length} properties · sorted by ad readiness
      </p>
    </div>
  )
}

function PropertyRow({ prop }: { prop: InventoryProperty }) {
  return (
    <tr className="group transition hover:bg-white/[0.02]">
      {/* Name */}
      <td className="max-w-[200px] pl-5 pr-4 py-3.5">
        <div className="truncate font-medium text-white/90">{prop.name}</div>
        <div className="mt-0.5 text-[13px] capitalize text-white/35">{prop.type}</div>
      </td>

      {/* Area / Developer */}
      <td className="px-4 py-3.5">
        <div className="text-white/75">{prop.area}</div>
        <div className="mt-0.5 text-[13px] text-white/35">{prop.developer}</div>
      </td>

      {/* Status */}
      <td className="px-4 py-3.5">
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[13px] font-medium ${statusBadge(prop.status)}`}>
          {statusLabel(prop.status)}
        </span>
      </td>

      {/* Starting price */}
      <td className="px-4 py-3.5 tabular-nums text-white/75">
        {formatPrice(prop.startingPriceAED)}
      </td>

      {/* Bedrooms */}
      <td className="px-4 py-3.5 text-white/60">
        {prop.bedrooms}
      </td>

      {/* ROI */}
      <td className="px-4 py-3.5 tabular-nums">
        {prop.roi !== null ? (
          <span className="text-[#D4AF37]">{prop.roi.toFixed(1)}%</span>
        ) : (
          <span className="text-white/25">—</span>
        )}
      </td>

      {/* Landing status */}
      <td className="px-4 py-3.5">
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[13px] font-medium ${landingBadge(prop.landingStatus)}`}>
          {landingLabel(prop.landingStatus)}
        </span>
      </td>

      {/* Data quality */}
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/[0.07]">
            <div
              className={`h-full rounded-full ${readinessBar(prop.dataQuality)}`}
              style={{ width: `${prop.dataQuality}%` }}
            />
          </div>
          <span className="tabular-nums text-[13px] text-white/40">{prop.dataQuality}</span>
        </div>
      </td>

      {/* Ad readiness */}
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/[0.07]">
            <div
              className={`h-full rounded-full ${readinessBar(prop.adReadiness)}`}
              style={{ width: `${prop.adReadiness}%` }}
            />
          </div>
          <span className="tabular-nums text-[13px] text-white/40">{prop.adReadiness}</span>
        </div>
      </td>

      {/* Leads 30d */}
      <td className="px-4 py-3.5 tabular-nums text-white/60">
        {prop.leads30d > 0 ? (
          <span className={prop.leads30d >= 50 ? 'text-white/90' : ''}>{prop.leads30d}</span>
        ) : (
          <span className="text-white/25">0</span>
        )}
      </td>

      {/* Actions */}
      <td className="pr-5 pl-4 py-3.5">
        <div className="flex items-center gap-2">
          <Link
            href={`/freehold-intelligence/inventory/${prop.id}`}
            className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[13px] text-white/60 transition hover:border-white/20 hover:text-white"
          >
            View <ArrowUpRight className="h-3 w-3" />
          </Link>
          <Link
            href={`/freehold-intelligence/inventory/${prop.id}/generate`}
            className="inline-flex items-center gap-1 rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/[0.06] px-3 py-1 text-[13px] text-[#D4AF37]/80 transition hover:border-[#D4AF37]/40 hover:text-[#D4AF37]"
          >
            <Sparkles className="h-3 w-3" /> LP
          </Link>
        </div>
      </td>
    </tr>
  )
}
