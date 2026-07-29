'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { metaLeadCount } from '@/lib/meta/lead-count'

interface Campaign {
  id: string
  name: string
  status: string
  objective: string
  daily_budget?: string
  created_time: string
  insights?: {
    impressions: string
    clicks: string
    spend: string
    actions?: { action_type: string; value: string }[]
    cpc?: string
    cpm?: string
  } | null
}

type StatusFilter = 'All' | 'ACTIVE' | 'PAUSED' | 'DELETED'

function fmtBudget(fils: string | undefined) {
  if (!fils) return '—'
  return `AED ${(parseInt(fils) / 100).toLocaleString('en-AE', { minimumFractionDigits: 0 })}`
}

function fmtSpend(spend: string | undefined) {
  if (!spend) return '—'
  const n = parseFloat(spend)
  return `AED ${n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function getLeads(campaign: Campaign) {
  return String(metaLeadCount(campaign.insights?.actions))
}

const FILTER_PILLS: { key: StatusFilter; labelKey: string }[] = [
  { key: 'All',     labelKey: 'lm.campaignList.filter.all'     },
  { key: 'ACTIVE',  labelKey: 'lm.campaignList.filter.active'  },
  { key: 'PAUSED',  labelKey: 'lm.campaignList.filter.paused'  },
  { key: 'DELETED', labelKey: 'lm.campaignList.filter.deleted' },
]

export function CampaignList({ campaigns }: { campaigns: Campaign[] }) {
  const t = useT()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')

  function statusConfig(status: string) {
    switch (status) {
      case 'ACTIVE':  return { dot: 'bg-emerald-400', text: 'text-emerald-300', badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',        labelKey: 'lm.campaignList.status.active'  }
      case 'PAUSED':  return { dot: 'bg-amber-400/70', text: 'text-amber-300', badge: 'border-amber-400/25 bg-amber-400/10 text-amber-300',              labelKey: 'lm.campaignList.status.paused'  }
      case 'DELETED': return { dot: 'bg-red-400/70',  text: 'text-red-300',    badge: 'border-red-400/20 bg-red-400/10 text-red-300',                    labelKey: 'lm.campaignList.status.deleted' }
      default:        return { dot: 'bg-white/30',    text: 'text-slate-500',  badge: 'border-white/10 bg-surface-2 text-slate-500',                     labelKey: ''                               }
    }
  }

  const filtered = useMemo(() => {
    if (statusFilter === 'All') return campaigns
    return campaigns.filter((c) => c.status === statusFilter)
  }, [campaigns, statusFilter])

  const activePillClass = (key: StatusFilter) => {
    if (statusFilter !== key) return 'border-line bg-surface-2 text-slate-500 hover:text-slate-300'
    switch (key) {
      case 'ACTIVE':  return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
      case 'PAUSED':  return 'border-amber-400/40 bg-amber-400/10 text-amber-300'
      case 'DELETED': return 'border-red-400/40 bg-red-400/10 text-red-300'
      default:        return 'border-line-strong bg-surface-2 text-slate-200'
    }
  }

  return (
    <section className="mt-12">
      {/* Filter pills + count */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTER_PILLS.map(({ key, labelKey }) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatusFilter(key)}
            className={`rounded-full border px-3 py-1 text-sm font-medium transition ${activePillClass(key)}`}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {filtered.length === campaigns.length
          ? t('lm.campaignList.count', { n: String(campaigns.length), plural: campaigns.length !== 1 ? 's' : '' })
          : t('lm.campaignList.countFiltered', { n: String(filtered.length), total: String(campaigns.length) })}
      </p>

      {/* List */}
      <div className="mt-4 space-y-3">
        {filtered.map((campaign) => {
          const st    = statusConfig(campaign.status)
          const leads = getLeads(campaign)
          const cpl   = parseFloat(campaign.insights?.spend ?? '0') > 0 && parseInt(leads) > 0
            ? `AED ${(parseFloat(campaign.insights!.spend) / parseInt(leads)).toFixed(0)}`
            : '—'

          return (
            <Link
              key={campaign.id}
              href={`/freehold-intelligence/ads-live/meta/${campaign.id}`}
              className="group flex items-start justify-between gap-4 rounded-[20px] border border-line bg-surface p-5 transition hover:border-gold/25"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${st.dot}`} />
                  <h3 className="truncate text-sm font-semibold text-white transition group-hover:text-white">{campaign.name}</h3>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${st.badge}`}>
                    {st.labelKey ? t(st.labelKey) : campaign.status}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
                  <span>{t('lm.campaignList.field.budget')} <span className="text-slate-300">{fmtBudget(campaign.daily_budget)}/day</span></span>
                  <span>{t('lm.campaignList.field.objective')} <span className="text-slate-300">{campaign.objective.replace(/_/g, ' ')}</span></span>
                </div>
                {campaign.insights && (
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs">
                    <span className="text-slate-500">{t('lm.campaignList.field.impressions')} <span className="text-slate-300">{parseInt(campaign.insights.impressions ?? '0').toLocaleString()}</span></span>
                    <span className="text-slate-500">{t('lm.campaignList.field.clicks')} <span className="text-slate-300">{parseInt(campaign.insights.clicks ?? '0').toLocaleString()}</span></span>
                    <span className="text-slate-500">{t('lm.campaignList.field.spend')} <span className="text-slate-300">{fmtSpend(campaign.insights.spend)}</span></span>
                    <span className="text-slate-500">{t('lm.campaignList.field.leads')} <span className="font-semibold text-gold">{leads}</span></span>
                    <span className="text-slate-500">{t('lm.campaignList.field.cpl')} <span className="text-slate-300">{cpl}</span></span>
                  </div>
                )}
              </div>
              <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-slate-600 transition group-hover:text-gold" />
            </Link>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="mt-8 rounded-[22px] border border-line bg-surface-2 px-6 py-12 text-center text-sm text-slate-500">
          {t('lm.campaignList.noMatch')}{' '}
          <button type="button" onClick={() => setStatusFilter('All')} className="ml-1 text-gold/60 hover:text-gold">
            {t('lm.campaignList.showAll')}
          </button>
        </div>
      )}
    </section>
  )
}
