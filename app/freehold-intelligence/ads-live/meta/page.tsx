'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowUpRight, CheckCircle2, Plus, Palette, ChevronDown, ChevronUp } from 'lucide-react'
import { MarketingExpertPanel } from '@/components/google/ads-expert-panel'
import { useT } from '@/lib/i18n/provider'

const META_BLUE = '#1877F2'

interface MetaCampaign {
  name: string
  status: 'Active' | 'Paused'
  dailyBudget: number
  spend: number
  impressions: number
  clicks: number
  leads: number
  cpl: number
}

const campaigns: MetaCampaign[] = [
  {
    name: 'Palm Jumeirah Investor | Meta',
    status: 'Active',
    dailyBudget: 500,
    spend: 7820,
    impressions: 148200,
    clicks: 3210,
    leads: 94,
    cpl: 83.2,
  },
  {
    name: 'Dubai Hills Yield | Meta',
    status: 'Active',
    dailyBudget: 350,
    spend: 6140,
    impressions: 124800,
    clicks: 2740,
    leads: 88,
    cpl: 69.8,
  },
  {
    name: 'Golden Visa Buyers | Meta',
    status: 'Active',
    dailyBudget: 250,
    spend: 4460,
    impressions: 89400,
    clicks: 1960,
    leads: 66,
    cpl: 67.6,
  },
  {
    name: 'JVC Investor | Meta',
    status: 'Paused',
    dailyBudget: 200,
    spend: 0,
    impressions: 0,
    clicks: 0,
    leads: 0,
    cpl: 0,
  },
]

const adSets = [
  { nameKey: 'lm.meta.adSet.uaeHomebuyers',      budgetAmount: '450', status: 'Active',  audience: '2.1M' },
  { nameKey: 'lm.meta.adSet.gccInvestors',        budgetAmount: '280', status: 'Active',  audience: '840K' },
  { nameKey: 'lm.meta.adSet.expatProfessionals',  budgetAmount: '170', status: 'Paused', audience: '1.4M' },
]

type StatusFilter = 'All' | 'Active' | 'Paused'
type SortCol = 'spend' | 'leads' | 'cpl' | 'impressions'

