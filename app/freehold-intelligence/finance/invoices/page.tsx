'use client'

import { useState } from 'react'
import { Download, FileText } from 'lucide-react'
import { financeSummary } from '@/src/features/freehold-intelligence/finance'

function fmt(n: number) { return 'AED ' + n.toLocaleString('en-US') }

function PlatformBadge({ platform }: { platform: 'meta' | 'google' }) {
  return platform === 'meta' ? (
    <span className="inline-flex items-center rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[13px] font-medium text-blue-400">Meta</span>
  ) : (
    <span className="inline-flex items-center rounded-md border border-[#D4AF37]/20 bg-[#D4AF37]/10 px-2 py-0.5 text-[13px] font-medium text-[#D4AF37]">Google</span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid:       'border-[#D4AF37]/20 bg-[#D4AF37]/10 text-[#D4AF37]',
    processing: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
    overdue:    'border-red-500/20 bg-red-500/10 text-red-400',
    pending:    'border-white/[0.08] bg-white/[0.04] text-white/45',
  }
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[13px] font-medium ${map[status] ?? map.pending}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

type Filter = 'All' | 'paid' | 'processing' | 'overdue' | 'pending'

export default function InvoicesPage() {
  const [filter, setFilter] = useState<Filter>('All')
  const all = financeSummary.invoices
  const visible = filter === 'All' ? all : all.filter((i) => i.status === filter)

  const totalPending = all.filter((i) => i.status === 'processing' || i.status === 'pending').reduce((s, i) => s + i.amountAED, 0)
  const totalPaid    = all.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amountAED, 0)

  return (
    <div className="p-6 lg:p-8 space-y-7">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white/90">Invoices</h1>
          <p className="mt-1 text-sm text-white/40">Platform billing — Meta Ads & Google Ads</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[13px] text-white/55 transition hover:border-white/20 hover:text-white/80">
          <Download className="h-3.5 w-3.5" /> Export CSV
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total Invoices', value: all.length.toString() },
          { label: 'Paid',          value: all.filter((i) => i.status === 'paid').length.toString(), accent: 'text-[#D4AF37]' },
          { label: 'Processing',    value: all.filter((i) => i.status === 'processing').length.toString(), accent: 'text-amber-400' },
          { label: 'Amount Pending',value: fmt(totalPending), accent: 'text-amber-400' },
        ].map(({ label, value, accent }) => (
          <div key={label} className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-4">
            <div className="text-[12px] font-medium uppercase tracking-wider text-white/35">{label}</div>
            <div className={`mt-2 text-xl font-semibold tabular-nums ${accent ?? 'text-white/80'}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-1.5">
        {(['All', 'paid', 'processing', 'overdue', 'pending'] as Filter[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 text-[13px] font-medium transition border ${
              filter === s
                ? 'border-[#D4AF37]/35 bg-[#D4AF37]/10 text-[#D4AF37]'
                : 'border-white/[0.08] text-white/40 hover:text-white/65'
            }`}
          >
            {s === 'All' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/[0.05] bg-white/[0.03] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.05]">
                {['Invoice ID', 'Platform', 'Period', 'Issued', 'Due Date', 'Amount', 'Status', ''].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-left text-[12px] font-medium uppercase tracking-wider text-white/35 last:text-right">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[13px] text-white/30">No invoices match this filter.</td>
                </tr>
              ) : visible.map((inv) => (
                <tr key={inv.id} className="transition hover:bg-white/[0.02]">
                  <td className="px-5 py-4 font-mono text-[12px] text-white/55">{inv.id}</td>
                  <td className="px-5 py-4"><PlatformBadge platform={inv.platform} /></td>
                  <td className="px-5 py-4 text-white/65">{inv.period}</td>
                  <td className="px-5 py-4 text-white/45 text-[13px]">{inv.issuedDate}</td>
                  <td className="px-5 py-4 text-white/45 text-[13px]">{inv.dueDate}</td>
                  <td className="px-5 py-4 text-right tabular-nums font-medium text-white/85">{fmt(inv.amountAED)}</td>
                  <td className="px-5 py-4"><StatusBadge status={inv.status} /></td>
                  <td className="px-5 py-4 text-right">
                    <button className="inline-flex items-center gap-1.5 text-[13px] text-white/35 transition hover:text-white/65">
                      <FileText className="h-3.5 w-3.5" /> PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-white/[0.04] px-5 py-3 flex items-center justify-between">
          <span className="text-[13px] text-white/30">{visible.length} invoice{visible.length !== 1 ? 's' : ''}</span>
          <span className="text-[13px] text-white/45">
            Paid: <span className="text-[#D4AF37] tabular-nums">{fmt(totalPaid)}</span>
            <span className="mx-2 text-white/20">·</span>
            Pending: <span className="text-amber-400 tabular-nums">{fmt(totalPending)}</span>
          </span>
        </div>
      </div>
    </div>
  )
}
