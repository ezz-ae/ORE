'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Play,
  Pause,
  RefreshCw,
  AlertCircle,
  Loader2,
  Search,
  ArrowUpRight,
} from 'lucide-react'
import type {
  GoogleCampaign,
  GoogleAdGroup,
  GoogleKeyword,
  GoogleResponsiveSearchAd,
  GoogleAdStrength,
  GoogleKeywordMatchType,
} from '@/lib/google/types'

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
  DISPLAY:         'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/20',
  PERFORMANCE_MAX: 'bg-[#FBBC04]/10 text-[#FBBC04] border-[#FBBC04]/20',
  VIDEO:           'bg-rose-400/10 text-white/55 border-rose-400/20',
}

const AD_STRENGTH_COLOR: Record<GoogleAdStrength, string> = {
  PENDING:   'text-white/40 bg-white/[0.04] border-white/[0.08]',
  POOR:      'text-red-400 bg-red-400/10 border-red-400/20',
  AVERAGE:   'text-[#FBBC04] bg-[#FBBC04]/10 border-[#FBBC04]/20',
  GOOD:      'text-[#D4AF37] bg-[#D4AF37]/10 border-[#D4AF37]/20',
  EXCELLENT: 'text-[#4285F4] bg-[#4285F4]/10 border-[#4285F4]/20',
}

const MATCH_BADGE: Record<GoogleKeywordMatchType, string> = {
  BROAD:  'bg-white/[0.04] text-white/40 border-white/[0.08]',
  PHRASE: 'bg-sky-400/10 text-white/55 border-sky-400/20',
  EXACT:  'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/20',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[13px] font-medium uppercase tracking-[0.22em] text-white/40">
      {children}
    </div>
  )
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string
  value: string | number
  accent?: string
}) {
  return (
    <div className="rounded-[16px] border border-white/[0.08] bg-[#131B2B] p-4">
      <div className="text-[12px] text-white/35">{label}</div>
      <div className={`mt-2 text-[20px] font-semibold leading-tight tabular-nums ${accent ?? 'text-white'}`}>
        {value}
      </div>
    </div>
  )
}

