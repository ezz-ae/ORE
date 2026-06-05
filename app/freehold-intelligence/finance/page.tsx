'use client'

import { financeSummary } from '@/src/features/freehold-intelligence/finance'

function fmt(n: number) {
  return 'AED ' + n.toLocaleString('en-US')
}

function PlatformBadge({ platform }: { platform: 'meta' | 'google' }) {
  return platform === 'meta' ? (
    <span className="inline-flex items-center rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-400">
      Meta
    </span>
  ) : (
    <span className="inline-flex items-center rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
      Google
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'paid') {
    return (
      <span className="inline-flex items-center rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
        Paid
      </span>
    )
  }
  if (status === 'processing') {
    return (
      <span className="inline-flex items-center rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400">
        Processing
      </span>
    )
  }
  if (status === 'overdue') {
    return (
      <span className="inline-flex items-center rounded-md border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-400">
        Overdue
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium text-white/40">
      {status}
    </span>
  )
}

function ProgressBar({ label, spent, budget, utilization, color }: {
  label: string
  spent: number
  budget: number
  utilization: number
  color: string
}) {
  return (
    <div className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-white/70">{label}</span>
        <span className="text-xs text-white/40">{Math.round(utilization * 100)}% used</span>
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tabular-nums text-white/90">{fmt(spent)}</span>
        <span className="text-sm text-white/35">/ {fmt(budget)}</span>
      </div>
      <div className="mt-3 h-2 w-full rounded-full bg-white/[0.06]">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${utilization * 100}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-white/35">{fmt(budget - spent)} remaining this month</p>
    </div>
  )
}

export default function FinancePage() {
  const f = financeSummary

  // Only total rows for history table (exclude per-platform May rows to avoid duplication)
  const historyRows = f.monthlyHistory.filter((r) => r.platform === 'total')

  return (
    <div className="p-6 lg:p-8 space-y-8">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white/90">Finance & Billing</h1>
          <p className="mt-1 text-sm text-white/40">Ad spend, budget utilization, and invoices</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-2 text-sm text-white/60">
          <span className="h-1.5 w-1.5 rounded-full bg-[#D4AF37]" />
          May 2026
        </div>
      </div>

      {/* ── Top KPI row ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-white/40">Total Spend</div>
          <div className="mt-3 text-2xl font-semibold tabular-nums text-white/90">{fmt(f.totalSpend30d)}</div>
          <div className="mt-1 text-xs text-white/35">Last 30 days · all platforms</div>
        </div>
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-white/40">Total Leads</div>
          <div className="mt-3 text-2xl font-semibold tabular-nums text-white/90">{f.totalLeads30d}</div>
          <div className="mt-1 text-xs text-white/35">Last 30 days · all campaigns</div>
        </div>
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-white/40">Avg CPL</div>
          <div className="mt-3 text-2xl font-semibold tabular-nums text-[#D4AF37]">AED {f.avgCpl30d}</div>
          <div className="mt-1 text-xs text-white/35">Cost per lead · 30d average</div>
        </div>
      </div>

      {/* ── Budget Utilization ── */}
      <section>
        <div className="mb-4 text-xs font-medium uppercase tracking-widest text-white/40">Budget Utilization</div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ProgressBar
            label="Meta Ads"
            spent={f.currentMonthSpendMeta}
            budget={f.metaBudgetAED}
            utilization={f.budgetUtilizationMeta}
            color="bg-blue-500"
          />
          <ProgressBar
            label="Google Ads"
            spent={f.currentMonthSpendGoogle}
            budget={f.googleBudgetAED}
            utilization={f.budgetUtilizationGoogle}
            color="bg-emerald-500"
          />
        </div>
      </section>

      {/* ── Monthly Spend History ── */}
      <section>
        <div className="mb-4 text-xs font-medium uppercase tracking-widest text-white/40">Monthly Spend History</div>
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.03] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.05]">
                  <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-white/35">Month</th>
                  <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-white/35">Budget</th>
                  <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-white/35">Spent</th>
                  <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-white/35">Leads</th>
                  <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-white/35">CPL</th>
                  <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-white/35">Util.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {historyRows.map((row, i) => {
                  const util = row.spentAED / row.budgetAED
                  const isCurrent = row.month === 'May 2026'
                  return (
                    <tr key={i} className={`transition hover:bg-white/[0.02] ${isCurrent ? 'bg-[#D4AF37]/[0.03]' : ''}`}>
                      <td className="px-5 py-4 font-medium text-white/75">
                        {row.month}
                        {isCurrent && (
                          <span className="ml-2 rounded-full bg-[#D4AF37]/15 px-1.5 py-0.5 text-[10px] font-medium text-[#D4AF37]">Current</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums text-white/50">{fmt(row.budgetAED)}</td>
                      <td className="px-5 py-4 text-right tabular-nums text-white/80">{fmt(row.spentAED)}</td>
                      <td className="px-5 py-4 text-right tabular-nums text-white/70">{row.leadsGenerated.toLocaleString('en-US')}</td>
                      <td className="px-5 py-4 text-right tabular-nums text-[#D4AF37]">AED {row.avgCpl}</td>
                      <td className="px-5 py-4 text-right">
                        <span className={`text-xs font-medium tabular-nums ${util >= 0.9 ? 'text-red-400' : util >= 0.7 ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {Math.round(util * 100)}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Top Spend Campaigns ── */}
      <section>
        <div className="mb-4 text-xs font-medium uppercase tracking-widest text-white/40">Top Spend Campaigns</div>
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.03] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.05]">
                  <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-white/35">Campaign</th>
                  <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-white/35">Platform</th>
                  <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-white/35">Spend</th>
                  <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-white/35">Leads</th>
                  <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-white/35">CPL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {f.topSpendCampaigns.map((c, i) => (
                  <tr key={i} className="transition hover:bg-white/[0.02]">
                    <td className="px-5 py-4 font-medium text-white/75 max-w-[260px]">
                      <span className="block truncate">{c.name}</span>
                    </td>
                    <td className="px-5 py-4">
                      <PlatformBadge platform={c.platform} />
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums text-white/80">{fmt(c.spendAED)}</td>
                    <td className="px-5 py-4 text-right tabular-nums text-white/70">{c.leads}</td>
                    <td className="px-5 py-4 text-right tabular-nums text-[#D4AF37]">AED {c.cpl}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Invoices ── */}
      <section>
        <div className="mb-4 text-xs font-medium uppercase tracking-widest text-white/40">Invoices</div>
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.03] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.05]">
                  <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-white/35">Invoice</th>
                  <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-white/35">Platform</th>
                  <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-white/35">Period</th>
                  <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-white/35">Amount</th>
                  <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-white/35">Due</th>
                  <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-white/35">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {f.invoices.map((inv) => (
                  <tr key={inv.id} className="transition hover:bg-white/[0.02]">
                    <td className="px-5 py-4 font-mono text-xs text-white/55">{inv.id}</td>
                    <td className="px-5 py-4">
                      <PlatformBadge platform={inv.platform} />
                    </td>
                    <td className="px-5 py-4 text-white/60">{inv.period}</td>
                    <td className="px-5 py-4 text-right tabular-nums font-medium text-white/85">{fmt(inv.amountAED)}</td>
                    <td className="px-5 py-4 text-xs text-white/45">{inv.dueDate}</td>
                    <td className="px-5 py-4">
                      <StatusBadge status={inv.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

    </div>
  )
}
