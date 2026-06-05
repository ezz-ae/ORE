'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Search,
  RefreshCw,
  AlertCircle,
  ArrowUpRight,
  Zap,
  Play,
  Pause,
  Loader2,
} from 'lucide-react'
import type { GoogleCampaign, GoogleCampaignType } from '@/lib/google/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMicros(m: number): string {
  const aed = m / 1_000_000
  if (aed >= 1000) return `AED ${(aed / 1000).toFixed(1)}K`
  return `AED ${aed.toFixed(1)}`
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(2)}%`
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CAMPAIGN_TYPE_COLOR: Record<string, string> = {
  SEARCH:          'bg-[#4285F4]/10 text-[#4285F4] border-[#4285F4]/20',
  DISPLAY:         'bg-[#D4AF37]/10 text-[#D4AF37] border-emerald-400/20',
  PERFORMANCE_MAX: 'bg-[#FBBC04]/10 text-[#FBBC04] border-[#FBBC04]/20',
  VIDEO:           'bg-rose-400/10 text-white/55 border-rose-400/20',
}

const FILTER_TYPES: { label: string; value: GoogleCampaignType | 'ALL' }[] = [
  { label: 'All',             value: 'ALL' },
  { label: 'Search',          value: 'SEARCH' },
  { label: 'Performance Max', value: 'PERFORMANCE_MAX' },
  { label: 'Display',         value: 'DISPLAY' },
  { label: 'Video',           value: 'VIDEO' },
]

// ─── API shapes ───────────────────────────────────────────────────────────────

interface CampaignsResponse {
  campaigns?: GoogleCampaign[]
  error?: string
  type?: string
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const cls = CAMPAIGN_TYPE_COLOR[type] ?? 'bg-white/[0.04] text-white/40 border-white/[0.08]'
  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${cls}`}
    >
      {type.replace(/_/g, ' ')}
    </span>
  )
}

