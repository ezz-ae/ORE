'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Download, FileText, CheckCircle2, Clock, Loader2 } from 'lucide-react'
import { PageHeader, StatCard, buttonClass } from '@/components/freehold/ui'
import { type FinanceCategory, type FinanceEntry } from '@/lib/finance-shared'
import { useT } from '@/lib/i18n/provider'

function fmt(n: number) {
  if (!n || n <= 0) return 'AED 0'
  return 'AED ' + Math.round(n).toLocaleString('en-US')
}

const CAT_KEY: Record<FinanceCategory, string> = {
  ad_spend: 'finance.cat.ads',
  commission: 'finance.cat.commission',
  salary: 'finance.cat.salaries',
  expense: 'finance.cat.expenses',
  transportation: 'finance.cat.transportation',
  referral: 'finance.cat.referrals',
  other: 'finance.cat.other',
}

type Filter = 'All' | 'paid' | 'pending'

export default function InvoicesPage() {
  const t = useT()
  const [entries, setEntries] = useState<FinanceEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('All')
  const [busy, setBusy] = useState<string | null>(null)

  function catLabel(cat: FinanceCategory) {
    return CAT_KEY[cat] ? t(CAT_KEY[cat]) : cat
  }

  function downloadCsv(filename: string, rows: (string | number)[][]) {
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = filename
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
    toast.success(t('finance.invoices.downloaded', { file: filename }))
  }

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
    } catch { toast.error(t('finance.invoices.updateFailed')) } finally { setBusy(null) }
  }

  const FILTERS: { id: Filter; label: string }[] = [
    { id: 'All', label: t('finance.invoices.filterAll', { count: entries.length }) },
    { id: 'paid', label: t('finance.invoices.filterPaid', { count: entries.filter((e) => e.status === 'paid').length }) },
    { id: 'pending', label: t('finance.invoices.filterPending', { count: entries.filter((e) => e.status === 'pending').length }) },
  ]

  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-7 sm:px-8">
      <PageHeader
        eyebrow={t('finance.eyebrow')}
        Icon={FileText}
        title={t('finance.invoices.title')}
        subtitle={t('finance.invoices.subtitle')}
        actions={
          <button
            onClick={() => downloadCsv('invoices.csv', [
              [t('finance.invoices.csvCategory'), t('finance.invoices.csvDescription'), t('finance.invoices.csvPayee'), t('finance.invoices.csvAmount'), t('finance.invoices.csvStatus'), t('finance.invoices.csvDate')],
              ...visible.map((e) => [catLabel(e.category), e.description, e.payee, Math.round(e.amountAed), e.status, e.entryDate || '']),
            ])}
            className={buttonClass('secondary', 'sm')}>
            <Download className="h-3.5 w-3.5" /> {t('finance.invoices.exportCsv')}
          </button>
        }
      />

      <div className="mt-5 mb-5 grid grid-cols-3 gap-3">
        <StatCard label={t('finance.invoices.totalBills')} value={entries.length} />
        <StatCard label={t('finance.invoices.paid')} value={fmt(totalPaid)} delta={{ value: t('finance.invoices.settled'), direction: 'up' }} />
        <StatCard label={t('finance.invoices.outstanding')} value={fmt(totalPending)} delta={totalPending > 0 ? { value: t('finance.invoices.toPay'), direction: 'down' } : undefined} />
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
              {entries.length === 0 ? t('finance.invoices.noBills') : t('finance.invoices.noMatch')}
            </div>
          ) : visible.map((e) => (
            <div key={e.id} className="flex items-center gap-4 px-5 py-4">
              {e.status === 'paid' ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" /> : <Clock className="h-4 w-4 shrink-0 text-amber-400" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-slate-100 truncate">{e.description || (CAT_KEY[e.category] ? t(CAT_KEY[e.category]) : '') || t('finance.invoices.expense')}</span>
                  <span className="rounded-full border border-line-strong bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">{catLabel(e.category)}</span>
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
                  {busy === e.id ? '…' : e.status === 'paid' ? t('finance.invoices.markUnpaid') : t('finance.invoices.markPaid')}
                </button>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between px-5 py-3 border-t border-line">
            <span className="text-xs text-slate-500">{visible.length === 1 ? t('finance.invoices.billCount', { count: visible.length }) : t('finance.invoices.billCountPlural', { count: visible.length })}</span>
            <span className="text-xs text-slate-400">
              {t('finance.invoices.paidLabel')} <span className="text-emerald-400 font-medium tabular-nums">{fmt(totalPaid)}</span>
              <span className="mx-2 text-slate-700">·</span>
              {t('finance.invoices.outstandingLabel')} <span className="text-amber-400 font-medium tabular-nums">{fmt(totalPending)}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
