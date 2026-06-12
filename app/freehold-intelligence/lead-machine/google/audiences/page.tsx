'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Users,
  AlertCircle,
  RefreshCw,
  ArrowUpRight,
  Upload,
  Info,
} from 'lucide-react'
import type { GoogleAudience, GoogleAudienceType } from '@/lib/google/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtReach(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

function fmtSize(n: number): string {
  if (n >= 1_000_000) return `~${(n / 1_000_000).toFixed(1)}M users`
  if (n >= 10_000)    return `~${Math.round(n / 1_000)}K users`
  if (n >= 1_000)     return `~${(n / 1_000).toFixed(1)}K users`
  return `~${n.toLocaleString()} users`
}

// ─── Badge colour maps ────────────────────────────────────────────────────────

const TYPE_BADGE: Record<GoogleAudienceType, string> = {
  CUSTOMER_MATCH:   'bg-gold/10 text-[#F8E7AE] border-gold/20',
  IN_MARKET:        'bg-sky-400/10 text-slate-400 border-sky-400/20',
  AFFINITY:         'bg-violet-400/10 text-slate-400 border-violet-400/20',
  REMARKETING:      'bg-gold/10 text-gold border-gold/20',
  SIMILAR_AUDIENCE: 'bg-rose-400/10 text-slate-400 border-rose-400/20',
  COMBINED:         'bg-surface-2 text-slate-500 border-line',
}

const TYPE_LABEL: Record<GoogleAudienceType, string> = {
  CUSTOMER_MATCH:   'Customer Match',
  IN_MARKET:        'In-Market',
  AFFINITY:         'Affinity',
  REMARKETING:      'Remarketing',
  SIMILAR_AUDIENCE: 'Similar',
  COMBINED:         'Combined',
}

// ─── Static in-market audience suggestions ───────────────────────────────────

const STATIC_IN_MARKET = [
  {
    name: 'Real estate buyers',
    description: 'Users actively researching property purchases in Dubai and UAE.',
  },
  {
    name: 'Luxury goods shoppers',
    description: 'High-intent buyers in premium consumer categories — strong overlap with luxury real estate.',
  },
  {
    name: 'Financial investors',
    description: 'Users researching investment vehicles, portfolios, and asset allocation.',
  },
  {
    name: 'International travelers',
    description: 'Frequent travellers to UAE — potential expats and second-home buyers.',
  },
]

// ─── Filter tabs ─────────────────────────────────────────────────────────────

type AudienceFilter = 'ALL' | GoogleAudienceType

const FILTER_TABS: { label: string; value: AudienceFilter }[] = [
  { label: 'All',            value: 'ALL'            },
  { label: 'Customer Match', value: 'CUSTOMER_MATCH' },
  { label: 'In-Market',      value: 'IN_MARKET'      },
  { label: 'Affinity',       value: 'AFFINITY'       },
  { label: 'Remarketing',    value: 'REMARKETING'    },
]

// ─── API shape ────────────────────────────────────────────────────────────────

interface AudiencesApiResponse {
  audiences?: GoogleAudience[]
  error?: string
  type?: string
}

// ─── Audience card ────────────────────────────────────────────────────────────

