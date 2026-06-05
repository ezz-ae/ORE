'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Play, Pause, Trash2, RefreshCw, AlertCircle, TrendingUp, Users, DollarSign, CheckCircle2, Loader2, ArrowUpRight } from 'lucide-react'

interface AdSetData {
  id: string
  name: string
  status: string
  daily_budget: string
  optimization_goal: string
  ads: { id: string; name: string; status: string }[]
}

interface CampaignDetailData {
  campaign: {
    id: string
    name: string
    status: string
    objective: string
    daily_budget?: string
    created_time: string
  }
  insights: {
    impressions: string
    clicks: string
    spend: string
    cpc?: string
    cpm?: string
    actions?: { action_type: string; value: string }[]
    date_start: string
    date_stop: string
  } | null
  adSets: AdSetData[]
}

interface ApiState {
  data: CampaignDetailData | null
  loading: boolean
  error: string | null
  updating: boolean
}

function statusBadge(status: string) {
  switch (status) {
    case 'ACTIVE':   return 'border-[#D4AF37]/25 bg-[#D4AF37]/10 text-[#D4AF37]'
    case 'PAUSED':   return 'border-[#D4AF37]/25 bg-[#D4AF37]/10 text-[#D4AF37]'
    case 'DELETED':  return 'border-red-400/25 bg-red-400/10 text-red-300'
    default:         return 'border-white/10 bg-white/[0.04] text-white/45'
  }
}

function fmtNum(s: string | undefined) {
  if (!s) return '0'
  return parseInt(s).toLocaleString('en-AE')
}

