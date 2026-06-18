'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search, LayoutGrid, ArrowUpRight, Sparkles, TrendingUp, Wrench, Rocket, AlertTriangle } from 'lucide-react'
import {
  getInventoryStats,
  getInventoryAnalysis,
  type InventoryProperty,
  type PropertyStatus,
  type LandingStatus,
  type AdCandidate,
  type AdVerdict,
} from '@/src/features/freehold-intelligence/inventory'
import { PageHeader, StatCard, EmptyState } from '@/components/freehold/ui'

function formatPrice(n: number | null): string {
  if (n === null) return '—'
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`
  return `AED ${(n / 1_000).toFixed(0)}K`
}

function statusBadge(status: PropertyStatus) {
  switch (status) {
    case 'active':
    case 'ready':
      return 'bg-gold/10 text-gold border-gold/20'
    case 'off_plan':
      return 'bg-blue-400/10 text-blue-300 border-blue-400/20'
    case 'under_construction':
      return 'bg-amber-400/10 text-amber-300 border-amber-400/20'
    case 'sold_out':
      return 'bg-red-400/10 text-red-300 border-red-400/20'
    case 'coming_soon':
      return 'bg-violet-400/10 text-slate-400 border-violet-400/20'
    default:
      return 'bg-surface-2 text-slate-400 border-line'
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
      return 'bg-gold/10 text-gold border-gold/20'
    case 'draft':
      return 'bg-amber-400/10 text-amber-300 border-amber-400/20'
    case 'pending_review':
      return 'bg-blue-400/10 text-blue-300 border-blue-400/20'
    case 'missing':
      return 'bg-rose-400/10 text-slate-400 border-rose-400/20'
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
  if (value >= 80) return 'bg-gold'
  if (value >= 50) return 'bg-gold'
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
  launch:    { label: 'Launch',    cls: 'border-gold/25 bg-gold/[0.07] text-[#F8E7AE]',       Icon: Rocket },
  fix_first: { label: 'Fix first', cls: 'border-amber-400/25 bg-amber-400/[0.06] text-amber-300',        Icon: Wrench },
  hold:      { label: 'Hold',      cls: 'border-white/[0.1] bg-surface-2 text-slate-400',             Icon: AlertTriangle },
}

function CandidateCard({ c }: { c: AdCandidate }) {
  const m = VERDICT_META[c.verdict]
  return (
    <div className="flex flex-col rounded-[16px] border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold text-slate-100">{c.name}</div>
          <div className="mt-0.5 truncate text-xs text-slate-500">{c.area} · {c.developer}</div>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${m.cls}`}>
          <m.Icon className="h-3 w-3" /> {m.label}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
        <span className="font-semibold tabular-nums text-slate-300">{c.score}<span className="text-slate-500">/100</span></span>
        {c.roi !== null && <span className="text-gold/80">{c.roi.toFixed(1)}% ROI</span>}
        <span>{c.leads30d} leads</span>
      </div>

      <ul className="mt-3 space-y-1">
        {c.reasons.slice(0, 2).map((r, i) => (
          <li key={i} className="flex gap-1.5 text-xs leading-snug text-slate-400">
            <span className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-slate-500" />{r}
          </li>
        ))}
      </ul>

      <div className="mt-3 border-t border-line pt-2.5 text-xs text-gold/75">{c.nextAction}</div>
    </div>
  )
}