function QualityScoreDots({ score }: { score: number }) {
  const color =
    score <= 3 ? 'bg-red-400' : score <= 6 ? 'bg-yellow-400' : 'bg-[#D4AF37]'
  const textColor =
    score <= 3 ? 'text-red-400' : score <= 6 ? 'text-yellow-400' : 'text-[#D4AF37]'

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              i < score ? color : 'bg-white/[0.08]'
            }`}
          />
        ))}
      </div>
      <span className={`text-[13px] font-medium tabular-nums ${textColor}`}>{score}</span>
    </div>
  )
}

// ─── API shapes ───────────────────────────────────────────────────────────────

interface CampaignResponse {
  campaign?: GoogleCampaign
  error?: string
  type?: string
}

interface AdGroupsResponse {
  adGroups?: GoogleAdGroup[]
  error?: string
}

interface KeywordsResponse {
  keywords?: GoogleKeyword[]
  error?: string
}

interface AdsResponse {
  ads?: GoogleResponsiveSearchAd[]
  error?: string
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function GoogleCampaignDetailPage({
  params,
}: {
  params: Promise<{ campaignId: string }>
}) {
  const [campaignId, setCampaignId] = useState<string | null>(null)

  const [campaign, setCampaign]   = useState<GoogleCampaign | null>(null)
  const [adGroups, setAdGroups]   = useState<GoogleAdGroup[]>([])
  const [keywords, setKeywords]   = useState<GoogleKeyword[]>([])
  const [ads, setAds]             = useState<GoogleResponsiveSearchAd[]>([])

  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [configErr, setConfigErr] = useState(false)
  const [togglingStatus, setTogglingStatus] = useState(false)

  // ── Resolve params promise ─────────────────────────────────────────────────

  useEffect(() => {
    params.then(({ campaignId: id }) => setCampaignId(id))
  }, [params])

  // ── Fetch all data in parallel ─────────────────────────────────────────────

  const fetchAll = useCallback(
    async (id: string, quiet = false) => {
      if (quiet) setRefreshing(true)
      else { setLoading(true); setConfigErr(false) }
      setError(null)

      try {
        const [cRes, agRes, kwRes, adRes] = await Promise.all([
          fetch(`/api/google/campaigns/${id}`),
          fetch(`/api/google/ad-groups?campaignId=${id}`),
          fetch(`/api/google/keywords?campaignId=${id}`),
          fetch(`/api/google/ads?campaignId=${id}`),
        ])

        const [cData, agData, kwData, adData]: [
          CampaignResponse,
          AdGroupsResponse,
          KeywordsResponse,
          AdsResponse,
        ] = await Promise.all([
          cRes.json(),
          agRes.json(),
          kwRes.json(),
          adRes.json(),
        ])

        // Config error takes priority
        if (cData.type === 'config') {
          setConfigErr(true)
          setError(cData.error ?? 'Google Ads not configured')
          return
        }
        if (cData.error) {
          setError(cData.error)
          return
        }

        setCampaign(cData.campaign ?? null)
        setAdGroups(agData.adGroups ?? [])
        setKeywords(kwData.keywords ?? [])
        setAds(
          (adData.ads ?? []).filter(
            (ad): ad is GoogleResponsiveSearchAd =>
              ad.type === 'RESPONSIVE_SEARCH_AD',
          ),
        )
      } catch {
        setError('Network error — could not reach Google Ads API')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (campaignId) fetchAll(campaignId)
  }, [campaignId, fetchAll])

  // ── Toggle campaign status ─────────────────────────────────────────────────

  async function toggleStatus() {
    if (!campaignId || !campaign) return
    const newStatus = campaign.status === 'ENABLED' ? 'PAUSED' : 'ENABLED'
    setTogglingStatus(true)
    try {
      const res = await fetch(`/api/google/campaigns/${campaignId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        setCampaign((prev) => (prev ? { ...prev, status: newStatus } : prev))
      } else {
        const json = await res.json()
        setError(json.error ?? 'Failed to update campaign status')
      }
    } catch {
      setError('Network error — could not update campaign')
    } finally {
      setTogglingStatus(false)
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const m          = campaign?.metrics
  const isEnabled  = campaign?.status === 'ENABLED'

  // Sort keywords by impressions desc for "Top Keywords"
  const topKeywords = [...keywords]
    .sort((a, b) => (b.metrics?.impressions ?? 0) - (a.metrics?.impressions ?? 0))
    .slice(0, 20)

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-10 sm:px-6 sm:pt-14">

      {/* ── Back link ──────────────────────────────────────────────────────── */}
      <Link
        href="/freehold-intelligence/lead-machine/google/campaigns"
        className="inline-flex items-center gap-1.5 text-[12px] text-white/40 transition hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All campaigns
      </Link>

      {/* ── Loading ────────────────────────────────────────────────────────── */}
      {loading && (
        <div className="mt-20 flex items-center justify-center gap-3 text-white/35">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-[14px]">Loading campaign…</span>
        </div>
      )}

      {/* ── Config error ───────────────────────────────────────────────────── */}
      {!loading && configErr && (
        <div className="mt-10 rounded-[20px] border border-red-400/20 bg-red-400/[0.05] p-5 sm:p-6">
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
      {!loading && error && !configErr && (
        <div className="mt-10 rounded-[18px] border border-orange-400/20 bg-orange-400/[0.04] p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
            <div>
              <p className="text-[13px] text-white/65">{error}</p>
              {campaignId && (
                <button
                  onClick={() => fetchAll(campaignId)}
                  className="mt-2 text-[12px] text-[#4285F4]/70 transition hover:text-[#4285F4]"
                >
                  Try again
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Main content ───────────────────────────────────────────────────── */}
      {!loading && !error && campaign && (
        <>
          {/* ── Campaign header ────────────────────────────────────────────── */}
          <section className="mt-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                {/* Badges */}
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${
                      CAMPAIGN_TYPE_COLOR[campaign.type] ??
                      'bg-white/[0.04] text-white/40 border-white/[0.08]'
                    }`}
                  >
                    {campaign.type.replace(/_/g, ' ')}
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${
                      isEnabled
                        ? 'border-[#D4AF37]/25 bg-[#D4AF37]/10 text-[#D4AF37]'
                        : 'border-white/[0.08] bg-white/[0.04] text-white/40'
                    }`}
                  >
                    {campaign.status}
                  </span>
                </div>

                {/* Name */}
                <h1 className="mt-3 text-[28px] font-semibold leading-tight tracking-tight text-white sm:text-[36px]">
                  {campaign.name}
                </h1>

                {/* Meta row */}
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-white/40">
                  <span>
                    Daily budget:{' '}
                    <span className="text-white/65">
                      AED{' '}
                      {Math.round(
                        campaign.dailyBudgetMicros / 1_000_000,
                      ).toLocaleString()}
                    </span>
                  </span>
                  <span>
                    Bidding:{' '}
                    <span className="text-white/65">
                      {campaign.biddingStrategyType.replace(/_/g, ' ')}
                    </span>
                  </span>
                  {campaign.startDate && (
                    <span>
                      Started:{' '}
                      <span className="text-white/65">{campaign.startDate}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Controls */}
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <button
                  onClick={() => campaignId && fetchAll(campaignId, true)}
                  disabled={refreshing || togglingStatus}
                  className="inline-flex items-center gap-1.5 rounded-[10px] border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-white/50 transition hover:text-white disabled:opacity-40"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
                  />
                  Refresh
                </button>

                <button
                  onClick={toggleStatus}
                  disabled={togglingStatus || refreshing}
                  className={[
                    'inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[12px] font-semibold transition disabled:opacity-40',
                    isEnabled
                      ? 'border-[#D4AF37]/20 bg-[#D4AF37]/10 text-[#D4AF37] hover:bg-[#D4AF37]/20'
                      : 'border-[#D4AF37]/20 bg-[#D4AF37]/10 text-[#D4AF37] hover:bg-[#D4AF37]/20',
                  ].join(' ')}
                >
                  {togglingStatus ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : isEnabled ? (
                    <Pause className="h-3.5 w-3.5" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                  {isEnabled ? 'Pause campaign' : 'Activate campaign'}
                </button>
              </div>
            </div>
          </section>

          {/* ── KPI stats ──────────────────────────────────────────────────── */}
          <section className="mt-10">
            <SectionLabel>Performance · 30 days</SectionLabel>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <StatCard
                label="Impressions"
                value={m ? m.impressions.toLocaleString() : '—'}
              />
              <StatCard
                label="Clicks"
                value={m ? m.clicks.toLocaleString() : '—'}
              />
              <StatCard
                label="CTR"
                value={m ? fmtPct(m.ctr) : '—'}
                accent="text-[#4285F4]"
              />
              <StatCard
                label="Conversions"
                value={m ? Math.round(m.conversions).toLocaleString() : '—'}
                accent={m && m.conversions > 0 ? 'text-[#FBBC04]' : undefined}
              />
              <StatCard
                label="30d cost"
                value={m ? fmtMicros(m.costMicros) : '—'}
                accent="text-white"
              />
            </div>

            {/* Secondary row */}
            {m && (
              <div className="mt-3 flex flex-wrap gap-4 text-[12px] text-white/40">
                <span>
                  Avg CPC:{' '}
                  <span className="text-white/65">
                    {fmtMicros(m.averageCpcMicros)}
                  </span>
                </span>
                {m.averageCpa != null && m.averageCpa > 0 && (
                  <span>
                    Avg CPA:{' '}
                    <span className="text-white/65">
                      AED {m.averageCpa.toFixed(2)}
                    </span>
                  </span>
                )}
                {campaign.targetCpaMicros && (
                  <span>
                    Target CPA:{' '}
                    <span className="text-white/65">
                      {fmtMicros(campaign.targetCpaMicros)}
                    </span>
                  </span>
                )}
                {campaign.targetRoas != null && (
                  <span>
                    Target ROAS:{' '}
                    <span className="text-white/65">{campaign.targetRoas}x</span>
                  </span>
                )}
              </div>
            )}
          </section>

          {/* ── Ad Groups ──────────────────────────────────────────────────── */}
          {adGroups.length > 0 && (
            <section className="mt-14">
              <SectionLabel>Ad groups</SectionLabel>
              <h2 className="mt-2 text-[18px] font-semibold text-white">
                {adGroups.length} ad group
                {adGroups.length !== 1 ? 's' : ''}
              </h2>

              <div className="mt-5 overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#131B2B]">
                {/* Table header */}
                <div className="grid grid-cols-[1fr_80px_80px_80px_72px_72px] gap-x-3 border-b border-white/[0.05] px-5 py-2.5 text-[12px] font-medium uppercase tracking-[0.18em] text-white/25">
                  <span>Name</span>
                  <span>Status</span>
                  <span className="text-right">Bid</span>
                  <span className="text-right">Impr.</span>
                  <span className="text-right">Clicks</span>
                  <span className="text-right">Conv.</span>
                </div>

                <div className="divide-y divide-white/[0.035]">
                  {adGroups.map((ag) => (
                    <div
                      key={ag.id}
                      className="grid grid-cols-[1fr_80px_80px_80px_72px_72px] items-center gap-x-3 px-5 py-3.5 text-[12px] transition hover:bg-white/[0.015]"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                            ag.status === 'ENABLED'
                              ? 'bg-[#D4AF37]'
                              : 'bg-white/20'
                          }`}
                        />
                        <span className="truncate font-medium text-white/85">
                          {ag.name}
                        </span>
                      </div>

                      <span
                        className={`text-[12px] font-medium ${
                          ag.status === 'ENABLED'
                            ? 'text-[#D4AF37]'
                            : 'text-white/35'
                        }`}
                      >
                        {ag.status}
                      </span>

                      <span className="text-right text-white/55">
                        {ag.cpcBidMicros != null
                          ? fmtMicros(ag.cpcBidMicros)
                          : '—'}
                      </span>

                      <span className="text-right text-white/60">
                        {ag.metrics?.impressions.toLocaleString() ?? '—'}
                      </span>
                      <span className="text-right text-white/60">
                        {ag.metrics?.clicks.toLocaleString() ?? '—'}
                      </span>
                      <span className="text-right font-medium text-white/70">
                        {ag.metrics?.conversions != null
                          ? Math.round(ag.metrics.conversions)
                          : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* ── Top Keywords ───────────────────────────────────────────────── */}
          {topKeywords.length > 0 && (
            <section className="mt-14">
              <SectionLabel>Top keywords</SectionLabel>
              <h2 className="mt-2 text-[18px] font-semibold text-white">
                {keywords.length} keyword{keywords.length !== 1 ? 's' : ''}
                {keywords.length > 20 && (
                  <span className="ml-2 text-[13px] font-normal text-white/40">
                    · showing top 20 by impressions
                  </span>
                )}
              </h2>

              <div className="mt-5 overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#131B2B]">
                {/* Table header */}
                <div className="grid grid-cols-[1fr_90px_130px_72px_72px_80px_60px] gap-x-3 border-b border-white/[0.05] px-5 py-2.5 text-[12px] font-medium uppercase tracking-[0.18em] text-white/25">
                  <span>Keyword</span>
                  <span>Match</span>
                  <span>Quality score</span>
                  <span className="text-right">Impr.</span>
                  <span className="text-right">CTR</span>
                  <span className="text-right">Avg CPC</span>
                  <span className="text-right">Conv.</span>
                </div>

                <div className="divide-y divide-white/[0.035]">
                  {topKeywords.map((kw) => (
                    <div
                      key={kw.id}
                      className="grid grid-cols-[1fr_90px_130px_72px_72px_80px_60px] items-center gap-x-3 px-5 py-3 text-[12px] transition hover:bg-white/[0.015]"
                    >
                      {/* Keyword text */}
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                            kw.status === 'ENABLED'
                              ? 'bg-[#D4AF37]'
                              : 'bg-white/20'
                          }`}
                        />
                        <span className="truncate font-medium text-white/85">
                          {kw.text}
                        </span>
                      </div>

                      {/* Match type badge */}
                      <span
                        className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[12px] font-medium ${
                          MATCH_BADGE[kw.matchType]
                        }`}
                      >
                        {kw.matchType === 'BROAD'
                          ? 'Broad'
                          : kw.matchType === 'PHRASE'
                            ? 'Phrase'
                            : 'Exact'}
                      </span>

                      {/* Quality score dots */}
                      <div>
                        {kw.qualityScore != null ? (
                          <QualityScoreDots score={kw.qualityScore} />
                        ) : (
                          <span className="text-[13px] text-white/20">—</span>
                        )}
                      </div>

                      {/* Metrics */}
                      <span className="text-right text-white/60">
                        {kw.metrics?.impressions.toLocaleString() ?? '—'}
                      </span>
                      <span className="text-right text-white/50">
                        {kw.metrics?.ctr != null ? fmtPct(kw.metrics.ctr) : '—'}
                      </span>
                      <span className="text-right text-white/60">
                        {kw.metrics?.averageCpcMicros != null
                          ? fmtMicros(kw.metrics.averageCpcMicros)
                          : '—'}
                      </span>
                      <span className="text-right font-medium text-white/70">
                        {kw.metrics?.conversions != null
                          ? Math.round(kw.metrics.conversions)
                          : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* ── RSA Ads ────────────────────────────────────────────────────── */}
          {ads.length > 0 && (
            <section className="mt-14">
              <SectionLabel>Responsive search ads</SectionLabel>
              <h2 className="mt-2 text-[18px] font-semibold text-white">
                {ads.length} ad{ads.length !== 1 ? 's' : ''}
              </h2>

              <div className="mt-5 space-y-4">
                {ads.map((ad) => {
                  const strengthCls =
                    AD_STRENGTH_COLOR[ad.adStrength] ??
                    'text-white/40 bg-white/[0.04] border-white/[0.08]'
                  const firstThreeHeadlines = ad.headlines.slice(0, 3)
                  const firstTwoDescs       = ad.descriptions.slice(0, 2)
                  const finalUrl            = ad.finalUrls[0] ?? ''

                  return (
                    <div
                      key={ad.id}
                      className="rounded-[20px] border border-white/[0.08] bg-[#131B2B] p-5"
                    >
                      {/* Top bar: ad strength + status dot */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[12px] font-semibold ${strengthCls}`}
                        >
                          {ad.adStrength}
                        </span>
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            ad.status === 'ENABLED'
                              ? 'bg-[#D4AF37]'
                              : 'bg-white/20'
                          }`}
                          title={ad.status}
                        />
                      </div>

                      {/* Headlines */}
                      <div className="mt-4">
                        <div className="mb-2 text-[12px] font-medium uppercase tracking-[0.16em] text-white/25">
                          Headlines
                        </div>
                        <div className="space-y-1.5">
                          {firstThreeHeadlines.map((h, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-2 rounded-[10px] border border-white/[0.05] bg-white/[0.02] px-3 py-2"
                            >
                              <span className="mt-0.5 shrink-0 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-medium text-white/35">
                                H{i + 1}
                              </span>
                              <span className="text-[13px] font-medium text-white/80">
                                {h.text}
                              </span>
                              {h.pinnedField && (
                                <span className="ml-auto shrink-0 rounded-full border border-[#4285F4]/20 bg-[#4285F4]/10 px-2 py-0.5 text-[9px] text-[#4285F4]">
                                  pinned
                                </span>
                              )}
                            </div>
                          ))}
                          {ad.headlines.length > 3 && (
                            <p className="pl-1 text-[13px] text-white/25">
                              +{ad.headlines.length - 3} more headlines
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Descriptions */}
                      <div className="mt-4">
                        <div className="mb-2 text-[12px] font-medium uppercase tracking-[0.16em] text-white/25">
                          Descriptions
                        </div>
                        <div className="space-y-1.5">
                          {firstTwoDescs.map((d, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-2 rounded-[10px] border border-white/[0.05] bg-white/[0.02] px-3 py-2"
                            >
                              <span className="mt-0.5 shrink-0 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-medium text-white/35">
                                D{i + 1}
                              </span>
                              <span className="text-[13px] leading-snug text-white/70">
                                {d.text}
                              </span>
                            </div>
                          ))}
                          {ad.descriptions.length > 2 && (
                            <p className="pl-1 text-[13px] text-white/25">
                              +{ad.descriptions.length - 2} more descriptions
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Final URL */}
                      {finalUrl && (
                        <div className="mt-4 flex items-center gap-2">
                          <span className="text-[12px] font-medium uppercase tracking-[0.16em] text-white/25">
                            URL
                          </span>
                          <a
                            href={finalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="max-w-xs truncate text-[12px] text-[#4285F4]/70 transition hover:text-[#4285F4]"
                          >
                            {finalUrl}
                          </a>
                        </div>
                      )}

                      {/* Ad metrics */}
                      {ad.metrics && (
                        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-white/[0.05] pt-4 text-[13px] text-white/40">
                          <span>
                            Impr.{' '}
                            <span className="text-white/65">
                              {ad.metrics.impressions.toLocaleString()}
                            </span>
                          </span>
                          <span>
                            Clicks{' '}
                            <span className="text-white/65">
                              {ad.metrics.clicks.toLocaleString()}
                            </span>
                          </span>
                          <span>
                            CTR{' '}
                            <span className="text-white/65">
                              {fmtPct(ad.metrics.ctr)}
                            </span>
                          </span>
                          <span>
                            Conv.{' '}
                            <span className="font-medium text-[#FBBC04]">
                              {Math.round(ad.metrics.conversions).toLocaleString()}
                            </span>
                          </span>
                          <span>
                            Cost{' '}
                            <span className="text-white/65">
                              {fmtMicros(ad.metrics.costMicros)}
                            </span>
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* ── No ad data states ──────────────────────────────────────────── */}
          {adGroups.length === 0 && keywords.length === 0 && ads.length === 0 && (
            <div className="mt-14 rounded-[24px] border border-white/[0.08] bg-white/[0.02] px-6 py-12 text-center">
              <Search className="mx-auto mb-3 h-7 w-7 text-[#4285F4]/30" />
              <div className="text-[15px] font-semibold text-white">
                No sub-data available
              </div>
              <p className="mt-1.5 text-[13px] text-white/40">
                Ad groups, keywords, and ads will appear here once the campaign
                is set up and delivering.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
