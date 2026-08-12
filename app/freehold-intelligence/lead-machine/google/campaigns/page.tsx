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
import { useT } from '@/lib/i18n/provider'
import { DemoNotice } from '@/components/freehold/demo-badge'
import GoogleDeliveryChip from '@/components/freehold/google-delivery-chip'

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
  DISPLAY:         'bg-gold/10 text-gold border-gold/20',
  PERFORMANCE_MAX: 'bg-[#FBBC04]/10 text-[#FBBC04] border-[#FBBC04]/20',
  VIDEO:           'bg-rose-400/10 text-slate-400 border-rose-400/20',
}

// label holds an i18n key — render with t(label)
const FILTER_TYPES: { label: string; value: GoogleCampaignType | 'ALL' }[] = [
  { label: 'lm.google.keywords.filter.all',    value: 'ALL' },
  { label: 'lm.google.campaignNew.type.search', value: 'SEARCH' },
  { label: 'lm.google.campaignNew.type.pmax',   value: 'PERFORMANCE_MAX' },
  { label: 'lm.google.campaignNew.type.display', value: 'DISPLAY' },
  { label: 'lm.google.campaignNew.type.video',   value: 'VIDEO' },
]

// ─── API shapes ───────────────────────────────────────────────────────────────

interface CampaignsResponse {
  campaigns?: GoogleCampaign[]
  error?: string
  type?: string
  demo?: boolean
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const cls = CAMPAIGN_TYPE_COLOR[type] ?? 'bg-surface-2 text-slate-400 border-line'
  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}
    >
      {type.replace(/_/g, ' ')}
    </span>
  )
}

