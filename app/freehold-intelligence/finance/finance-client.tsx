'use client'

import { useState, useMemo } from 'react'
import { DollarSign } from 'lucide-react'
import { financeSummary as defaultFinanceSummary } from '@/src/features/freehold-intelligence/finance'
import { PageHeader, StatCard, Section, Panel, StatusPill } from '@/components/freehold/ui'

interface DealTotals {
  totalSalesAed: number
  totalCommissionAed: number
  netCommissionAed: number
  totalPaidAed: number
  totalOutstandingAed: number
  approvedDeals: number
}

interface FinanceClientProps {
  initialSummary?: typeof defaultFinanceSummary
  creditBalances?: Record<string, unknown>[]
  ledgerSummary?: Record<string, unknown>[]
  dealTotals?: DealTotals
}

function fmt(n: number) {
  return 'AED ' + n.toLocaleString('en-US')
}

function fmtCompact(n: number) {
  if (!n || n <= 0) return 'AED 0'
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `AED ${(n / 1_000).toFixed(0)}K`
  return `AED ${Math.round(n).toLocaleString()}`
}

function PlatformBadge({ platform }: { platform: 'meta' | 'google' }) {
  return platform === 'meta' ? (
    <span className="inline-flex items-center rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-sm font-medium text-blue-400">
      Meta
    </span>
  ) : (
    <span className="inline-flex items-center rounded-md border border-gold/20 bg-gold/10 px-2 py-0.5 text-sm font-medium text-gold">
      Google
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'paid')       return <StatusPill tone="gold">Paid</StatusPill>
  if (status === 'processing') return <StatusPill tone="amber">Processing</StatusPill>
  if (status === 'overdue')    return <StatusPill tone="red">Overdue</StatusPill>
  return <StatusPill tone="neutral">{status}</StatusPill>
}

function ProgressBar({ label, spent, budget, utilization, color }: {
  label: string
  spent: number
  budget: number
  utilization: number
  color: string
}) {
  return (
    <div className="rounded-xl border border-line bg-surface-2 p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-300">{label}</span>
        <span className="text-xs text-slate-400">{Math.round(utilization * 100)}% used</span>
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tabular-nums text-slate-100">{fmt(spent)}</span>
        <span className="text-sm text-slate-500">/ {fmt(budget)}</span>
      </div>
      <div className="mt-3 h-2 w-full rounded-full bg-surface-3">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${utilization * 100}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-slate-500">{fmt(budget - spent)} remaining this month</p>
    </div>
  )
}

