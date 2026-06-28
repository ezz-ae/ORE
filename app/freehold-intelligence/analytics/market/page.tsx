'use client'

import { useEffect, useState } from 'react'
import { Building2, MapPin, TrendingUp, Hammer } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { ExpertDepth } from '@/components/freehold/expert-depth'

type MarketAreaStat = { name: string; pricePerSqft: number | null; rentalYield: number | null }
type MarketStats = {
  liveProjects: number | null
  areasCovered: number | null
  avgYield: number | null
  developersTracked: number | null
  topAreas: MarketAreaStat[]
} | null

function MetricCard({ Icon, label, value }: { Icon: typeof Building2; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-800/50 p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</div>
        <Icon className="h-4 w-4 text-violet-400/70" />
      </div>
      <div className="mt-3 text-2xl font-semibold tabular-nums text-slate-100">{value}</div>
    </div>
  )
}

export default function MarketAnalyticsPage() {
  const t = useT()
  const [stats, setStats] = useState<MarketStats>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/freehold/analytics/market')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setStats(d?.stats ?? null); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [])

  const num = (v: number | null | undefined, suffix = '') => (v != null ? `${v.toLocaleString('en-US')}${suffix}` : '—')

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-100">{t('analytics.tab.market')}</h1>
        <p className="mt-1 text-sm text-slate-400">{t('analytics.market.sub')}</p>
      </div>

      <ExpertDepth prompts={['expert.depth.market.q1', 'expert.depth.market.q2', 'expert.depth.market.q3']} />

      {/* Live market overview from the public catalogue */}
      <section>
        <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-slate-400">
          {t('analytics.sec.marketOverview')}
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-400/90">
            <span className="h-1 w-1 rounded-full bg-emerald-400" /> {t('analytics.live')}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard Icon={Building2} label={t('analytics.metric.projects')} value={num(stats?.liveProjects)} />
          <MetricCard Icon={MapPin} label={t('analytics.metric.areas')} value={num(stats?.areasCovered)} />
          <MetricCard Icon={TrendingUp} label={t('analytics.metric.avgYield')} value={num(stats?.avgYield, '%')} />
          <MetricCard Icon={Hammer} label={t('analytics.metric.developers')} value={num(stats?.developersTracked)} />
        </div>
      </section>

      {/* Top areas by coverage (live) */}
      <section>
        <div className="mb-4 text-xs font-medium uppercase tracking-widest text-slate-400">{t('analytics.sec.topAreas')}</div>
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-800/50">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-slate-500">{t('analytics.th.area')}</th>
                  <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-slate-500">{t('analytics.th.price')}</th>
                  <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-slate-500">{t('analytics.th.yield')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {stats && stats.topAreas.length > 0 ? (
                  stats.topAreas.map((area) => (
                    <tr key={area.name} className="transition hover:bg-slate-800/40">
                      <td className="px-5 py-4 font-medium text-slate-300">{area.name}</td>
                      <td className="px-5 py-4 text-right tabular-nums text-slate-300">
                        {area.pricePerSqft != null ? `AED ${area.pricePerSqft.toLocaleString('en-US')}` : '—'}
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums text-[#D4AF37]">
                        {area.rentalYield != null ? `${area.rentalYield}%` : '—'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-5 py-8 text-center text-sm text-slate-500">
                      {loaded ? t('analytics.empty.market') : t('analytics.loading')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}
