'use client'

import { DollarSign } from 'lucide-react'
import { PageHeader, StatCard, Section } from '@/components/freehold/ui'
import { useT } from '@/lib/i18n/provider'

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
  const t = useT()
  const spend = realSpend ?? { totalSpend30d: 0, totalLeads30d: 0, avgCpl30d: 0, monthly: [] }
  const hasSpend = spend.totalSpend30d > 0 || spend.monthly.some((m) => m.spentAed > 0)

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <PageHeader
        eyebrow={t('finance.eyebrow')}
        Icon={DollarSign}
        title={t('finance.overview.title')}
        subtitle={t('finance.overview.subtitle')}
      />

      {/* ── Marketing spend (real, from ad_spend ledger) ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t('finance.overview.adSpend30d')} value={fmtCompact(spend.totalSpend30d)} hint={t('finance.overview.adSpendHint')} />
        <StatCard label={t('finance.overview.leads30d')} value={spend.totalLeads30d} hint={t('finance.overview.leadsHint')} delta={spend.totalLeads30d > 0 ? { value: t('finance.overview.leadsIncoming'), direction: 'up' } : undefined} />
        <StatCard label={t('finance.overview.avgCpl30d')} value={spend.avgCpl30d > 0 ? `AED ${spend.avgCpl30d}` : '—'} hint={t('finance.overview.cplHint')} />
      </div>

      {/* ── Sales & Commission (deal-backed, real) ── */}
      {dealTotals && (
        <Section title={t('finance.overview.salesCommission')} description={dealTotals.approvedDeals === 1 ? t('finance.overview.approvedDeals', { count: dealTotals.approvedDeals }) : t('finance.overview.approvedDealsPlural', { count: dealTotals.approvedDeals })}>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label={t('finance.overview.totalSales')} value={fmtCompact(dealTotals.totalSalesAed)} hint={t('finance.overview.totalSalesHint')} />
            <StatCard label={t('finance.overview.totalCommission')} value={fmtCompact(dealTotals.totalCommissionAed)} hint={t('finance.overview.totalCommissionHint')} />
            <StatCard label={t('finance.overview.totalPaid')} value={fmtCompact(dealTotals.totalPaidAed)} hint={t('finance.overview.totalPaidHint')} />
            <StatCard label={t('finance.overview.outstanding')} value={fmtCompact(dealTotals.totalOutstandingAed)} hint={t('finance.overview.outstandingHint')} delta={dealTotals.totalOutstandingAed > 0 ? { value: t('finance.overview.awaiting'), direction: 'down' } : undefined} />
          </div>
        </Section>
      )}

      {/* ── Ad spend by month (real) ── */}
      <Section title={t('finance.overview.adSpend6mo')} description={t('finance.overview.adSpend6moDesc')}>
        <div className="rounded-xl border border-line bg-surface overflow-hidden">
          {!hasSpend ? (
            <div className="px-5 py-10 text-center text-sm text-slate-500">
              {t('finance.overview.noSpend')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-slate-500">{t('finance.overview.month')}</th>
                    <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-slate-500">{t('finance.overview.adSpendCol')}</th>
                    <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-slate-500">{t('finance.overview.leadsCol')}</th>
                    <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-slate-500">{t('finance.overview.cplCol')}</th>
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
