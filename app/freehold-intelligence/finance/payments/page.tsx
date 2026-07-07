'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { CreditCard, Loader2 } from 'lucide-react'
import { PageHeader, StatCard } from '@/components/freehold/ui'
import { useT } from '@/lib/i18n/provider'

// Broker commission payouts — REAL money from approved deals. The old sample
// cards, wire-transfer history and payment schedule are gone: what you see is
// what the deals ledger actually owes, and "record payment" writes to it.

function fmt(n: number) {
  if (!n || n <= 0) return 'AED 0'
  return 'AED ' + Math.round(n).toLocaleString('en-US')
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

export default function PaymentsPage() {
  const t = useT()
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [loading, setLoading] = useState(true)
  const [payingId, setPayingId] = useState<string | null>(null)

  function loadPayouts() {
    fetch('/api/freehold/finance/entries', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.payouts) setPayouts(d.payouts) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => { loadPayouts() }, [])

  async function payCommission(p: Payout) {
    if (!window.confirm(t('finance.payments.confirmPay', { agent: p.agentName, amount: fmt(p.outstandingAed) }))) return
    setPayingId(p.id)
    try {
      const res = await fetch(`/api/freehold/deals/${p.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'record_payment', amountAed: p.outstandingAed }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed')
      toast.success(t('finance.payments.commissionPaid', { agent: p.agentName }))
      loadPayouts()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('finance.payments.paymentFailed'))
    } finally { setPayingId(null) }
  }

  const pendingCommissions = payouts.reduce((sum, p) => sum + p.outstandingAed, 0)
  const receivedTotal = payouts.reduce((sum, p) => sum + p.receivedAed, 0)

  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-7 sm:px-8">

      <PageHeader
        eyebrow={t('finance.eyebrow')}
        Icon={CreditCard}
        title={t('finance.payments.title')}
        subtitle={t('finance.payments.subtitle')}
      />

      <div className="mt-5 mb-6 grid grid-cols-2 gap-3">
        <StatCard label={t('finance.payments.pendingPayouts')} value={fmt(pendingCommissions)} hint={t('finance.payments.agentCommissions')} />
        <StatCard label={t('finance.payments.recordedPaid')} value={fmt(receivedTotal)} hint={t('finance.payments.acrossOpenDeals')} />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 rounded-[16px] border border-line bg-surface px-5 py-6 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> {t('common.loading')}
        </div>
      ) : (
        <div className="rounded-[16px] border border-line bg-surface divide-y divide-line overflow-hidden">
          {payouts.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-500">{t('finance.payments.noCommission')}</div>
          ) : payouts.map((c) => (
            <div key={c.id} className="flex items-center gap-4 px-5 py-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold/10 text-xs font-bold text-gold">
                {(c.agentName || '?')[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-100">{c.agentName}{c.coAgentName ? ` + ${c.coAgentName}` : ''}</div>
                <div className="text-xs text-slate-500 truncate">{c.leadName}{c.projectName ? ` · ${c.projectName}` : ''}</div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-100">{fmt(c.outstandingAed)}</div>
                  <div className="text-[10px] text-slate-500">{t('finance.payments.ofTotal', { total: fmt(c.commissionAed) })}</div>
                </div>
                <button
                  onClick={() => payCommission(c)}
                  disabled={payingId === c.id}
                  className="rounded-full bg-gold px-3.5 py-1.5 text-xs font-semibold text-ink transition hover:opacity-90 disabled:opacity-50"
                >
                  {payingId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t('finance.payments.payNow')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
