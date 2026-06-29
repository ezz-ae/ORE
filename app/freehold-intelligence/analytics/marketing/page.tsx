'use client'

import { useEffect, useMemo, useState } from 'react'
import { useT } from '@/lib/i18n/provider'
import { useSession } from '@/lib/freehold/use-session'
import { siteAnalytics } from '@/src/features/freehold-intelligence/analytics'
import { prettySource, fmtAed } from '@/lib/freehold/analytics-format'
import { ExpertDepth } from '@/components/freehold/expert-depth'

type Live = { sources: { label: string; count: number }[] } | null

function formatDuration(seconds: number): string {
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

// Two-series traffic sparkline (sample data).
function SparklineChart({ daily }: { daily: { pageViews: number; uniqueVisitors: number }[] }) {
  const W = 600, H = 110, PAD_B = 4
  const max = Math.max(1, ...daily.map((d) => Math.max(d.pageViews, d.uniqueVisitors)))
  const toX = (i: number) => (daily.length <= 1 ? 0 : (i / (daily.length - 1)) * W)
  const toY = (v: number) => H - PAD_B - (v / max) * (H - PAD_B - 8)
  const pv = daily.map((d, i) => `${toX(i)},${toY(d.pageViews)}`).join(' ')
  const uv = daily.map((d, i) => `${toX(i)},${toY(d.uniqueVisitors)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" style={{ height: 110 }} aria-hidden="true">
      <line x1="0" y1={H - PAD_B} x2={W} y2={H - PAD_B} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      <polyline points={pv} fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={uv} fill="none" stroke="#D4AF37" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function SampleTag({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-400/25 bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-400/80">
      {label}
    </span>
  )
}

type BreakRow = { key: string; label: string; leads: number; closed: number; convRate: number; hotShare: number; avgBudget: number; score: number }

export default function MarketingAnalyticsPage() {
  const t = useT()
  const { user } = useSession()
  const role = user?.role
  const a = siteAnalytics
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
  const totalDeviceSessions = useMemo(() => a.devices.reduce((s, d) => s + d.sessions, 0), [a.devices])

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-100">{t('analytics.tab.marketing')}</h1>
        <p className="mt-1 text-sm text-slate-400">{t('analytics.marketing.sub')}</p>
      </div>

      <ExpertDepth prompts={['expert.depth.marketing.q1', 'expert.depth.marketing.q2', 'expert.depth.marketing.q3']} />

      {/* Live: lead channels + ad spend */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-slate-400">
            {t('analytics.sec.channels')}
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-400/90">
              <span className="h-1 w-1 rounded-full bg-emerald-400" /> {t('analytics.live')}
            </span>
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
                      <div className="h-full rounded-full bg-[#D4AF37]" style={{ width: `${(c.count / maxChannel) * 100}%` }} />
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
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-400/90">
              <span className="h-1 w-1 rounded-full bg-emerald-400" /> {t('analytics.live')}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-line bg-white/[0.05] p-5">
              <div className="text-xs font-medium uppercase tracking-wider text-slate-400">{t('analytics.kpi.adSpend')}</div>
              <div className="mt-3 text-2xl font-semibold tabular-nums text-slate-100">{spend ? fmtAed(spend.total) : '—'}</div>
              <div className="mt-1 text-xs text-slate-500">{t('analytics.kpi.allTime')}</div>
            </div>
            <div className="rounded-xl border border-line bg-white/[0.05] p-5">
              <div className="text-xs font-medium uppercase tracking-wider text-slate-400">{t('analytics.kpi.spend30d')}</div>
              <div className="mt-3 text-2xl font-semibold tabular-nums text-[#D4AF37]">{spend ? fmtAed(spend.last30) : '—'}</div>
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
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-400/90">
              <span className="h-1 w-1 rounded-full bg-emerald-400" /> {t('analytics.live')}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              {DIMS.map((d) => (
                <button key={d.id} onClick={() => setDim(d.id)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${dim === d.id ? 'border border-[#D4AF37]/35 bg-[#D4AF37]/10 text-[#D4AF37]' : 'border border-line-strong bg-white/[0.05] text-slate-400 hover:text-slate-200'}`}>
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
                      <td className="px-4 py-3 text-right tabular-nums text-[#D4AF37]">{r.closed.toLocaleString('en-US')}</td>
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

      {/* Sample web-traffic banner */}
      <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-4 py-3">
        <div className="flex items-center gap-2">
          <SampleTag label={t('analytics.sample')} />
          <span className="text-sm text-slate-300">{t('analytics.sec.trafficBlock')}</span>
        </div>
        <p className="mt-1.5 text-xs text-slate-500">{t('analytics.sampleTraffic')}</p>
      </div>

      {/* Sample KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-line bg-white/[0.05] p-5">
          <div className="flex items-center justify-between"><div className="text-xs font-medium uppercase tracking-wider text-slate-400">{t('analytics.kpi.pageViews')}</div><SampleTag label={t('analytics.sample')} /></div>
          <div className="mt-3 text-2xl font-semibold tabular-nums text-slate-100">{a.totalPageViews.toLocaleString('en-US')}</div>
        </div>
        <div className="rounded-xl border border-line bg-white/[0.05] p-5">
          <div className="flex items-center justify-between"><div className="text-xs font-medium uppercase tracking-wider text-slate-400">{t('analytics.kpi.uniqueVisitors')}</div><SampleTag label={t('analytics.sample')} /></div>
          <div className="mt-3 text-2xl font-semibold tabular-nums text-slate-100">{a.totalUniqueSessions.toLocaleString('en-US')}</div>
        </div>
        <div className="rounded-xl border border-line bg-white/[0.05] p-5">
          <div className="flex items-center justify-between"><div className="text-xs font-medium uppercase tracking-wider text-slate-400">{t('analytics.kpi.avgSession')}</div><SampleTag label={t('analytics.sample')} /></div>
          <div className="mt-3 text-2xl font-semibold tabular-nums text-slate-100">{formatDuration(a.avgSessionDuration)}</div>
        </div>
      </div>

      {/* Sample daily traffic */}
      <section>
        <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-slate-400">{t('analytics.sec.dailyTraffic')} <SampleTag label={t('analytics.sample')} /></div>
        <div className="rounded-xl border border-line bg-white/[0.05] p-5">
          <SparklineChart daily={a.daily} />
          <div className="mt-3 flex items-center gap-5">
            <div className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-white/60" /><span className="text-xs text-slate-400">{t('analytics.kpi.pageViews')}</span></div>
            <div className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: '#D4AF37' }} /><span className="text-xs text-slate-400">{t('analytics.kpi.uniqueVisitors')}</span></div>
          </div>
        </div>
      </section>

      {/* Sample top pages + devices */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-slate-400">{t('analytics.sec.topPages')} <SampleTag label={t('analytics.sample')} /></div>
          <div className="overflow-hidden rounded-xl border border-line bg-white/[0.05]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">{t('analytics.th.page')}</th>
                  <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">{t('analytics.th.views')}</th>
                  <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">{t('analytics.th.bounce')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.08]">
                {a.topPages.slice(0, 6).map((p) => (
                  <tr key={p.path} className="transition hover:bg-white/[0.04]">
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-300">{p.title}</div>
                      <div className="mt-0.5 font-mono text-xs text-slate-500">{p.path}</div>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-300">{p.pageViews.toLocaleString('en-US')}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-400">{Math.round(p.bounceRate * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-slate-400">{t('analytics.sec.devices')} <SampleTag label={t('analytics.sample')} /></div>
          <div className="space-y-3">
            {a.devices.map((d) => {
              const pct = Math.round((d.sessions / totalDeviceSessions) * 100)
              return (
                <div key={d.device} className="rounded-xl border border-line bg-white/[0.05] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wider text-slate-400 capitalize">{d.device}</span>
                    <span className="text-xs font-semibold text-slate-300">{pct}%</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-white/[0.08]">
                    <div className="h-full rounded-full bg-violet-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
