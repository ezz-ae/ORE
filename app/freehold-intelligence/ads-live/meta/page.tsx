'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowUpRight, CheckCircle2, Plus, Palette, ChevronDown, ChevronUp, Loader2, PlugZap, Copy } from 'lucide-react'
import { ExpertDepth } from '@/components/freehold/expert-depth'
import { useT } from '@/lib/i18n/provider'
import type { MetaCampaign, MetaInsights } from '@/lib/meta/types'
import { metaLeadCount } from '@/lib/meta/lead-count'

const META_BLUE = '#1877F2'

// One truthful source: /api/meta/campaigns. When the company ad account is
// connected it returns the REAL campaigns + insights; when it isn't, it
// returns in-app sandbox campaigns flagged `demo: true` — and this page then
// says "Not connected" (never a fake Connected badge).

interface Row {
  id: string
  name: string
  active: boolean
  objective: string
  dailyBudget: number // AED
  spend: number
  impressions: number
  clicks: number
  leads: number
  cpl: number
}

function leadsFrom(insights: MetaInsights | null | undefined): number {
  return metaLeadCount(insights?.actions)
}

function toRow(c: MetaCampaign & { insights?: MetaInsights | null }): Row {
  const spend = Number(c.insights?.spend) || 0
  const impressions = Number(c.insights?.impressions) || 0
  const clicks = Number(c.insights?.clicks) || 0
  const leads = leadsFrom(c.insights)
  return {
    id: c.id,
    name: c.name,
    active: c.status === 'ACTIVE',
    objective: c.objective ?? '',
    dailyBudget: c.daily_budget ? Math.round(Number(c.daily_budget) / 100) : 0,
    spend,
    impressions,
    clicks,
    leads,
    cpl: leads > 0 ? Math.round((spend / leads) * 10) / 10 : 0,
  }
}

type StatusFilter = 'All' | 'Active' | 'Paused'
type SortCol = 'spend' | 'leads' | 'cpl' | 'impressions'

const fmtAED = (n: number) => `AED ${n.toLocaleString()}`

