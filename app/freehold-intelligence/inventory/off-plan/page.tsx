'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Sparkles, Search, Calendar, TrendingUp } from 'lucide-react'
import { inventoryProperties } from '@/src/features/freehold-intelligence/inventory'

function formatPrice(n: number | null): string {
  if (n === null) return '—'
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`
  return `AED ${(n / 1_000).toFixed(0)}K`
}

const STATUS_LABEL: Record<string, string> = {
  off_plan:           'Off Plan',
  under_construction: 'Under Construction',
  coming_soon:        'Coming Soon',
}

const STATUS_STYLE: Record<string, string> = {
  off_plan:           'text-blue-400   bg-blue-400/10   border-blue-400/20',
  under_construction: 'text-amber-400  bg-amber-400/10  border-amber-400/20',
  coming_soon:        'text-slate-500   bg-slate-800/50  border-white/10',
}

type SortKey = 'leads' | 'price' | 'handover' | 'readiness'

export default function OffPlanPage() {
  const [query, setQuery] = useState('')
  const [sort,  setSort]  = useState<SortKey>('leads')
  const [year,  setYear]  = useState('All')

  const OFFPLAN_STATUSES = ['off_plan', 'under_construction', 'coming_soon']

  const base = inventoryProperties.filter((p) => OFFPLAN_STATUSES.includes(p.status))

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

      <div className="mb-7">
        <h1 className="text-[20px] font-semibold text-white">Off-Plan</h1>
        <p className="mt-1 text-xs text-slate-500">Pre-launch and under-construction properties</p>
      </div>

      {/* Tiles */}
      <div className="mb-5 grid grid-cols-4 gap-3">
        {[
          { label: 'Off Plan',     value: offPlanCount,           color: 'text-blue-400'   },
          { label: 'Under Const.', value: underConstCount,        color: 'text-amber-400'  },
          { label: '30d Leads',    value: totalLeads,             color: 'text-[#D4AF37]'  },
          { label: 'Handovers',    value: Object.keys(handovers).length + ' yrs', color: 'text-slate-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-[14px] border border-slate-800 bg-slate-900 p-3.5">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
            <div className={`mt-1.5 text-[18px] font-semibold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Handover timeline chips */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500">Handover:</span>
        {Object.entries(handovers).sort().map(([yr, count]) => (
          <button key={yr} onClick={() => setYear(year === yr ? 'All' : yr)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${
              year === yr
                ? 'border-amber-400/30 bg-amber-400/10 text-amber-400'
                : 'border-slate-800 text-slate-400 hover:text-slate-300'
            }`}>
            <Calendar className="h-3 w-3" />
            {yr}
            <span className="text-slate-500">({count})</span>
          </button>
        ))}
        {year !== 'All' && (
          <button onClick={() => setYear('All')} className="text-xs text-slate-500 hover:text-slate-400 transition">clear</button>
        )}
      </div>

      {/* Filters */}
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search by name or developer…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-[10px] border border-slate-800 bg-slate-900 py-2 pl-8 pr-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-amber-400/30"
          />
        </div>
        <div className="flex gap-1 rounded-[10px] border border-slate-800 bg-slate-900 p-1">
          {(['leads', 'price', 'handover', 'readiness'] as SortKey[]).map((s) => (
            <button key={s} onClick={() => setSort(s)}
              className={`rounded-[8px] px-2.5 py-1 text-xs font-medium capitalize transition ${
                sort === s ? 'bg-slate-800/50 text-white' : 'text-slate-500 hover:text-slate-400'
              }`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Property list */}
      <div className="rounded-[16px] border border-slate-800 bg-slate-900 divide-y divide-slate-800 overflow-hidden">
        {props.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-slate-500">No off-plan properties match.</div>
        )}
        {props.map((p) => (
          <div key={p.id} className="px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-white truncate">{p.name}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLE[p.status]}`}>
                    {STATUS_LABEL[p.status] ?? p.status}
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
                  {p.leads30d > 0 && <><span>·</span><span className="text-amber-400/70">{p.leads30d} leads</span></>}
                </div>
                {/* Readiness bar */}
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1 w-24 rounded-full bg-slate-800/50">
                    <div className={`h-1 rounded-full ${p.adReadiness >= 80 ? 'bg-amber-400' : p.adReadiness >= 60 ? 'bg-amber-400/60' : 'bg-white/20'}`}
                      style={{ width: `${p.adReadiness}%` }} />
                  </div>
                  <span className="text-xs text-slate-500 tabular-nums">{p.adReadiness}% ad ready</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <div className="text-sm font-semibold text-slate-300">{formatPrice(p.startingPriceAED)}</div>
                <div className="flex items-center gap-1.5">
                  <Link href={`/freehold-intelligence/inventory/${p.id}`}
                    className="flex items-center gap-1 rounded-full border border-slate-800 px-2.5 py-1 text-xs text-slate-400 hover:text-slate-100 transition">
                    View <ArrowUpRight className="h-3 w-3" />
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
