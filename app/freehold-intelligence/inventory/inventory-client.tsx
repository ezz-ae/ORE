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
import { useT } from '@/lib/i18n/provider'

type TFn = (key: string, vars?: Record<string, string | number>) => string

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

function statusLabel(status: PropertyStatus, t: TFn): string {
  return t(`inv.status.${status}`)
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

function landingLabel(status: LandingStatus, t: TFn): string {
  return t(`inv.landing.${status}`)
}

function readinessBar(value: number) {
  if (value >= 80) return 'bg-gold'
  if (value >= 50) return 'bg-gold'
  return 'bg-red-400'
}

type FilterStatus = 'all' | PropertyStatus

const FILTERS: { value: FilterStatus; labelKey: string }[] = [
  { value: 'all', labelKey: 'inv.filter.all' },
  { value: 'off_plan', labelKey: 'inv.status.off_plan' },
  { value: 'ready', labelKey: 'inv.status.ready' },
  { value: 'under_construction', labelKey: 'inv.status.under_construction' },
  { value: 'coming_soon', labelKey: 'inv.status.coming_soon' },
]

const VERDICT_META: Record<AdVerdict, { labelKey: string; cls: string; Icon: typeof Rocket }> = {
  scale:     { labelKey: 'inv.verdict.scale',     cls: 'border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-300', Icon: TrendingUp },
  launch:    { labelKey: 'inv.verdict.launch',    cls: 'border-gold/25 bg-gold/[0.07] text-[#F8E7AE]',       Icon: Rocket },
  fix_first: { labelKey: 'inv.verdict.fix_first', cls: 'border-amber-400/25 bg-amber-400/[0.06] text-amber-300',        Icon: Wrench },
  hold:      { labelKey: 'inv.verdict.hold',      cls: 'border-white/[0.1] bg-surface-2 text-slate-400',             Icon: AlertTriangle },
}

function CandidateCard({ c, t }: { c: AdCandidate; t: TFn }) {
  const m = VERDICT_META[c.verdict]
  return (
    <div className="flex flex-col rounded-[16px] border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold text-slate-100">{c.name}</div>
          <div className="mt-0.5 truncate text-xs text-slate-500">{c.area} · {c.developer}</div>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${m.cls}`}>
          <m.Icon className="h-3 w-3" /> {t(m.labelKey)}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
        <span className="font-semibold tabular-nums text-slate-300">{c.score}<span className="text-slate-500">/100</span></span>
        {c.roi !== null && <span className="text-gold/80">{t('inv.candidate.roi', { roi: c.roi.toFixed(1) })}</span>}
        <span>{t('inv.candidate.leads', { count: c.leads30d })}</span>
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
  const t = useT()
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
        eyebrow={t('inv.eyebrow')}
        Icon={LayoutGrid}
        title={t('inv.pageTitle')}
        subtitle={t('inv.pageSubtitle')}
      />

      {/* Stats row */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t('inv.stat.totalProperties')} value={stats.total} hint={t('inv.stat.totalProperties.hint')} />
        <StatCard label={t('inv.stat.liveLandings')} value={stats.live} hint={t('inv.stat.liveLandings.hint')} delta={{ value: t('inv.stat.liveLandings.delta'), direction: 'up' }} />
        <StatCard label={t('inv.stat.missingLanding')} value={stats.missingLanding} hint={t('inv.stat.missingLanding.hint')} delta={stats.missingLanding > 0 ? { value: t('inv.stat.missingLanding.delta'), direction: 'down' } : undefined} />
        <StatCard label={t('inv.stat.adReady')} value={stats.adReady} hint={t('inv.stat.adReady.hint')} delta={{ value: t('inv.stat.adReady.delta'), direction: 'up' }} />
      </div>

      {/* ── Ad-readiness analysis ─────────────────────────────────────────── */}
      <section className="mt-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-gold/85">
            <Sparkles className="h-3.5 w-3.5" /> {t('inv.whichToAdvertise')}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="text-emerald-300">{t('inv.count.scale', { count: analysis.counts.scale })}</span>
            <span className="text-[#F8E7AE]">{t('inv.count.launch', { count: analysis.counts.launch })}</span>
            <span className="text-amber-300">{t('inv.count.fixFirst', { count: analysis.counts.fixFirst })}</span>
          </div>
        </div>
        <p className="mt-1.5 text-xs text-slate-500">
          {t('inv.rankedBy')}
        </p>

        {/* Top picks */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {analysis.topPicks.map((c) => <CandidateCard key={c.id} c={c} t={t} />)}
        </div>

        {/* Fix-first + missed opportunities */}
        {(analysis.fixFirst.length > 0 || analysis.missedOpportunities.length > 0) && (
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {analysis.fixFirst.length > 0 && (
              <div className="rounded-[16px] border border-amber-400/15 bg-amber-400/[0.03] p-4">
                <div className="flex items-center gap-1.5 text-xs font-medium text-amber-300/90">
                  <Wrench className="h-3.5 w-3.5" /> {t('inv.fixFirstTitle')}
                </div>
                <ul className="mt-3 space-y-2">
                  {analysis.fixFirst.map((c) => (
                    <li key={c.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-medium text-slate-300">{c.name}</div>
                        <div className="truncate text-xs text-slate-500">{c.nextAction}</div>
                      </div>
                      <Link href={`/freehold-intelligence/inventory/${c.id}`} className="shrink-0 text-xs text-gold/70 hover:text-gold">{t('inv.action.open')}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {analysis.missedOpportunities.length > 0 && (
              <div className="rounded-[16px] border border-rose-400/15 bg-rose-400/[0.03] p-4">
                <div className="flex items-center gap-1.5 text-xs font-medium text-rose-300/90">
                  <AlertTriangle className="h-3.5 w-3.5" /> {t('inv.missedTitle')}
                </div>
                <ul className="mt-3 space-y-2">
                  {analysis.missedOpportunities.map((c) => (
                    <li key={c.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-medium text-slate-300">{c.name}</div>
                        <div className="truncate text-xs text-slate-500">{t('inv.missed.buildLanding', { roi: c.roi?.toFixed(1) ?? '—' })}</div>
                      </div>
                      <Link href={`/freehold-intelligence/inventory/${c.id}/generate`} className="shrink-0 text-xs text-gold/70 hover:text-gold">{t('inv.action.buildLp')}</Link>
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
              {t(f.labelKey)}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder={t('inv.search.namePlaceholder')}
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
                'inv.col.name',
                'inv.col.areaDeveloper',
                'inv.col.status',
                'inv.col.startingPrice',
                'inv.col.bedrooms',
                'inv.col.roi',
                'inv.col.landing',
                'inv.col.dataQuality',
                'inv.col.adReadiness',
                'inv.col.leads30d',
                'inv.col.actions',
              ].map((col) => (
                <th
                  key={col}
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.18em] text-slate-500 first:pl-5 last:pr-5"
                >
                  {t(col)}
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
                    title={t('inv.empty.title')}
                    description={t('inv.empty.description')}
                    className="rounded-none border-x-0 border-b-0"
                  />
                </td>
              </tr>
            ) : (
              filtered.map((prop) => (
                <PropertyRow key={prop.id} prop={prop} t={t} />
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-sm text-slate-500">
        {t('inv.propertiesSorted', { shown: filtered.length, total: initialProperties.length })}
      </p>
    </div>
  )
}

function PropertyRow({ prop, t }: { prop: InventoryProperty; t: TFn }) {
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
          {statusLabel(prop.status, t)}
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
            {landingLabel(prop.landingStatus, t)} <ArrowUpRight className="h-3 w-3" />
          </a>
        ) : (
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-sm font-medium ${landingBadge(prop.landingStatus)}`}>
            {landingLabel(prop.landingStatus, t)}
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
            {t('inv.action.view')} <ArrowUpRight className="h-3 w-3" />
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