function AudienceCard({ audience }: { audience: GoogleAudience }) {
  const typeCls  = TYPE_BADGE[audience.type] ?? 'bg-surface-2 text-slate-500 border-line'
  const typeLabel = TYPE_LABEL[audience.type] ?? audience.type

  return (
    <div className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-5 transition hover:border-[#4285F4]/20">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${typeCls}`}
          >
            {typeLabel}
          </span>
          <div className="mt-2 text-[14px] font-semibold text-white leading-snug">
            {audience.name}
          </div>
        </div>

        {/* Status badge */}
        <span
          className={`mt-0.5 shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
            audience.status === 'OPEN'
              ? 'border-gold/20 bg-gold/10 text-gold'
              : 'border-red-400/20 bg-red-400/10 text-red-300'
          }`}
        >
          {audience.status === 'OPEN' ? 'Active' : 'Closed'}
        </span>
      </div>

      {/* Size */}
      {audience.size != null && audience.size > 0 && (
        <div className="text-xs text-slate-400">
          {fmtSize(audience.size)}
        </div>
      )}

      {/* Match rate bar */}
      {audience.matchRate != null && (
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-sm text-slate-500">Match rate</span>
            <span className="text-sm font-medium text-orange-300">
              {(audience.matchRate * 100).toFixed(0)}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-orange-400 transition-all"
              style={{ width: `${Math.min(audience.matchRate * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Description */}
      {audience.description && (
        <p className="text-xs leading-relaxed text-slate-500">{audience.description}</p>
      )}

      {/* CTA */}
      <div className="mt-auto pt-1">
        <Link
          href="/freehold-intelligence/lead-machine/google/campaigns/new"
          className="inline-flex items-center gap-1 text-xs text-[#4285F4]/70 transition hover:text-[#4285F4]"
        >
          Attach to campaign <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GoogleAudiencesPage() {
  const [data, setData]             = useState<AudiencesApiResponse>({})
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter]         = useState<AudienceFilter>('ALL')

  async function fetchData(quiet = false) {
    if (quiet) setRefreshing(true)
    else setLoading(true)
    try {
      const res  = await fetch('/api/google/audiences')
      const json = await res.json()
      setData(json)
    } catch {
      setData({ error: 'Network error — could not reach Google Ads API' })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const audiences    = data.audiences ?? []
  const isConfigErr  = data.type === 'config'

  // ─ Derived stats ─
  const customerMatchCount = audiences.filter((a) => a.type === 'CUSTOMER_MATCH').length
  const totalReach         = audiences.reduce((s, a) => s + (a.size ?? 0), 0)

  // ─ Filter ─
  const filtered = filter === 'ALL' ? audiences : audiences.filter((a) => a.type === filter)

  // ─ Customer match lists for empty-state logic ─
  const customerLists = audiences.filter((a) => a.type === 'CUSTOMER_MATCH')

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <section>
          <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-[#4285F4]/85">
            <Users className="h-3.5 w-3.5" />
            Audiences
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
            Audience segments /<br />
            <span className="text-slate-500">
              {loading
                ? '…'
                : isConfigErr
                  ? 'not connected.'
                  : `${audiences.length} lists.`}
            </span>
          </h1>
        </section>

        <div className="mt-7 sm:mt-10">
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-line bg-surface-2 px-3 py-2 text-xs text-slate-400 transition hover:text-white disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Config error ── */}
      {isConfigErr && (
        <div className="mt-8 rounded-[20px] border border-red-400/20 bg-red-400/[0.05] p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <div>
              <div className="text-sm font-semibold text-white">Google Ads not connected</div>
              <p className="mt-1 text-sm text-slate-400">{data.error}</p>
              <Link
                href="/freehold-intelligence/integrations/google"
                className="mt-3 inline-flex items-center gap-1 text-xs text-[#4285F4]/80 transition hover:text-[#4285F4]"
              >
                Set up Google Ads integration <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── General error ── */}
      {data.error && !isConfigErr && (
        <div className="mt-8 rounded-[18px] border border-orange-400/20 bg-orange-400/[0.04] p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
            <p className="text-sm text-slate-300">{data.error}</p>
          </div>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="mt-12 text-center text-[14px] text-slate-500">Loading audiences…</div>
      )}

      {!loading && !isConfigErr && (
        <>
          {/* ── Stats row ── */}
          <div className="mt-8 grid grid-cols-3 gap-3">
            {[
              { label: 'Total audiences',    value: audiences.length,            color: 'text-white'           },
              { label: 'Customer Match lists', value: customerMatchCount,         color: 'text-gold'       },
              { label: 'Total reach',          value: totalReach > 0 ? fmtReach(totalReach) : '—',
                                                                                  color: 'text-white'           },
            ].map((s) => (
              <div key={s.label} className="rounded-[16px] border border-line bg-surface px-4 py-3">
                <div className={`text-[22px] font-semibold leading-none tabular-nums ${s.color}`}>
                  {s.value}
                </div>
                <div className="mt-1.5 text-xs text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>

          {/* ── Type filter tabs ── */}
          <div className="mt-8 flex flex-wrap items-center gap-2">
            {FILTER_TABS.map(({ label, value }) => {
              const count = value === 'ALL'
                ? audiences.length
                : audiences.filter((a) => a.type === value).length
              const isActive = filter === value
              return (
                <button
                  key={value}
                  onClick={() => setFilter(value)}
                  className={[
                    'rounded-full border px-3.5 py-1.5 text-xs font-medium transition',
                    isActive
                      ? 'border-[#4285F4]/40 bg-[#4285F4]/15 text-[#4285F4]'
                      : 'border-line bg-surface-2 text-slate-500 hover:text-slate-300',
                  ].join(' ')}
                >
                  {label}
                  <span className="ml-1.5 text-xs opacity-60">{count}</span>
                </button>
              )
            })}
          </div>

          {/* ── Audience grid ── */}
          {filtered.length > 0 ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {filtered.map((audience) => (
                <AudienceCard key={audience.id} audience={audience} />
              ))}
            </div>
          ) : (
            audiences.length > 0 ? (
              /* filtered but no results for this type */
              <div className="mt-8 rounded-[24px] border border-line bg-surface px-6 py-12 text-center">
                <Users className="mx-auto mb-4 h-7 w-7 text-[#4285F4]/30" />
                <div className="text-sm font-semibold text-white">
                  No {FILTER_TABS.find((t) => t.value === filter)?.label.toLowerCase()} audiences
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  Try a different filter or create audiences in Google Ads Manager.
                </p>
              </div>
            ) : null
          )}

          {/* ── Customer match empty state ── */}
          {customerLists.length === 0 && (
            <div className="mt-8 rounded-[24px] border border-dashed border-gold/20 bg-gold/[0.03] px-6 py-10 text-center">
              <Upload className="mx-auto mb-3 h-7 w-7 text-gold/40" />
              <div className="text-sm font-semibold text-white">No customer match lists yet</div>
              <p className="mt-2 text-sm text-slate-500">
                Upload your CRM database to re-engage existing leads and find similar audiences on Google.
              </p>
              <button
                disabled
                className="mt-5 inline-flex cursor-not-allowed items-center gap-2 rounded-full border border-gold/20 bg-gold/10 px-5 py-2.5 text-sm font-medium text-[#F8E7AE]/60"
              >
                <Upload className="h-4 w-4" /> Upload CRM data
              </button>
            </div>
          )}

          {/* ── In-Market Audiences (static) ── */}
          <section className="mt-12">
            <div className="mb-5">
              <div className="text-sm font-medium uppercase tracking-wider text-slate-500">
                Recommended in-market audiences
              </div>
              <p className="mt-1.5 text-sm text-slate-500">
                Google-curated in-market segments relevant to Dubai real estate buyers and investors.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {STATIC_IN_MARKET.map((item) => (
                <div
                  key={item.name}
                  className="flex items-start justify-between gap-4 rounded-[16px] border border-line bg-surface p-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full border border-sky-400/20 bg-sky-400/10 px-2 py-0.5 text-xs font-medium text-slate-400">
                        In-Market
                      </span>
                    </div>
                    <div className="mt-2 text-sm font-semibold text-white">{item.name}</div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      {item.description}
                    </p>
                  </div>
                  <span className="mt-1 shrink-0 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-sm font-medium text-slate-500">
                    Add
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* ── Customer Match info note ── */}
          <div className="mt-8 flex items-start gap-3 rounded-[14px] border border-line bg-surface-2 px-5 py-4">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <p className="text-xs leading-relaxed text-slate-500">
              <span className="font-medium text-slate-400">Customer Match</span> requires a minimum of 1,000 matched users to be active in campaigns. Uploaded lists may take up to 48 hours to process.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
