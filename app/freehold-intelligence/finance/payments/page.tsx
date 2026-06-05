import { financeSummary } from '@/src/features/freehold-intelligence/finance'
import { CheckCircle2, Clock } from 'lucide-react'

function fmt(n: number) { return 'AED ' + n.toLocaleString('en-US') }

export default function PaymentsPage() {
  const paid = financeSummary.invoices.filter((i) => i.status === 'paid')
  const pending = financeSummary.invoices.filter((i) => i.status === 'processing' || i.status === 'pending')
  const history = financeSummary.monthlyHistory.filter((r) => r.platform === 'total')

  return (
    <div className="p-6 lg:p-8 space-y-7">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white/90">Payments</h1>
        <p className="mt-1 text-sm text-white/40">Payment history and upcoming charges</p>
      </div>

      {/* Upcoming */}
      {pending.length > 0 && (
        <section>
          <div className="mb-4 flex items-center gap-2 text-[12px] font-medium uppercase tracking-wider text-amber-400/80">
            <Clock className="h-3.5 w-3.5" /> Upcoming Payments
          </div>
          <div className="space-y-3">
            {pending.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between rounded-2xl border border-amber-500/15 bg-amber-500/[0.04] px-5 py-4">
                <div>
                  <div className="font-medium text-white/85">{inv.id}</div>
                  <div className="mt-0.5 text-[13px] text-white/40">{inv.period} · Due {inv.dueDate}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold tabular-nums text-amber-400">{fmt(inv.amountAED)}</div>
                  <div className="mt-0.5 text-[13px] text-amber-400/60 capitalize">{inv.status}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Payment history */}
      <section>
        <div className="mb-4 flex items-center gap-2 text-[12px] font-medium uppercase tracking-wider text-white/40">
          <CheckCircle2 className="h-3.5 w-3.5" /> Payment History
        </div>
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.03] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.05]">
                {['Invoice', 'Platform', 'Period', 'Paid On', 'Amount'].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-left text-[12px] font-medium uppercase tracking-wider text-white/35 last:text-right">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {paid.map((inv) => (
                <tr key={inv.id} className="transition hover:bg-white/[0.02]">
                  <td className="px-5 py-4 font-mono text-[12px] text-white/55">{inv.id}</td>
                  <td className="px-5 py-4 text-white/65 capitalize">{inv.platform === 'meta' ? 'Meta Ads' : 'Google Ads'}</td>
                  <td className="px-5 py-4 text-white/65">{inv.period}</td>
                  <td className="px-5 py-4 text-white/45 text-[13px]">{inv.dueDate}</td>
                  <td className="px-5 py-4 text-right tabular-nums font-medium text-[#D4AF37]">{fmt(inv.amountAED)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Monthly totals */}
      <section>
        <div className="mb-4 text-[12px] font-medium uppercase tracking-wider text-white/40">Monthly Totals</div>
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.03] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.05]">
                {['Month', 'Budget', 'Actual Spend', 'Leads', 'Avg CPL', 'Δ vs Budget'].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-left text-[12px] font-medium uppercase tracking-wider text-white/35 last:text-right">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {history.map((row, i) => {
                const delta = row.spentAED - row.budgetAED
                const isCurrent = row.month === 'May 2026'
                return (
                  <tr key={i} className={`transition hover:bg-white/[0.02] ${isCurrent ? 'bg-[#D4AF37]/[0.02]' : ''}`}>
                    <td className="px-5 py-4 font-medium text-white/75">
                      {row.month}
                      {isCurrent && <span className="ml-2 rounded-full bg-[#D4AF37]/15 px-1.5 py-0.5 text-[11px] text-[#D4AF37]">Current</span>}
                    </td>
                    <td className="px-5 py-4 tabular-nums text-white/50">{fmt(row.budgetAED)}</td>
                    <td className="px-5 py-4 tabular-nums text-white/80">{fmt(row.spentAED)}</td>
                    <td className="px-5 py-4 tabular-nums text-white/65">{row.leadsGenerated}</td>
                    <td className="px-5 py-4 tabular-nums text-[#D4AF37]">AED {row.avgCpl}</td>
                    <td className="px-5 py-4 text-right tabular-nums">
                      <span className={delta < 0 ? 'text-[#D4AF37]' : 'text-white/40'}>
                        {delta < 0 ? `−${fmt(Math.abs(delta))}` : `+${fmt(delta)}`}
                      </span>
                    </td>
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
