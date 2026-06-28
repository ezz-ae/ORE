'use client'

import { DollarSign } from 'lucide-react'
import { PageHeader, StatCard, Section } from '@/components/freehold/ui'

interface DealTotals {
  totalSalesAed: number
  totalCommissionAed: number
  netCommissionAed: number
  totalPaidAed: number
  totalOutstandingAed: number
  approvedDeals: number
}

interface RealSpend {
  totalSpend30d: number
  totalLeads30d: number
  avgCpl30d: number
  monthly: { month: string; spentAed: number; leads: number; cpl: number }[]
}

interface FinanceClientProps {
  creditBalances?: Record<string, unknown>[]
  ledgerSummary?: Record<string, unknown>[]
  dealTotals?: DealTotals
  realSpend?: RealSpend
}

function fmtCompact(n: number) {
  if (!n || n <= 0) return 'AED 0'
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `AED ${(n / 1_000).toFixed(0)}K`
  return `AED ${Math.round(n).toLocaleString()}`
}

export default function FinanceClient({ dealTotals, realSpend }: FinanceClientProps) {
  const spend = realSpend ?? { totalSpend30d: 0, totalLeads30d: 0, avgCpl30d: 0, monthly: [] }
  const hasSpend = spend.totalSpend30d > 0 || spend.monthly.some((m) => m.spentAed > 0)

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <PageHeader
        eyebrow="Finance"
        Icon={DollarSign}
        title="Finance & Billing"
        subtitle="Ad spend, commission, and operating costs"
      />

      {/* ── Marketing spend (real, from ad_spend ledger) ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Ad Spend (30d)" value={fmtCompact(spend.totalSpend30d)} hint="Logged ad_spend · last 30 days" />
        <StatCard label="Leads (30d)" value={spend.totalLeads30d} hint="New leads · last 30 days" delta={spend.totalLeads30d > 0 ? { value: 'incoming', direction: 'up' } : undefined} />
        <StatCard label="Avg CPL (30d)" value={spend.avgCpl30d > 0 ? `AED ${spend.avgCpl30d}` : '—'} hint="Cost per lead" />
      </div>

      {/* ── Sales & Commission (deal-backed, real) ── */}
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

      {/* ── Ad spend by month (real) ── */}
      <Section title="Ad Spend — Last 6 Months" description="From the ad_spend category in your finance ledger">
        <div className="rounded-xl border border-line bg-surface overflow-hidden">
          {!hasSpend ? (
            <div className="px-5 py-10 text-center text-sm text-slate-500">
              No ad spend logged yet — add entries under Finance → Company Finance (category “Ads”).
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Month</th>
                    <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-slate-500">Ad Spend</th>
                    <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-slate-500">Leads</th>
                    <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-slate-500">CPL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {spend.monthly.map((row, i) => (
                    <tr key={i} className="transition hover:bg-surface-2">
                      <td className="px-5 py-4 font-medium text-slate-300">{row.month}</td>
                      <td className="px-5 py-4 text-right tabular-nums text-slate-100">{fmtCompact(row.spentAed)}</td>
                      <td className="px-5 py-4 text-right tabular-nums text-slate-300">{row.leads.toLocaleString('en-US')}</td>
                      <td className="px-5 py-4 text-right tabular-nums text-gold">{row.cpl > 0 ? `AED ${row.cpl}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Section>
    </div>
  )
}
