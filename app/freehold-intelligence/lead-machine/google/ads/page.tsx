'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Monitor, RefreshCw, AlertCircle, ArrowUpRight, Wand2 } from 'lucide-react'
import type { GoogleResponsiveSearchAd, GoogleAdStrength } from '@/lib/google/types'

interface AdsData {
  ads?: GoogleResponsiveSearchAd[]
  error?: string
  type?: string
}

const STRENGTH_CONFIG: Record<GoogleAdStrength, { label: string; color: string }> = {
  PENDING:   { label: 'Pending',   color: 'text-white/40 bg-white/[0.04] border-white/[0.08]'          },
  POOR:      { label: 'Poor',      color: 'text-red-300 bg-red-400/10 border-red-400/20'               },
  AVERAGE:   { label: 'Average',   color: 'text-[#FBBC04] bg-[#FBBC04]/10 border-[#FBBC04]/20'         },
  GOOD:      { label: 'Good',      color: 'text-[#D4AF37] bg-[#D4AF37]/10 border-emerald-400/20'   },
  EXCELLENT: { label: 'Excellent', color: 'text-[#4285F4] bg-[#4285F4]/10 border-[#4285F4]/20'         },
}

function fmtMicros(m: number) {
  const aed = m / 1_000_000
  if (aed >= 1000) return `AED ${(aed / 1000).toFixed(1)}K`
  return `AED ${aed.toFixed(0)}`
}

function strengthBar(strength: GoogleAdStrength) {
  const map: Record<GoogleAdStrength, number> = { PENDING: 0, POOR: 20, AVERAGE: 50, GOOD: 75, EXCELLENT: 100 }
  const color: Record<GoogleAdStrength, string> = {
    PENDING: 'bg-white/20', POOR: 'bg-red-400', AVERAGE: 'bg-[#FBBC04]', GOOD: 'bg-[#D4AF37]', EXCELLENT: 'bg-[#4285F4]',
  }
  return { width: map[strength], color: color[strength] }
}

