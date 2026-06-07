'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Globe, Sparkles, Eye, ArrowUpRight, Search, Plus, CheckCircle2,
  AlertTriangle, Clock, Pencil,
} from 'lucide-react'
import { inventoryProperties } from '@/src/features/freehold-intelligence/inventory'

type StatusFilter = 'All' | 'live' | 'draft' | 'pending_review' | 'missing'

const STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string; icon: React.ElementType }> = {
  live:           { label: 'Live',           dot: 'bg-emerald-400', badge: 'text-emerald-400 border-emerald-400/25 bg-emerald-400/[0.08]', icon: CheckCircle2 },
  draft:          { label: 'Draft',          dot: 'bg-amber-400',   badge: 'text-amber-400 border-amber-400/25 bg-amber-400/[0.08]',       icon: Pencil       },
  pending_review: { label: 'Pending Review', dot: 'bg-gold',   badge: 'text-gold border-gold/25 bg-gold/[0.08]',     icon: Clock       },
  missing:        { label: 'Missing',        dot: 'bg-red-400',     badge: 'text-red-400 border-red-400/25 bg-red-400/[0.08]',             icon: AlertTriangle },
}

const FILTER_PILLS: { id: StatusFilter; label: string }[] = [
  { id: 'All',           label: 'All' },
  { id: 'live',          label: 'Live' },
  { id: 'pending_review',label: 'Pending Review' },
  { id: 'draft',         label: 'Draft' },
  { id: 'missing',       label: 'Missing' },
]