export default function FinanceClient({ initialSummary, creditBalances: _creditBalances, ledgerSummary: _ledgerSummary, dealTotals }: FinanceClientProps) {
  const f = initialSummary ?? defaultFinanceSummary

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
      <PageHeader
        eyebrow="Finance"
        Icon={DollarSign}
        title="Finance & Billing"
        subtitle="Ad spend, budget utilization, and invoices"
        actions={
          <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3.5 py-2 text-sm text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-gold" />
            May 2026
          </div>
        }
      />

      {/* ── Top KPI row ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Spend" value={fmt(f.totalSpend30d)} hint="Last 30 days · all platforms" />
        <StatCard label="Total Leads" value={f.totalLeads30d} hint="Last 30 days · all campaigns" delta={{ value: 'incoming', direction: 'up' }} />
        <StatCard label="Avg CPL" value={`AED ${f.avgCpl30d}`} hint="Cost per lead · 30d average" />
      </div>

      {/* ── Sales & Commission (deal-backed) ── */}
      {dealTotals && (
        <Section title="Sales & Commission" description={`${dealTotals.approvedDeals} approved deal${dealTotals.approvedDeals === 1 ? '' : 's'}`}>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Total Sales" value={fmtCompact(dealTotals.totalSalesAed)} hint="Property value · approved deals" />
            <StatCard label="Total Commission" value={fmtCompact(dealTotals.totalCommissionAed)} hint="Gross agency commission" />
            <StatCard label="Total Paid" value={fmtCompact(dealTotals.totalPaidAed)} hint="Commission received" />
            <StatCard label="Outstanding" value={fmtCompact(dealTotals.totalOutstandingAed)} hint="Commission still due" delta={dealTotals.totalOutstandingAed > 0 ? { value: 'awaiting', direction: 'down' } : undefined} />
          </div>
        </Section>
      )}

      {/* ── Budget Utilization ── */}
      <Section title="Budget Utilization">
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
            color="bg-gold"
          />
        </div>
      </Section>

      {/* ── Spend Trend ── */}
      <Section title="Spend Trend">
        <Panel className="p-5">
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
                  <div className="rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm">
                    <span className="text-slate-400">Avg Monthly Spend: </span>
                    <span className="font-medium text-slate-100 tabular-nums">AED 37,388</span>
                  </div>
                  <div className="rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm">
                    <span className="text-slate-400">YTD Spend: </span>
                    <span className="font-medium text-slate-100 tabular-nums">AED 186,940</span>
                  </div>
                </div>
              </>
            )
          })()}
        </Panel>
      </Section>

      {/* ── Monthly Spend History ── */}
      <Section title="Monthly Spend History">
        <div className="rounded-xl border border-line bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Month</th>
                  <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-slate-500">Budget</th>
                  <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-slate-500">Spent</th>
                  <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-slate-500">Leads</th>
                  <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-slate-500">CPL</th>
                  <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-slate-500">Util.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {historyRows.map((row, i) => {
                  const util = row.spentAED / row.budgetAED
                  const isCurrent = row.month === 'May 2026'
                  return (
                    <tr key={i} className={`transition hover:bg-surface-2 ${isCurrent ? 'bg-gold/[0.03]' : ''}`}>
                      <td className="px-5 py-4 font-medium text-slate-300">
                        {row.month}
                        {isCurrent && (
                          <span className="ml-2 rounded-full bg-gold/15 px-1.5 py-0.5 text-xs font-medium text-gold">Current</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums text-slate-400">{fmt(row.budgetAED)}</td>
                      <td className="px-5 py-4 text-right tabular-nums text-slate-100">{fmt(row.spentAED)}</td>
                      <td className="px-5 py-4 text-right tabular-nums text-slate-300">{row.leadsGenerated.toLocaleString('en-US')}</td>
                      <td className="px-5 py-4 text-right tabular-nums text-gold">AED {row.avgCpl}</td>
                      <td className="px-5 py-4 text-right">
                        <span className={`text-xs font-medium tabular-nums ${util >= 0.9 ? 'text-red-400' : util >= 0.7 ? 'text-amber-400' : 'text-gold'}`}>
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
      </Section>

      {/* ── Top Spend Campaigns ── */}
      <Section
        title="Top Spend Campaigns"
        action={
          <div className="flex gap-1.5">
            {(['All', 'meta', 'google'] as const).map((p) => {
              const isActive = platformFilter === p
              let activeClass = 'border border-gold/35 bg-gold/10 text-gold'
              if (isActive && p === 'meta') activeClass = 'border border-blue-400/35 bg-blue-400/10 text-blue-300'
              if (isActive && p === 'google') activeClass = 'border border-emerald-400/35 bg-gold/10 text-gold'
              return (
                <button
                  key={p}
                  onClick={() => setPlatformFilter(p)}
                  className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                    isActive
                      ? activeClass
                      : 'border border-line-strong text-slate-400 bg-surface-2 hover:text-slate-300'
                  }`}
                >
                  {p === 'All' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              )
            })}
          </div>
        }
      >
        <div className="rounded-xl border border-line bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Campaign</th>
                  <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Platform</th>
                  <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-slate-500">Spend</th>
                  <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-slate-500">Leads</th>
                  <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-slate-500">CPL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredCampaigns.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500">No items match this filter.</td>
                  </tr>
                ) : (
                  filteredCampaigns.map((c, i) => (
                    <tr key={i} className="transition hover:bg-surface-2">
                      <td className="px-5 py-4 font-medium text-slate-300 max-w-[260px]">
                        <span className="block truncate">{c.name}</span>
                      </td>
                      <td className="px-5 py-4">
                        <PlatformBadge platform={c.platform} />
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums text-slate-100">{fmt(c.spendAED)}</td>
                      <td className="px-5 py-4 text-right tabular-nums text-slate-300">{c.leads}</td>
                      <td className="px-5 py-4 text-right tabular-nums text-gold">AED {c.cpl}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* ── Invoices ── */}
      <Section
        title="Invoices"
        action={
          <div className="flex gap-1.5">
            {(['All', 'paid', 'processing', 'overdue'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setInvoiceFilter(s)}
                className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                  invoiceFilter === s
                    ? 'border border-gold/35 bg-gold/10 text-gold'
                    : 'border border-line-strong text-slate-400 bg-surface-2 hover:text-slate-300'
                }`}
              >
                {s === 'All' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        }
      >
        <div className="rounded-xl border border-line bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Invoice</th>
                  <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Platform</th>
                  <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Period</th>
                  <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-slate-500">Amount</th>
                  <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Due</th>
                  <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-500">No items match this filter.</td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="transition hover:bg-surface-2">
                      <td className="px-5 py-4 font-mono text-xs text-slate-400">{inv.id}</td>
                      <td className="px-5 py-4">
                        <PlatformBadge platform={inv.platform} />
                      </td>
                      <td className="px-5 py-4 text-slate-300">{inv.period}</td>
                      <td className="px-5 py-4 text-right tabular-nums font-medium text-slate-100">{fmt(inv.amountAED)}</td>
                      <td className="px-5 py-4 text-xs text-slate-400">{inv.dueDate}</td>
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
      </Section>

    </div>
  )
}