export default function GoogleAdsLibraryPage() {
  const [data, setData]           = useState<AdsData>({})
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter]       = useState<'ALL' | GoogleAdStrength>('ALL')

  async function fetchAds(quiet = false) {
    if (quiet) setRefreshing(true)
    else setLoading(true)
    try {
      const res  = await fetch('/api/google/ads')
      const json = await res.json()
      setData(json)
    } catch {
      setData({ error: 'Network error' })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { fetchAds() }, [])

  const ads      = data.ads ?? []
  const filtered = filter === 'ALL' ? ads : ads.filter((a) => a.adStrength === filter)
  const isConfigError = data.type === 'config'

  const strengthCounts: Record<string, number> = {}
  for (const a of ads) {
    strengthCounts[a.adStrength] = (strengthCounts[a.adStrength] ?? 0) + 1
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-10 sm:px-6 sm:pt-14">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <section>
          <div className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-[0.22em] text-[#4285F4]/85">
            <Monitor className="h-3.5 w-3.5" /> Responsive Search Ads
          </div>
          <h1 className="mt-4 text-[36px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[48px]">
            Ad library<br />
            <span className="text-white/35">
              {loading ? '…' : isConfigError ? 'not connected.' : `${ads.length} RSAs.`}
            </span>
          </h1>
        </section>

        <div className="mt-7 flex gap-2 sm:mt-10">
          <button
            onClick={() => fetchAds(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-white/50 transition hover:text-white disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link
            href="/freehold-intelligence/lead-machine/google/ads/generate"
            className="inline-flex items-center gap-2 rounded-full bg-[#4285F4] px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#5A97F5]"
          >
            <Wand2 className="h-4 w-4" /> Generate RSA copy
          </Link>
        </div>
      </div>

      {/* Config error */}
      {isConfigError && (
        <div className="mt-8 rounded-[20px] border border-red-400/20 bg-red-400/[0.05] p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <div>
              <div className="text-[13px] font-semibold text-white">Google Ads not connected</div>
              <p className="mt-1 text-[13px] text-white/60">{data.error}</p>
              <Link href="/freehold-intelligence/integrations/google" className="mt-3 inline-flex items-center gap-1 text-[12px] text-[#4285F4]/80 transition hover:text-[#4285F4]">
                Set up Google integration <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* API error */}
      {data.error && !isConfigError && (
        <div className="mt-8 rounded-[18px] border border-orange-400/20 bg-orange-400/[0.04] p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
            <p className="text-[13px] text-white/65">{data.error}</p>
          </div>
        </div>
      )}

      {loading && (
        <div className="mt-12 text-center text-[14px] text-white/35">Loading ads…</div>
      )}

      {!loading && !isConfigError && ads.length > 0 && (
        <>
          {/* Strength summary */}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {(['ALL', 'EXCELLENT', 'GOOD', 'AVERAGE', 'POOR'] as const).map((s) => {
              const count = s === 'ALL' ? ads.length : (strengthCounts[s] ?? 0)
              const cfg   = s === 'ALL' ? { label: 'All', color: 'text-white' } : STRENGTH_CONFIG[s]
              return (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={[
                    'rounded-[14px] border p-3 text-left transition',
                    filter === s
                      ? 'border-[#4285F4]/30 bg-[#4285F4]/[0.06]'
                      : 'border-white/[0.08] bg-[#1A1F2A] hover:border-white/20',
                  ].join(' ')}
                >
                  <div className="text-[20px] font-semibold text-white">{count}</div>
                  <div className={`text-[12px] font-medium ${s === 'ALL' ? 'text-white/40' : STRENGTH_CONFIG[s as GoogleAdStrength]?.color.split(' ')[0]}`}>
                    {cfg.label}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Ad cards */}
          <section className="mt-8 space-y-4">
            {filtered.map((ad) => {
              const cfg  = STRENGTH_CONFIG[ad.adStrength]
              const bar  = strengthBar(ad.adStrength)
              const cost = fmtMicros(ad.metrics?.costMicros ?? 0)
              return (
                <div key={ad.id} className="rounded-[22px] border border-white/[0.08] bg-[#1A1F2A] p-5">
                  {/* Top bar */}
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className={`rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      <span className={`h-1.5 w-1.5 rounded-full ${ad.status === 'ENABLED' ? 'bg-[#D4AF37]' : 'bg-white/20'}`} />
                      <span className="text-[13px] text-white/30">{ad.status}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[13px] text-white/30">
                      {ad.metrics && (
                        <>
                          <span>{ad.metrics.impressions.toLocaleString()} imp</span>
                          <span>{ad.metrics.clicks.toLocaleString()} clicks</span>
                          <span>{Math.round(ad.metrics.conversions)} conv</span>
                          <span className="text-white/50">{cost}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Strength bar */}
                  <div className="mb-4">
                    <div className="mb-1 flex items-center justify-between text-[12px]">
                      <span className="text-white/30">Ad strength</span>
                      <span className={cfg.color.split(' ')[0]}>{cfg.label}</span>
                    </div>
                    <div className="h-1 rounded-full bg-white/[0.06]">
                      <div className={`h-full rounded-full transition-all ${bar.color}`} style={{ width: `${bar.width}%` }} />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Headlines */}
                    <div>
                      <div className="mb-2 text-[12px] font-medium uppercase tracking-[0.14em] text-white/30">
                        Headlines ({ad.headlines.length})
                      </div>
                      <div className="space-y-1">
                        {ad.headlines.slice(0, 5).map((h, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="shrink-0 text-[12px] text-white/20 w-4 text-right">{i + 1}</span>
                            <span className="text-[12px] text-white/75">{h.text}</span>
                            {h.pinnedField && (
                              <span className="rounded bg-white/[0.06] px-1 py-0.5 text-[9px] text-white/30">pinned</span>
                            )}
                          </div>
                        ))}
                        {ad.headlines.length > 5 && (
                          <div className="text-[13px] text-white/25">+{ad.headlines.length - 5} more</div>
                        )}
                      </div>
                    </div>

                    {/* Descriptions */}
                    <div>
                      <div className="mb-2 text-[12px] font-medium uppercase tracking-[0.14em] text-white/30">
                        Descriptions ({ad.descriptions.length})
                      </div>
                      <div className="space-y-2">
                        {ad.descriptions.map((d, i) => (
                          <p key={i} className="text-[12px] text-white/55 leading-relaxed">{d.text}</p>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Final URL */}
                  {ad.finalUrls[0] && (
                    <div className="mt-4 border-t border-white/[0.04] pt-3">
                      <span className="text-[12px] font-mono text-white/25 truncate block">{ad.finalUrls[0]}</span>
                    </div>
                  )}

                  <div className="mt-3 border-t border-white/[0.04] pt-2.5 text-[12px] font-mono text-white/15">{ad.id}</div>
                </div>
              )
            })}
          </section>
        </>
      )}

      {/* Empty state */}
      {!loading && !isConfigError && ads.length === 0 && (
        <div className="mt-16 rounded-[28px] border border-white/[0.08] bg-white/[0.02] px-7 py-14 text-center">
          <Monitor className="mx-auto h-8 w-8 text-[#4285F4]/40 mb-4" />
          <div className="text-[18px] font-semibold text-white">No ads yet</div>
          <p className="mt-2 text-[14px] text-white/40">Create a campaign and add Responsive Search Ads, or generate copy with AI first.</p>
          <Link
            href="/freehold-intelligence/lead-machine/google/ads/generate"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#4285F4] px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#5A97F5]"
          >
            <Wand2 className="h-4 w-4" /> Generate RSA copy
          </Link>
        </div>
      )}

    </div>
  )
}