export default function MetaAdsPage() {
  const t = useT()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')
  const [sortCol, setSortCol] = useState<SortCol>('leads')
  const [sortAsc, setSortAsc] = useState(false)

  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const [rows, setRows] = useState<Row[]>([])
  const [account, setAccount] = useState<{ adAccountId: string; pageId: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/meta/campaigns', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return
        setConnected(!d.demo && Array.isArray(d.campaigns))
        if (Array.isArray(d.campaigns)) setRows(d.campaigns.map(toRow))
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    // Real ad-account identifiers for the card (management/marketing only —
    // fails soft to the generic label for other roles).
    fetch('/api/freehold/integrations/meta/credentials')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.configured) setAccount({ adAccountId: d.adAccountId, pageId: d.pageId })
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const totals = useMemo(() => {
    const spend = rows.reduce((s, r) => s + r.spend, 0)
    const impressions = rows.reduce((s, r) => s + r.impressions, 0)
    const clicks = rows.reduce((s, r) => s + r.clicks, 0)
    const leads = rows.reduce((s, r) => s + r.leads, 0)
    return {
      spend, impressions, clicks, leads,
      cpl: leads > 0 ? Math.round((spend / leads) * 10) / 10 : 0,
      ctr: impressions > 0 ? Math.round((clicks / impressions) * 1000) / 10 : 0,
    }
  }, [rows])

  const visibleCampaigns = useMemo(() => {
    const filtered = statusFilter === 'All' ? rows : rows.filter((c) => (statusFilter === 'Active' ? c.active : !c.active))
    return [...filtered].sort((a, b) => {
      const diff = a[sortCol] - b[sortCol]
      return sortAsc ? diff : -diff
    })
  }, [rows, statusFilter, sortCol, sortAsc])

  function handleSort(col: SortCol) {
    if (sortCol === col) setSortAsc((v) => !v)
    else { setSortCol(col); setSortAsc(false) }
  }

  // Plain-text dump of one campaign's live numbers — meant to be pasted
  // straight into an AI conversation (this app's Expert, or any other tool).
  function copyCampaignInfo(r: Row) {
    const lines = [
      `Meta Ads Campaign — ${r.name}`,
      `ID: ${r.id}`,
      `Status: ${r.active ? t('lm.meta.status.active') : t('lm.meta.status.paused')}`,
      r.objective ? `Objective: ${r.objective.replace(/_/g, ' ')}` : null,
      `Daily budget: ${r.dailyBudget > 0 ? `AED ${r.dailyBudget}/day` : '—'}`,
      `Spend: ${r.spend > 0 ? fmtAED(r.spend) : '—'}`,
      `Impressions: ${r.impressions > 0 ? r.impressions.toLocaleString() : '—'}`,
      `Clicks: ${r.clicks > 0 ? r.clicks.toLocaleString() : '—'}`,
      `Leads: ${r.leads > 0 ? r.leads : '—'}`,
      `Cost per lead: ${r.cpl > 0 ? fmtAED(r.cpl) : '—'}`,
    ].filter((l): l is string => !!l).join('\n')
    navigator.clipboard?.writeText(lines)
    toast.success(t('lm.meta.copyOk'))
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
            {t('lm.meta.title')}
          </h1>
        </section>

        <div className="mt-7 flex flex-col items-end gap-2 sm:mt-10">
          {/* Connection badge — REAL status, same truth as the Integrations page */}
          {loading ? (
            <span className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm text-slate-400">
              <Loader2 className="h-3 w-3 animate-spin" /> {t('lm.meta.checking')}
            </span>
          ) : connected ? (
            <span className="flex items-center gap-1.5 rounded-full border border-gold/25 bg-gold/[0.08] px-3 py-1.5 text-sm font-medium text-gold">
              <CheckCircle2 className="h-3 w-3" />
              {t('lm.meta.connected')}
            </span>
          ) : (
            <Link
              href="/freehold-intelligence/integrations/meta"
              className="flex items-center gap-1.5 rounded-full border border-line-strong bg-surface-2 px-3 py-1.5 text-sm font-medium text-slate-300 transition hover:border-gold/40 hover:text-white"
            >
              <PlugZap className="h-3.5 w-3.5 text-gold" />
              {t('lm.meta.connectCta')}
            </Link>
          )}
          {connected && (
            <button onClick={() => { window.open('https://business.facebook.com/adsmanager', '_blank'); toast.info(t('lm.meta.openingManager')) }} className="inline-flex items-center gap-1 text-xs text-slate-500 transition hover:text-slate-300">
              {t('lm.meta.manageInMeta')} <ArrowUpRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Account status — only shown when the ad account is really connected */}
      {connected && (
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
            <div className="text-sm font-semibold text-white">
              {account ? account.adAccountId : t('lm.meta.accountDesc')}
            </div>
            {account && (
              <div className="text-sm text-slate-400">{t('lm.meta.pageLabel')} {account.pageId}</div>
            )}
          </div>
        </div>
      )}

      {/* Not connected — say so plainly and route to the connect flow */}
      {!loading && !connected && (
        <div className="mt-6 rounded-2xl border border-line bg-surface-2 px-5 py-5">
          <div className="text-sm font-semibold text-white">{t('lm.meta.notConnectedTitle')}</div>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-400">{t('lm.meta.notConnectedBody')}</p>
          <Link
            href="/freehold-intelligence/integrations/meta"
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-ink transition hover:opacity-90"
          >
            <PlugZap className="h-4 w-4" /> {t('lm.meta.connectCta')}
          </Link>
        </div>
      )}

      {/* KPI row — computed from the live campaign insights */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: t('lm.meta.kpi.spend'),       value: totals.spend > 0 ? fmtAED(totals.spend) : '—' },
          { label: t('lm.meta.col.clicks'),       value: totals.clicks > 0 ? totals.clicks.toLocaleString() : '—' },
          { label: t('lm.meta.kpi.impressions'),  value: totals.impressions > 0 ? totals.impressions.toLocaleString() : '—' },
          { label: t('lm.meta.kpi.leads'),        value: totals.leads > 0 ? String(totals.leads) : '—', color: totals.leads > 0 ? 'text-gold' : undefined },
          { label: t('lm.meta.kpi.cpl'),          value: totals.cpl > 0 ? fmtAED(totals.cpl) : '—' },
          { label: t('lm.meta.kpi.ctr'),          value: totals.ctr > 0 ? `${totals.ctr}%` : '—' },
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
        {loading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface-2 px-5 py-6 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> {t('lm.meta.loading')}
          </div>
        ) : visibleCampaigns.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface-2 px-5 py-6 text-sm text-slate-400">
            {t('lm.meta.noCampaigns')}{' '}
            <Link href="/freehold-intelligence/lead-machine/campaigns/new" className="font-semibold text-gold hover:opacity-80">
              {t('lm.meta.createCampaign')}
            </Link>
          </div>
        ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[700px] overflow-hidden rounded-2xl border border-line bg-surface-2">
            {/* Table header */}
            <div className="grid grid-cols-[2fr_80px_100px_80px_90px_70px_60px_70px_32px] gap-4 border-b border-line px-5 py-3">
              {[
                { label: t('lm.meta.col.campaign'),    col: null },
                { label: t('lm.meta.col.status'),      col: null },
                { label: t('lm.meta.col.dailyBudget'), col: null },
                { label: t('lm.meta.col.spend'),       col: 'spend' as SortCol },
                { label: t('lm.meta.col.impressions'), col: 'impressions' as SortCol },
                { label: t('lm.meta.col.clicks'),      col: null },
                { label: t('lm.meta.col.leads'),       col: 'leads' as SortCol },
                { label: t('lm.meta.col.cpl'),         col: 'cpl' as SortCol },
                { label: '',                           col: null },
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
                <Link
                  key={c.id}
                  href={`/freehold-intelligence/ads-live/meta/${c.id}`}
                  className="grid grid-cols-[2fr_80px_100px_80px_90px_70px_60px_70px_32px] gap-4 items-center px-5 py-4 transition hover:bg-white/[0.03]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${c.active ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                    <span className="truncate text-sm font-semibold text-slate-100">{c.name}</span>
                  </div>
                  <div>
                    <span className="rounded-full border border-gold/20 bg-gold/10 px-2 py-0.5 text-xs font-medium text-gold">
                      {c.active ? t('lm.meta.status.active') : t('lm.meta.status.paused')}
                    </span>
                  </div>
                  <div className="text-xs text-slate-300">
                    {c.dailyBudget > 0 ? `AED ${c.dailyBudget}/d` : '—'}
                  </div>
                  <div className="text-xs text-slate-300">
                    {c.spend > 0 ? fmtAED(c.spend) : '—'}
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
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); copyCampaignInfo(c) }}
                    aria-label={t('lm.meta.copyRow')}
                    title={t('lm.meta.copyRow')}
                    className="grid h-7 w-7 place-items-center justify-self-end rounded-lg border border-line-strong text-slate-500 transition hover:border-gold/30 hover:text-gold"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </Link>
              ))}
            </div>
          </div>
        </div>
        )}
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

      {/* Ask the single docked Expert — no separate conversation */}
      <ExpertDepth prompts={['expert.depth.ads.q1', 'expert.depth.ads.q2', 'expert.depth.ads.q3', 'expert.depth.ads.q4']} />

    </div>
  )
}
