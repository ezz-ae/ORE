'use client'

import { useState } from 'react'
import { BarChart2, TrendingUp, FileText, Table, Download, Calendar, RefreshCw, CheckCircle2 } from 'lucide-react'
import { financeSummary } from '@/src/features/freehold-intelligence/finance'

function fmt(n: number) { return 'AED ' + n.toLocaleString('en-US') }

const REPORT_TEMPLATES = [
  { id: 'r1', icon: BarChart2,  name: 'Monthly Ad Spend',      desc: 'Platform breakdown, campaign performance, CPL trends',        formats: ['PDF', 'Excel'], lastRun: '2026-06-01', schedule: 'monthly'   },
  { id: 'r2', icon: TrendingUp, name: 'Lead Cost Analysis',    desc: 'CPL by campaign, channel, and property over 6 months',         formats: ['PDF', 'Excel'], lastRun: '2026-06-01', schedule: 'monthly'   },
  { id: 'r3', icon: Table,      name: 'Invoice Summary',        desc: 'All invoices grouped by platform and billing period',          formats: ['PDF', 'CSV'],   lastRun: '2026-06-01', schedule: 'monthly'   },
  { id: 'r4', icon: FileText,   name: 'Budget Utilisation',    desc: 'Meta vs Google spend vs budget for the current quarter',        formats: ['PDF'],          lastRun: '2026-05-01', schedule: 'quarterly' },
  { id: 'r5', icon: BarChart2,  name: 'Agent Commission Report', desc: 'Commissions paid, pending, and projected per agent',          formats: ['PDF', 'Excel'], lastRun: '2026-06-01', schedule: 'monthly'   },
  { id: 'r6', icon: TrendingUp, name: 'ROI by Property',       desc: 'Ad spend vs lead volume vs conversion per property listing',    formats: ['PDF', 'Excel'], lastRun: '2026-05-15', schedule: 'on-demand' },
]

const RANGE_OPTIONS = ['This month', 'Last month', 'Last 3 months', 'Last 6 months', 'This year', 'Custom']

