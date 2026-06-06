'use client'

import { useState } from 'react'
import { Download, FileText, CheckCircle2, Clock, AlertCircle, ArrowDownToLine } from 'lucide-react'
import { financeSummary } from '@/src/features/freehold-intelligence/finance'

function fmt(n: number) { return 'AED ' + n.toLocaleString('en-US') }

const PLATFORM_STYLE: Record<string, string> = {
  meta:   'text-blue-400   bg-blue-400/10   border-blue-400/20',
  google: 'text-[#D4AF37] bg-[#D4AF37]/10 border-[#D4AF37]/20',
}

const STATUS_STYLE: Record<string, string> = {
  paid:       'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  processing: 'text-amber-400   bg-amber-400/10   border-amber-400/20',
  overdue:    'text-red-400     bg-red-400/10     border-red-400/20',
  pending:    'text-white/40    bg-white/[0.04]   border-white/10',
}

const STATUS_ICON: Record<string, React.ElementType> = {
  paid: CheckCircle2, processing: Clock, overdue: AlertCircle, pending: Clock,
}

type Filter = 'All' | 'paid' | 'processing' | 'overdue' | 'pending'

export default function InvoicesPage() {
  const [filter,    setFilter]    = useState<Filter>('All')
  const [expanded,  setExpanded]  = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)

  const all     = financeSummary.invoices
  const visible = filter === 'All' ? all : all.filter((i) => i.status === filter)

  const totalPending = all.filter((i) => ['processing', 'pending'].includes(i.status)).reduce((s, i) => s + i.amountAED, 0)
  const totalPaid    = all.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amountAED, 0)

  function download(id: string) {
    setDownloading(id)
    setTimeout(() => setDownloading(null), 1500)
  }

  const FILTERS: { id: Filter; label: string }[] = [
    { id: 'All',        label: `All (${all.length})` },
    { id: 'paid',       label: `Paid (${all.filter((i) => i.status === 'paid').length})` },
    { id: 'processing', label: `Processing (${all.filter((i) => i.status === 'processing').length})` },
    { id: 'overdue',    label: `Overdue (${all.filter((i) => i.status === 'overdue').length})` },
    { id: 'pending',    label: `Pending (${all.filter((i) => i.status === 'pending').length})` },
  ]

  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-7 sm:px-8">

      <div className="mb-7 flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-semibold text-white">Invoices</h1>
          <p className="mt-1 text-[12px] text-white/30">Platform billing — Meta Ads &amp; Google Ads</p>
        </div>
        <button className="flex items-center gap-1.5 rounded-full border border-white/[0.08] px-3 py-1.5 text-[12px] text-white/40 transition hover:text-white/70">
          <Download className="h-3.5 w-3.5" /> Export CSV
        </button>
      </div>

      {/* Summary tiles */}
      <div className="mb-5 grid grid-cols-4 gap-3">
        {[
          { label: 'Total',    value: all.length.toString(),                              color: 'text-white/70'    },
          { label: 'Paid',     value: all.filter((i) => i.status === 'paid').length.toString(), color: 'text-emerald-400' },
          { label: 'Processing', value: all.filter((i) => i.status === 'processing').length.toString(), color: 'text-amber-400' },
          { label: 'Pending',  value: fmt(totalPending),                                  color: 'text-amber-400'   },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-[14px] border border-white/[0.07] bg-[#131B2B] p-3.5">
            <div className="text-[10px] text-white/25 uppercase tracking-wider">{label}</div>
            <div className={`mt-1.5 text-[17px] font-semibold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Overdue alert */}
      {all.some((i) => i.status === 'overdue') && (
        <div className="mb-5 flex items-start gap-3 rounded-[14px] border border-red-400/15 bg-red-400/[0.04] px-4 py-3.5">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <div>
            <div className="text-[13px] font-medium text-red-300">Overdue payment</div>
            <div className="mt-0.5 text-[12px] text-white/35">
              {all.filter((i) => i.status === 'overdue').map((i) => `${i.id} — ${fmt(i.amountAED)}`).join(' · ')}
            </div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map(({ id, label }) => (
          <button key={id} onClick={() => setFilter(id)}
            className={`rounded-full border px-3 py-1 text-[12px] font-medium transition ${
              filter === id
                ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400'
                : 'border-white/[0.07] text-white/35 hover:text-white/65'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Invoice list */}
      <div className="rounded-[16px] border border-white/[0.07] bg-[#131B2B] divide-y divide-white/[0.04] overflow-hidden">
        {visible.length === 0
          ? <div className="px-5 py-10 text-center text-[13px] text-white/25">No invoices match this filter.</div>
          : visible.map((inv) => {
              const StatusIcon = STATUS_ICON[inv.status] ?? Clock
              const isExpanded = expanded === inv.id
              const isDownloading = downloading === inv.id
              return (
                <div key={inv.id}>
                  <button className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-white/[0.02] transition"
                    onClick={() => setExpanded(isExpanded ? null : inv.id)}>
                    <StatusIcon className={`h-4 w-4 shrink-0 ${STATUS_STYLE[inv.status].split(' ')[0]}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[12px] text-white/55">{inv.id}</span>
                        <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${PLATFORM_STYLE[inv.platform]}`}>
                          {inv.platform === 'meta' ? 'Meta' : 'Google'}
                        </span>
                        <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${STATUS_STYLE[inv.status]}`}>
                          {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-white/25">
                        {inv.period} · Due {inv.dueDate}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[14px] font-semibold text-white/75 tabular-nums">{fmt(inv.amountAED)}</span>
                      <button onClick={(e) => { e.stopPropagation(); download(inv.id) }}
                        className="flex items-center gap-1 text-white/20 hover:text-white/60 transition">
                        {isDownloading
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          : <ArrowDownToLine className="h-4 w-4" />
                        }
                      </button>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-white/[0.04] bg-white/[0.01] px-5 py-4">
                      <div className="grid grid-cols-3 gap-4 text-[12px]">
                        {[
                          { label: 'Invoice date', value: inv.issuedDate },
                          { label: 'Due date',     value: inv.dueDate    },
                          { label: 'Platform',     value: inv.platform === 'meta' ? 'Meta Platforms Inc.' : 'Google LLC' },
                        ].map(({ label, value }) => (
                          <div key={label}>
                            <div className="text-[10px] text-white/25 uppercase tracking-wider">{label}</div>
                            <div className="mt-1 text-white/60">{value}</div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 flex items-center gap-2 pt-3 border-t border-white/[0.04]">
                        <button onClick={() => download(inv.id)}
                          className="flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/[0.07] px-3 py-1.5 text-[12px] font-medium text-emerald-400 transition hover:bg-emerald-400/15">
                          <FileText className="h-3.5 w-3.5" /> Download PDF
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
        }

        {/* Footer total */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.04]">
          <span className="text-[11px] text-white/25">{visible.length} invoice{visible.length !== 1 ? 's' : ''}</span>
          <span className="text-[11px] text-white/40">
            Paid <span className="text-emerald-400 font-medium tabular-nums">{fmt(totalPaid)}</span>
            <span className="mx-2 text-white/15">·</span>
            Pending <span className="text-amber-400 font-medium tabular-nums">{fmt(totalPending)}</span>
          </span>
        </div>
      </div>

    </div>
  )
}
