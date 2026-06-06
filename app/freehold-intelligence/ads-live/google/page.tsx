'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowUpRight, RefreshCw, AlertCircle, Zap } from 'lucide-react'
import type { GoogleCampaign, GoogleReportSummary } from '@/lib/google/types'
import { MarketingExpertPanel } from '@/components/google/ads-expert-panel'

const GOOGLE_BLUE = '#4285F4'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtMicros(m: number) {
  const aed = m / 1_000_000
  if (aed >= 1_000_000) return `AED ${(aed / 1_000_000).toFixed(2)}M`
  if (aed >= 1_000)     return `AED ${(aed / 1_000).toFixed(1)}K`
  return `AED ${aed.toFixed(0)}`
}

function fmtPct(n: number) {
  return `${(n * 100).toFixed(2)}%`
}

// ─── SVG sparkline ────────────────────────────────────────────────────────────

function DailySpendChart({ days }: { days: GoogleReportSummary['byDay'] }) {
  if (!days.length) return null
  const sorted  = [...days].sort((a, b) => a.date.localeCompare(b.date)).slice(-14)
  const W = 560, H = 72, pad = 4
  const maxSpend = Math.max(...sorted.map((d) => d.costMicros), 1)
  const maxClicks = Math.max(...sorted.map((d) => d.clicks), 1)

  function points(key: 'costMicros' | 'clicks', max: number) {
    return sorted.map((d, i) => {
      const x = pad + (i / Math.max(sorted.length - 1, 1)) * (W - pad * 2)
      const y = H - pad - (d[key] / max) * (H - pad * 2)
      return `${x},${y}`
    }).join(' ')
  }

  return (
    <div className="overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#131B2B] p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[12px] font-medium uppercase tracking-[0.14em] text-white/35">Daily performance</div>
        <div className="flex items-center gap-4 text-[11px] text-white/35">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded" style={{ background: GOOGLE_BLUE }} /> Spend
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded bg-[#D4AF37]" /> Clicks
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: 72 }}>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((t) => (
          <line key={t} x1={pad} y1={pad + t * (H - pad * 2)} x2={W - pad} y2={pad + t * (H - pad * 2)}
            stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        ))}
        {/* Spend area */}
        <defs>
          <linearGradient id="gSpend" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GOOGLE_BLUE} stopOpacity="0.18" />
            <stop offset="100%" stopColor={GOOGLE_BLUE} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          points={`${pad},${H - pad} ${points('costMicros', maxSpend).split(' ').join(' ')} ${W - pad},${H - pad}`}
          fill="url(#gSpend)"
        />
        <polyline points={points('costMicros', maxSpend)} fill="none" stroke={GOOGLE_BLUE} strokeWidth="1.5" strokeLinejoin="round" />
        {/* Clicks line */}
        <polyline points={points('clicks', maxClicks)} fill="none" stroke="#D4AF37" strokeWidth="1.5" strokeLinejoin="round" strokeDasharray="4 2" />
      </svg>
      {/* X-axis labels */}
      <div className="mt-2 flex justify-between">
        {sorted.filter((_, i) => i === 0 || i === Math.floor(sorted.length / 2) || i === sorted.length - 1).map((d) => (
          <span key={d.date} className="text-[11px] text-white/25">
            {new Date(d.date).toLocaleDateString('en-AE', { month: 'short', day: 'numeric' })}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type SortCol = 'costMicros' | 'clicks' | 'conversions' | 'impressions'

export default function GoogleAdsPage() {
  const [campaigns, setCampaigns]   = useState<GoogleCampaign[]>([])
  const [report, setReport]         = useState<GoogleReportSummary | null>(null)
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [configErr, setConfigErr]   = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [sortCol, setSortCol]       = useState<SortCol>('costMicros')
  const [sortAsc, setSortAsc]       = useState(false)
  const [toggling, setToggling]     = useState<string | null>(null)

  async function fetchAll(quiet = false) {
    if (quiet) setRefreshing(true); else setLoading(true)
    setError(null)
    try {
      const [cRes, rRes] = await Promise.all([
        fetch('/api/google/campaigns'),
        fetch('/api/google/reports?range=30d'),
      ])
      const cData = await cRes.json()
      const rData = await rRes.json()
      if (cData.type === 'config') { setConfigErr(true); setError(cData.error ?? null); return }
      setCampaigns(cData.campaigns ?? [])
      setReport(rData.report ?? null)
    } catch {
      setError('Network error — could not reach Google Ads API')
    } finally {
      setLoading(false); setRefreshing(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  async function toggleStatus(c: GoogleCampaign) {
    const newStatus = c.status === 'ENABLED' ? 'PAUSED' : 'ENABLED'
    setToggling(c.id)
    try {
      const res = await fetch(`/api/google/campaigns/${c.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        setCampaigns((prev) => prev.map((x) => x.id === c.id ? { ...x, status: newStatus } : x))
      }
    } finally {
      setToggling(null)
    }
  }

  function handleSort(col: SortCol) {
    if (sortCol === col) setSortAsc((v) => !v)
    else { setSortCol(col); setSortAsc(false) }
  }

  const totalSpend = campaigns.reduce((s, c) => s + (c.metrics?.costMicros ?? 0), 0)
  const totalClicks = campaigns.reduce((s, c) => s + (c.metrics?.clicks ?? 0), 0)
  const totalConv   = campaigns.reduce((s, c) => s + (c.metrics?.conversions ?? 0), 0)
  const totalImpr   = campaigns.reduce((s, c) => s + (c.metrics?.impressions ?? 0), 0)
  const avgCtr      = totalImpr > 0 ? totalClicks / totalImpr : 0
  const avgCpc      = totalClicks > 0 ? totalSpend / totalClicks : 0

  const sorted = [...campaigns].sort((a, b) => {
    const va = a.metrics?.[sortCol] ?? 0
    const vb = b.metrics?.[sortCol] ?? 0
    return sortAsc ? va - vb : vb - va
  })

  const searchTerms = report?.searchTerms.slice(0, 8) ?? []

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <section>
          <div className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-wider" style={{ color: `${GOOGLE_BLUE}CC` }}>
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
              <path d="M21.805 10.023H12v3.955h5.63c-.513 2.466-2.694 4.022-5.63 4.022-3.414 0-6.182-2.768-6.182-6.182s2.768-6.182 6.182-6.182c1.533 0 2.926.564 3.99 1.488l2.964-2.964C17.113 2.548 14.659 1.5 12 1.5 6.201 1.5 1.5 6.201 1.5 12S6.201 22.5 12 22.5c5.523 0 10.5-4 10.5-10.5 0-.657-.066-1.298-.195-1.977z" fill={GOOGLE_BLUE} />
            </svg>
            Google Ads · 30-day
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white/90">
            {loading ? 'Loading…' : configErr ? 'Not connected.' : `${campaigns.length} campaign${campaigns.length !== 1 ? 's' : ''}.`}
          </h1>
        </section>

        <div className="mt-7 flex items-center gap-2 sm:mt-10">
          <button
            onClick={() => fetchAll(true)}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-white/50 transition hover:text-white disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link
            href="/freehold-intelligence/lead-machine/google"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-semibold text-white transition"
            style={{ background: GOOGLE_BLUE }}
          >
            <Zap className="h-3.5 w-3.5" /> Manage
          </Link>
        </div>
      </div>

      {/* Config error */}
      {configErr && (
        <div className="mt-8 rounded-[20px] border border-red-400/20 bg-red-400/[0.05] p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <div>
              <div className="text-[13px] font-semibold text-white">Google Ads not connected</div>
              <p className="mt-1 text-[13px] text-white/55">{error}</p>
              <Link href="/freehold-intelligence/integrations/google" className="mt-3 inline-flex items-center gap-1 text-[12px] text-[#4285F4]/80 hover:text-[#4285F4]">
                Set up Google Ads <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Network error */}
      {error && !configErr && (
        <div className="mt-8 rounded-[18px] border border-orange-400/20 bg-orange-400/[0.04] p-4">
          <div className="flex items-center gap-2 text-[13px] text-white/60">
            <AlertCircle className="h-4 w-4 shrink-0 text-orange-400" />
            {error}
          </div>
        </div>
      )}

      {loading && (
        <div className="mt-16 text-center text-[14px] text-white/30">Loading Google Ads data…</div>
      )}

      {!loading && !configErr && (
        <>
          {/* KPI row */}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: 'Spend',       value: fmtMicros(totalSpend),               color: 'text-white'      },
              { label: 'Impressions', value: totalImpr.toLocaleString(),           color: 'text-white/70'   },
              { label: 'Clicks',      value: totalClicks.toLocaleString(),         color: 'text-white'      },
              { label: 'Conversions', value: Math.round(totalConv).toLocaleString(), color: 'text-[#D4AF37]' },
              { label: 'Avg CTR',     value: fmtPct(avgCtr),                      color: 'text-white/70'   },
              { label: 'Avg CPC',     value: fmtMicros(avgCpc),                   color: 'text-white/70'   },
            ].map((k) => (
              <div key={k.label} className="rounded-[18px] border border-white/[0.05] bg-white/[0.03] p-4">
                <div className="text-[12px] font-medium uppercase tracking-[0.18em] text-white/35">{k.label}</div>
                <div className={`mt-2 text-[20px] font-semibold leading-none ${k.color}`}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Daily chart */}
          {report && report.byDay.length > 0 && (
            <div className="mt-6">
              <DailySpendChart days={report.byDay} />
            </div>
          )}

          {/* Campaigns table */}
          {sorted.length > 0 && (
            <section className="mt-10">
              <div className="mb-4 text-[13px] font-medium uppercase tracking-wider text-white/40">Campaigns</div>
              <div className="overflow-x-auto">
                <div className="min-w-[700px] overflow-hidden rounded-[20px] border border-white/[0.05] bg-white/[0.03]">
                  {/* Header */}
                  <div className="grid grid-cols-[2fr_80px_70px_90px_70px_70px_70px_56px] gap-3 border-b border-white/[0.05] px-5 py-3">
                    {[
                      { label: 'Campaign', col: null },
                      { label: 'Type',     col: null },
                      { label: 'Status',   col: null },
                      { label: 'Spend',    col: 'costMicros'  as SortCol },
                      { label: 'Impr.',    col: 'impressions' as SortCol },
                      { label: 'Clicks',   col: 'clicks'      as SortCol },
                      { label: 'Conv.',    col: 'conversions' as SortCol },
                      { label: '',         col: null },
                    ].map(({ label, col }) => (
                      <button
                        key={label}
                        onClick={() => col && handleSort(col)}
                        className={[
                          'text-left text-[12px] font-medium uppercase tracking-[0.14em] transition',
                          col ? 'cursor-pointer text-white/30 hover:text-white/60' : 'cursor-default text-white/30',
                          col && sortCol === col ? 'text-[#4285F4]/80' : '',
                        ].join(' ')}
                      >
                        {label}
                        {col && sortCol === col && (
                          <span className="ml-0.5 text-[10px]">{sortAsc ? '↑' : '↓'}</span>
                        )}
                      </button>
                    ))}
                  </div>
                  {/* Rows */}
                  <div className="divide-y divide-white/[0.04]">
                    {sorted.map((c) => (
                      <div key={c.id} className="grid grid-cols-[2fr_80px_70px_90px_70px_70px_70px_56px] gap-3 items-center px-5 py-4">
                        <Link
                          href={`/freehold-intelligence/lead-machine/google/campaigns/${c.id}`}
                          className="flex items-center gap-2 min-w-0 hover:text-white transition"
                        >
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${c.status === 'ENABLED' ? 'bg-[#D4AF37]' : 'bg-white/20'}`} />
                          <span className="truncate text-[13px] font-medium text-white/85">{c.name}</span>
                        </Link>
                        <span
                          className="rounded-full border px-2 py-0.5 text-[11px] font-medium"
                          style={{ background: `${GOOGLE_BLUE}14`, borderColor: `${GOOGLE_BLUE}28`, color: GOOGLE_BLUE }}
                        >
                          {c.type.replace('_', ' ')}
                        </span>
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                          c.status === 'ENABLED'
                            ? 'border-[#D4AF37]/20 bg-[#D4AF37]/10 text-[#D4AF37]'
                            : 'border-white/[0.08] bg-white/[0.04] text-white/35'
                        }`}>
                          {c.status === 'ENABLED' ? 'Active' : 'Paused'}
                        </span>
                        <span className="text-[12px] text-white/70">{fmtMicros(c.metrics?.costMicros ?? 0)}</span>
                        <span className="text-[12px] text-white/55">{(c.metrics?.impressions ?? 0).toLocaleString()}</span>
                        <span className="text-[12px] text-white/55">{(c.metrics?.clicks ?? 0).toLocaleString()}</span>
                        <span className="text-[13px] font-semibold text-[#D4AF37]">{Math.round(c.metrics?.conversions ?? 0)}</span>
                        <button
                          onClick={() => toggleStatus(c)}
                          disabled={toggling === c.id}
                          className={[
                            'rounded-[8px] border px-2 py-1 text-[11px] font-medium transition disabled:opacity-40',
                            c.status === 'ENABLED'
                              ? 'border-red-400/20 bg-red-400/[0.07] text-red-300 hover:bg-red-400/[0.14]'
                              : 'border-[#D4AF37]/20 bg-[#D4AF37]/[0.07] text-[#D4AF37] hover:bg-[#D4AF37]/[0.14]',
                          ].join(' ')}
                        >
                          {toggling === c.id ? '…' : c.status === 'ENABLED' ? 'Pause' : 'Resume'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Top search terms */}
          {searchTerms.length > 0 && (
            <section className="mt-10">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-[13px] font-medium uppercase tracking-wider text-white/40">Top search terms</div>
                <Link href="/freehold-intelligence/lead-machine/google/reports" className="text-[12px] text-white/35 transition hover:text-white">
                  Full report <ArrowUpRight className="inline h-3 w-3" />
                </Link>
              </div>
              <div className="overflow-x-auto">
                <div className="min-w-[540px] overflow-hidden rounded-[20px] border border-white/[0.05] bg-white/[0.03]">
                  <div className="grid grid-cols-[2fr_90px_70px_70px_90px] gap-4 border-b border-white/[0.05] px-5 py-3">
                    {['Search Term', 'Impressions', 'Clicks', 'CTR', 'Avg CPC'].map((h) => (
                      <div key={h} className="text-[12px] font-medium uppercase tracking-[0.14em] text-white/30">{h}</div>
                    ))}
                  </div>
                  <div className="divide-y divide-white/[0.04]">
                    {searchTerms.map((s) => {
                      const ctr = s.impressions > 0 ? s.clicks / s.impressions : 0
                      const cpc = s.clicks > 0 ? s.costMicros / s.clicks : 0
                      return (
                        <div key={s.searchTerm} className="grid grid-cols-[2fr_90px_70px_70px_90px] gap-4 items-center px-5 py-3.5">
                          <div className="truncate text-[13px] font-medium text-white/85">{s.searchTerm}</div>
                          <div className="text-[12px] text-white/55">{s.impressions.toLocaleString()}</div>
                          <div className="text-[12px] text-white/70">{s.clicks.toLocaleString()}</div>
                          <div className="text-[12px] font-semibold" style={{ color: GOOGLE_BLUE }}>{fmtPct(ctr)}</div>
                          <div className="text-[12px] text-white/70">{fmtMicros(cpc)}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Empty state */}
          {campaigns.length === 0 && !error && (
            <div className="mt-16 rounded-[28px] border border-white/[0.08] bg-white/[0.02] px-7 py-14 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: `${GOOGLE_BLUE}14` }}>
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none">
                  <path d="M21.805 10.023H12v3.955h5.63c-.513 2.466-2.694 4.022-5.63 4.022-3.414 0-6.182-2.768-6.182-6.182s2.768-6.182 6.182-6.182c1.533 0 2.926.564 3.99 1.488l2.964-2.964C17.113 2.548 14.659 1.5 12 1.5 6.201 1.5 1.5 6.201 1.5 12S6.201 22.5 12 22.5c5.523 0 10.5-4 10.5-10.5 0-.657-.066-1.298-.195-1.977z" fill={GOOGLE_BLUE} />
                </svg>
              </div>
              <div className="text-[18px] font-semibold text-white">No Google Ads campaigns yet</div>
              <p className="mt-2 text-[13px] text-white/40">Create your first campaign to start capturing high-intent leads from Google Search.</p>
              <Link
                href="/freehold-intelligence/lead-machine/google/campaigns/new"
                className="mt-6 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-semibold text-white transition"
                style={{ background: GOOGLE_BLUE }}
              >
                <Zap className="h-4 w-4" /> Create first campaign
              </Link>
            </div>
          )}

          {/* Footer link */}
          {campaigns.length > 0 && (
            <div className="mt-10">
              <Link
                href="/freehold-intelligence/lead-machine/google"
                className="inline-flex items-center gap-2 rounded-[18px] border border-white/[0.07] bg-white/[0.03] px-5 py-3 text-[13px] font-semibold text-white/75 transition hover:border-[#4285F4]/30 hover:text-white"
              >
                Full Google Ads manager <ArrowUpRight className="h-3.5 w-3.5" style={{ color: GOOGLE_BLUE }} />
              </Link>
            </div>
          )}

          {/* Marketing Expert Agent */}
          <MarketingExpertPanel
            scope="google-ads"
            context={{
              platform: 'Google Ads (Live)',
              activeCampaigns: campaigns.filter((c) => c.status === 'ENABLED').length,
              totalCampaigns: campaigns.length,
              spend30d: fmtMicros(campaigns.reduce((s, c) => s + (c.metrics?.costMicros ?? 0), 0)),
              conversions: Math.round(campaigns.reduce((s, c) => s + (c.metrics?.conversions ?? 0), 0)),
              clicks: campaigns.reduce((s, c) => s + (c.metrics?.clicks ?? 0), 0),
            }}
          />
        </>
      )}
    </div>
  )
}
