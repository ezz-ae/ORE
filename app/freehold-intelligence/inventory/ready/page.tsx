'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Sparkles, Search, SlidersHorizontal, AlertTriangle, Home } from 'lucide-react'
import { type InventoryProperty } from '@/src/features/freehold-intelligence/inventory'
import { PageHeader, StatCard } from '@/components/freehold/ui'
import { useT } from '@/lib/i18n/provider'

function formatPrice(n: number | null): string {
  if (n === null) return '—'
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`
  return `AED ${(n / 1_000).toFixed(0)}K`
}

const LANDING_STYLE: Record<string, string> = {
  live:           'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  draft:          'text-amber-400   bg-amber-400/10   border-amber-400/20',
  pending_review: 'text-teal-400    bg-teal-400/10    border-teal-400/20',
  missing:        'text-red-400     bg-red-400/10     border-red-400/20',
}
const LANDING_LABEL_KEY: Record<string, string> = {
  live: 'inv.landing.live', draft: 'inv.landing.draft', pending_review: 'inv.landing.review', missing: 'inv.landing.missing',
}

type SortKey = 'leads' | 'price' | 'readiness' | 'roi'

export default function ReadyPage() {
  const t = useT()
  const [query,  setQuery]  = useState('')
  const [sort,   setSort]   = useState<SortKey>('leads')
  const [area,   setArea]   = useState('All')
  // Real DB inventory only — populated from the API; no seed.
  const [allProperties, setAllProperties] = useState<InventoryProperty[]>([])

  useEffect(() => {
    let cancelled = false
    fetch('/api/freehold/inventory')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && d?.properties?.length > 0) setAllProperties(d.properties) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const base = allProperties.filter((p) => p.status === 'ready' || p.status === 'active')

  const areas = ['All', ...Array.from(new Set(base.map((p) => p.area))).sort()]

  const props = base
    .filter((p) => area === 'All' || p.area === area)
    .filter((p) => !query || p.name.toLowerCase().includes(query.toLowerCase()) || p.developer.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'leads')     return b.leads30d - a.leads30d
      if (sort === 'price')     return (b.startingPriceAED ?? 0) - (a.startingPriceAED ?? 0)
      if (sort === 'readiness') return b.adReadiness - a.adReadiness
      if (sort === 'roi')       return (b.roi ?? 0) - (a.roi ?? 0)
      return 0
    })

  const liveLandings    = props.filter((p) => p.landingStatus === 'live').length
  const missingLandings = props.filter((p) => p.landingStatus === 'missing').length
  const totalLeads      = props.reduce((s, p) => s + p.leads30d, 0)
  const avgReadiness    = props.length > 0 ? Math.round(props.reduce((s, p) => s + p.adReadiness, 0) / props.length) : 0

  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-7 sm:px-8">

      <PageHeader
        eyebrow={t('inv.eyebrow')}
        Icon={Home}
        title={t('inv.ready.title')}
        subtitle={t('inv.ready.subtitle')}
        className="mb-6"
      />

      {/* Tiles */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t('inv.ready.tile.readyUnits')} value={props.length} hint={t('inv.ready.tile.readyUnits.hint')} />
        <StatCard label={t('inv.ready.tile.livePages')} value={liveLandings} hint={t('inv.ready.tile.livePages.hint')} delta={{ value: t('inv.ready.tile.livePages.delta'), direction: 'up' }} />
        <StatCard label={t('inv.ready.tile.leads30d')} value={totalLeads} hint={t('inv.ready.tile.leads30d.hint')} />
        <StatCard label={t('inv.ready.tile.avgReadiness')} value={`${avgReadiness}%`} hint={t('inv.ready.tile.avgReadiness.hint')} />
      </div>

      {/* Missing landing alert */}
      {missingLandings > 0 && (
        <div className="mb-5 flex items-start gap-3 rounded-[14px] border border-red-400/15 bg-red-400/[0.04] px-4 py-3.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400/80" />
          <div>
            <div className="text-sm font-medium text-red-300">
              {missingLandings === 1
                ? t('inv.ready.missingAlert.one', { count: missingLandings })
                : t('inv.ready.missingAlert.many', { count: missingLandings })}
            </div>
            <div className="mt-0.5 text-xs text-slate-400">
              {t('inv.ready.missingAlert.body')}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            placeholder={t('inv.ready.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-[10px] border border-line bg-surface py-2 pl-8 pr-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-amber-400/30"
          />
        </div>
        <select value={area} onChange={(e) => setArea(e.target.value)}
          className="rounded-[10px] border border-line bg-surface px-3 py-2 text-xs text-slate-400 outline-none focus:border-amber-400/30">
          {areas.map((a) => <option key={a} value={a}>{a === 'All' ? t('inv.filter.all') : a}</option>)}
        </select>
        <div className="flex items-center gap-1 rounded-[10px] border border-line bg-surface p-1">
          <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500 ml-1" />
          {(['leads', 'price', 'readiness', 'roi'] as SortKey[]).map((s) => (
            <button key={s} onClick={() => setSort(s)}
              className={`rounded-[8px] px-2.5 py-1 text-xs font-medium capitalize transition ${
                sort === s ? 'bg-surface-2 text-white' : 'text-slate-500 hover:text-slate-400'
              }`}>
              {t(`inv.sort.${s}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Property list */}
      <div className="rounded-[16px] border border-line bg-surface divide-y divide-line overflow-hidden">
        {props.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-slate-500">{t('inv.ready.empty')}</div>
        )}
        {props.map((p) => (
          <div key={p.id} className="px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-white truncate">{p.name}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${LANDING_STYLE[p.landingStatus]}`}>
                    {LANDING_LABEL_KEY[p.landingStatus] ? t(LANDING_LABEL_KEY[p.landingStatus]) : p.landingStatus}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                  <span>{p.area}</span>
                  <span>·</span>
                  <span>{p.developer}</span>
                  <span>·</span>
                  <span className="capitalize">{p.type}</span>
                  <span>·</span>
                  <span>{p.bedrooms} BR</span>
                  {p.roi !== null && <><span>·</span><span className="text-amber-400">{t('inv.candidate.roi', { roi: p.roi.toFixed(1) })}</span></>}
                </div>
                {/* Readiness bar */}
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1 w-24 rounded-full bg-surface-2">
                    <div className={`h-1 rounded-full ${p.adReadiness >= 80 ? 'bg-amber-400' : p.adReadiness >= 60 ? 'bg-amber-400/60' : 'bg-red-400/60'}`}
                      style={{ width: `${p.adReadiness}%` }} />
                  </div>
                  <span className="text-xs text-slate-500 tabular-nums">{t('inv.ready.pctReady', { pct: p.adReadiness })}</span>
                  {p.leads30d > 0 && <span className="text-xs text-amber-400/70 ml-1">{t('inv.ready.leads', { count: p.leads30d })}</span>}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <div className="text-sm font-semibold text-slate-300">{formatPrice(p.startingPriceAED)}</div>
                <div className="flex items-center gap-1.5">
                  <Link href={`/freehold-intelligence/inventory/${p.id}`}
                    className="flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs text-slate-400 hover:text-slate-100 transition">
                    {t('inv.action.view')} <ArrowUpRight className="h-3 w-3" />
                  </Link>
                  <Link href={`/freehold-intelligence/inventory/${p.id}/generate`}
                    className="flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/[0.07] px-2.5 py-1 text-xs text-amber-400/80 hover:text-amber-400 transition">
                    <Sparkles className="h-3 w-3" /> LP
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  )
}
