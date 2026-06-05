import { Download, BarChart2, TrendingUp, FileText, Table } from 'lucide-react'
import { financeSummary } from '@/src/features/freehold-intelligence/finance'

function fmt(n: number) { return 'AED ' + n.toLocaleString('en-US') }

const REPORT_TEMPLATES = [
  {
    icon: BarChart2,
    name: 'Monthly Ad Spend Report',
    description: 'Platform breakdown, campaign performance, CPL trends',
    format: 'PDF · Excel',
    lastGenerated: '1 Jun 2026',
  },
  {
    icon: TrendingUp,
    name: 'Lead Cost Analysis',
    description: 'CPL by campaign, channel, and property type over 6 months',
    format: 'PDF · Excel',
    lastGenerated: '1 Jun 2026',
  },
  {
    icon: Table,
    name: 'Invoice Summary',
    description: 'All invoices grouped by platform and period',
    format: 'PDF · CSV',
    lastGenerated: '1 Jun 2026',
  },
  {
    icon: FileText,
    name: 'Budget Utilization Report',
    description: 'Meta vs Google spend vs budget for the current quarter',
    format: 'PDF',
    lastGenerated: '1 Jun 2026',
  },
]

export default function ReportsPage() {
  const history = financeSummary.monthlyHistory.filter((r) => r.platform === 'total')
  const ytdSpend = history.reduce((s, r) => s + r.spentAED, 0)
  const ytdLeads = history.reduce((s, r) => s + r.leadsGenerated, 0)
  const avgCpl = Math.round(ytdSpend / ytdLeads)

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white/90">Reports</h1>
        <p className="mt-1 text-sm text-white/40">Generate and export financial reports</p>
      </div>

      {/* YTD snapshot */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'YTD Spend',    value: fmt(ytdSpend),       sub: 'Jan – May 2026' },
          { label: 'YTD Leads',    value: ytdLeads.toLocaleString(), sub: 'All platforms' },
          { label: 'YTD Avg CPL',  value: `AED ${avgCpl}`,     sub: 'Cost per lead', accent: 'text-[#D4AF37]' },
        ].map(({ label, value, sub, accent }) => (
          <div key={label} className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-5">
            <div className="text-[12px] font-medium uppercase tracking-wider text-white/35">{label}</div>
            <div className={`mt-3 text-2xl font-semibold tabular-nums ${accent ?? 'text-white/85'}`}>{value}</div>
            <div className="mt-1 text-[13px] text-white/35">{sub}</div>
          </div>
        ))}
      </div>

      {/* Report templates */}
      <section>
        <div className="mb-4 text-[12px] font-medium uppercase tracking-wider text-white/40">Report Templates</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {REPORT_TEMPLATES.map((r) => {
            const Icon = r.icon
            return (
              <div key={r.name} className="group rounded-2xl border border-white/[0.05] bg-white/[0.03] p-5 transition hover:border-white/[0.10] hover:bg-white/[0.05]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#D4AF37]/20 bg-[#D4AF37]/10">
                      <Icon className="h-4 w-4 text-[#D4AF37]" />
                    </div>
                    <div>
                      <div className="font-medium text-white/85">{r.name}</div>
                      <div className="mt-1 text-[13px] text-white/45">{r.description}</div>
                      <div className="mt-2 text-[12px] text-white/30">
                        Format: <span className="text-white/50">{r.format}</span>
                        <span className="mx-2">·</span>
                        Last: <span className="text-white/50">{r.lastGenerated}</span>
                      </div>
                    </div>
                  </div>
                  <button className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[13px] text-white/50 transition group-hover:border-[#D4AF37]/25 group-hover:text-[#D4AF37]">
                    <Download className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Data table for inline reference */}
      <section>
        <div className="mb-4 text-[12px] font-medium uppercase tracking-wider text-white/40">Monthly Breakdown</div>
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.03] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.05]">
                {['Month', 'Meta Spend', 'Google Spend', 'Total', 'Leads', 'CPL', 'Budget'].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-[12px] font-medium uppercase tracking-wider text-white/35">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {history.map((row, i) => {
                const metaRow = financeSummary.monthlyHistory.find((r) => r.platform === 'meta' && r.month === row.month)
                const gglRow  = financeSummary.monthlyHistory.find((r) => r.platform === 'google' && r.month === row.month)
                const isCurrent = row.month === 'May 2026'
                return (
                  <tr key={i} className={`transition hover:bg-white/[0.02] ${isCurrent ? 'bg-[#D4AF37]/[0.02]' : ''}`}>
                    <td className="px-5 py-4 font-medium text-white/75">
                      {row.month}
                      {isCurrent && <span className="ml-2 rounded-full bg-[#D4AF37]/15 px-1.5 py-0.5 text-[11px] text-[#D4AF37]">Current</span>}
                    </td>
                    <td className="px-5 py-4 tabular-nums text-blue-400/80">{metaRow ? fmt(metaRow.spentAED) : '—'}</td>
                    <td className="px-5 py-4 tabular-nums text-[#D4AF37]/80">{gglRow ? fmt(gglRow.spentAED) : '—'}</td>
                    <td className="px-5 py-4 tabular-nums font-medium text-white/85">{fmt(row.spentAED)}</td>
                    <td className="px-5 py-4 tabular-nums text-white/65">{row.leadsGenerated}</td>
                    <td className="px-5 py-4 tabular-nums text-[#D4AF37]">AED {row.avgCpl}</td>
                    <td className="px-5 py-4 tabular-nums text-white/40">{fmt(row.budgetAED)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
