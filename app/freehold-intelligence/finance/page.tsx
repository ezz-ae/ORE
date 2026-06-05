'use client'

import { useState, useMemo } from 'react'
import { financeSummary } from '@/src/features/freehold-intelligence/finance'

function fmt(n: number) {
  return 'AED ' + n.toLocaleString('en-US')
}

function PlatformBadge({ platform }: { platform: 'meta' | 'google' }) {
  return platform === 'meta' ? (
    <span className="inline-flex items-center rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[13px] font-medium text-blue-400">
      Meta
    </span>
  ) : (
    <span className="inline-flex items-center rounded-md border border-[#D4AF37]/20 bg-[#D4AF37]/10 px-2 py-0.5 text-[13px] font-medium text-[#D4AF37]">
      Google
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'paid') {
    return (
      <span className="inline-flex items-center rounded-md border border-[#D4AF37]/20 bg-[#D4AF37]/10 px-2 py-0.5 text-[13px] font-medium text-[#D4AF37]">
        Paid
      </span>
    )
  }
  if (status === 'processing') {
    return (
      <span className="inline-flex items-center rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[13px] font-medium text-amber-400">
        Processing
      </span>
    )
  }
  if (status === 'overdue') {
    return (
      <span className="inline-flex items-center rounded-md border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[13px] font-medium text-red-400">
        Overdue
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[13px] font-medium text-white/40">
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

  const [invoiceFilter, setInvoiceFilter] = useState<'All' | 'paid' | 'processing' | 'overdue'>('All')
  const [platformFilter, setPlatformFilter] = useState<'All' | 'meta' | 'google'>('All')

  const filteredInvoices = useMemo(
    () => invoiceFilter === 'All' ? f.invoices : f.invoices.filter((inv) => inv.status === invoiceFilter),
    [f.invoices, invoiceFilter],
  )

  const filteredCampaigns = useMemo(
    () => platformFilter === 'All' ? f.topSpendCampaigns : f.topSpendCampaigns.filter((c) => c.platform === platformFilter),
    [f.topSpendCampaigns, platformFilter],
  )

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
            color="bg-[#D4AF37]"
          />
        </div>
      </section>

      {/* ── Spend Trend ── */}
      <section>
        <div className="mb-4 text-xs font-medium uppercase tracking-widest text-white/40">Spend Trend</div>
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-5">
          {(() => {
            const maxValue = 43000
            const chartWidth = 600
            const chartHeight = 180
            const labelSpace = 20
            const maxBarArea = 140
            const groupWidth = chartWidth / historyRows.length // 120px per group
            const barWidth = 40
            const barGap = 8

            return (
              <>
                <svg
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  preserveAspectRatio="none"
                  style={{ width: '100%', height: '180px', display: 'block' }}
                >
                  {historyRows.map((row, i) => {
                    const groupX = i * groupWidth
                    const centerX = groupX + groupWidth / 2
                    const budgetBarHeight = (row.budgetAED / maxValue) * maxBarArea
                    const spentBarHeight = (row.spentAED / maxValue) * maxBarArea
                    const budgetBarX = centerX - barGap / 2 - barWidth
                    const spentBarX = centerX + barGap / 2
                    const isCurrent = row.month === 'May 2026'
                    // Short month label: "Jan", "Feb", etc.
                    const shortMonth = row.month.split(' ')[0]

                    return (
                      <g key={i}>
                        {/* Budget bar */}
                        <rect
                          x={budgetBarX}
                          y={chartHeight - labelSpace - budgetBarHeight}
                          width={barWidth}
                          height={budgetBarHeight}
                          fill="#FFFFFF"
                          fillOpacity="0.06"
                          rx="3"
                        />
                        {/* Spent bar */}
                        <rect
                          x={spentBarX}
                          y={chartHeight - labelSpace - spentBarHeight}
                          width={barWidth}
                          height={spentBarHeight}
                          fill="#D4AF37"
                          fillOpacity={isCurrent ? '1' : '0.7'}
                          rx="3"
                        />
                        {/* "Current" annotation for May 2026 */}
                        {isCurrent && (
                          <text
                            x={spentBarX + barWidth / 2}
                            y={chartHeight - labelSpace - spentBarHeight - 6}
                            textAnchor="middle"
                            fill="#D4AF37"
                            fontSize="9"
                            fontWeight="500"
                          >
                            Current
                          </text>
                        )}
                        {/* Month label */}
                        <text
                          x={centerX}
                          y={chartHeight - 4}
                          textAnchor="middle"
                          fill="rgba(255,255,255,0.3)"
                          fontSize="11"
                        >
                          {shortMonth}
                        </text>
                      </g>
                    )
                  })}
                </svg>

                {/* Stat chips */}
                <div className="mt-4 flex flex-wrap gap-3">
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm">
                    <span className="text-white/40">Avg Monthly Spend: </span>
                    <span className="font-medium text-white/80 tabular-nums">AED 37,388</span>
                  </div>
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm">
                    <span className="text-white/40">YTD Spend: </span>
                    <span className="font-medium text-white/80 tabular-nums">AED 186,940</span>
                  </div>
                </div>
              </>
            )
          })()}
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
                          <span className="ml-2 rounded-full bg-[#D4AF37]/15 px-1.5 py-0.5 text-[12px] font-medium text-[#D4AF37]">Current</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums text-white/50">{fmt(row.budgetAED)}</td>
                      <td className="px-5 py-4 text-right tabular-nums text-white/80">{fmt(row.spentAED)}</td>
                      <td className="px-5 py-4 text-right tabular-nums text-white/70">{row.leadsGenerated.toLocaleString('en-US')}</td>
                      <td className="px-5 py-4 text-right tabular-nums text-[#D4AF37]">AED {row.avgCpl}</td>
                      <td className="px-5 py-4 text-right">
                        <span className={`text-xs font-medium tabular-nums ${util >= 0.9 ? 'text-red-400' : util >= 0.7 ? 'text-amber-400' : 'text-[#D4AF37]'}`}>
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
        <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="text-xs font-medium uppercase tracking-widest text-white/40">Top Spend Campaigns</div>
          <div className="flex gap-1.5">
            {(['All', 'meta', 'google'] as const).map((p) => {
              const isActive = platformFilter === p
              let activeClass = 'border border-[#D4AF37]/35 bg-[#D4AF37]/10 text-[#D4AF37]'
              if (isActive && p === 'meta') activeClass = 'border border-blue-400/35 bg-blue-400/10 text-blue-300'
              if (isActive && p === 'google') activeClass = 'border border-emerald-400/35 bg-[#D4AF37]/10 text-[#D4AF37]'
              return (
                <button
                  key={p}
                  onClick={() => setPlatformFilter(p)}
                  className={`rounded-full px-3 py-1 text-[13px] font-medium transition ${
                    isActive
                      ? activeClass
                      : 'border border-white/[0.08] text-white/40 hover:text-white/65'
                  }`}
                >
                  {p === 'All' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              )
            })}
          </div>
        </div>
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
                {filteredCampaigns.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-[13px] text-white/30">No items match this filter.</td>
                  </tr>
                ) : (
                  filteredCampaigns.map((c, i) => (
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Invoices ── */}
      <section>
        <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="text-xs font-medium uppercase tracking-widest text-white/40">Invoices</div>
          <div className="flex gap-1.5">
            {(['All', 'paid', 'processing', 'overdue'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setInvoiceFilter(s)}
                className={`rounded-full px-3 py-1 text-[13px] font-medium transition ${
                  invoiceFilter === s
                    ? 'border border-[#D4AF37]/35 bg-[#D4AF37]/10 text-[#D4AF37]'
                    : 'border border-white/[0.08] text-white/40 hover:text-white/65'
                }`}
              >
                {s === 'All' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
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
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-[13px] text-white/30">No items match this filter.</td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => (
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

    </div>
  )
}
