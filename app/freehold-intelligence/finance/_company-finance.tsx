'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Wallet, Plus, Loader2, Check, Trash2, Banknote } from 'lucide-react'
import { Section, StatCard, Panel, PanelHeader } from '@/components/freehold/ui'
import { FINANCE_CATEGORIES, type FinanceCategory, type FinanceEntry, type CompanyFinanceSummary } from '@/lib/finance-shared'
import { useT } from '@/lib/i18n/provider'

const CAT_KEY: Record<FinanceCategory, string> = {
  ad_spend: 'finance.cat.ads',
  commission: 'finance.cat.commission',
  salary: 'finance.cat.salaries',
  expense: 'finance.cat.expenses',
  transportation: 'finance.cat.transportation',
  referral: 'finance.cat.referrals',
  other: 'finance.cat.other',
}

interface Payout {
  id: string
  agentName: string
  coAgentName: string
  projectName: string
  leadName: string
  commissionAed: number
  receivedAed: number
  outstandingAed: number
}

function fmt(n: number) {
  if (!n || n <= 0) return 'AED 0'
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `AED ${(n / 1_000).toFixed(0)}K`
  return `AED ${Math.round(n).toLocaleString()}`
}

export function CompanyFinance() {
  const t = useT()
  const [entries, setEntries] = useState<FinanceEntry[]>([])
  const [summary, setSummary] = useState<CompanyFinanceSummary | null>(null)
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [showAdd, setShowAdd] = useState(false)

  const [form, setForm] = useState<{ category: FinanceCategory; amountAed: string; payee: string; description: string; status: 'pending' | 'paid' }>({
    category: 'expense', amountAed: '', payee: '', description: '', status: 'pending',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/freehold/finance/entries', { cache: 'no-store' })
      const data = await res.json()
      setEntries(Array.isArray(data.entries) ? data.entries : [])
      setSummary(data.summary || null)
      setPayouts(Array.isArray(data.payouts) ? data.payouts : [])
    } catch {
      toast.error(t('finance.company.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => { load() }, [load])

  async function addEntry() {
    const amount = Number(form.amountAed)
    if (!Number.isFinite(amount) || amount <= 0) { toast.error(t('finance.company.enterValidAmount')); return }
    setBusy(true)
    try {
      const res = await fetch('/api/freehold/finance/entries', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amountAed: amount }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || t('finance.company.failed'))
      toast.success(t('finance.company.entryAdded'))
      setForm({ category: 'expense', amountAed: '', payee: '', description: '', status: 'pending' })
      setShowAdd(false)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('finance.company.failed'))
    } finally { setBusy(false) }
  }

  async function toggleStatus(e: FinanceEntry) {
    const res = await fetch(`/api/freehold/finance/entries/${e.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: e.status === 'paid' ? 'pending' : 'paid' }),
    })
    if (res.ok) load(); else toast.error(t('finance.company.updateFailed'))
  }

  async function remove(id: string) {
    const res = await fetch(`/api/freehold/finance/entries/${id}`, { method: 'DELETE' })
    if (res.ok) load(); else toast.error(t('finance.company.deleteFailed'))
  }

  async function recordPayout(p: Payout) {
    const input = window.prompt(t('finance.company.recordPrompt', { lead: p.leadName, amount: fmt(p.outstandingAed) }), String(Math.round(p.outstandingAed)))
    if (input === null) return
    const amount = Number(input)
    if (!Number.isFinite(amount) || amount <= 0) { toast.error(t('finance.company.invalidAmount')); return }
    const res = await fetch(`/api/freehold/deals/${p.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'record_payment', amountAed: amount }),
    })
    if (res.ok) { toast.success(t('finance.company.paymentRecorded')); load() } else { const d = await res.json(); toast.error(d?.error || t('finance.company.failed')) }
  }

  const categoryRows = useMemo(() => {
    if (!summary) return []
    return FINANCE_CATEGORIES.map((c) => ({ ...c, total: summary.byCategory[c.key] || 0 }))
  }, [summary])

  if (loading) {
    return <div className="flex items-center justify-center py-10 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /></div>
  }

  return (
    <div className="space-y-8">
      <Section
        title={t('finance.company.title')}
        description={t('finance.company.description')}
        action={
          <button onClick={() => setShowAdd((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg border border-gold/30 bg-gold/10 px-3.5 py-1.5 text-sm font-medium text-gold transition hover:bg-gold/20">
            <Plus className="h-3.5 w-3.5" /> {showAdd ? t('finance.cancel') : t('finance.company.addEntry')}
          </button>
        }
      >
        {/* Bottom line */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label={t('finance.company.netCommission')} value={fmt(summary?.commissionNetAed || 0)} hint={t('finance.company.netCommissionHint')} />
          <StatCard label={t('finance.company.totalExpenses')} value={fmt(summary?.totalExpensesAed || 0)} hint={t('finance.company.totalExpensesHint')} />
          <StatCard label={t('finance.company.netPosition')} value={fmt(summary?.netPositionAed || 0)} hint={t('finance.company.netPositionHint')} delta={summary && summary.netPositionAed < 0 ? { value: t('finance.company.negative'), direction: 'down' } : { value: t('finance.company.positive'), direction: 'up' }} />
          <StatCard label={t('finance.company.commissionOutstanding')} value={fmt(summary?.commissionOutstandingAed || 0)} hint={t('finance.company.commissionOutstandingHint')} delta={summary && summary.commissionOutstandingAed > 0 ? { value: t('finance.company.toPay'), direction: 'down' } : undefined} />
        </div>

        {/* Add entry */}
        {showAdd && (
          <div className="mt-4 rounded-xl border border-gold/20 bg-gold/[0.03] p-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as FinanceCategory }))} className="rounded-lg border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-white outline-none focus:border-gold/40">
                {FINANCE_CATEGORIES.map((c) => <option key={c.key} value={c.key} className="bg-surface">{t(CAT_KEY[c.key])}</option>)}
              </select>
              <input type="number" min={0} value={form.amountAed} onChange={(e) => setForm((f) => ({ ...f, amountAed: e.target.value }))} placeholder={t('finance.company.amountPlaceholder')} className="rounded-lg border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-gold/40" />
              <input value={form.payee} onChange={(e) => setForm((f) => ({ ...f, payee: e.target.value }))} placeholder={t('finance.company.payeePlaceholder')} className="rounded-lg border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-gold/40" />
              <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder={t('finance.company.descriptionPlaceholder')} className="col-span-2 md:col-span-2 rounded-lg border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-gold/40" />
              <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as 'pending' | 'paid' }))} className="rounded-lg border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-white outline-none focus:border-gold/40">
                <option value="pending" className="bg-surface">{t('finance.status.optPending')}</option>
                <option value="paid" className="bg-surface">{t('finance.status.optPaid')}</option>
              </select>
            </div>
            <button onClick={addEntry} disabled={busy} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-medium text-gold transition hover:bg-gold/20 disabled:opacity-50">
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {t('finance.company.saveEntry')}
            </button>
          </div>
        )}

        {/* Category breakdown */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {categoryRows.map((c) => (
            <div key={c.key} className="rounded-xl border border-line bg-surface-2 p-4">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">{t(CAT_KEY[c.key])}</div>
              <div className="mt-1 text-[15px] font-bold tabular-nums text-white">{fmt(c.total)}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Commission payouts */}
      <Panel>
        <PanelHeader title={t('finance.company.payouts')} action={<span className="text-xs text-slate-500">{t('finance.company.payoutsAction')}</span>} />
        <div className="divide-y divide-line">
          {payouts.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-slate-500">{t('finance.company.noOutstanding')}</div>
          ) : payouts.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-slate-100">{p.leadName} · {p.projectName || '—'}</div>
                <div className="text-xs text-slate-500">{p.agentName}{p.coAgentName ? ` + ${p.coAgentName}` : ''}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold tabular-nums text-white">{fmt(p.outstandingAed)}</div>
                <div className="text-xs text-slate-500">{t('finance.company.of', { amount: fmt(p.commissionAed) })}</div>
              </div>
              <button onClick={() => recordPayout(p)} className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-medium text-emerald-400 transition hover:bg-emerald-500/20">
                <Banknote className="h-3.5 w-3.5" /> {t('finance.company.recordPayment')}
              </button>
            </div>
          ))}
        </div>
      </Panel>

      {/* Expense ledger */}
      <Panel>
        <PanelHeader title={t('finance.company.expenseLedger')} action={<span className="text-xs text-slate-500">{t('finance.company.entries', { count: entries.length })}</span>} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2">
                {[
                  { key: 'category', label: t('finance.company.colCategory') },
                  { key: 'description', label: t('finance.company.colDescription') },
                  { key: 'payee', label: t('finance.company.colPayee') },
                  { key: 'amount', label: t('finance.company.colAmount') },
                  { key: 'status', label: t('finance.company.colStatus') },
                  { key: 'actions', label: '' },
                ].map((h) => (
                  <th key={h.key} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{h.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {entries.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">{t('finance.company.noEntries')}</td></tr>
              ) : entries.map((e) => (
                <tr key={e.id} className="hover:bg-surface-2">
                  <td className="px-4 py-3"><span className="rounded-full border border-line-strong bg-surface px-2 py-0.5 text-xs text-slate-300">{t(CAT_KEY[e.category])}</span></td>
                  <td className="px-4 py-3 text-slate-300">{e.description || '—'}</td>
                  <td className="px-4 py-3 text-slate-400">{e.payee || '—'}</td>
                  <td className="px-4 py-3 font-semibold tabular-nums text-white">{fmt(e.amountAed)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleStatus(e)} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${e.status === 'paid' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                      {e.status === 'paid' ? <Check className="h-3 w-3" /> : null}{e.status === 'paid' ? t('finance.status.paid') : t('finance.status.pending')}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => remove(e.id)} className="text-slate-500 transition hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