function BiddingBadge({ strategy }: { strategy: string }) {
  return (
    <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[12px] text-white/40">
      {strategy.replace(/_/g, ' ')}
    </span>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function GoogleCampaignsPage() {
  const [campaigns, setCampaigns]   = useState<GoogleCampaign[]>([])
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [configErr, setConfigErr]   = useState(false)
  const [filter, setFilter]         = useState<GoogleCampaignType | 'ALL'>('ALL')
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchCampaigns = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true)
    else { setLoading(true); setConfigErr(false) }
    setError(null)
    try {
      const res  = await fetch('/api/google/campaigns')
      const data: CampaignsResponse = await res.json()

      if (data.type === 'config') {
        setConfigErr(true)
        setError(data.error ?? 'Google Ads not configured')
        return
      }
      if (data.error) {
        setError(data.error)
        return
      }
      setCampaigns(data.campaigns ?? [])
    } catch {
      setError('Network error — could not reach Google Ads API')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchCampaigns() }, [fetchCampaigns])

  // ── Toggle status ──────────────────────────────────────────────────────────

  async function toggleStatus(campaign: GoogleCampaign) {
    const newStatus = campaign.status === 'ENABLED' ? 'PAUSED' : 'ENABLED'
    setTogglingId(campaign.id)
    try {
      const res = await fetch(`/api/google/campaigns/${campaign.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        setCampaigns((prev) =>
          prev.map((c) => (c.id === campaign.id ? { ...c, status: newStatus } : c)),
        )
      } else {
        const json = await res.json()
        setError(json.error ?? 'Failed to update campaign status')
      }
    } catch {
      setError('Network error — could not update campaign')
    } finally {
      setTogglingId(null)
    }
  }

  // ── Derived stats ──────────────────────────────────────────────────────────

  const activeCount = campaigns.filter((c) => c.status === 'ENABLED').length
  const pausedCount = campaigns.filter((c) => c.status === 'PAUSED').length
  const totalSpend  = campaigns.reduce((s, c) => s + (c.metrics?.costMicros ?? 0), 0)
  const totalConvs  = campaigns.reduce((s, c) => s + (c.metrics?.conversions ?? 0), 0)

  const filtered =
    filter === 'ALL' ? campaigns : campaigns.filter((c) => c.type === filter)

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-10 sm:px-6 sm:pt-14">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <section>
          <div className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-[0.22em] text-[#4285F4]/85">
            <Search className="h-3.5 w-3.5" />
            Google Ads / Campaigns
          </div>
          <h1 className="mt-4 text-[36px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[48px]">
            Search &amp; Performance Max
            <br />
            <span className="text-white/35">
              {loading
                ? '…'
                : configErr
                  ? 'not connected.'
                  : `${campaigns.length} total.`}
            </span>
          </h1>
        </section>

        <div className="mt-7 flex items-center gap-2 sm:mt-10">
          <button
            onClick={() => fetchCampaigns(true)}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-white/50 transition hover:text-white disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link
            href="/freehold-intelligence/lead-machine/google/campaigns/new"
            className="inline-flex items-center gap-2 rounded-full bg-[#4285F4] px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#5A97F5]"
          >
            <Zap className="h-4 w-4" /> New campaign
          </Link>
        </div>
      </div>

      {/* ── Config error ───────────────────────────────────────────────────── */}
      {configErr && (
        <div className="mt-8 rounded-[20px] border border-red-400/20 bg-red-400/[0.05] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <div>
              <div className="text-[13px] font-semibold text-white">
                Google Ads not connected
              </div>
              <p className="mt-1 text-[13px] text-white/60">{error}</p>
              <Link
                href="/freehold-intelligence/integrations/google"
                className="mt-3 inline-flex items-center gap-1 text-[12px] text-[#4285F4]/80 transition hover:text-[#4285F4]"
              >
                Set up Google Ads integration <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── API error ──────────────────────────────────────────────────────── */}
      {error && !configErr && (
        <div className="mt-8 rounded-[18px] border border-orange-400/20 bg-orange-400/[0.04] p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
            <p className="text-[13px] text-white/65">{error}</p>
          </div>
        </div>
      )}

      {/* ── Loading ────────────────────────────────────────────────────────── */}
      {loading && (
        <div className="mt-20 flex items-center justify-center gap-3 text-white/35">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-[14px]">Loading campaigns…</span>
        </div>
      )}

      {!loading && !configErr && (
        <>
          {/* ── Stats row ──────────────────────────────────────────────────── */}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                label: 'Active',
                value: activeCount,
                color: 'text-[#D4AF37]',
              },
              {
                label: 'Paused',
                value: pausedCount,
                color: 'text-white/50',
              },
              {
                label: 'Total spend',
                value: `AED ${(totalSpend / 1_000_000).toLocaleString('en-AE', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}`,
                color: 'text-white',
              },
              {
                label: 'Total conversions',
                value: Math.round(totalConvs).toLocaleString(),
                color: totalConvs > 0 ? 'text-[#FBBC04]' : 'text-white/50',
              },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-[18px] border border-white/[0.08] bg-[#1A1F2A] p-4"
              >
                <div className={`text-[26px] font-semibold leading-none tabular-nums ${s.color}`}>
                  {s.value}
                </div>
                <div className="mt-1.5 text-[13px] text-white/40">{s.label}</div>
              </div>
            ))}
          </div>

          {/* ── Type filters ───────────────────────────────────────────────── */}
          <div className="mt-6 flex flex-wrap gap-2">
            {FILTER_TYPES.map(({ label, value }) => {
              const isActive = filter === value
              return (
                <button
                  key={value}
                  onClick={() => setFilter(value)}
                  className={[
                    'rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition',
                    isActive
                      ? 'border-[#4285F4]/40 bg-[#4285F4]/15 text-[#4285F4]'
                      : 'border-white/[0.08] bg-white/[0.03] text-white/45 hover:text-white/70',
                  ].join(' ')}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* ── Campaign list ──────────────────────────────────────────────── */}
          {filtered.length > 0 && (
            <section className="mt-6 space-y-3">
              {filtered.map((campaign) => {
                const m          = campaign.metrics
                const isToggling = togglingId === campaign.id
                const isEnabled  = campaign.status === 'ENABLED'

                return (
                  <div
                    key={campaign.id}
                    className="rounded-[20px] border border-white/[0.08] bg-[#1A1F2A] p-5 transition hover:border-[#4285F4]/20"
                  >
                    {/* Row 1: type badge + name + status dot */}
                    <div className="flex flex-wrap items-center gap-2.5">
                      <TypeBadge type={campaign.type} />

                      <Link
                        href={`/freehold-intelligence/lead-machine/google/campaigns/${campaign.id}`}
                        className="min-w-0 flex-1 truncate text-[15px] font-semibold text-white/90 transition hover:text-white"
                      >
                        {campaign.name}
                      </Link>

                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          isEnabled ? 'bg-[#D4AF37]' : 'bg-white/20'
                        }`}
                        title={isEnabled ? 'Active' : 'Paused'}
                      />
                    </div>

                    {/* Row 2: budget + metrics */}
                    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12px] text-white/45">
                      <span>
                        Daily budget:{' '}
                        <span className="text-white/70">
                          AED {Math.round(campaign.dailyBudgetMicros / 1_000_000).toLocaleString()}
                        </span>
                      </span>

                      {m && (
                        <>
                          <span>
                            Impressions:{' '}
                            <span className="text-white/70">
                              {m.impressions.toLocaleString()}
                            </span>
                          </span>
                          <span>
                            Clicks:{' '}
                            <span className="text-white/70">{m.clicks.toLocaleString()}</span>
                          </span>
                          <span>
                            CTR:{' '}
                            <span className="text-white/70">{fmtPct(m.ctr)}</span>
                          </span>
                          <span>
                            Conversions:{' '}
                            <span className="font-medium text-[#FBBC04]">
                              {Math.round(m.conversions).toLocaleString()}
                            </span>
                          </span>
                          <span>
                            Cost:{' '}
                            <span className="text-white/70">{fmtMicros(m.costMicros)}</span>
                          </span>
                        </>
                      )}
                    </div>

                    {/* Row 3: bidding badge + pause/activate button */}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <BiddingBadge strategy={campaign.biddingStrategyType} />

                      <button
                        onClick={() => toggleStatus(campaign)}
                        disabled={isToggling}
                        className={[
                          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-medium transition disabled:opacity-40',
                          isEnabled
                            ? 'border-[#D4AF37]/20 bg-[#D4AF37]/10 text-[#D4AF37] hover:bg-[#D4AF37]/20'
                            : 'border-emerald-400/20 bg-[#D4AF37]/10 text-[#D4AF37] hover:bg-[#D4AF37]/20',
                        ].join(' ')}
                      >
                        {isToggling ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : isEnabled ? (
                          <Pause className="h-3 w-3" />
                        ) : (
                          <Play className="h-3 w-3" />
                        )}
                        {isEnabled ? 'Pause' : 'Activate'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </section>
          )}

          {/* ── Empty state (no campaigns at all) ─────────────────────────── */}
          {!error && campaigns.length === 0 && (
            <div className="mt-16 rounded-[28px] border border-white/[0.08] bg-white/[0.02] px-7 py-14 text-center">
              <Search className="mx-auto mb-4 h-8 w-8 text-[#4285F4]/40" />
              <div className="text-[18px] font-semibold text-white">
                No Google Ads campaigns yet
              </div>
              <p className="mt-2 text-[14px] text-white/40">
                Create your first Search or Performance Max campaign to start
                capturing leads from Google.
              </p>
              <Link
                href="/freehold-intelligence/lead-machine/google/campaigns/new"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#4285F4] px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#5A97F5]"
              >
                <Zap className="h-4 w-4" /> Create first campaign
              </Link>
            </div>
          )}

          {/* ── Filtered empty state ────────────────────────────────────────── */}
          {!error && campaigns.length > 0 && filtered.length === 0 && (
            <div className="mt-10 rounded-[20px] border border-white/[0.08] bg-white/[0.02] px-6 py-10 text-center">
              <p className="text-[14px] text-white/40">
                No{' '}
                <span className="text-white/60">
                  {filter.replace(/_/g, ' ').toLowerCase()}
                </span>{' '}
                campaigns found.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