export default function InventoryClient({ initialProperties }: { initialProperties: InventoryProperty[] }) {
  const stats = getInventoryStats(initialProperties)
  const analysis = getInventoryAnalysis(initialProperties)
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [query, setQuery] = useState('')

  const filtered = initialProperties
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
      <PageHeader
        eyebrow="Inventory"
        Icon={LayoutGrid}
        title="Property Inventory"
        subtitle="Ad readiness, landing status, and ROI across all tracked properties"
      />

      {/* Stats row */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Properties" value={stats.total} hint="in portfolio" />
        <StatCard label="Live Landings" value={stats.live} hint="pages published" delta={{ value: 'live', direction: 'up' }} />
        <StatCard label="Missing Landing" value={stats.missingLanding} hint="need pages built" delta={stats.missingLanding > 0 ? { value: 'action needed', direction: 'down' } : undefined} />
        <StatCard label="Ad-Ready" value={stats.adReady} hint="cleared for launch" delta={{ value: 'ready to run', direction: 'up' }} />
      </div>

      {/* ── Ad-readiness analysis ─────────────────────────────────────────── */}
      <section className="mt-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-gold/85">
            <Sparkles className="h-3.5 w-3.5" /> Which to advertise
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="text-emerald-300">{analysis.counts.scale} scale</span>
            <span className="text-[#F8E7AE]">{analysis.counts.launch} launch</span>
            <span className="text-amber-300">{analysis.counts.fixFirst} fix first</span>
          </div>
        </div>
        <p className="mt-1.5 text-xs text-slate-500">
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
                <div className="flex items-center gap-1.5 text-xs font-medium text-amber-300/90">
                  <Wrench className="h-3.5 w-3.5" /> Fix first — high potential, blocked
                </div>
                <ul className="mt-3 space-y-2">
                  {analysis.fixFirst.map((c) => (
                    <li key={c.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-medium text-slate-300">{c.name}</div>
                        <div className="truncate text-xs text-slate-500">{c.nextAction}</div>
                      </div>
                      <Link href={`/freehold-intelligence/inventory/${c.id}`} className="shrink-0 text-xs text-gold/70 hover:text-gold">Open</Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {analysis.missedOpportunities.length > 0 && (
              <div className="rounded-[16px] border border-rose-400/15 bg-rose-400/[0.03] p-4">
                <div className="flex items-center gap-1.5 text-xs font-medium text-rose-300/90">
                  <AlertTriangle className="h-3.5 w-3.5" /> Missed — high ROI, no landing page
                </div>
                <ul className="mt-3 space-y-2">
                  {analysis.missedOpportunities.map((c) => (
                    <li key={c.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-medium text-slate-300">{c.name}</div>
                        <div className="truncate text-xs text-slate-500">{c.roi?.toFixed(1)}% ROI · build landing to capture demand</div>
                      </div>
                      <Link href={`/freehold-intelligence/inventory/${c.id}/generate`} className="shrink-0 text-xs text-gold/70 hover:text-gold">Build LP</Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

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
                'rounded-full border px-3.5 py-1.5 text-xs font-medium transition',
                filter === f.value
                  ? 'border-gold/40 bg-gold/[0.1] text-[#F8E7AE]'
                  : 'border-line-strong bg-surface-2 text-slate-400 hover:text-slate-200 hover:border-slate-500',
              ].join(' ')}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search name, area, developer…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-[12px] border border-line bg-surface-2 py-2 pl-8 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-gold/50 focus:outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="mt-5 overflow-x-auto rounded-[20px] border border-line bg-surface-2">
        <table className="w-full min-w-[1060px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line">
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
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.18em] text-slate-500 first:pl-5 last:pr-5"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={11}>
                  <EmptyState
                    Icon={LayoutGrid}
                    title="No properties match your filters"
                    description="Try a different status or clear the search."
                    className="rounded-none border-x-0 border-b-0"
                  />
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

      <p className="mt-3 text-sm text-slate-500">
        {filtered.length} of {initialProperties.length} properties · sorted by ad readiness
      </p>
    </div>
  )
}

function PropertyRow({ prop }: { prop: InventoryProperty }) {
  return (
    <tr className="group transition hover:bg-surface-2">
      {/* Name */}
      <td className="max-w-[200px] pl-5 pr-4 py-3.5">
        <div className="truncate font-medium text-slate-100">{prop.name}</div>
        <div className="mt-0.5 text-sm capitalize text-slate-500">{prop.type}</div>
      </td>

      {/* Area / Developer */}
      <td className="px-4 py-3.5">
        <div className="text-slate-200">{prop.area}</div>
        <div className="mt-0.5 text-sm text-slate-500">{prop.developer}</div>
      </td>

      {/* Status */}
      <td className="px-4 py-3.5">
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-sm font-medium ${statusBadge(prop.status)}`}>
          {statusLabel(prop.status)}
        </span>
      </td>

      {/* Starting price */}
      <td className="px-4 py-3.5 tabular-nums text-slate-200">
        {formatPrice(prop.startingPriceAED)}
      </td>

      {/* Bedrooms */}
      <td className="px-4 py-3.5 text-slate-400">
        {prop.bedrooms}
      </td>

      {/* ROI */}
      <td className="px-4 py-3.5 tabular-nums">
        {prop.roi !== null ? (
          <span className="text-gold">{prop.roi.toFixed(1)}%</span>
        ) : (
          <span className="text-slate-500">—</span>
        )}
      </td>

      {/* Landing status */}
      <td className="px-4 py-3.5">
        {prop.landingUrl ? (
          <a
            href={prop.landingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-sm font-medium transition hover:opacity-80 ${landingBadge(prop.landingStatus)}`}
          >
            {landingLabel(prop.landingStatus)} <ArrowUpRight className="h-3 w-3" />
          </a>
        ) : (
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-sm font-medium ${landingBadge(prop.landingStatus)}`}>
            {landingLabel(prop.landingStatus)}
          </span>
        )}
      </td>

      {/* Data quality */}
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-2">
            <div
              className={`h-full rounded-full ${readinessBar(prop.dataQuality)}`}
              style={{ width: `${prop.dataQuality}%` }}
            />
          </div>
          <span className="tabular-nums text-sm text-slate-400">{prop.dataQuality}</span>
        </div>
      </td>

      {/* Ad readiness */}
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-2">
            <div
              className={`h-full rounded-full ${readinessBar(prop.adReadiness)}`}
              style={{ width: `${prop.adReadiness}%` }}
            />
          </div>
          <span className="tabular-nums text-sm text-slate-400">{prop.adReadiness}</span>
        </div>
      </td>

      {/* Leads 30d */}
      <td className="px-4 py-3.5 tabular-nums text-slate-400">
        {prop.leads30d > 0 ? (
          <span className={prop.leads30d >= 50 ? 'text-slate-100' : ''}>{prop.leads30d}</span>
        ) : (
          <span className="text-slate-500">0</span>
        )}
      </td>

      {/* Actions */}
      <td className="pr-5 pl-4 py-3.5">
        <div className="flex items-center gap-2">
          <Link
            href={`/freehold-intelligence/inventory/${prop.id}`}
            className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 px-3 py-1 text-sm text-slate-400 transition hover:border-white/20 hover:text-white"
          >
            View <ArrowUpRight className="h-3 w-3" />
          </Link>
          <Link
            href={`/freehold-intelligence/inventory/${prop.id}/generate`}
            className="inline-flex items-center gap-1 rounded-full border border-gold/20 bg-gold/[0.06] px-3 py-1 text-sm text-gold/80 transition hover:border-gold/40 hover:text-gold"
          >
            <Sparkles className="h-3 w-3" /> LP
          </Link>
        </div>
      </td>
    </tr>
  )
}
