'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  TrendingUp, DollarSign, Target, Sparkles, CheckCircle2, Loader2,
} from 'lucide-react'
import { StatCard, Section, Panel, PanelHeader } from '@/components/freehold/ui'
import { useT } from '@/lib/i18n/provider'

interface Analytics {
  totals: { totalSalesAed: number; totalCommissionAed: number; netCommissionAed: number; approvedDeals: number }
  ytd: { salesAed: number; commissionAed: number; deals: number; leads: number; costPerLeadAed: number }
  monthlyDeals: { month: string; sales: number; commission: number; deals: number }[]
  leadsBySource: { source: string; leads: number; closed: number; conversionPct: number }[]
  expensesByCategory: Record<string, number>
  conversion: { totalLeads: number; closedDeals: number; conversionPct: number }
}

function fmtAED(n: number) {
  if (!n || n <= 0) return 'AED 0'
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `AED ${(n / 1_000).toFixed(0)}K`
  return `AED ${Math.round(n).toLocaleString()}`
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob); const a = document.createElement('a')
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
}

export default function ROIPage() {
  const t = useT()
  const [a, setA] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/freehold/management/analytics', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setA(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const adSpend = a?.expensesByCategory?.ad_spend || 0
  const totalExpenses = a ? Object.values(a.expensesByCategory).reduce((s, v) => s + (v || 0), 0) : 0
  const commission = a?.totals.totalCommissionAed || 0
  const netCommission = a?.totals.netCommissionAed || 0
  const overallROI = adSpend > 0 ? Math.round(((commission - adSpend) / adSpend) * 100) : null
  const maxSourceLeads = a && a.leadsBySource.length ? Math.max(...a.leadsBySource.map((s) => s.leads)) : 1
  const maxMonthly = a && a.monthlyDeals.length ? Math.max(...a.monthlyDeals.map((m) => m.commission), 1) : 1

  return (
    <div className="min-h-screen pb-16 bg-ink">
      <div className="border-b border-line bg-app/80 px-6 py-5 backdrop-blur-xl sticky top-0 z-30">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-white">{t('mgmt.roi.title')}</h1>
            <p className="mt-0.5 text-sm text-slate-500">{t('mgmt.roi.subtitle')}</p>
          </div>
          <button
            onClick={() => {
              if (!a) return
              const rows: (string | number)[][] = [['Source', 'Leads', 'Closed', 'Conversion %']]
              a.leadsBySource.forEach((s) => rows.push([s.source, s.leads, s.closed, s.conversionPct]))
              downloadCsv('attribution-report.csv', rows)
              toast.success(t('mgmt.roi.csvDownloaded', { filename: 'attribution-report.csv' }))
            }}
            className="rounded-lg border border-gold/30 bg-gold/10 px-4 py-1.5 text-sm font-medium text-gold hover:bg-gold/20 transition-colors disabled:opacity-50"
            disabled={!a}
          >
            {t('mgmt.roi.exportReport')}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 pt-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-500"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : !a ? (
          <div className="py-20 text-center text-sm text-slate-500">{t('mgmt.roi.noAnalytics')}</div>
        ) : (
        <>
          {/* Hero */}
          <div className="grid gap-4 xl:grid-cols-4">
            <div className="xl:col-span-1 rounded-xl border border-gold/25 bg-gold/[0.04] p-6 flex flex-col items-center justify-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-gold/30 bg-gold/15 mb-4">
                <TrendingUp className="h-6 w-6 text-gold" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">{t('mgmt.roi.commissionRoi')}</p>
              <p className="text-5xl font-bold text-gold tabular-nums tracking-tight">{overallROI !== null ? `${overallROI}%` : '—'}</p>
              <p className="mt-2 text-sm text-slate-400">
                {t('mgmt.roi.heroLine', { commission: fmtAED(commission), adSpend: fmtAED(adSpend) })}
              </p>
              {overallROI === null && <p className="mt-2 text-xs text-slate-600">{t('mgmt.roi.logAdSpend')}</p>}
            </div>

            <div className="xl:col-span-3 grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatCard label={t('mgmt.roi.totalAdSpend')} value={fmtAED(adSpend)} Icon={DollarSign} hint={t('mgmt.roi.fromLedger')} />
              <StatCard label={t('mgmt.roi.grossCommission')} value={fmtAED(commission)} Icon={TrendingUp} hint={t('mgmt.roi.approvedDeals')} />
              <StatCard label={t('mgmt.roi.totalLeads')} value={a.conversion.totalLeads} Icon={Target} hint={t('mgmt.roi.conversionHint', { pct: a.conversion.conversionPct })} />
              <StatCard label={t('mgmt.roi.closedDeals')} value={a.conversion.closedDeals} Icon={CheckCircle2} hint={a.conversion.closedDeals > 0 ? t('mgmt.roi.avgPerDeal', { amount: fmtAED(commission / a.conversion.closedDeals) }) : undefined} />
            </div>
          </div>

          {/* AI insight */}
          {a.leadsBySource.length > 0 && (
            <div className="rounded-xl border border-gold/20 bg-gold/[0.03] px-5 py-4 flex items-start gap-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gold/25 bg-gold/10">
                <Sparkles className="h-[18px] w-[18px] text-gold" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white mb-0.5">{t('mgmt.roi.attributionInsight')}</p>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {(() => {
                    const top = [...a.leadsBySource].sort((x, y) => y.conversionPct - x.conversionPct)[0]
                    const vol = [...a.leadsBySource].sort((x, y) => y.leads - x.leads)[0]
                    return t('mgmt.roi.insightBody', { top: top.source, topPct: top.conversionPct, vol: vol.source, volLeads: vol.leads, net: fmtAED(netCommission), spend: fmtAED(totalExpenses) })
                  })()}
                </p>
              </div>
            </div>
          )}

          {/* Source attribution */}
          <Panel>
            <PanelHeader title={t('mgmt.roi.sourceAttribution')} action={<span className="text-xs text-slate-500">{t('mgmt.roi.sourceAttrHint')}</span>} />
            <div className="p-5 space-y-3">
              {a.leadsBySource.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">{t('mgmt.roi.noLeadsRecorded')}</p>
              ) : a.leadsBySource.map((s) => (
                <div key={s.source} className="rounded-xl border border-line bg-surface-2/40 p-4">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-100 capitalize">{s.source}</p>
                      <p className="text-xs text-slate-500">{t('mgmt.roi.leadsClosedLine', { leads: s.leads, closed: s.closed })}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-2xl font-bold tabular-nums text-gold">{s.conversionPct}%</p>
                      <p className="text-xs text-slate-500">{t('mgmt.roi.conversion')}</p>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-surface-2 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gold/70 transition-all duration-700" style={{ width: `${(s.leads / maxSourceLeads) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          {/* Monthly deal performance */}
          <Panel>
            <PanelHeader title={t('mgmt.roi.monthlyPerf')} action={<span className="text-xs text-slate-500">{t('mgmt.roi.monthlyPerfHint')}</span>} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-2">
                    {[['mgmt.roi.col.month', 'm'], ['mgmt.roi.col.deals', 'd'], ['mgmt.roi.col.salesValue', 's'], ['mgmt.roi.col.commission', 'c'], ['', 'e']].map(([h, k]) => (
                      <th key={k} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">{h ? t(h) : ''}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {a.monthlyDeals.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">{t('mgmt.roi.noClosed6mo')}</td></tr>
                  ) : a.monthlyDeals.map((m) => (
                    <tr key={m.month} className="hover:bg-surface-2">
                      <td className="px-4 py-3 text-sm font-medium text-slate-200">{m.month}</td>
                      <td className="px-4 py-3 text-sm text-slate-300 tabular-nums">{m.deals}</td>
                      <td className="px-4 py-3 text-sm text-white font-semibold tabular-nums whitespace-nowrap">{fmtAED(m.sales)}</td>
                      <td className="px-4 py-3 text-sm text-gold tabular-nums whitespace-nowrap">{fmtAED(m.commission)}</td>
                      <td className="px-4 py-3 w-32">
                        <div className="h-2 w-full bg-surface-2 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500/70" style={{ width: `${(m.commission / maxMonthly) * 100}%` }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
        )}
      </div>
    </div>
  )
}
