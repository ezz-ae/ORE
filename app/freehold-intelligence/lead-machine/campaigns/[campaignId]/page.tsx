'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Play, Pause, Trash2, RefreshCw, AlertCircle, TrendingUp, Users, DollarSign, CheckCircle2, Loader2, ArrowUpRight } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

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
    case 'ACTIVE':   return 'border-gold/25 bg-gold/10 text-gold'
    case 'PAUSED':   return 'border-gold/25 bg-gold/10 text-gold'
    case 'DELETED':  return 'border-red-400/25 bg-red-400/10 text-red-300'
    default:         return 'border-white/10 bg-surface-2 text-slate-500'
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
  const t = useT()
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
        setState((s) => ({ ...s, loading: false, error: json.error ?? t('pcamp.errLoad') }))
        return
      }
      setState((s) => ({ ...s, data: json, loading: false }))
    } catch {
      setState((s) => ({ ...s, loading: false, error: t('pcamp.errNetwork') }))
    }
  }, [t])

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
        setState((s) => ({ ...s, updating: false, error: json.error ?? t('pcamp.errUpdate') }))
      }
    } catch {
      setState((s) => ({ ...s, updating: false, error: t('pcamp.errNetworkShort') }))
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
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      <Link href="/freehold-intelligence/lead-machine/campaigns" className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> {t('pcamp.back')}
      </Link>

      {/* Loading */}
      {loading && (
        <div className="mt-20 flex items-center justify-center gap-3 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-[14px]">{t('pcamp.loading')}</span>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="mt-10 rounded-[20px] border border-red-400/20 bg-red-400/[0.05] p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <div>
              <div className="text-sm font-semibold text-white">{t('pcamp.errorTitle')}</div>
              <p className="mt-1 text-sm text-slate-400">{error}</p>
              {error.includes('not configured') && (
                <Link href="/freehold-intelligence/integrations/meta" className="mt-2 inline-flex items-center gap-1 text-xs text-gold/80 hover:text-gold">
                  {t('pcamp.setupMeta')} <ArrowUpRight className="h-3 w-3" />
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
                  <span className={`rounded-full border px-2.5 py-0.5 text-sm font-medium ${statusBadge(campaign.status)}`}>
                    {campaign.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-400">
                  {campaign.objective.replace(/_/g, ' ')} · {t('pcamp.metaSummary', { budget: fmtBudget(campaign.daily_budget), id: campaign.id })}
                </p>
              </div>

              {/* Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => campaignId && fetchData(campaignId)}
                  disabled={updating}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line-strong bg-surface-2 px-3 text-sm text-slate-300 transition hover:bg-surface-2"
                >
                  <RefreshCw className={`h-3 w-3 ${updating ? 'animate-spin' : ''}`} /> {t('pcamp.refresh')}
                </button>

                {campaign.status === 'ACTIVE' && (
                  <button
                    onClick={() => updateStatus('PAUSED')}
                    disabled={updating}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-gold/20 bg-gold/10 px-3 text-sm font-medium text-gold transition hover:bg-gold/20"
                  >
                    <Pause className="h-3 w-3" /> {t('pcamp.pause')}
                  </button>
                )}

                {campaign.status === 'PAUSED' && (
                  <button
                    onClick={() => updateStatus('ACTIVE')}
                    disabled={updating}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-gold/20 bg-gold/10 px-3 text-sm font-medium text-gold transition hover:bg-gold/20"
                  >
                    <Play className="h-3 w-3" /> {t('pcamp.activate')}
                  </button>
                )}

                {campaign.status !== 'DELETED' && (
                  <button
                    onClick={() => {
                      if (confirm(t('pcamp.deleteConfirm'))) updateStatus('DELETED')
                    }}
                    disabled={updating}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-red-400/15 bg-red-400/[0.06] px-3 text-sm text-red-300 transition hover:bg-red-400/15"
                  >
                    <Trash2 className="h-3 w-3" /> {t('pcamp.delete')}
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Metrics */}
          {insights ? (
            <section className="mt-10">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t('pcamp.performance', { start: insights.date_start, stop: insights.date_stop })}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  { label: t('pcamp.impressions'), value: fmtNum(insights.impressions), icon: TrendingUp },
                  { label: t('pcamp.clicks'),      value: fmtNum(insights.clicks),      icon: TrendingUp },
                  { label: t('pcamp.ctr'),         value: ctr,                          icon: TrendingUp },
                  { label: t('pcamp.spend'),       value: fmtMoney(insights.spend),     icon: DollarSign },
                  { label: t('pcamp.leads'),       value: leads,                        icon: Users },
                  { label: t('pcamp.cpl'),         value: cpl,                          icon: DollarSign },
                ].map((m) => (
                  <div key={m.label} className="rounded-[16px] border border-line bg-surface p-4">
                    <div className="text-xs text-slate-500">{m.label}</div>
                    <div className="mt-2 text-xl font-semibold text-white leading-tight">{m.value}</div>
                  </div>
                ))}
              </div>

              {insights.cpc && (
                <div className="mt-3 flex flex-wrap gap-5 text-xs text-slate-500">
                  <span>{t('pcamp.cpc')}: <span className="text-slate-300">{fmtMoney(insights.cpc)}</span></span>
                  <span>{t('pcamp.cpm')}: <span className="text-slate-300">{fmtMoney(insights.cpm)}</span></span>
                </div>
              )}
            </section>
          ) : (
            <div className="mt-8 rounded-[18px] border border-line bg-surface p-5 text-center text-sm text-slate-400">
              {t('pcamp.noInsights')}
            </div>
          )}

          {/* Ad sets */}
          {data?.adSets && data.adSets.length > 0 && (
            <section className="mt-14">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t('pcamp.adSets')}</div>
              <h2 className="mt-2 text-xl font-semibold text-white">{data.adSets.length === 1 ? t('pcamp.adSetCountOne', { count: data.adSets.length }) : t('pcamp.adSetCountMany', { count: data.adSets.length })}</h2>
              <div className="mt-5 space-y-3">
                {data.adSets.map((adSet) => (
                  <div key={adSet.id} className="rounded-[18px] border border-line bg-surface p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{adSet.name}</div>
                        <div className="mt-1 text-xs text-slate-400">
                          {t('pcamp.adSetMeta', { budget: fmtBudget(adSet.daily_budget), goal: adSet.optimization_goal.replace(/_/g, ' ') })}
                        </div>
                      </div>
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusBadge(adSet.status)}`}>
                        {adSet.status}
                      </span>
                    </div>

                    {adSet.ads.length > 0 && (
                      <div className="mt-4 border-t border-line pt-4 space-y-2">
                        {adSet.ads.map((ad) => (
                          <div key={ad.id} className="flex items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 ${ad.status === 'ACTIVE' ? 'text-gold' : 'text-slate-600'}`} />
                              <span className="text-slate-300">{ad.name}</span>
                            </div>
                            <span className={`text-xs font-medium ${ad.status === 'ACTIVE' ? 'text-gold' : 'text-slate-500'}`}>{ad.status}</span>
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