export default function MetaAdsPage() {
  const t = useT()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')
  const [sortCol, setSortCol] = useState<SortCol>('leads')
  const [sortAsc, setSortAsc] = useState(false)

  const visibleCampaigns = useMemo(() => {
    const filtered = statusFilter === 'All' ? campaigns : campaigns.filter((c) => c.status === statusFilter)
    return [...filtered].sort((a, b) => {
      const diff = a[sortCol] - b[sortCol]
      return sortAsc ? diff : -diff
    })
  }, [statusFilter, sortCol, sortAsc])

  function handleSort(col: SortCol) {
    if (sortCol === col) setSortAsc((v) => !v)
    else { setSortCol(col); setSortAsc(false) }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <section>
          <div
            className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider"
            style={{ color: `${META_BLUE}CC` }}
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill={META_BLUE}>
              <path d="M12 2.04c-5.5 0-9.96 4.46-9.96 9.96 0 4.41 2.87 8.16 6.84 9.49v-6.71H6.9v-2.78h1.98V9.84c0-1.95 1.17-3.03 2.94-3.03.85 0 1.74.15 1.74.15v1.92h-.98c-.97 0-1.27.6-1.27 1.21v1.46h2.16l-.34 2.78h-1.82V21.5c3.97-1.33 6.84-5.08 6.84-9.5 0-5.5-4.46-9.96-9.96-9.96z" />
            </svg>
            {t('lm.meta.eyebrow')}
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-100">
            {t('lm.meta.title')}<br />
            <span className="text-slate-500">{t('lm.meta.subtitle')}</span>
          </h1>
        </section>

        <div className="mt-7 flex flex-col items-end gap-2 sm:mt-10">
          {/* Connected badge */}
          <span className="flex items-center gap-1.5 rounded-full border border-gold/25 bg-gold/[0.08] px-3 py-1.5 text-sm font-medium text-gold">
            <CheckCircle2 className="h-3 w-3" />
            {t('lm.meta.connected')}
          </span>
          {/* Manage external link */}
          <button onClick={() => { window.open('https://business.facebook.com/adsmanager', '_blank'); toast.info(t('lm.meta.openingManager')) }} className="inline-flex items-center gap-1 text-xs text-slate-500 transition hover:text-slate-300">
            {t('lm.meta.manageInMeta')} <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Account status */}
      <div className="mt-6 flex items-center gap-3 rounded-2xl border border-line bg-surface-2 px-5 py-4">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${META_BLUE}18`, border: `1px solid ${META_BLUE}30` }}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill={META_BLUE}>
            <path d="M12 2.04c-5.5 0-9.96 4.46-9.96 9.96 0 4.41 2.87 8.16 6.84 9.49v-6.71H6.9v-2.78h1.98V9.84c0-1.95 1.17-3.03 2.94-3.03.85 0 1.74.15 1.74.15v1.92h-.98c-.97 0-1.27.6-1.27 1.21v1.46h2.16l-.34 2.78h-1.82V21.5c3.97-1.33 6.84-5.08 6.84-9.5 0-5.5-4.46-9.96-9.96-9.96z" />
          </svg>
        </div>
        <div>
          <div className="text-sm font-semibold text-white">{t('lm.meta.accountName')}</div>
          <div className="text-sm text-slate-400">{t('lm.meta.accountDesc')}</div>
        </div>
      </div>

      {/* KPI row */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: t('lm.meta.kpi.spend'),       value: 'AED 18,420' },
          { label: t('lm.meta.kpi.reach'),        value: '142,000' },
          { label: t('lm.meta.kpi.impressions'),  value: '380,000' },
          { label: t('lm.meta.kpi.leads'),        value: '248',       color: 'text-gold' },
          { label: t('lm.meta.kpi.cpl'),          value: 'AED 74.3' },
          { label: t('lm.meta.kpi.ctr'),          value: '2.1%' },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-line bg-surface-2 p-4">
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">{k.label}</div>
            <div className={`mt-2 text-xl font-semibold leading-none ${k.color ?? 'text-white'}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Campaigns table */}
      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-400">{t('lm.meta.section.campaigns')}</div>
          <div className="flex gap-1.5">
            {(['All', 'Active', 'Paused'] as StatusFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={[
                  'rounded-full px-3 py-1 text-sm font-medium transition',
                  statusFilter === f
                    ? 'border border-[#1877F2]/40 bg-[#1877F2]/15 text-[#6BA3F5]'
                    : 'border border-line-strong text-slate-400 hover:text-slate-200',
                ].join(' ')}
              >
                {f === 'All' ? t('lm.meta.filter.all') : f === 'Active' ? t('lm.meta.filter.active') : t('lm.meta.filter.paused')}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[700px] overflow-hidden rounded-2xl border border-line bg-surface-2">
            {/* Table header */}
            <div className="grid grid-cols-[2fr_80px_100px_80px_90px_70px_60px_70px] gap-4 border-b border-line px-5 py-3">
              {[
                { label: t('lm.meta.col.campaign'),    col: null },
                { label: t('lm.meta.col.status'),      col: null },
                { label: t('lm.meta.col.dailyBudget'), col: null },
                { label: t('lm.meta.col.spend'),       col: 'spend' as SortCol },
                { label: t('lm.meta.col.impressions'), col: 'impressions' as SortCol },
                { label: t('lm.meta.col.clicks'),      col: null },
                { label: t('lm.meta.col.leads'),       col: 'leads' as SortCol },
                { label: t('lm.meta.col.cpl'),         col: 'cpl' as SortCol },
              ].map(({ label, col }) => (
                <button
                  key={label}
                  onClick={() => col && handleSort(col)}
                  className={[
                    'flex items-center gap-1 text-xs font-medium uppercase tracking-[0.16em] transition',
                    col ? 'text-slate-500 hover:text-slate-300 cursor-pointer' : 'text-slate-500 cursor-default',
                    col && sortCol === col ? 'text-slate-300' : '',
                  ].join(' ')}
                >
                  {label}
                  {col && sortCol === col && (
                    sortAsc ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />
                  )}
                </button>
              ))}
            </div>
            {/* Rows */}
            <div className="divide-y divide-line">
              {visibleCampaigns.map((c) => (
                <div
                  key={c.name}
                  className="grid grid-cols-[2fr_80px_100px_80px_90px_70px_60px_70px] gap-4 items-center px-5 py-4"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${c.status === 'Active' ? 'bg-gold' : 'bg-gold'}`} />
                    <span className="truncate text-sm font-semibold text-slate-100">{c.name}</span>
                  </div>
                  <div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        c.status === 'Active'
                          ? 'border border-gold/20 bg-gold/10 text-gold'
                          : 'border border-gold/20 bg-gold/10 text-gold'
                      }`}
                    >
                      {c.status === 'Active' ? t('lm.meta.status.active') : t('lm.meta.status.paused')}
                    </span>
                  </div>
                  <div className="text-xs text-slate-300">
                    {c.dailyBudget > 0 ? `AED ${c.dailyBudget}/d` : '—'}
                  </div>
                  <div className="text-xs text-slate-300">
                    {c.spend > 0 ? `AED ${c.spend.toLocaleString()}` : '—'}
                  </div>
                  <div className="text-xs text-slate-400">
                    {c.impressions > 0 ? c.impressions.toLocaleString() : '—'}
                  </div>
                  <div className="text-xs text-slate-400">
                    {c.clicks > 0 ? c.clicks.toLocaleString() : '—'}
                  </div>
                  <div className={`text-sm font-semibold ${c.leads > 0 ? 'text-gold' : 'text-slate-500'}`}>
                    {c.leads > 0 ? c.leads : '—'}
                  </div>
                  <div className="text-xs text-slate-300">
                    {c.cpl > 0 ? `AED ${c.cpl}` : '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Ad sets */}
      <section className="mt-10">
        <div className="mb-4 text-xs font-medium uppercase tracking-wider text-slate-400">{t('lm.meta.section.adSets')}</div>
        <div className="grid gap-3 sm:grid-cols-3">
          {adSets.map((s) => (
            <div
              key={s.nameKey}
              className="rounded-2xl border border-line bg-surface-2 p-5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-100">{t(s.nameKey)}</span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    s.status === 'Active'
                      ? 'border border-gold/20 bg-gold/10 text-gold'
                      : 'border border-gold/20 bg-gold/10 text-gold'
                  }`}
                >
                  {s.status === 'Active' ? t('lm.meta.status.active') : t('lm.meta.status.paused')}
                </span>
              </div>
              <div className="mt-3 space-y-1.5 text-xs text-slate-400">
                <div>{t('lm.meta.adSet.budget')} <span className="text-slate-300">{t('lm.meta.budgetPerDay', { amount: s.budgetAmount })}</span></div>
                <div>{t('lm.meta.adSet.audienceSize')} <span className="text-slate-300">{s.audience}</span></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Quick actions */}
      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/freehold-intelligence/lead-machine/campaigns/new"
          className="inline-flex items-center gap-2 rounded-2xl border border-line bg-surface-2 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:border-gold/30 hover:text-white"
        >
          <Plus className="h-4 w-4 text-gold" /> {t('lm.meta.createCampaign')}
        </Link>
        <Link
          href="/freehold-intelligence/lead-machine/creatives"
          className="inline-flex items-center gap-2 rounded-2xl border border-line bg-surface-2 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:border-gold/30 hover:text-white"
        >
          <Palette className="h-4 w-4 text-gold" /> {t('lm.meta.viewCreatives')}
        </Link>
      </div>

      {/* Marketing Expert Agent */}
      <MarketingExpertPanel
        scope="meta-ads"
        context={{
          platform: 'Meta Ads',
          totalCampaigns: campaigns.length,
          activeCampaigns: campaigns.filter((c) => c.status === 'Active').length,
          totalSpend: campaigns.reduce((s, c) => s + c.spend, 0),
          totalLeads: campaigns.reduce((s, c) => s + c.leads, 0),
          avgCpl: (campaigns.reduce((s, c) => s + c.cpl, 0) / (campaigns.length || 1)).toFixed(0),
        }}
      />

    </div>
  )
}