function fmtPrice(n: number | null): string {
  if (n === null) return '—'
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`
  return `AED ${(n / 1_000).toFixed(0)}K`
}

export default function LandingsPage() {
  const [filter, setFilter] = useState<StatusFilter>('All')
  const [query, setQuery] = useState('')
  const [bulkCreating, setBulkCreating] = useState(false)
  const [bulkDone, setBulkDone] = useState(false)

  const props = inventoryProperties
    .filter((p) => filter === 'All' || p.landingStatus === filter)
    .filter((p) => !query || p.name.toLowerCase().includes(query.toLowerCase()) || p.developer.toLowerCase().includes(query.toLowerCase()))

  const live    = inventoryProperties.filter((p) => p.landingStatus === 'live').length
  const missing = inventoryProperties.filter((p) => p.landingStatus === 'missing').length
  const draft   = inventoryProperties.filter((p) => p.landingStatus === 'draft').length
  const pending = inventoryProperties.filter((p) => p.landingStatus === 'pending_review').length

  function bulkCreate() {
    setBulkCreating(true)
    setTimeout(() => { setBulkCreating(false); setBulkDone(true) }, 2200)
  }

  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-7 sm:px-8">

      <div className="mb-7 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-semibold text-white">Landing Pages</h1>
          <p className="mt-1 text-xs text-slate-500">
            {inventoryProperties.length} properties — each property has a dedicated ad landing page
          </p>
        </div>
        <button
          onClick={bulkCreate}
          disabled={bulkCreating || bulkDone}
          className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium transition ${
            bulkDone
              ? 'border border-emerald-400/30 bg-emerald-400/10 text-emerald-400'
              : 'bg-gold text-ink hover:bg-[#F0CB67] disabled:opacity-60'
          }`}
        >
          {bulkCreating ? (
            <><Sparkles className="h-3.5 w-3.5 animate-spin" /> Creating all…</>
          ) : bulkDone ? (
            <><CheckCircle2 className="h-3.5 w-3.5" /> All created</>
          ) : (
            <><Plus className="h-3.5 w-3.5" /> Create all missing</>
          )}
        </button>
      </div>

      {/* Summary tiles */}
      <div className="mb-5 grid grid-cols-4 gap-3">
        {[
          { label: 'Live',    value: live,    color: 'text-emerald-400' },
          { label: 'Pending', value: pending, color: 'text-gold'  },
          { label: 'Draft',   value: draft,   color: 'text-amber-400'  },
          { label: 'Missing', value: missing, color: 'text-red-400'    },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-[14px] border border-line bg-surface p-3.5">
            <div className="text-[10px] text-slate-600 uppercase tracking-wider">{label}</div>
            <div className={`mt-1.5 text-[20px] font-semibold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Missing alert */}
      {missing > 0 && !bulkDone && (
        <div className="mb-5 flex items-start gap-3 rounded-[14px] border border-red-400/15 bg-red-400/[0.04] px-4 py-3.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400/80" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-red-300">
              {missing} {missing === 1 ? 'property is' : 'properties are'} missing landing pages
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              Properties without landing pages cannot run ad campaigns. Generate or publish them below.
            </div>
          </div>
          <button onClick={bulkCreate} disabled={bulkCreating}
            className="shrink-0 rounded-full border border-red-400/20 bg-red-400/[0.07] px-3 py-1.5 text-xs text-red-400/80 transition hover:bg-red-400/15 disabled:opacity-50">
            {bulkCreating ? 'Creating…' : 'Generate all'}
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-600" />
          <input
            type="text"
            placeholder="Search properties…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-[10px] border border-line bg-surface py-2 pl-8 pr-3 text-sm text-white placeholder-white/20 outline-none focus:border-amber-400/30"
          />
        </div>
        <div className="flex gap-1 rounded-[10px] border border-line bg-surface p-1">
          {FILTER_PILLS.map(({ id, label }) => (
            <button key={id} onClick={() => setFilter(id)}
              className={`rounded-[8px] px-2.5 py-1 text-xs font-medium transition whitespace-nowrap ${
                filter === id ? 'bg-surface-2 text-white' : 'text-slate-600 hover:text-slate-400'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Property list */}
      <div className="rounded-[16px] border border-line bg-surface divide-y divide-white/[0.04] overflow-hidden">
        {props.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-slate-600">No properties match this filter.</div>
        )}
        {props.map((p) => {
          const sc = STATUS_CONFIG[p.landingStatus]
          const StatusIcon = sc.icon
          return (
            <div key={p.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-white truncate">{p.name}</span>
                    <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${sc.badge}`}>
                      <StatusIcon className="h-3 w-3" /> {sc.label}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-600 flex-wrap">
                    <span>{p.area}</span>
                    <span>·</span>
                    <span>{p.developer}</span>
                    <span>·</span>
                    <span>{fmtPrice(p.startingPriceAED)}</span>
                    {p.linkedCampaigns > 0 && (
                      <><span>·</span>
                      <span className="text-gold/60">{p.linkedCampaigns} {p.linkedCampaigns === 1 ? 'campaign' : 'campaigns'}</span></>
                    )}
                  </div>

                  {/* Mini progress bar for ad readiness */}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1 w-20 rounded-full bg-surface-2">
                      <div
                        className={`h-1 rounded-full ${p.adReadiness >= 80 ? 'bg-gold' : p.adReadiness >= 60 ? 'bg-amber-400/60' : 'bg-red-400/50'}`}
                        style={{ width: `${p.adReadiness}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-600">{p.adReadiness}% ad ready</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Preview — only if has landing URL */}
                  {p.landingStatus !== 'missing' && (
                    <a
                      href={`/lp/${p.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 rounded-full border border-line px-2.5 py-1.5 text-xs text-slate-500 transition hover:text-slate-300"
                    >
                      <Globe className="h-3 w-3" />
                    </a>
                  )}

                  {/* Edit */}
                  <Link
                    href={`/freehold-intelligence/inventory/${p.id}/generate`}
                    className="flex items-center gap-1 rounded-full border border-line px-2.5 py-1.5 text-xs text-slate-500 transition hover:text-slate-300"
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </Link>

                  {/* Generate / Create */}
                  {p.landingStatus === 'missing' ? (
                    <Link
                      href={`/freehold-intelligence/inventory/${p.id}/generate`}
                      className="flex items-center gap-1 rounded-full border border-gold/25 bg-gold/[0.07] px-2.5 py-1.5 text-xs text-gold/80 transition hover:text-gold"
                    >
                      <Sparkles className="h-3 w-3" /> Create
                    </Link>
                  ) : (
                    <Link
                      href={`/freehold-intelligence/inventory/${p.id}`}
                      className="flex items-center gap-1 rounded-full border border-line px-2.5 py-1.5 text-xs text-slate-500 transition hover:text-slate-300"
                    >
                      <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer info */}
      <div className="mt-6 rounded-[14px] border border-line bg-surface-2 px-5 py-4">
        <div className="flex items-start gap-3 text-xs text-slate-500">
          <Globe className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
          <div>
            Each property automatically gets a landing page at <span className="font-mono text-slate-500">/lp/{'{property-slug}'}</span>.
            Landing pages are standalone (no site navigation) and optimized for ad campaigns.
            Use the editor to customize copy, highlights, and lead form fields per property or campaign theme.
          </div>
        </div>
      </div>

    </div>
  )
}
