'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

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

function statusConfig(status: string) {
  switch (status) {
    case 'ACTIVE':  return { dot: 'bg-gold',  text: 'text-gold', badge: 'border-gold/25 bg-gold/10 text-gold',   label: 'Active'  }
    case 'PAUSED':  return { dot: 'bg-white/35',   text: 'text-slate-400',  badge: 'border-white/[0.10] bg-surface-2 text-slate-400',        label: 'Paused'  }
    case 'DELETED': return { dot: 'bg-red-400/70', text: 'text-red-300',   badge: 'border-red-400/20 bg-red-400/10 text-red-300',             label: 'Deleted' }
    default:        return { dot: 'bg-white/30',    text: 'text-slate-500',   badge: 'border-white/10 bg-surface-2 text-slate-500',            label: status    }
  }
}

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
  return campaign.insights?.actions?.find((a) => a.action_type === 'lead')?.value ?? '0'
}

const FILTER_PILLS: { key: StatusFilter; label: string }[] = [
  { key: 'All',     label: 'All'     },
  { key: 'ACTIVE',  label: 'Active'  },
  { key: 'PAUSED',  label: 'Paused'  },
  { key: 'DELETED', label: 'Deleted' },
]

export function CampaignList({ campaigns }: { campaigns: Campaign[] }) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')

  const filtered = useMemo(() => {
    if (statusFilter === 'All') return campaigns
    return campaigns.filter((c) => c.status === statusFilter)
  }, [campaigns, statusFilter])

  const activePillClass = (key: StatusFilter) => {
    if (statusFilter !== key) return 'border-line bg-surface-2 text-slate-500 hover:text-slate-300'
    switch (key) {
      case 'ACTIVE':  return 'border-emerald-400/40 bg-gold/10 text-gold'
      case 'PAUSED':  return 'border-gold/40 bg-gold/10 text-gold'
      case 'DELETED': return 'border-red-400/40 bg-red-400/10 text-red-300'
      default:        return 'border-gold/40 bg-gold/10 text-gold'
    }
  }

  return (
    <section className="mt-12">
      {/* Filter pills + count */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTER_PILLS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatusFilter(key)}
            className={`rounded-full border px-3 py-1 text-sm font-medium transition ${activePillClass(key)}`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {filtered.length === campaigns.length
          ? `${campaigns.length} campaign${campaigns.length !== 1 ? 's' : ''}`
          : `${filtered.length} of ${campaigns.length} campaigns`}
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
              href={`/freehold-intelligence/lead-machine/campaigns/${campaign.id}`}
              className="group flex items-start justify-between gap-4 rounded-[20px] border border-line bg-surface p-5 transition hover:border-gold/25"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${st.dot}`} />
                  <h3 className="truncate text-sm font-semibold text-white transition group-hover:text-white">{campaign.name}</h3>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${st.badge}`}>{st.label}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
                  <span>Budget: <span className="text-slate-300">{fmtBudget(campaign.daily_budget)}/day</span></span>
                  <span>Objective: <span className="text-slate-300">{campaign.objective.replace(/_/g, ' ')}</span></span>
                </div>
                {campaign.insights && (
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs">
                    <span className="text-slate-500">Impressions: <span className="text-slate-300">{parseInt(campaign.insights.impressions ?? '0').toLocaleString()}</span></span>
                    <span className="text-slate-500">Clicks: <span className="text-slate-300">{parseInt(campaign.insights.clicks ?? '0').toLocaleString()}</span></span>
                    <span className="text-slate-500">Spend: <span className="text-slate-300">{fmtSpend(campaign.insights.spend)}</span></span>
                    <span className="text-slate-500">Leads: <span className="font-semibold text-gold">{leads}</span></span>
                    <span className="text-slate-500">CPL: <span className="text-slate-300">{cpl}</span></span>
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
          No campaigns match this filter.{' '}
          <button type="button" onClick={() => setStatusFilter('All')} className="ml-1 text-gold/60 hover:text-gold">
            Show all
          </button>
        </div>
      )}
    </section>
  )
}