function BiddingBadge({ strategy }: { strategy: string }) {
  return (
    <span className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-xs text-slate-400">
      {strategy.replace(/_/g, ' ')}
    </span>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function GoogleCampaignsPage() {
  const t = useT()
  const [campaigns, setCampaigns]   = useState<GoogleCampaign[]>([])
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [configErr, setConfigErr]   = useState(false)
  const [demoMode, setDemoMode]     = useState(false)
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
        setError(data.error ?? t('lm.google.common.notConnected'))
        return
      }
      if (data.error) {
        setError(data.error)
        return
      }
      setDemoMode(data.demo === true)
      setCampaigns(data.campaigns ?? [])
    } catch {
      setError(t('lm.google.err.network'))
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
        setError(json.error ?? t('lm.google.camp.updateFailed'))
      }
    } catch {
      setError(t('lm.google.camp.updateNetwork'))
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
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <section>
          <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-[#4285F4]/85">
            <Search className="h-3.5 w-3.5" />
            {t('lm.google.camp.eyebrow')}
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-100">
            {t('lm.google.camp.heading')}
            <br />
            <span className="text-slate-500">
              {loading
                ? '…'
                : configErr
                  ? t('lm.google.sub.notConnected')
                  : demoMode
                    ? t('lm.google.camp.demoSub')
                    : t('lm.google.camp.totalSub', { n: campaigns.length })}
            </span>
          </h1>
        </section>

        <div className="mt-7 flex items-center gap-2 sm:mt-10">
          <button
            onClick={() => fetchCampaigns(true)}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-line bg-surface-2 px-3 py-2 text-xs text-slate-400 transition hover:text-white disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {t('lm.google.common.refresh')}
          </button>
          <Link
            href="/freehold-intelligence/lead-machine/google/campaigns/new"
            className="inline-flex items-center gap-2 rounded-full bg-[#4285F4] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#5A97F5]"
          >
            <Zap className="h-4 w-4" /> {t('lm.google.common.newCampaign')}
          </Link>
        </div>
      </div>

      {/* ── Config error ───────────────────────────────────────────────────── */}
      {configErr && (
        <div className="mt-8 rounded-[20px] border border-line bg-surface-2 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-gold/70" />
            <div>
              <div className="text-sm font-semibold text-white">
                {t('lm.google.common.notConnected')}
              </div>
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

      {/* ── API error ──────────────────────────────────────────────────────── */}
      {error && !configErr && (
        <div className="mt-8 rounded-xl border border-line bg-surface-2 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <p className="text-sm text-slate-300">{error}</p>
          </div>
        </div>
      )}

      {/* ── Loading ────────────────────────────────────────────────────────── */}
      {loading && (
        <div className="mt-20 flex items-center justify-center gap-3 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-[14px]">{t('lm.google.campaigns.title')}…</span>
        </div>
      )}

      {!loading && !configErr && (
        <>
          {/* ── Stats row ──────────────────────────────────────────────────── */}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                label: t('lm.google.common.active'),
                value: activeCount,
                color: 'text-gold',
              },
              {
                label: t('lm.google.common.paused'),
                value: pausedCount,
                color: 'text-slate-400',
              },
              {
                label: t('lm.google.campaigns.col.spend'),
                value: `AED ${(totalSpend / 1_000_000).toLocaleString('en-AE', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}`,
                color: 'text-white',
              },
              {
                label: t('lm.google.common.conversions'),
                value: Math.round(totalConvs).toLocaleString(),
                color: totalConvs > 0 ? 'text-[#FBBC04]' : 'text-slate-400',
              },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-line bg-surface p-4"
              >
                <div className={`text-[26px] font-semibold leading-none tabular-nums ${s.color}`}>
                  {s.value}
                </div>
                <div className="mt-1.5 text-sm text-slate-400">{s.label}</div>
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
                    'rounded-full border px-3.5 py-1.5 text-xs font-medium transition',
                    isActive
                      ? 'border-[#4285F4]/40 bg-[#4285F4]/15 text-[#4285F4]'
                      : 'border-line-strong bg-surface-2 text-slate-400 hover:text-slate-200 hover:border-slate-500',
                  ].join(' ')}
                >
                  {t(label)}
                </button>
              )
            })}
          </div>

          {/* Demo data must never read as real spend/conversions. */}
          {demoMode && filtered.length > 0 && (
            <DemoNotice badge={t('lm.demo.badge')} note={t('lm.demo.note')} />
          )}

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
                    className="rounded-[20px] border border-line bg-surface p-5 transition hover:border-[#4285F4]/20"
                  >
                    {/* Row 1: type badge + name + status dot */}
                    <div className="flex flex-wrap items-center gap-2.5">
                      <TypeBadge type={campaign.type} />

                      <Link
                        href={`/freehold-intelligence/lead-machine/google/campaigns/${campaign.id}`}
                        className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-100 transition hover:text-white"
                      >
                        {campaign.name}
                      </Link>

                      {/* Google's own serving state, not the switch we set.
                          A dot drawn from campaign.status showed a campaign
                          with no keywords exactly like one that was working. */}
                      <GoogleDeliveryChip campaign={campaign} />
                    </div>

                    {/* Row 2: budget + metrics */}
                    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-400">
                      <span>
                        {t('lm.google.campaignNew.review.dailyBudget')}:{' '}
                        <span className="text-slate-300">
                          AED {Math.round(campaign.dailyBudgetMicros / 1_000_000).toLocaleString()}
                        </span>
                      </span>

                      {m && (
                        <>
                          <span>
                            {t('lm.google.common.impressions')}:{' '}
                            <span className="text-slate-300">
                              {m.impressions.toLocaleString()}
                            </span>
                          </span>
                          <span>
                            {t('lm.google.common.clicks')}:{' '}
                            <span className="text-slate-300">{m.clicks.toLocaleString()}</span>
                          </span>
                          <span>
                            {t('lm.google.overview.stat.ctr')}:{' '}
                            <span className="text-slate-300">{fmtPct(m.ctr)}</span>
                          </span>
                          <span>
                            {t('lm.google.common.conversions')}:{' '}
                            <span className="font-medium text-[#FBBC04]">
                              {Math.round(m.conversions).toLocaleString()}
                            </span>
                          </span>
                          <span>
                            {t('lm.google.common.spend')}:{' '}
                            <span className="text-slate-300">{fmtMicros(m.costMicros)}</span>
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
                          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition disabled:opacity-40',
                          isEnabled
                            ? 'border-gold/20 bg-gold/10 text-gold hover:bg-gold/20'
                            : 'border-gold/20 bg-gold/10 text-gold hover:bg-gold/20',
                        ].join(' ')}
                      >
                        {isToggling ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : isEnabled ? (
                          <Pause className="h-3 w-3" />
                        ) : (
                          <Play className="h-3 w-3" />
                        )}
                        {isEnabled ? t('lm.google.campaigns.pauseBtn') : t('lm.google.campaigns.resumeBtn')}
                      </button>
                    </div>
                  </div>
                )
              })}
            </section>
          )}

          {/* ── Empty state (no campaigns at all) ─────────────────────────── */}
          {!error && campaigns.length === 0 && (
            <div className="mt-16 rounded-[28px] border border-line bg-surface-2 px-7 py-14 text-center">
              <Search className="mx-auto mb-4 h-8 w-8 text-[#4285F4]/40" />
              <div className="text-[18px] font-semibold text-white">
                {t('lm.google.campaigns.empty')}
              </div>
              <p className="mt-2 text-[14px] text-slate-400">
                {t('lm.google.campaigns.emptyNote')}
              </p>
              <Link
                href="/freehold-intelligence/lead-machine/google/campaigns/new"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#4285F4] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#5A97F5]"
              >
                <Zap className="h-4 w-4" /> {t('lm.google.common.newCampaign')}
              </Link>
            </div>
          )}

          {/* ── Filtered empty state ────────────────────────────────────────── */}
          {!error && campaigns.length > 0 && filtered.length === 0 && (
            <div className="mt-10 rounded-[20px] border border-line bg-surface-2 px-6 py-10 text-center">
              <p className="text-[14px] text-slate-400">
                {t('lm.google.camp.noneFiltered', { type: filter.replace(/_/g, ' ').toLowerCase() })}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
