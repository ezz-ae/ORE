'use client'

import { toast } from 'sonner'
import {
  TrendingUp, DollarSign, Target, Sparkles,
  ArrowUpRight, ArrowDownRight, AlertTriangle, CheckCircle2,
} from 'lucide-react'

const PLATFORM_ROI = [
  {
    platform: 'WhatsApp',
    roi: 1200,
    leads: 148,
    deals: 18,
    revenue: 1680000,
    spend: 130000,
    cac: 7222,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/25',
    barColor: '#10b981',
    trend: '+14%',
    positive: true,
  },
  {
    platform: 'Meta (Facebook/Instagram)',
    roi: 840,
    leads: 312,
    deals: 24,
    revenue: 2520000,
    spend: 270000,
    cac: 11250,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/25',
    barColor: '#3b82f6',
    trend: '+8%',
    positive: true,
  },
  {
    platform: 'Google Ads',
    roi: 620,
    leads: 224,
    deals: 16,
    revenue: 1440000,
    spend: 210000,
    cac: 13125,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/25',
    barColor: '#f59e0b',
    trend: '-5%',
    positive: false,
  },
  {
    platform: 'Email Marketing',
    roi: 480,
    leads: 89,
    deals: 7,
    revenue: 630000,
    spend: 112000,
    cac: 16000,
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/25',
    barColor: '#8b5cf6',
    trend: '+2%',
    positive: true,
  },
]

const TOP_CAMPAIGNS = [
  { name: 'WhatsApp Broadcast — Palm Jumeirah Villas',     platform: 'WhatsApp', roi: 2400, spend: 8000,   revenue: 200000, leads: 42, deals: 4 },
  { name: 'Meta Lead Gen — Dubai Hills Homes Q2',          platform: 'Meta',     roi: 1850, spend: 12000,  revenue: 234000, leads: 68, deals: 5 },
  { name: 'WhatsApp Re-engagement — Warm Leads Pool',      platform: 'WhatsApp', roi: 1620, spend: 6500,   revenue: 112000, leads: 31, deals: 3 },
  { name: 'Google Search — "Buy Apartment Dubai"',         platform: 'Google',   roi: 1380, spend: 18000,  revenue: 266400, leads: 54, deals: 6 },
  { name: 'Meta Retargeting — Website Visitors June',      platform: 'Meta',     roi: 1100, spend: 9500,   revenue: 114000, leads: 38, deals: 3 },
]

const CAC_TREND = [
  { month: 'Jan 2026', meta: 14200, google: 16800, whatsapp: 8900,  email: 19200 },
  { month: 'Feb 2026', meta: 13600, google: 15900, whatsapp: 8400,  email: 18700 },
  { month: 'Mar 2026', meta: 12900, google: 15200, whatsapp: 7800,  email: 17900 },
  { month: 'Apr 2026', meta: 12100, google: 14600, whatsapp: 7500,  email: 17400 },
  { month: 'May 2026', meta: 11600, google: 14000, whatsapp: 7300,  email: 16800 },
  { month: 'Jun 2026', meta: 11250, google: 13125, whatsapp: 7222,  email: 16000 },
]

const PLATFORM_BADGE: Record<string, string> = {
  WhatsApp: 'bg-emerald-500/15 text-emerald-400',
  Meta:     'bg-blue-500/15 text-blue-400',
  Google:   'bg-amber-500/15 text-amber-400',
  Email:    'bg-violet-500/15 text-violet-400',
}

function fmtAED(n: number) {
  if (n >= 1000000) return `AED ${(n / 1000000).toFixed(2)}M`
  if (n >= 1000)    return `AED ${(n / 1000).toFixed(0)}K`
  return `AED ${n.toLocaleString()}`
}

function downloadCsv(filename: string, rows: string) {
  const blob = new Blob([rows], { type: 'text/csv' })
  const url = URL.createObjectURL(blob); const a = document.createElement('a')
  a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url)
  toast.success(filename + ' downloaded')
}