function fmtMoney(s: string | undefined) {
  if (!s) return 'AED 0'
  return `AED ${parseFloat(s).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtBudget(fils: string | undefined) {
  if (!fils) return '—'
  return `AED ${(parseInt(fils) / 100).toLocaleString('en-AE')}`
}

function getLeads(data: CampaignDetailData | null) {
  return data?.insights?.actions?.find((a) => a.action_type === 'lead')?.value ?? '0'
}

export default function CampaignDetailPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [state, setState] = useState<ApiState>({ data: null, loading: true, error: null, updating: false })

  useEffect(() => {
    params.then(({ campaignId: id }) => setCampaignId(id))
  }, [params])

  const fetchData = useCallback(async (id: string) => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const res  = await fetch(`/api/meta/campaigns/${id}`)
      const json = await res.json()
      if (!res.ok) {
        setState((s) => ({ ...s, loading: false, error: json.error ?? 'Failed to load campaign' }))
        return
      }
      setState((s) => ({ ...s, data: json, loading: false }))
    } catch {
      setState((s) => ({ ...s, loading: false, error: 'Network error. Please refresh.' }))
    }
  }, [])

  useEffect(() => {
    if (campaignId) fetchData(campaignId)
  }, [campaignId, fetchData])

  async function updateStatus(newStatus: 'ACTIVE' | 'PAUSED' | 'DELETED') {
    if (!campaignId) return
    setState((s) => ({ ...s, updating: true }))
    try {
      const res = await fetch(`/api/meta/campaigns/${campaignId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        await fetchData(campaignId)
      } else {
        const json = await res.json()
        setState((s) => ({ ...s, updating: false, error: json.error ?? 'Update failed' }))
      }
    } catch {
      setState((s) => ({ ...s, updating: false, error: 'Network error' }))
    }
  }

  const { data, loading, error, updating } = state
  const campaign = data?.campaign
  const insights = data?.insights
  const leads    = getLeads(data)
  const cpl      = parseFloat(insights?.spend ?? '0') > 0 && parseInt(leads) > 0
    ? `AED ${(parseFloat(insights!.spend) / parseInt(leads)).toFixed(0)}`
    : '—'
  const ctr = insights && parseInt(insights.impressions) > 0
    ? ((parseInt(insights.clicks) / parseInt(insights.impressions)) * 100).toFixed(2) + '%'
    : '—'

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-10 sm:px-6 sm:pt-14">

      <Link href="/freehold-intelligence/lead-machine/campaigns" className="inline-flex items-center gap-1.5 text-[12px] text-white/40 transition hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> All campaigns
      </Link>

      {/* Loading */}
      {loading && (
        <div className="mt-20 flex items-center justify-center gap-3 text-white/40">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-[14px]">Loading campaign…</span>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="mt-10 rounded-[20px] border border-red-400/20 bg-red-400/[0.05] p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <div>
              <div className="text-[13px] font-semibold text-white">Error loading campaign</div>
              <p className="mt-1 text-[13px] text-white/60">{error}</p>
              {error.includes('not configured') && (
                <Link href="/freehold-intelligence/integrations/meta" className="mt-2 inline-flex items-center gap-1 text-[12px] text-[#D4AF37]/80 hover:text-[#D4AF37]">
                  Set up Meta integration <ArrowUpRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {campaign && !loading && (
        <>
          {/* Header */}
          <section className="mt-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-[28px] font-semibold text-white sm:text-[36px]">{campaign.name}</h1>
                  <span className={`rounded-full border px-2.5 py-0.5 text-[13px] font-medium ${statusBadge(campaign.status)}`}>
                    {campaign.status}
                  </span>
                </div>
                <p className="mt-2 text-[13px] text-white/45">
                  {campaign.objective.replace(/_/g, ' ')} · Budget {fmtBudget(campaign.daily_budget)}/day · ID {campaign.id}
                </p>
              </div>

              {/* Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => campaignId && fetchData(campaignId)}
                  disabled={updating}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 text-[13px] text-white/60 transition hover:bg-white/[0.07]"
                >
                  <RefreshCw className={`h-3 w-3 ${updating ? 'animate-spin' : ''}`} /> Refresh
                </button>

                {campaign.status === 'ACTIVE' && (
                  <button
                    onClick={() => updateStatus('PAUSED')}
                    disabled={updating}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/10 px-3 text-[13px] font-medium text-[#D4AF37] transition hover:bg-[#D4AF37]/20"
                  >
                    <Pause className="h-3 w-3" /> Pause
                  </button>
                )}

                {campaign.status === 'PAUSED' && (
                  <button
                    onClick={() => updateStatus('ACTIVE')}
                    disabled={updating}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/10 px-3 text-[13px] font-medium text-[#D4AF37] transition hover:bg-[#D4AF37]/20"
                  >
                    <Play className="h-3 w-3" /> Activate
                  </button>
                )}

                {campaign.status !== 'DELETED' && (
                  <button
                    onClick={() => {
                      if (confirm('Delete this campaign? This cannot be undone.')) updateStatus('DELETED')
                    }}
                    disabled={updating}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-red-400/15 bg-red-400/[0.06] px-3 text-[13px] text-red-300 transition hover:bg-red-400/15"
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Metrics */}
          {insights ? (
            <section className="mt-10">
              <div className="text-[13px] font-medium uppercase tracking-[0.22em] text-white/40">
                Performance · {insights.date_start} → {insights.date_stop}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  { label: 'Impressions', value: fmtNum(insights.impressions), icon: TrendingUp },
                  { label: 'Clicks',      value: fmtNum(insights.clicks),      icon: TrendingUp },
                  { label: 'CTR',         value: ctr,                          icon: TrendingUp },
                  { label: 'Spend',       value: fmtMoney(insights.spend),     icon: DollarSign },
                  { label: 'Leads',       value: leads,                        icon: Users },
                  { label: 'CPL',         value: cpl,                          icon: DollarSign },
                ].map((m) => (
                  <div key={m.label} className="rounded-[16px] border border-white/[0.08] bg-[#1A1F2A] p-4">
                    <div className="text-[13px] text-white/35">{m.label}</div>
                    <div className="mt-2 text-[20px] font-semibold text-white leading-tight">{m.value}</div>
                  </div>
                ))}
              </div>

              {insights.cpc && (
                <div className="mt-3 flex flex-wrap gap-5 text-[12px] text-white/40">
                  <span>CPC: <span className="text-white/65">{fmtMoney(insights.cpc)}</span></span>
                  <span>CPM: <span className="text-white/65">{fmtMoney(insights.cpm)}</span></span>
                </div>
              )}
            </section>
          ) : (
            <div className="mt-8 rounded-[18px] border border-white/[0.08] bg-[#1A1F2A] p-5 text-center text-[13px] text-white/35">
              No insights yet — data appears after the campaign has delivered impressions.
            </div>
          )}

          {/* Ad sets */}
          {data?.adSets && data.adSets.length > 0 && (
            <section className="mt-14">
              <div className="text-[13px] font-medium uppercase tracking-[0.22em] text-white/40">Ad sets</div>
              <h2 className="mt-2 text-xl font-semibold text-white">{data.adSets.length} ad set{data.adSets.length !== 1 ? 's' : ''}</h2>
              <div className="mt-5 space-y-3">
                {data.adSets.map((adSet) => (
                  <div key={adSet.id} className="rounded-[18px] border border-white/[0.08] bg-[#1A1F2A] p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[14px] font-semibold text-white">{adSet.name}</div>
                        <div className="mt-1 text-[12px] text-white/45">
                          Budget {fmtBudget(adSet.daily_budget)}/day · {adSet.optimization_goal.replace(/_/g, ' ')}
                        </div>
                      </div>
                      <span className={`rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${statusBadge(adSet.status)}`}>
                        {adSet.status}
                      </span>
                    </div>

                    {adSet.ads.length > 0 && (
                      <div className="mt-4 border-t border-white/[0.05] pt-4 space-y-2">
                        {adSet.ads.map((ad) => (
                          <div key={ad.id} className="flex items-center justify-between gap-3 text-[12px]">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 ${ad.status === 'ACTIVE' ? 'text-[#D4AF37]' : 'text-white/20'}`} />
                              <span className="text-white/70">{ad.name}</span>
                            </div>
                            <span className={`text-[12px] font-medium ${ad.status === 'ACTIVE' ? 'text-[#D4AF37]' : 'text-white/35'}`}>{ad.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