export default function ReportsPage() {
  const [range,    setRange]    = useState('Last 3 months')
  const [running,  setRunning]  = useState<string | null>(null)
  const [done,     setDone]     = useState<string[]>([])

  function runReport(id: string) {
    setRunning(id)
    setTimeout(() => {
      setRunning(null)
      setDone((prev) => [...prev, id])
      setTimeout(() => setDone((prev) => prev.filter((d) => d !== id)), 3000)
    }, 1800)
  }

  const history = financeSummary.monthlyHistory.filter((r) => r.platform === 'total')
  const ytdSpend = history.reduce((s, r) => s + r.spentAED, 0)
  const ytdLeads = history.reduce((s, r) => s + r.leadsGenerated, 0)
  const avgCpl   = ytdLeads > 0 ? Math.round(ytdSpend / ytdLeads) : 0

  const metaHistory   = financeSummary.monthlyHistory.filter((r) => r.platform === 'meta')
  const googleHistory = financeSummary.monthlyHistory.filter((r) => r.platform === 'google')
  const maxSpend      = Math.max(...history.map((r) => r.spentAED), 1)

  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-7 sm:px-8">

      <div className="mb-7 flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-semibold text-white">Reports</h1>
          <p className="mt-1 text-xs text-slate-500">Generate and schedule financial reports</p>
        </div>
        {/* Range selector */}
        <div className="flex gap-1 rounded-[10px] border border-slate-800 bg-slate-900 p-1">
          {RANGE_OPTIONS.slice(0, 4).map((r) => (
            <button key={r} onClick={() => setRange(r)}
              className={`rounded-[8px] px-2.5 py-1 text-xs font-medium transition ${
                range === r ? 'bg-slate-800/50 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}>
              {r.replace('Last ', '')}
            </button>
          ))}
        </div>
      </div>

      {/* YTD tiles */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        {[
          { label: 'YTD Spend',    value: fmt(ytdSpend), sub: 'Jan – Jun 2026',  color: 'text-slate-100'    },
          { label: 'YTD Leads',    value: ytdLeads.toLocaleString(), sub: 'All platforms', color: 'text-slate-100' },
          { label: 'Avg CPL',      value: `AED ${avgCpl}`, sub: 'Cost per lead', color: 'text-emerald-400' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="rounded-[14px] border border-slate-800 bg-slate-900 p-4">
            <div className="text-xs text-slate-500 uppercase tracking-wider">{label}</div>
            <div className={`mt-2 text-[18px] font-semibold ${color}`}>{value}</div>
            <div className="mt-0.5 text-xs text-slate-500">{sub}</div>
          </div>
        ))}
      </div>

      {/* Spend chart */}
      <section className="mb-6">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Monthly Spend</div>
        <div className="rounded-[16px] border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-end gap-2 h-28">
            {history.map((row) => {
              const metaRow   = metaHistory.find((r) => r.month === row.month)
              const googleRow = googleHistory.find((r) => r.month === row.month)
              const total     = row.spentAED
              const metaH     = ((metaRow?.spentAED ?? 0) / maxSpend) * 100
              const googleH   = ((googleRow?.spentAED ?? 0) / maxSpend) * 100
              return (
                <div key={row.month} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col justify-end gap-0.5 h-24">
                    <div className="w-full rounded-t-sm bg-blue-400/40" style={{ height: `${metaH}%` }} title={`Meta: ${fmt(metaRow?.spentAED ?? 0)}`} />
                    <div className="w-full bg-emerald-400/40" style={{ height: `${googleH}%` }} title={`Google: ${fmt(googleRow?.spentAED ?? 0)}`} />
                  </div>
                  <div className="text-[9px] text-slate-500 whitespace-nowrap">{row.month.split(' ')[0]}</div>
                </div>
              )
            })}
          </div>
          <div className="mt-3 flex items-center gap-4 border-t border-slate-800 pt-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <div className="h-2 w-3 rounded-sm bg-blue-400/40" /> Meta
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <div className="h-2 w-3 rounded-sm bg-emerald-400/40" /> Google
            </div>
          </div>
        </div>
      </section>

      {/* Monthly breakdown table */}
      <section className="mb-6">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Monthly Breakdown</div>
        <div className="rounded-[16px] border border-slate-800 bg-slate-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  {['Month', 'Meta', 'Google', 'Total', 'Leads', 'CPL', 'Budget'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 last:text-right">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {history.map((row, i) => {
                  const metaRow   = metaHistory.find((r) => r.month === row.month)
                  const googleRow = googleHistory.find((r) => r.month === row.month)
                  const current   = row.month === history[history.length - 1].month
                  return (
                    <tr key={i} className={`transition hover:bg-slate-800/40 ${current ? 'bg-emerald-400/[0.02]' : ''}`}>
                      <td className="px-4 py-3 font-medium text-slate-300">
                        {row.month}
                        {current && <span className="ml-2 rounded-full bg-emerald-400/15 px-1.5 py-0.5 text-[10px] text-emerald-400">Current</span>}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-blue-400/70">{metaRow ? fmt(metaRow.spentAED) : '—'}</td>
                      <td className="px-4 py-3 tabular-nums text-emerald-400/70">{googleRow ? fmt(googleRow.spentAED) : '—'}</td>
                      <td className="px-4 py-3 tabular-nums font-medium text-slate-100">{fmt(row.spentAED)}</td>
                      <td className="px-4 py-3 tabular-nums text-slate-400">{row.leadsGenerated}</td>
                      <td className="px-4 py-3 tabular-nums text-emerald-400">AED {row.avgCpl}</td>
                      <td className="px-4 py-3 tabular-nums text-right text-slate-500">{fmt(row.budgetAED)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Report templates */}
      <section>
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Report Templates</div>
        <div className="space-y-2">
          {REPORT_TEMPLATES.map((r) => {
            const Icon    = r.icon
            const isDone  = done.includes(r.id)
            const isRunning = running === r.id
            return (
              <div key={r.id} className="rounded-[14px] border border-slate-800 bg-slate-900 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-emerald-400/20 bg-emerald-400/10">
                      <Icon className="h-3.5 w-3.5 text-emerald-400" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-100">{r.name}</div>
                      <div className="mt-0.5 text-xs text-slate-400 leading-relaxed">{r.desc}</div>
                      <div className="mt-1.5 flex items-center gap-3 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {r.schedule}</span>
                        <span>Last: {r.lastRun}</span>
                        <span>{r.formats.join(' · ')}</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => runReport(r.id)} disabled={isRunning}
                    className={`shrink-0 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      isDone
                        ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400'
                        : 'border-slate-800 text-slate-400 hover:border-emerald-400/25 hover:text-emerald-400'
                    } disabled:opacity-50`}>
                    {isRunning ? <RefreshCw className="h-3 w-3 animate-spin" /> : isDone ? <CheckCircle2 className="h-3 w-3" /> : <Download className="h-3 w-3" />}
                    {isRunning ? 'Building…' : isDone ? 'Ready' : 'Generate'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </section>

    </div>
  )
}
