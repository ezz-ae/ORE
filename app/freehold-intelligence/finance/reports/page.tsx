'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { BarChart2, TrendingUp, FileText, Table, Download, Calendar, Loader2 } from 'lucide-react'
import { PageHeader, StatCard, Section } from '@/components/freehold/ui'
import { useT } from '@/lib/i18n/provider'

interface Analytics {
  totals: { totalSalesAed: number; totalCommissionAed: number; netCommissionAed: number; totalPaidAed: number; totalOutstandingAed: number }
  ytd: { salesAed: number; commissionAed: number; deals: number; leads: number; costPerLeadAed: number }
  monthlyDeals: { month: string; sales: number; commission: number; deals: number }[]
  leadsBySource: { source: string; leads: number; closed: number; conversionPct: number }[]
  expensesByCategory: Record<string, number>
}

function fmt(n: number) {
  if (!n || n <= 0) return 'AED 0'
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `AED ${(n / 1_000).toFixed(0)}K`
  return 'AED ' + Math.round(n).toLocaleString('en-US')
}

export default function FinanceReportsPage() {
  const t = useT()
  const [a, setA] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  function downloadCsv(filename: string, rows: (string | number)[][]) {
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a')
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
    toast.success(t('finance.reports.downloaded', { file: filename }))
  }

  useEffect(() => {
    fetch('/api/freehold/management/analytics', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null).then((d) => setA(d)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const maxComm = a && a.monthlyDeals.length ? Math.max(...a.monthlyDeals.map((m) => m.commission), 1) : 1

  const templates = [
    { id: 'sales', icon: BarChart2, name: 'Sales & Commission', desc: 'Monthly sales value and agency commission', build: () => {
      const rows: (string | number)[][] = [['Month', 'Deals', 'Sales AED', 'Commission AED']]
      a?.monthlyDeals.forEach((m) => rows.push([m.month, m.deals, Math.round(m.sales), Math.round(m.commission)]))
      return rows
    } },
    { id: 'sources', icon: TrendingUp, name: 'Lead Source Analysis', desc: 'Leads, closed deals and conversion per source', build: () => {
      const rows: (string | number)[][] = [['Source', 'Leads', 'Closed', 'Conversion %']]
      a?.leadsBySource.forEach((s) => rows.push([s.source, s.leads, s.closed, s.conversionPct]))
      return rows
    } },
    { id: 'expenses', icon: Table, name: 'Expense Breakdown', desc: 'Operating costs by category', build: () => {
      const rows: (string | number)[][] = [['Category', 'Amount AED']]
      if (a) Object.entries(a.expensesByCategory).forEach(([k, v]) => rows.push([k, Math.round(v)]))
      return rows
    } },
    { id: 'commission', icon: FileText, name: 'Commission Settlement', desc: 'Commission earned, paid, outstanding', build: () => {
      const t = a?.totals
      return [['Metric', 'AED'], ['Gross commission', Math.round(t?.totalCommissionAed || 0)], ['Net commission', Math.round(t?.netCommissionAed || 0)], ['Paid', Math.round(t?.totalPaidAed || 0)], ['Outstanding', Math.round(t?.totalOutstandingAed || 0)]] as (string | number)[][]
    } },
  ]

  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-7 sm:px-8">
      <PageHeader eyebrow="Finance" Icon={BarChart2} title="Reports" subtitle="Live financial reports from your deals & ledger" className="mb-7" />

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : !a ? (
        <div className="py-16 text-center text-sm text-slate-500">No data available yet.</div>
      ) : (
      <>
        <div className="mb-6 grid grid-cols-3 gap-3">
          <StatCard label="YTD Sales" value={fmt(a.ytd.salesAed)} hint="Approved deals" Icon={TrendingUp} />
          <StatCard label="YTD Commission" value={fmt(a.ytd.commissionAed)} hint={`${a.ytd.deals} deals`} Icon={BarChart2} />
          <StatCard label="YTD Leads" value={a.ytd.leads.toLocaleString()} hint="All sources" Icon={FileText} />
        </div>

        <Section title="Monthly Commission" className="mb-6">
          <div className="rounded-[16px] border border-line bg-surface p-5">
            {a.monthlyDeals.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">No closed deals in the last 6 months.</p>
            ) : (
              <div className="flex items-end gap-2 h-28">
                {a.monthlyDeals.map((m) => (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex flex-col justify-end h-24">
                      <div className="w-full rounded-t-sm bg-gold/50" style={{ height: `${(m.commission / maxComm) * 100}%` }} title={`${m.month}: ${fmt(m.commission)}`} />
                    </div>
                    <div className="text-[9px] text-slate-500 whitespace-nowrap">{m.month.split(' ')[0]}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Section>

        <Section title="Monthly Breakdown" className="mb-6">
          <div className="rounded-[16px] border border-line bg-surface overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  {['Month', 'Deals', 'Sales', 'Commission'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {a.monthlyDeals.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">No data.</td></tr>
                ) : a.monthlyDeals.map((m, i) => (
                  <tr key={i} className="hover:bg-surface-2">
                    <td className="px-4 py-3 font-medium text-slate-300">{m.month}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-400">{m.deals}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-100">{fmt(m.sales)}</td>
                    <td className="px-4 py-3 tabular-nums text-gold">{fmt(m.commission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Report Templates">
          <div className="space-y-2">
            {templates.map((t) => {
              const Icon = t.icon
              return (
                <div key={t.id} className="rounded-[14px] border border-line bg-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-emerald-400/20 bg-emerald-400/10">
                        <Icon className="h-3.5 w-3.5 text-emerald-400" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-100">{t.name}</div>
                        <div className="mt-0.5 text-xs text-slate-400 leading-relaxed">{t.desc}</div>
                        <div className="mt-1.5 flex items-center gap-3 text-[10px] text-slate-500">
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> live</span>
                          <span>CSV</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => downloadCsv(`${t.id}-report.csv`, t.build())}
                      className="shrink-0 flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:border-emerald-400/25 hover:text-emerald-400">
                      <Download className="h-3 w-3" /> Generate
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </Section>
      </>
      )}
    </div>
  )
}
