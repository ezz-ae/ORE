'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Search, BarChart2, Zap, AlertCircle, ArrowUpRight, TrendingUp, RefreshCw, Monitor } from 'lucide-react'
import type { GoogleCampaign, GoogleReportSummary } from '@/lib/google/types'
import { MarketingExpertPanel } from '@/components/google/ads-expert-panel'

interface OverviewData {
  campaigns?: GoogleCampaign[]
  error?: string
  type?: string
}
interface ReportData {
  report?: GoogleReportSummary
  error?: string
}

function fmtMicros(m: number) {
  const aed = m / 1_000_000
  if (aed >= 1000) return `AED ${(aed / 1000).toFixed(1)}K`
  return `AED ${aed.toFixed(0)}`
}

function fmtPct(n: number) {
  return `${(n * 100).toFixed(2)}%`
}

const CAMPAIGN_TYPE_COLOR: Record<string, string> = {
  SEARCH:          'bg-[#4285F4]/10 text-[#4285F4] border-[#4285F4]/20',
  DISPLAY:         'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/20',
  PERFORMANCE_MAX: 'bg-[#FBBC04]/10 text-[#FBBC04] border-[#FBBC04]/20',
  VIDEO:           'bg-rose-400/10 text-white/55 border-rose-400/20',
  SHOPPING:        'bg-violet-400/10 text-white/55 border-violet-400/20',
}

