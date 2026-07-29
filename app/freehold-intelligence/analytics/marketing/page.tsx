'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BarChart3, ArrowUpRight } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { useSession } from '@/lib/freehold/use-session'
import { prettySource, fmtAed } from '@/lib/freehold/analytics-format'
import { ExpertDepth } from '@/components/freehold/expert-depth'

type Live = { sources: { label: string; count: number }[] } | null

type BreakRow = { key: string; label: string; leads: number; closed: number; convRate: number; hotShare: number; avgBudget: number; score: number }

export default function MarketingAnalyticsPage() {
  const t = useT()
  const { user } = useSession()
  const role = user?.role
  const [live, setLive] = useState<Live>(null)
  const [spend, setSpend] = useState<{ total: number; last30: number } | null>(null)
  const [dim, setDim] = useState<'source' | 'country' | 'agent'>('source')
  const [period, setPeriod] = useState<'7' | '30' | '90'>('30')
  const [rows, setRows] = useState<BreakRow[] | null>(null)

  useEffect(() => {
    fetch('/api/freehold/analytics/leads')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setLive({ sources: d.sources ?? [] }) })
      .catch(() => {})
    fetch('/api/freehold/finance/summary')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && (d.totalSpendAED != null || d.last30dSpendAED != null)) {
          setSpend({ total: Number(d.totalSpendAED ?? 0), last30: Number(d.last30dSpendAED ?? 0) })
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    setRows(null)
    fetch(`/api/freehold/analytics/marketing?dim=${dim}&period=${period}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (Array.isArray(d?.rows)) setRows(d.rows) })
      .catch(() => {})
  }, [dim, period])

  // Per-broker breakdown is management-only (matches the API). Marketing users
  // never see the "By team member" dimension.
  const canSeeAgents = ['admin', 'ceo', 'director'].includes(role ?? '')
  const DIMS: { id: 'source' | 'country' | 'agent'; labelKey: string }[] = [
    { id: 'source', labelKey: 'analytics.mk.byChannel' },
    { id: 'country', labelKey: 'analytics.mk.byCountry' },
    ...(canSeeAgents ? [{ id: 'agent' as const, labelKey: 'analytics.mk.byMember' }] : []),
  ]
  const PERIODS: ('7' | '30' | '90')[] = ['7', '30', '90']

  const channels = live?.sources ?? []
  const maxChannel = Math.max(1, ...channels.map((c) => c.count))

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-100 sm:text-2xl">{t('analytics.tab.marketing')}</h1>
        <p className="mt-1 text-sm text-slate-400">{t('analytics.marketing.sub')}</p>
      </div>

      <ExpertDepth prompts={['expert.depth.marketing.q1', 'expert.depth.marketing.q2', 'expert.depth.marketing.q3']} />

      {/* Live: lead channels + ad spend */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-slate-400">
            {t('analytics.sec.channels')}
            {channels.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-400/90">
                <span className="h-1 w-1 rounded-full bg-emerald-400" /> {t('analytics.live')}
              </span>
            )}
          </div>
          <div className="rounded-xl border border-line bg-white/[0.05] p-5">
            {channels.length > 0 ? (
              <div className="space-y-2.5">
                {channels.map((c) => (
                  <div key={c.label}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-300 truncate">{prettySource(c.label)}</span>
                      <span className="ml-3 shrink-0 text-xs tabular-nums text-slate-400">{c.count.toLocaleString('en-US')}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                      <div className="h-full rounded-full bg-gold" style={{ width: `${(c.count / maxChannel) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-slate-500">{live ? t('analytics.empty.leads') : t('analytics.loading')}</p>
            )}
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-slate-400">
            {t('analytics.kpi.adSpend')}
            {spend && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-400/90">
                <span className="h-1 w-1 rounded-full bg-emerald-400" /> {t('analytics.live')}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-line bg-white/[0.05] p-5">
              <div className="text-xs font-medium uppercase tracking-wider text-slate-400">{t('analytics.kpi.adSpend')}</div>
              <div className="mt-3 text-2xl font-semibold tabular-nums text-slate-100">{spend ? fmtAed(spend.total) : '—'}</div>
              <div className="mt-1 text-xs text-slate-500">{t('analytics.kpi.allTime')}</div>
            </div>
            <div className="rounded-xl border border-line bg-white/[0.05] p-5">
              <div className="text-xs font-medium uppercase tracking-wider text-slate-400">{t('analytics.kpi.spend30d')}</div>
              <div className="mt-3 text-2xl font-semibold tabular-nums text-gold">{spend ? fmtAed(spend.last30) : '—'}</div>
              <div className="mt-1 text-xs text-slate-500">{t('analytics.last30')}</div>
            </div>
          </div>
        </section>
      </div>

      {/* Live breakdown — by channel / country / team member, with period filter */}
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-slate-400">
            {t('analytics.mk.breakdown')}
            {rows && rows.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-400/90">
                <span className="h-1 w-1 rounded-full bg-emerald-400" /> {t('analytics.live')}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              {DIMS.map((d) => (
                <button key={d.id} onClick={() => setDim(d.id)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${dim === d.id ? 'border border-gold/35 bg-gold/10 text-gold' : 'border border-line-strong bg-white/[0.05] text-slate-400 hover:text-slate-200'}`}>
                  {t(d.labelKey)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              {PERIODS.map((p) => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${period === p ? 'border border-violet-400/35 bg-violet-400/10 text-violet-300' : 'border border-line-strong bg-white/[0.05] text-slate-400 hover:text-slate-200'}`}>
                  {t(`analytics.period.${p}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-line bg-white/[0.05]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">{dim === 'country' ? t('analytics.th.country') : dim === 'agent' ? t('analytics.th.agent') : t('analytics.th.source')}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">{t('analytics.th.leads')}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">{t('analytics.th.conversions')}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">{t('analytics.th.convRate')}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">{t('analytics.mk.hotShare')}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">{t('analytics.mk.score')}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">{t('analytics.mk.avgBudget')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.08]">
                {rows && rows.length > 0 ? (
                  rows.map((r) => (
                    <tr key={r.key} className="transition hover:bg-white/[0.04]">
                      <td className="px-4 py-3 font-medium text-slate-200">{dim === 'source' ? prettySource(r.label) : r.label}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-300">{r.leads.toLocaleString('en-US')}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gold">{r.closed.toLocaleString('en-US')}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-300">{r.convRate}%</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-300">{r.hotShare}%</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-300">{r.score}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-400">{r.avgBudget > 0 ? fmtAed(r.avgBudget) : '—'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                      {rows ? t('analytics.empty.leads') : t('analytics.loading')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Web traffic — real numbers require a connected analytics provider.
          No fabricated visitor/pageview data is shown. */}
      <section>
        <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-slate-400">
          {t('analytics.sec.trafficBlock')}
        </div>
        <div className="rounded-xl border border-line bg-white/[0.03] px-6 py-10 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-white/[0.04]">
            <BarChart3 className="h-5 w-5 text-slate-400" />
          </div>
          <div className="text-sm font-medium text-slate-200">{t('analytics.traffic.connectTitle')}</div>
          <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-slate-500">{t('analytics.traffic.connectBody')}</p>
          <Link
            href="/freehold-intelligence/integrations"
            className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/[0.08] px-4 py-2 text-xs font-medium text-gold transition hover:bg-gold/[0.14]"
          >
            {t('analytics.traffic.connectCta')} <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>
    </div>
  )
}
