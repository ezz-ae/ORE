'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Sparkles, Search, Calendar, TrendingUp, Building2 } from 'lucide-react'
import { inventoryProperties, type InventoryProperty } from '@/src/features/freehold-intelligence/inventory'
import { PageHeader, StatCard, EmptyState } from '@/components/freehold/ui'
import { useT } from '@/lib/i18n/provider'

function formatPrice(n: number | null): string {
  if (n === null) return '—'
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`
  return `AED ${(n / 1_000).toFixed(0)}K`
}

const STATUS_LABEL_KEY: Record<string, string> = {
  off_plan:           'inv.status.off_plan',
  under_construction: 'inv.status.under_construction',
  coming_soon:        'inv.status.coming_soon',
}

const STATUS_STYLE: Record<string, string> = {
  off_plan:           'text-blue-400   bg-blue-400/10   border-blue-400/20',
  under_construction: 'text-amber-400  bg-amber-400/10  border-amber-400/20',
  coming_soon:        'text-slate-500   bg-surface-2  border-white/10',
}

type SortKey = 'leads' | 'price' | 'handover' | 'readiness'

export default function OffPlanPage() {
  const t = useT()
  const [query, setQuery] = useState('')
  const [sort,  setSort]  = useState<SortKey>('leads')
  const [year,  setYear]  = useState('All')
  const [allProperties, setAllProperties] = useState<InventoryProperty[]>(inventoryProperties)

  useEffect(() => {
    let cancelled = false
    fetch('/api/freehold/inventory')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && d?.properties?.length > 0) setAllProperties(d.properties) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const OFFPLAN_STATUSES = ['off_plan', 'under_construction', 'coming_soon']

  const base = allProperties.filter((p) => OFFPLAN_STATUSES.includes(p.status))

  const handoverYears = ['All', ...Array.from(new Set(base.map((p) => p.handoverYear).filter(Boolean))).sort().map(String)]

  const props = base
    .filter((p) => year === 'All' || String(p.handoverYear) === year)
    .filter((p) => !query || p.name.toLowerCase().includes(query.toLowerCase()) || p.developer.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'leads')     return b.leads30d - a.leads30d
      if (sort === 'price')     return (b.startingPriceAED ?? 0) - (a.startingPriceAED ?? 0)
      if (sort === 'handover')  return (a.handoverYear ?? 9999) - (b.handoverYear ?? 9999)
      if (sort === 'readiness') return b.adReadiness - a.adReadiness
      return 0
    })

  const handovers = base.filter((p) => p.handoverYear).reduce<Record<number, number>>((acc, p) => {
    acc[p.handoverYear!] = (acc[p.handoverYear!] ?? 0) + 1
    return acc
  }, {})

  const totalLeads      = props.reduce((s, p) => s + p.leads30d, 0)
  const offPlanCount    = props.filter((p) => p.status === 'off_plan').length
  const underConstCount = props.filter((p) => p.status === 'under_construction').length

  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-7 sm:px-8">

      <PageHeader
        eyebrow={t('inv.eyebrow')}
        Icon={Building2}
        title={t('inv.offPlan.title')}
        subtitle={t('inv.offPlan.subtitle')}
        className="mb-6"
      />

      {/* Tiles */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t('inv.offPlan.tile.offPlan')} value={offPlanCount} hint={t('inv.offPlan.tile.offPlan.hint')} />
        <StatCard label={t('inv.offPlan.tile.underConst')} value={underConstCount} hint={t('inv.offPlan.tile.underConst.hint')} />
        <StatCard label={t('inv.offPlan.tile.leads30d')} value={totalLeads} hint={t('inv.offPlan.tile.leads30d.hint')} delta={{ value: t('inv.offPlan.tile.leads30d.delta'), direction: 'up' }} />
        <StatCard label={t('inv.offPlan.tile.handoverYears')} value={Object.keys(handovers).length} hint={t('inv.offPlan.tile.handoverYears.hint')} />
      </div>

      {/* Handover timeline chips */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500">{t('inv.offPlan.handover')}</span>
        {Object.entries(handovers).sort().map(([yr, count]) => (
          <button key={yr} onClick={() => setYear(year === yr ? 'All' : yr)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${
              year === yr
                ? 'border-amber-400/30 bg-amber-400/10 text-amber-400'
                : 'border-line text-slate-400 hover:text-slate-300'
            }`}>
            <Calendar className="h-3 w-3" />
            {yr}
            <span className="text-slate-500">({count})</span>
          </button>
        ))}
        {year !== 'All' && (
          <button onClick={() => setYear('All')} className="text-xs text-slate-500 hover:text-slate-400 transition">{t('inv.offPlan.clear')}</button>
        )}
      </div>

      {/* Filters */}
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            placeholder={t('inv.offPlan.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-[10px] border border-line bg-surface py-2 pl-8 pr-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-amber-400/30"
          />
        </div>
        <div className="flex gap-1 rounded-[10px] border border-line bg-surface p-1">
          {(['leads', 'price', 'handover', 'readiness'] as SortKey[]).map((s) => (
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
          <EmptyState
            Icon={Building2}
            title={t('inv.offPlan.empty.title')}
            description={t('inv.offPlan.empty.description')}
            className="rounded-none border-none"
          />
        )}
        {props.map((p) => (
          <div key={p.id} className="px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-white truncate">{p.name}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLE[p.status]}`}>
                    {STATUS_LABEL_KEY[p.status] ? t(STATUS_LABEL_KEY[p.status]) : p.status}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                  <span>{p.area}</span>
                  <span>·</span>
                  <span>{p.developer}</span>
                  {p.handoverYear && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {p.handoverYear}</span>
                    </>
                  )}
                  {p.paymentPlan && <><span>·</span><span>{p.paymentPlan}</span></>}
                  {p.leads30d > 0 && <><span>·</span><span className="text-amber-400/70">{t('inv.offPlan.leads', { count: p.leads30d })}</span></>}
                </div>
                {/* Readiness bar */}
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1 w-24 rounded-full bg-surface-2">
                    <div className={`h-1 rounded-full ${p.adReadiness >= 80 ? 'bg-amber-400' : p.adReadiness >= 60 ? 'bg-amber-400/60' : 'bg-white/20'}`}
                      style={{ width: `${p.adReadiness}%` }} />
                  </div>
                  <span className="text-xs text-slate-500 tabular-nums">{t('inv.offPlan.pctAdReady', { pct: p.adReadiness })}</span>
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
