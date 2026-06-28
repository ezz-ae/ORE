'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { BarChart2, AlertCircle, ArrowUpRight } from 'lucide-react'
import type { GoogleReportSummary, SearchTermRow, GoogleCampaign } from '@/lib/google/types'
import { useT } from '@/lib/i18n/provider'

// ─── Re-export types to satisfy import requirements (used in scope below) ────
type _GoogleCampaign = GoogleCampaign
void (null as unknown as _GoogleCampaign)

type DateRange = '7d' | '30d' | '90d'
type SearchTermStatus = 'NONE' | 'ADDED' | 'EXCLUDED' | 'ADDED_EXCLUDED'
type StatusFilter = 'all' | 'NONE' | 'ADDED' | 'EXCLUDED'

interface ReportResponse {
  report?: GoogleReportSummary
  error?: string
  type?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtMicros(m: number): string {
  const aed = m / 1_000_000
  if (aed >= 1000) return `AED ${(aed / 1000).toFixed(1)}K`
  return `AED ${aed.toLocaleString('en-AE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(2)}%`
}

function fmtNum(n: number): string {
  return n.toLocaleString()
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CAMPAIGN_TYPE_COLOR: Record<string, string> = {
  SEARCH:          'bg-[#4285F4]/10 text-[#4285F4] border-[#4285F4]/20',
  DISPLAY:         'bg-gold/10 text-gold border-gold/20',
  PERFORMANCE_MAX: 'bg-[#FBBC04]/10 text-[#FBBC04] border-[#FBBC04]/20',
  VIDEO:           'bg-rose-400/10 text-slate-400 border-rose-400/20',
  SHOPPING:        'bg-violet-400/10 text-slate-400 border-violet-400/20',
}

const STATUS_BADGE: Record<SearchTermStatus, string> = {
  NONE:           'text-slate-500 border border-white/[0.12] bg-surface-2',
  ADDED:          'text-gold border border-gold/25 bg-gold/[0.07]',
  EXCLUDED:       'text-red-400 border border-red-400/25 bg-red-400/[0.07]',
  ADDED_EXCLUDED: 'text-orange-300 border border-orange-400/25 bg-orange-400/[0.07]',
}

const STATUS_LABEL: Record<SearchTermStatus, string> = {
  NONE:           'Not added',
  ADDED:          'Added',
  EXCLUDED:       'Excluded',
  ADDED_EXCLUDED: 'Added+Excl',
}

const DEVICE_ICON: Record<string, string> = {
  DESKTOP: '🖥',
  MOBILE:  '📱',
  TABLET:  '💻',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GoogleReportsPage() {
  const t = useT()
  const [range, setRange]         = useState<DateRange>('30d')
  const [report, setReport]       = useState<GoogleReportSummary | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [configErr, setConfigErr] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  useEffect(() => {
    async function fetchReport() {
      setLoading(true)
      setError(null)
      setConfigErr(false)
      try {
        const res  = await fetch(`/api/google/reports?range=${range}`)
        const data: ReportResponse = await res.json()
        if (data.type === 'config') {
          setConfigErr(true)
          setError(data.error ?? 'Google Ads is not connected.')
          setReport(null)
          return
        }
        if (data.error) {
          setError(data.error)
          setReport(null)
          return
        }
        setReport(data.report ?? null)
      } catch {
        setError('Network error — could not reach the reports API.')
      } finally {
        setLoading(false)
      }
    }
    fetchReport()
  }, [range])

  // ── Derived data ────────────────────────────────────────────────────────────

  const sortedCampaigns = report
    ? [...report.byCampaign].sort((a, b) => b.costMicros - a.costMicros)
    : []

  const maxDeviceImpressions = report
    ? Math.max(...report.byDevice.map((d) => d.impressions), 1)
    : 1

  const last14Days = report
    ? [...report.byDay]
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-14)
    : []

  const maxDaySpend = last14Days.length
    ? Math.max(...last14Days.map((d) => d.costMicros), 1)
    : 1

  const filteredTerms: SearchTermRow[] = report
    ? report.searchTerms
        .slice(0, 50)
        .filter((t) => {
          if (statusFilter === 'all') return true
          if (statusFilter === 'NONE') return t.status === 'NONE'
          if (statusFilter === 'ADDED') return t.status === 'ADDED' || t.status === 'ADDED_EXCLUDED'
          if (statusFilter === 'EXCLUDED') return t.status === 'EXCLUDED' || t.status === 'ADDED_EXCLUDED'
          return true
        })
    : []

  function formatShortDate(dateStr: string): string {
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('en-AE', { month: 'short', day: 'numeric' })
    } catch {
      return dateStr
    }
  }

  const rangeLabel: Record<DateRange, string> = {
    '7d':  '7-day',
    '30d': '30-day',
    '90d': '90-day',
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      {/* Header */}
      <section>
        <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-[#4285F4]/85">
          <BarChart2 className="h-3.5 w-3.5" /> Reports
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
          Performance reports<br />
          <span className="text-slate-500">{rangeLabel[range]} window.</span>
        </h1>
      </section>

      {/* Date range toggle */}
      <div className="mt-8 flex items-center gap-2">
        {(['7d', '30d', '90d'] as DateRange[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={[
              'rounded-[10px] px-4 py-2 text-xs font-semibold transition',
              range === r
                ? 'bg-[#4285F4] text-white'
                : 'bg-surface-2 text-slate-500 hover:bg-white/[0.1] hover:text-slate-300',
            ].join(' ')}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Config error */}
      {configErr && (
        <div className="mt-8 rounded-[20px] border border-red-400/20 bg-red-400/[0.05] p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <div>
              <div className="text-sm font-semibold text-white">{t('lm.google.common.notConnected')}</div>
              <p className="mt-1 text-sm text-slate-400">{error}</p>
              <Link
                href="/freehold-intelligence/integrations/google"
                className="mt-3 inline-flex items-center gap-1 text-xs text-[#4285F4]/80 transition hover:text-[#4285F4]"
              >
                {t('lm.google.common.setup')} <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* General error */}
      {error && !configErr && (
        <div className="mt-8 rounded-[18px] border border-orange-400/20 bg-orange-400/[0.04] p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
            <p className="text-sm text-slate-300">{error}</p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="mt-16 text-center text-[14px] text-slate-500">
          Loading {rangeLabel[range]} report…
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && !report && (
        <div className="mt-16 rounded-[28px] border border-line bg-surface-2 px-7 py-14 text-center">
          <BarChart2 className="mx-auto mb-4 h-8 w-8 text-[#4285F4]/30" />
          <div className="text-[17px] font-semibold text-white">{t('lm.google.reports.empty')}</div>
          <p className="mt-2 text-sm text-slate-500">
            No performance data is available for the selected window.
          </p>
        </div>
      )}

      {!loading && report && (
        <>
          {/* ── KPI summary cards ───────────────────────────────────────────── */}
          <section className="mt-10">
            <div className="mb-4 text-sm font-medium uppercase tracking-wider text-slate-500">
              Summary — {rangeLabel[range]}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { label: t('lm.google.common.impressions'),  value: fmtNum(report.totalImpressions)       },
                { label: t('lm.google.common.clicks'),       value: fmtNum(report.totalClicks)            },
                { label: t('lm.google.common.spend'),        value: fmtMicros(report.totalCostMicros)     },
                { label: t('lm.google.common.conversions'),  value: fmtNum(Math.round(report.totalConversions)) },
                { label: t('lm.google.overview.stat.ctr'),   value: fmtPct(report.avgCtr)                 },
                { label: t('lm.google.overview.stat.cpc'),   value: fmtMicros(report.avgCpcMicros)        },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  className="rounded-[18px] border border-line bg-surface px-4 py-4"
                >
                  <div className="text-[20px] font-semibold leading-none text-white">
                    {kpi.value}
                  </div>
                  <div className="mt-1.5 text-xs text-slate-500">{kpi.label}</div>
                </div>
              ))}
            </div>
          </section>

          {/* ── By Campaign table ───────────────────────────────────────────── */}
          {sortedCampaigns.length > 0 && (
            <section className="mt-10">
              <div className="mb-4 text-sm font-medium uppercase tracking-wider text-slate-500">
                By campaign — sorted by spend
              </div>
              <div className="overflow-hidden rounded-[20px] border border-line bg-surface">
                {/* Table header */}
                <div className="grid grid-cols-[1fr_100px_80px_60px_70px_70px_90px] gap-x-4 border-b border-line px-5 py-2.5">
                  {['Campaign', 'Type', 'Impr.', 'Clicks', 'CTR', 'Conv.', 'Spend'].map((h) => (
                    <div key={h} className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                      {h}
                    </div>
                  ))}
                </div>
                {/* Table rows */}
                <div className="divide-y divide-white/[0.04]">
                  {sortedCampaigns.map((c) => {
                    const ctr = c.clicks > 0 && c.impressions > 0 ? c.clicks / c.impressions : 0
                    return (
                      <div
                        key={c.campaignId}
                        className="grid grid-cols-[1fr_100px_80px_60px_70px_70px_90px] items-center gap-x-4 px-5 py-3.5 transition hover:bg-surface-2"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-white">{c.name}</div>
                        </div>
                        <div>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                              CAMPAIGN_TYPE_COLOR[c.type] ?? 'bg-surface-2 text-slate-500 border-line'
                            }`}
                          >
                            {c.type.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400">{fmtNum(c.impressions)}</div>
                        <div className="text-xs text-slate-400">{fmtNum(c.clicks)}</div>
                        <div className="text-xs text-slate-400">{fmtPct(ctr)}</div>
                        <div className="text-xs text-slate-400">{Math.round(c.conversions)}</div>
                        <div className="text-xs font-semibold text-white">{fmtMicros(c.costMicros)}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </section>
          )}

          {/* ── By Device breakdown ─────────────────────────────────────────── */}
          {report.byDevice.length > 0 && (
            <section className="mt-10">
              <div className="mb-4 text-sm font-medium uppercase tracking-wider text-slate-500">
                By device
              </div>
              <div className="overflow-hidden rounded-[20px] border border-line bg-surface p-5">
                <div className="space-y-5">
                  {[...report.byDevice]
                    .sort((a, b) => b.impressions - a.impressions)
                    .map((d) => {
                      const widthPct = Math.round((d.impressions / maxDeviceImpressions) * 100)
                      const ctr      = d.impressions > 0 ? d.clicks / d.impressions : 0
                      return (
                        <div key={d.device}>
                          <div className="mb-1.5 flex items-center gap-3">
                            <span className="w-5 text-base">{DEVICE_ICON[d.device] ?? '📲'}</span>
                            <span className="w-20 text-xs font-semibold text-slate-100">
                              {d.device.charAt(0) + d.device.slice(1).toLowerCase()}
                            </span>
                            <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                              <div
                                className="absolute inset-y-0 left-0 rounded-full bg-[#4285F4]/60"
                                style={{ width: `${widthPct}%` }}
                              />
                            </div>
                            <div className="flex w-48 shrink-0 justify-end gap-5 text-sm text-slate-500">
                              <span>{fmtNum(d.impressions)} impr.</span>
                              <span>{fmtPct(ctr)} CTR</span>
                              <span>{Math.round(d.conversions)} conv.</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>
            </section>
          )}

          {/* ── Daily trend ─────────────────────────────────────────────────── */}
          {last14Days.length > 0 && (
            <section className="mt-10">
              <div className="mb-4 text-sm font-medium uppercase tracking-wider text-slate-500">
                Daily performance — last {last14Days.length} days
              </div>
              <div className="overflow-hidden rounded-[20px] border border-line bg-surface p-5">
                {/* SVG line chart */}
                {(() => {
                  const W = 560, H = 88, pad = 6
                  const maxSpend  = Math.max(...last14Days.map((d) => d.costMicros), 1)
                  const maxClicks = Math.max(...last14Days.map((d) => d.clicks), 1)
                  const maxConv   = Math.max(...last14Days.map((d) => d.conversions), 1)

                  function pts(key: 'costMicros' | 'clicks' | 'conversions', max: number) {
                    return last14Days.map((d, i) => {
                      const x = pad + (i / Math.max(last14Days.length - 1, 1)) * (W - pad * 2)
                      const y = H - pad - (d[key] / max) * (H - pad * 2)
                      return `${x.toFixed(1)},${y.toFixed(1)}`
                    }).join(' ')
                  }

                  const spendPts  = pts('costMicros', maxSpend)
                  const clicksPts = pts('clicks', maxClicks)
                  const convPts   = pts('conversions', maxConv)
                  const firstX = pad, firstY = H - pad
                  const lastX  = W - pad
                  const areaPoints = `${firstX},${firstY} ${spendPts} ${lastX},${firstY}`

                  return (
                    <>
                      <div className="mb-3 flex items-center gap-5 text-xs text-slate-500">
                        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-[#4285F4]" /> Spend</span>
                        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-gold" /> Clicks</span>
                        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-emerald-400" /> Conversions</span>
                      </div>
                      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 88 }} preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="rSpendGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#4285F4" stopOpacity="0.15" />
                            <stop offset="100%" stopColor="#4285F4" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        {[0.25, 0.5, 0.75].map((t) => (
                          <line key={t} x1={pad} y1={pad + t * (H - pad * 2)} x2={W - pad} y2={pad + t * (H - pad * 2)}
                            stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                        ))}
                        <polygon points={areaPoints} fill="url(#rSpendGrad)" />
                        <polyline points={spendPts}  fill="none" stroke="#4285F4" strokeWidth="1.5" strokeLinejoin="round" />
                        <polyline points={clicksPts} fill="none" stroke="#D4AF37" strokeWidth="1.5" strokeLinejoin="round" strokeDasharray="4 2" />
                        <polyline points={convPts}   fill="none" stroke="#34D399" strokeWidth="1.5" strokeLinejoin="round" strokeDasharray="2 3" />
                      </svg>
                      <div className="mt-2 flex justify-between text-xs text-slate-600">
                        {last14Days
                          .filter((_, i) => i === 0 || i === Math.floor(last14Days.length / 2) || i === last14Days.length - 1)
                          .map((d) => (
                            <span key={d.date}>{formatShortDate(d.date)}</span>
                          ))}
                      </div>
                    </>
                  )
                })()}

                {/* Summary row below chart */}
                <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4">
                  {[
                    { label: 'Total spend',  value: fmtMicros(last14Days.reduce((s, d) => s + d.costMicros, 0)) },
                    { label: 'Total clicks', value: last14Days.reduce((s, d) => s + d.clicks, 0).toLocaleString() },
                    { label: 'Conversions',  value: Math.round(last14Days.reduce((s, d) => s + d.conversions, 0)).toLocaleString() },
                  ].map((m) => (
                    <div key={m.label}>
                      <div className="text-[17px] font-semibold text-white">{m.value}</div>
                      <div className="text-xs text-slate-500">{m.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* ── Search Terms ────────────────────────────────────────────────── */}
          <section className="mt-10">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-medium uppercase tracking-wider text-slate-500">
                Search terms — top 50 by impressions
              </div>
              {/* Status filter */}
              <div className="flex items-center gap-1.5">
                {([
                  { value: 'all',      label: 'All'        },
                  { value: 'NONE',     label: 'Not Added'  },
                  { value: 'ADDED',    label: 'Added'      },
                  { value: 'EXCLUDED', label: 'Excluded'   },
                ] as { value: StatusFilter; label: string }[]).map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setStatusFilter(f.value)}
                    className={[
                      'rounded-[8px] px-3 py-1.5 text-sm font-medium transition',
                      statusFilter === f.value
                        ? 'bg-[#4285F4] text-white'
                        : 'bg-surface-2 text-slate-500 hover:bg-white/[0.1] hover:text-slate-300',
                    ].join(' ')}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredTerms.length === 0 ? (
              <div className="rounded-[16px] border border-line bg-surface px-5 py-8 text-center text-sm text-slate-500">
                No search terms match the selected filter.
              </div>
            ) : (
              <div className="overflow-hidden rounded-[20px] border border-line bg-surface">
                {/* Table header */}
                <div className="grid grid-cols-[2fr_80px_1fr_1fr_70px_50px_60px_70px_80px] gap-x-3 border-b border-line px-5 py-2.5">
                  {['Term', 'Match', 'Campaign', 'Ad Group', 'Impr.', 'Clicks', 'CTR', 'Conv.', 'Status'].map((h) => (
                    <div key={h} className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                      {h}
                    </div>
                  ))}
                </div>
                {/* Rows */}
                <div className="divide-y divide-white/[0.04]">
                  {filteredTerms.map((t, idx) => {
                    const displayTerm = t.searchTerm.length > 60
                      ? t.searchTerm.slice(0, 60) + '…'
                      : t.searchTerm
                    const status = t.status as SearchTermStatus
                    return (
                      <div
                        key={`${t.searchTerm}-${idx}`}
                        className="grid grid-cols-[2fr_80px_1fr_1fr_70px_50px_60px_70px_80px] items-center gap-x-3 px-5 py-3 transition hover:bg-surface-2"
                      >
                        <div
                          className="truncate text-xs text-slate-200"
                          title={t.searchTerm}
                        >
                          {displayTerm}
                        </div>
                        <div>
                          <span className="rounded border border-white/[0.1] bg-surface-2 px-1.5 py-0.5 text-xs text-slate-500">
                            {t.matchType}
                          </span>
                        </div>
                        <div className="truncate text-sm text-slate-500" title={t.campaignName}>
                          {t.campaignName}
                        </div>
                        <div className="truncate text-sm text-slate-500" title={t.adGroupName}>
                          {t.adGroupName}
                        </div>
                        <div className="text-sm text-slate-400">{fmtNum(t.impressions)}</div>
                        <div className="text-sm text-slate-400">{fmtNum(t.clicks)}</div>
                        <div className="text-sm text-slate-400">{fmtPct(t.ctr)}</div>
                        <div className="text-sm text-slate-400">{Math.round(t.conversions)}</div>
                        <div>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              STATUS_BADGE[status] ?? STATUS_BADGE.NONE
                            }`}
                          >
                            {STATUS_LABEL[status] ?? status}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Search terms note */}
            <p className="mt-4 text-xs leading-relaxed text-slate-500">
              Search terms are matched queries that triggered your ads. Adding high-performing terms
              as keywords improves Quality Score.
            </p>
          </section>
        </>
      )}
    </div>
  )
}
