'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Download, FileText, CheckCircle2, Clock, Loader2 } from 'lucide-react'
import { PageHeader, StatCard, buttonClass } from '@/components/freehold/ui'
import { FINANCE_CATEGORIES, type FinanceEntry } from '@/lib/finance-shared'

function fmt(n: number) {
  if (!n || n <= 0) return 'AED 0'
  return 'AED ' + Math.round(n).toLocaleString('en-US')
}

const CAT_LABEL = Object.fromEntries(FINANCE_CATEGORIES.map((c) => [c.key, c.label])) as Record<string, string>

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
  toast.success(filename + ' downloaded')
}

type Filter = 'All' | 'paid' | 'pending'

export default function InvoicesPage() {
  const [entries, setEntries] = useState<FinanceEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('All')
  const [busy, setBusy] = useState<string | null>(null)

  function load() {
    fetch('/api/freehold/finance/entries', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.entries) setEntries(d.entries) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const visible = filter === 'All' ? entries : entries.filter((e) => e.status === filter)
  const totalPaid = entries.filter((e) => e.status === 'paid').reduce((s, e) => s + e.amountAed, 0)
  const totalPending = entries.filter((e) => e.status === 'pending').reduce((s, e) => s + e.amountAed, 0)

  async function togglePaid(e: FinanceEntry) {
    setBusy(e.id)
    try {
      const res = await fetch(`/api/freehold/finance/entries/${e.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: e.status === 'paid' ? 'pending' : 'paid' }),
      })
      if (!res.ok) throw new Error('Failed')
      load()
    } catch { toast.error('Update failed') } finally { setBusy(null) }
  }

  const FILTERS: { id: Filter; label: string }[] = [
    { id: 'All', label: `All (${entries.length})` },
    { id: 'paid', label: `Paid (${entries.filter((e) => e.status === 'paid').length})` },
    { id: 'pending', label: `Pending (${entries.filter((e) => e.status === 'pending').length})` },
  ]

  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-7 sm:px-8">
      <PageHeader
        eyebrow="Finance"
        Icon={FileText}
        title="Bills & Invoices"
        subtitle="Company expenses and vendor bills from the finance ledger"
        actions={
          <button
            onClick={() => downloadCsv('invoices.csv', [
              ['Category', 'Description', 'Payee', 'Amount AED', 'Status', 'Date'],
              ...visible.map((e) => [CAT_LABEL[e.category] || e.category, e.description, e.payee, Math.round(e.amountAed), e.status, e.entryDate || '']),
            ])}
            className={buttonClass('secondary', 'sm')}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        }
      />

      <div className="mt-5 mb-5 grid grid-cols-3 gap-3">
        <StatCard label="Total bills" value={entries.length} />
        <StatCard label="Paid" value={fmt(totalPaid)} delta={{ value: 'settled', direction: 'up' }} />
        <StatCard label="Outstanding" value={fmt(totalPending)} delta={totalPending > 0 ? { value: 'to pay', direction: 'down' } : undefined} />
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map(({ id, label }) => (
          <button key={id} onClick={() => setFilter(id)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${filter === id ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400' : 'border-line text-slate-500 hover:text-slate-300'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <div className="rounded-[16px] border border-line bg-surface divide-y divide-line overflow-hidden">
          {visible.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-500">
              {entries.length === 0 ? 'No bills yet — add expenses in Finance → Company Finance.' : 'No bills match this filter.'}
            </div>
          ) : visible.map((e) => (
            <div key={e.id} className="flex items-center gap-4 px-5 py-4">
              {e.status === 'paid' ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" /> : <Clock className="h-4 w-4 shrink-0 text-amber-400" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-slate-100 truncate">{e.description || CAT_LABEL[e.category] || 'Expense'}</span>
                  <span className="rounded-full border border-line-strong bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">{CAT_LABEL[e.category] || e.category}</span>
                </div>
                <div className="mt-0.5 text-xs text-slate-500">{e.payee || '—'}{e.entryDate ? ` · ${e.entryDate}` : ''}</div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[14px] font-semibold text-slate-300 tabular-nums">{fmt(e.amountAed)}</span>
                <button
                  onClick={() => togglePaid(e)}
                  disabled={busy === e.id}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition disabled:opacity-50 ${e.status === 'paid' ? 'border-line text-slate-400 hover:text-slate-200' : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/20'}`}
                >
                  {busy === e.id ? '…' : e.status === 'paid' ? 'Mark unpaid' : 'Mark paid'}
                </button>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between px-5 py-3 border-t border-line">
            <span className="text-xs text-slate-500">{visible.length} bill{visible.length !== 1 ? 's' : ''}</span>
            <span className="text-xs text-slate-400">
              Paid <span className="text-emerald-400 font-medium tabular-nums">{fmt(totalPaid)}</span>
              <span className="mx-2 text-slate-700">·</span>
              Outstanding <span className="text-amber-400 font-medium tabular-nums">{fmt(totalPending)}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