export default function ROIPage() {
  const totalRevenue  = PLATFORM_ROI.reduce((s, p) => s + p.revenue, 0)
  const totalSpend    = PLATFORM_ROI.reduce((s, p) => s + p.spend, 0)
  const totalLeads    = PLATFORM_ROI.reduce((s, p) => s + p.leads, 0)
  const totalDeals    = PLATFORM_ROI.reduce((s, p) => s + p.deals, 0)
  const overallROI    = Math.round(((totalRevenue - totalSpend) / totalSpend) * 100)
  const maxROI        = Math.max(...PLATFORM_ROI.map(p => p.roi))

  return (
    <div className="min-h-screen pb-16 bg-[#0D1117]">
      {/* Header */}
      <div className="border-b border-slate-800 bg-[#090C12]/80 px-6 py-5 backdrop-blur-xl sticky top-0 z-30">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-white">ROI Dashboard</h1>
            <p className="mt-0.5 text-sm text-slate-500">Marketing return on investment · June 2026</p>
          </div>
          <button
            onClick={() => {
              const header = 'Channel,Leads,Deals,Revenue (AED),Ad Spend (AED),ROI %,CAC (AED)'
              const lines = PLATFORM_ROI.map(p =>
                [`"${p.platform}"`, p.leads, p.deals, p.revenue, p.spend, p.roi, p.cac].join(',')
              )
              downloadCsv('roi-report-jun-2026.csv', [header, ...lines].join('\n'))
            }}
            className="rounded-lg border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-1.5 text-sm font-medium text-[#D4AF37] hover:bg-[#D4AF37]/20 transition-colors">
            Export Report
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 pt-6 space-y-6">

        {/* Hero — Overall ROI + Quick Stats */}
        <div className="grid gap-4 xl:grid-cols-4">

          {/* Overall ROI — Hero Card */}
          <div className="xl:col-span-1 rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/[0.04] p-6 flex flex-col items-center justify-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/15 mb-4">
              <TrendingUp className="h-6 w-6 text-[#D4AF37]" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">Overall Marketing ROI</p>
            <p className="text-6xl font-bold text-[#D4AF37] tabular-nums tracking-tight">{overallROI}%</p>
            <p className="mt-2 text-sm text-slate-400">
              {fmtAED(totalRevenue)} revenue on {fmtAED(totalSpend)} spend
            </p>
            <div className="mt-4 flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1">
              <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-xs font-medium text-emerald-400">+12% vs last month</span>
            </div>
          </div>

          {/* Summary stats */}
          <div className="xl:col-span-3 grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { label: 'Total Ad Spend',   value: fmtAED(totalSpend),   icon: DollarSign,  color: 'text-slate-400', sub: 'Across all platforms' },
              { label: 'Total Revenue',    value: fmtAED(totalRevenue), icon: TrendingUp,  color: 'text-emerald-400', sub: 'Attributed to ads' },
              { label: 'Total Leads',      value: totalLeads.toString(), icon: Target,      color: 'text-sky-400',    sub: 'From paid channels' },
              { label: 'Closed Deals',     value: totalDeals.toString(), icon: CheckCircle2, color: 'text-violet-400', sub: `Avg ${fmtAED(Math.round(totalRevenue / totalDeals))} / deal` },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <s.icon className={['h-4 w-4', s.color].join(' ')} />
                  <p className="text-xs text-slate-500">{s.label}</p>
                </div>
                <p className={['text-2xl font-bold tabular-nums tracking-tight', s.color].join(' ')}>{s.value}</p>
                <p className="mt-1 text-xs text-slate-600">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* AI ROI Insight */}
        <div className="rounded-xl border border-[#D4AF37]/20 bg-[#D4AF37]/[0.03] px-5 py-4 flex items-start gap-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#D4AF37]/25 bg-[#D4AF37]/10">
            <Sparkles className="h-4.5 w-4.5 text-[#D4AF37]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white mb-0.5">AI ROI Insight</p>
            <p className="text-sm text-slate-300 leading-relaxed">
              WhatsApp has your highest ROI at <span className="text-emerald-400 font-semibold">1,200%</span> — significantly outperforming all other channels.
              Consider increasing its monthly budget by <span className="text-[#D4AF37] font-semibold">AED 2,000/month</span> and reallocating funds
              from Email Marketing (ROI: 480%) to capture more high-intent leads.
              Google Ads CTR dropped 5% MoM — review keyword targeting and pause underperforming ad groups.
            </p>
          </div>
        </div>

        {/* Platform ROI Comparison */}
        <div className="rounded-xl border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 px-5 py-4">
            <h2 className="text-sm font-semibold text-white">Platform ROI Comparison</h2>
            <p className="text-xs text-slate-500 mt-0.5">Revenue, spend, CAC and ROI per channel</p>
          </div>
          <div className="p-5 space-y-4">
            {PLATFORM_ROI.sort((a, b) => b.roi - a.roi).map((p) => (
              <div key={p.platform} className={['rounded-xl border p-4', p.bgColor, p.borderColor].join(' ')}>
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-slate-100">{p.platform}</p>
                      <span className={[
                        'flex items-center gap-0.5 text-xs font-medium',
                        p.positive ? 'text-emerald-400' : 'text-red-400',
                      ].join(' ')}>
                        {p.positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {p.trend} MoM
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {p.leads} leads · {p.deals} deals · CAC {fmtAED(p.cac)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={['text-3xl font-bold tabular-nums', p.color].join(' ')}>{p.roi}%</p>
                    <p className="text-xs text-slate-500">ROI</p>
                  </div>
                </div>
                {/* ROI bar */}
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${(p.roi / maxROI) * 100}%`,
                      background: p.barColor,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-slate-500">Spend: {fmtAED(p.spend)}</span>
                  <span className="text-xs font-medium text-slate-300">Revenue: {fmtAED(p.revenue)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue Attribution Table */}
        <div className="rounded-xl border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 px-5 py-4">
            <h2 className="text-sm font-semibold text-white">Revenue Attribution</h2>
            <p className="text-xs text-slate-500 mt-0.5">Channel breakdown — leads, deals, revenue, ROI</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-800/40">
                  {['Channel', 'Leads', 'Deals', 'Revenue', 'Ad Spend', 'ROI %', 'Cost per Lead', 'CAC'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {PLATFORM_ROI.sort((a, b) => b.roi - a.roi).map((p) => (
                  <tr key={p.platform} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className={['rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap', p.bgColor, p.color].join(' ')}>
                        {p.platform}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300 tabular-nums">{p.leads}</td>
                    <td className="px-4 py-3 text-sm text-slate-300 tabular-nums">{p.deals}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-white tabular-nums whitespace-nowrap">{fmtAED(p.revenue)}</td>
                    <td className="px-4 py-3 text-sm text-slate-400 tabular-nums whitespace-nowrap">{fmtAED(p.spend)}</td>
                    <td className="px-4 py-3">
                      <span className={['text-sm font-bold tabular-nums', p.color].join(' ')}>{p.roi}%</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400 tabular-nums whitespace-nowrap">
                      AED {Math.round(p.spend / p.leads).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400 tabular-nums whitespace-nowrap">
                      AED {p.cac.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-700 bg-slate-800/40">
                  <td className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Total / Avg</td>
                  <td className="px-4 py-3 text-sm font-bold text-slate-300 tabular-nums">{totalLeads}</td>
                  <td className="px-4 py-3 text-sm font-bold text-slate-300 tabular-nums">{totalDeals}</td>
                  <td className="px-4 py-3 text-sm font-bold text-white tabular-nums">{fmtAED(totalRevenue)}</td>
                  <td className="px-4 py-3 text-sm font-bold text-slate-300 tabular-nums">{fmtAED(totalSpend)}</td>
                  <td className="px-4 py-3 text-sm font-bold text-[#D4AF37] tabular-nums">{overallROI}%</td>
                  <td className="px-4 py-3 text-sm text-slate-400 tabular-nums whitespace-nowrap">
                    AED {Math.round(totalSpend / totalLeads).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400 tabular-nums whitespace-nowrap">
                    AED {Math.round(totalSpend / totalDeals).toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">

          {/* Top Performing Campaigns */}
          <div className="rounded-xl border border-slate-800 bg-slate-900">
            <div className="border-b border-slate-800 px-5 py-4">
              <h2 className="text-sm font-semibold text-white">Top 5 Campaigns by ROI</h2>
              <p className="text-xs text-slate-500 mt-0.5">Best performing campaigns — June 2026</p>
            </div>
            <div className="divide-y divide-slate-800">
              {TOP_CAMPAIGNS.map((c, idx) => (
                <div key={c.name} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className={[
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                      idx === 0 ? 'bg-[#D4AF37]/20 text-[#D4AF37]' :
                      idx === 1 ? 'bg-slate-600 text-slate-200' :
                      idx === 2 ? 'bg-orange-500/20 text-orange-400' :
                      'bg-slate-800 text-slate-500',
                    ].join(' ')}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-100 leading-snug mb-1">{c.name}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={['rounded-full px-2 py-0.5 text-xs font-medium', PLATFORM_BADGE[c.platform] ?? 'bg-slate-700 text-slate-300'].join(' ')}>
                          {c.platform}
                        </span>
                        <span className="text-xs text-slate-500">{c.leads} leads · {c.deals} deals</span>
                        <span className="text-xs text-slate-500">Spend: {fmtAED(c.spend)}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-emerald-400 tabular-nums">{c.roi}%</p>
                      <p className="text-xs text-slate-500">ROI</p>
                    </div>
                  </div>
                  {/* ROI mini bar */}
                  <div className="mt-2.5 ml-10 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${(c.roi / TOP_CAMPAIGNS[0].roi) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CAC Trend Table */}
          <div className="rounded-xl border border-slate-800 bg-slate-900">
            <div className="border-b border-slate-800 px-5 py-4">
              <h2 className="text-sm font-semibold text-white">Cost per Acquisition Trend</h2>
              <p className="text-xs text-slate-500 mt-0.5">CAC per platform — last 6 months (AED)</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-800/40">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Month</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-blue-400/70">Meta</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-amber-400/70">Google</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-emerald-400/70">WhatsApp</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-violet-400/70">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {CAC_TREND.map((row, idx) => {
                    const isCurrent = idx === CAC_TREND.length - 1
                    return (
                      <tr key={row.month} className={isCurrent ? 'bg-[#D4AF37]/5' : 'hover:bg-slate-800/30'}>
                        <td className="px-4 py-2.5 text-sm text-slate-300 font-medium">
                          {row.month}
                          {isCurrent && <span className="ml-2 text-xs text-[#D4AF37]">Current</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right text-sm text-blue-400 tabular-nums font-medium">
                          {row.meta.toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-right text-sm text-amber-400 tabular-nums font-medium">
                          {row.google.toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-right text-sm text-emerald-400 tabular-nums font-medium">
                          {row.whatsapp.toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-right text-sm text-violet-400 tabular-nums font-medium">
                          {row.email.toLocaleString()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-700 bg-slate-800/40">
                    <td className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500">6M Trend</td>
                    <td className="px-4 py-2.5 text-right text-xs text-emerald-400 font-semibold">↓ 20.8%</td>
                    <td className="px-4 py-2.5 text-right text-xs text-emerald-400 font-semibold">↓ 21.9%</td>
                    <td className="px-4 py-2.5 text-right text-xs text-emerald-400 font-semibold">↓ 18.9%</td>
                    <td className="px-4 py-2.5 text-right text-xs text-emerald-400 font-semibold">↓ 16.7%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="px-5 py-4 border-t border-slate-800 rounded-b-xl bg-emerald-500/[0.03]">
              <div className="flex items-start gap-2">
                <ArrowDownRight className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                <p className="text-xs text-slate-400 leading-relaxed">
                  All platform CAC costs are <span className="text-emerald-400 font-semibold">consistently declining</span> — your targeting efficiency is improving.
                  WhatsApp maintains the lowest CAC at AED 7,222, making it the most cost-efficient acquisition channel.
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