export default function GoogleOverviewPage() {
  const [campaigns, setCampaigns] = useState<GoogleCampaign[]>([])
  const [report, setReport]       = useState<GoogleReportSummary | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [configErr, setConfigErr] = useState(false)
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function fetchAll(quiet = false) {
    if (quiet) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const [cRes, rRes] = await Promise.all([
        fetch('/api/google/campaigns'),
        fetch('/api/google/reports?range=30d'),
      ])
      const cData: OverviewData  = await cRes.json()
      const rData: ReportData    = await rRes.json()

      if (cData.type === 'config') { setConfigErr(true); setError(cData.error ?? null); return }
      setCampaigns(cData.campaigns ?? [])
      setReport(rData.report ?? null)
    } catch {
      setError('Network error — could not reach Google Ads API')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  const active  = campaigns.filter((c) => c.status === 'ENABLED').length
  const paused  = campaigns.filter((c) => c.status === 'PAUSED').length
  const spend   = campaigns.reduce((s, c) => s + (c.metrics?.costMicros ?? 0), 0)
  const convs   = campaigns.reduce((s, c) => s + (c.metrics?.conversions ?? 0), 0)
  const clicks  = campaigns.reduce((s, c) => s + (c.metrics?.clicks ?? 0), 0)
  const imps    = campaigns.reduce((s, c) => s + (c.metrics?.impressions ?? 0), 0)

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <section>
          <div className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-wider text-[#4285F4]/85">
            <Search className="h-3.5 w-3.5" /> Google Ads
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white/90">
            Google Ads<br />
            <span className="text-white/35">
              {loading ? '…' : configErr ? 'not connected.' : `${campaigns.length} campaigns.`}
            </span>
          </h1>
        </section>

        <div className="mt-7 flex gap-2 sm:mt-10">
          <button
            onClick={() => fetchAll(true)}
            disabled={refreshing}
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

      {/* Config error */}
      {configErr && (
        <div className="mt-8 rounded-[20px] border border-red-400/20 bg-red-400/[0.05] p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <div>
              <div className="text-[13px] font-semibold text-white">Google Ads not connected</div>
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

      {/* General error */}
      {error && !configErr && (
        <div className="mt-8 rounded-[18px] border border-orange-400/20 bg-orange-400/[0.04] p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
            <p className="text-[13px] text-white/65">{error}</p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="mt-12 text-center text-[14px] text-white/35">Loading Google Ads data…</div>
      )}

      {!loading && !configErr && (
        <>
          {/* KPI row */}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Active',       value: active,          color: 'text-[#D4AF37]' },
              { label: 'Paused',       value: paused,          color: 'text-white/50'    },
              { label: '30d Spend',    value: fmtMicros(spend), color: 'text-white'       },
              { label: '30d Conversions', value: Math.round(convs), color: 'text-[#FBBC04]' },
            ].map((s) => (
              <div key={s.label} className="rounded-[18px] border border-white/[0.08] bg-[#131B2B] p-4">
                <div className={`text-[24px] font-semibold leading-none ${s.color}`}>{s.value}</div>
                <div className="mt-1.5 text-[12px] text-white/35">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Secondary metrics */}
          <div className="mt-3 grid grid-cols-3 gap-3">
            {[
              { label: 'Impressions',  value: imps.toLocaleString()     },
              { label: 'Clicks',       value: clicks.toLocaleString()   },
              { label: 'Avg CTR',      value: imps > 0 ? fmtPct(clicks / imps) : '—' },
            ].map((s) => (
              <div key={s.label} className="rounded-[14px] border border-white/[0.05] bg-[#131B2B] px-4 py-3">
                <div className="text-[18px] font-semibold text-white">{s.value}</div>
                <div className="text-[12px] text-white/30">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Channel breakdown */}
          {report && report.byCampaign.length > 0 && (
            <section className="mt-10">
              <div className="text-[13px] font-medium uppercase tracking-wider text-white/40 mb-4">
                Channel breakdown
              </div>
              <div className="overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#131B2B]">
                <div className="divide-y divide-white/[0.04]">
                  {['SEARCH', 'PERFORMANCE_MAX', 'DISPLAY', 'VIDEO'].map((type) => {
                    const rows   = report.byCampaign.filter((c) => c.type === type)
                    if (!rows.length) return null
                    const spend  = rows.reduce((s, r) => s + r.costMicros, 0)
                    const convs  = rows.reduce((s, r) => s + r.conversions, 0)
                    const clicks = rows.reduce((s, r) => s + r.clicks, 0)
                    return (
                      <div key={type} className="flex items-center gap-4 px-5 py-3.5">
                        <span className={`rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${CAMPAIGN_TYPE_COLOR[type] ?? 'bg-white/[0.04] text-white/40 border-white/[0.08]'}`}>
                          {type.replace('_', ' ')}
                        </span>
                        <span className="flex-1 text-[13px] font-semibold text-white">{rows.length} campaign{rows.length !== 1 ? 's' : ''}</span>
                        <span className="text-[12px] text-white/45">{clicks.toLocaleString()} clicks</span>
                        <span className="text-[12px] text-white/45">{Math.round(convs)} conv.</span>
                        <span className="text-[13px] font-medium text-white">{fmtMicros(spend)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </section>
          )}

          {/* Top campaigns */}
          {campaigns.length > 0 && (
            <section className="mt-10">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-[13px] font-medium uppercase tracking-wider text-white/40">
                  Top campaigns — 30d spend
                </div>
                <Link
                  href="/freehold-intelligence/lead-machine/google/campaigns"
                  className="text-[12px] text-white/40 transition hover:text-white"
                >
                  View all <ArrowUpRight className="inline h-3 w-3" />
                </Link>
              </div>
              <div className="space-y-2">
                {[...campaigns]
                  .sort((a, b) => (b.metrics?.costMicros ?? 0) - (a.metrics?.costMicros ?? 0))
                  .slice(0, 5)
                  .map((c) => (
                    <Link
                      key={c.id}
                      href={`/freehold-intelligence/lead-machine/google/campaigns/${c.id}`}
                      className="group flex items-center gap-4 rounded-[16px] border border-white/[0.08] bg-[#131B2B] px-4 py-3.5 transition hover:border-[#4285F4]/25"
                    >
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[12px] font-medium ${CAMPAIGN_TYPE_COLOR[c.type] ?? 'bg-white/[0.04] text-white/40 border-white/[0.08]'}`}>
                        {c.type.replace('_', ' ')}
                      </span>
                      <span className="flex-1 min-w-0 text-[13px] font-medium text-white/80 truncate group-hover:text-white">
                        {c.name}
                      </span>
                      <div className="flex shrink-0 items-center gap-4 text-[12px]">
                        <span className="text-white/40">{c.metrics?.clicks.toLocaleString() ?? 0} clicks</span>
                        <span className="text-white/40">{Math.round(c.metrics?.conversions ?? 0)} conv.</span>
                        <span className="font-medium text-white">{fmtMicros(c.metrics?.costMicros ?? 0)}</span>
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${c.status === 'ENABLED' ? 'bg-[#D4AF37]' : 'bg-white/20'}`} />
                      </div>
                    </Link>
                  ))
                }
              </div>
            </section>
          )}

          {/* Quick nav */}
          <section className="mt-10 grid gap-3 sm:grid-cols-3">
            {[
              { href: '/freehold-intelligence/lead-machine/google/keywords',   icon: Search,   title: 'Keywords',   body: 'Manage keywords, match types, and negatives across all campaigns.' },
              { href: '/freehold-intelligence/lead-machine/google/ads',        icon: Monitor,  title: 'Ads',        body: 'View RSA ad copy, ad strength scores, and performance.' },
              { href: '/freehold-intelligence/lead-machine/google/reports',    icon: BarChart2, title: 'Reports',   body: 'Search terms, auction insights, device breakdown.' },
              { href: '/freehold-intelligence/lead-machine/google/audiences',  icon: TrendingUp, title: 'Audiences', body: 'Customer match lists, in-market and remarketing audiences.' },
              { href: '/freehold-intelligence/lead-machine/google/extensions', icon: Zap,       title: 'Extensions', body: 'Sitelinks, callouts, call extensions, and lead form assets.' },
              { href: '/freehold-intelligence/lead-machine/google/ads/generate', icon: Zap,    title: 'RSA Generator', body: 'AI-generated headlines and descriptions for Responsive Search Ads.' },
            ].map(({ href, icon: Icon, title, body }) => (
              <Link
                key={href}
                href={href}
                className="group rounded-[18px] border border-white/[0.08] bg-[#131B2B] p-5 transition hover:border-[#4285F4]/25"
              >
                <Icon className="mb-2 h-4 w-4 text-[#4285F4]/60" />
                <div className="text-[13px] font-semibold text-white">{title}</div>
                <p className="mt-1 text-[12px] leading-relaxed text-white/40">{body}</p>
                <ArrowUpRight className="mt-3 h-3.5 w-3.5 text-white/20 transition group-hover:text-[#4285F4]/60" />
              </Link>
            ))}
          </section>
        </>
      )}

      {/* Empty state */}
      {!loading && !configErr && !error && campaigns.length === 0 && (
        <div className="mt-16 rounded-[28px] border border-white/[0.08] bg-white/[0.02] px-7 py-14 text-center">
          <Search className="mx-auto h-8 w-8 text-[#4285F4]/40 mb-4" />
          <div className="text-[18px] font-semibold text-white">No Google Ads campaigns yet</div>
          <p className="mt-2 text-[14px] text-white/40">Create your first Search or Performance Max campaign to start capturing leads from Google.</p>
          <Link
            href="/freehold-intelligence/lead-machine/google/campaigns/new"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#4285F4] px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#5A97F5]"
          >
            <Zap className="h-4 w-4" /> Create first campaign
          </Link>
        </div>
      )}

      {/* Marketing Expert Agent */}
      <MarketingExpertPanel
        scope="google-ads"
        context={{
          platform: 'Google Ads',
          activeCampaigns: active,
          pausedCampaigns: paused,
          totalCampaigns: campaigns.length,
          spend30d: fmtMicros(spend),
          conversions30d: Math.round(convs),
          clicks30d: clicks,
          impressions30d: imps,
          avgCtr: imps > 0 ? fmtPct(clicks / imps) : '0%',
          topCampaigns: [...campaigns]
            .sort((a, b) => (b.metrics?.costMicros ?? 0) - (a.metrics?.costMicros ?? 0))
            .slice(0, 5)
            .map((c) => ({ name: c.name, spend: fmtMicros(c.metrics?.costMicros ?? 0), status: c.status })),
        }}
      />

    </div>
  )
}
