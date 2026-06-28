'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { CreditCard, Clock, CheckCircle2, AlertCircle, ArrowDownToLine, Plus, Landmark, RefreshCw, Loader2 } from 'lucide-react'
import { PageHeader, StatCard, Section } from '@/components/freehold/ui'

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

const PAYMENT_METHODS = [
  { id: 'pm1', brand: 'Visa',       last4: '4242', expiry: '08/27', isDefault: true  },
  { id: 'pm2', brand: 'Mastercard', last4: '8923', expiry: '03/26', isDefault: false },
]

const TRANSFERS = [
  { id: 'TXN-4491', amount: 18500, date: '2026-06-01', method: 'Wire', ref: 'META-JUN-2026', status: 'settled' },
  { id: 'TXN-4388', amount: 14200, date: '2026-05-01', method: 'Wire', ref: 'META-MAY-2026', status: 'settled' },
  { id: 'TXN-4280', amount: 12100, date: '2026-05-01', method: 'Wire', ref: 'GADS-MAY-2026', status: 'settled' },
  { id: 'TXN-4178', amount: 15800, date: '2026-04-01', method: 'Wire', ref: 'META-APR-2026', status: 'settled' },
  { id: 'TXN-4071', amount: 11400, date: '2026-04-01', method: 'Wire', ref: 'GADS-APR-2026', status: 'settled' },
]

const SCHEDULED = [
  { id: 'SCH-001', desc: 'Meta Ads — June cycle', dueDate: 'Jun 15, 2026', amount: 22000, status: 'upcoming'    },
  { id: 'SCH-002', desc: 'Google Ads — June cycle', dueDate: 'Jun 20, 2026', amount: 16500, status: 'upcoming'  },
  { id: 'SCH-003', desc: 'Meta Ads — July cycle',   dueDate: 'Jul 15, 2026', amount: 22000, status: 'projected' },
]

const PENDING_COMMISSIONS = [
  { agent: 'Noura Al Mansoori', amount: 4200, tier: 'Gold',   property: 'Emaar Beachfront 3BR', status: 'approved' },
  { agent: 'James Thornton',    amount: 2800, tier: 'Silver', property: 'DAMAC Hills 2 Studio',  status: 'pending'  },
  { agent: 'Priya Nair',        amount: 1900, tier: 'Bronze', property: 'JVC Studio Unit',        status: 'pending'  },
]

export default function PaymentsPage() {
  const [tab, setTab] = useState<'commissions' | 'schedule' | 'history'>('commissions')
  const [addingCard, setAddingCard] = useState(false)
  const [defaultCard, setDefaultCard] = useState('pm1')
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [payingId, setPayingId] = useState<string | null>(null)

  function loadPayouts() {
    fetch('/api/freehold/finance/entries', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.payouts) setPayouts(d.payouts) })
      .catch(() => {})
  }
  useEffect(() => {
    loadPayouts()
    try { const dc = localStorage.getItem('fh_default_card'); if (dc) setDefaultCard(dc) } catch {}
  }, [])

  async function payCommission(p: Payout) {
    setPayingId(p.id)
    try {
      const res = await fetch(`/api/freehold/deals/${p.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'record_payment', amountAed: p.outstandingAed }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed')
      toast.success(`Commission paid to ${p.agentName}`)
      loadPayouts()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Payment failed')
    } finally { setPayingId(null) }
  }

  const totalScheduled = SCHEDULED.filter((s) => s.status === 'upcoming').reduce((sum, s) => sum + s.amount, 0)
  const totalHistory   = TRANSFERS.reduce((sum, t) => sum + t.amount, 0)
  const pendingCommissions = payouts.reduce((sum, p) => sum + p.outstandingAed, 0)

  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-7 sm:px-8">

      <PageHeader
        eyebrow="Finance"
        Icon={CreditCard}
        title="Payments"
        subtitle="Platform billing, wire transfers, and agent commissions"
      />

      <div className="mt-5 mb-6 grid grid-cols-3 gap-3">
        <StatCard label="Due this month"  value={fmt(totalScheduled)}      delta={{ value: 'upcoming', direction: 'down' }} />
        <StatCard label="Paid YTD"        value={fmt(totalHistory)}         delta={{ value: 'settled',  direction: 'up'   }} />
        <StatCard label="Pending payouts" value={fmt(pendingCommissions)}   hint="agent commissions" />
      </div>

      <Section
        className="mb-6"
        title="Payment Methods"
        action={
          <button onClick={() => setAddingCard((v) => !v)}
            className="flex items-center gap-1 text-xs text-emerald-400/70 hover:text-emerald-400 transition">
            <Plus className="h-3 w-3" /> Add card
          </button>
        }
      >
        <div className="space-y-2">
          {PAYMENT_METHODS.map((pm) => (
            <div key={pm.id} className="flex items-center gap-4 rounded-[14px] border border-line bg-surface px-4 py-3.5">
              <div className="flex h-9 w-14 items-center justify-center rounded-[8px] border border-line bg-surface-2">
                <CreditCard className="h-4 w-4 text-slate-500" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-100">
                  {pm.brand} ···· {pm.last4}
                </div>
                <div className="text-xs text-slate-500">Expires {pm.expiry}</div>
              </div>
              {defaultCard === pm.id
                ? <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-400">Default</span>
                : <button onClick={() => { setDefaultCard(pm.id); try { localStorage.setItem('fh_default_card', pm.id) } catch {}; toast.success('Default payment method updated') }} className="text-xs text-slate-500 hover:text-slate-300 transition">Set default</button>
              }
            </div>
          ))}
          <div className="flex items-center gap-4 rounded-[14px] border border-line bg-surface px-4 py-3.5">
            <div className="flex h-9 w-14 items-center justify-center rounded-[8px] border border-line bg-surface-2">
              <Landmark className="h-4 w-4 text-slate-500" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-slate-100">Wire Transfer (SWIFT)</div>
              <div className="text-xs text-slate-500">ENBD — AE070340****9821</div>
            </div>
            <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-2.5 py-0.5 text-[10px] font-medium text-sky-400">Verified</span>
          </div>
        </div>
        {addingCard && (
          <div className="mt-3 rounded-[14px] border border-emerald-400/15 bg-emerald-400/[0.03] p-4 space-y-2">
            <div className="text-xs font-medium text-slate-300 mb-3">Add payment card</div>
            <input placeholder="Card number" className="w-full rounded-[9px] border border-line bg-surface-2 px-3 py-2 font-mono text-sm text-white placeholder:text-slate-500 outline-none focus:border-emerald-400/50" />
            <div className="flex gap-2">
              <input placeholder="MM / YY" className="flex-1 rounded-[9px] border border-line bg-surface-2 px-3 py-2 font-mono text-sm text-white placeholder:text-slate-500 outline-none focus:border-emerald-400/50" />
              <input placeholder="CVV" className="w-20 rounded-[9px] border border-line bg-surface-2 px-3 py-2 font-mono text-sm text-white placeholder:text-slate-500 outline-none focus:border-emerald-400/50" />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => { setAddingCard(false); try { localStorage.setItem('fh_card_added', '1') } catch {}; toast.success('Card saved') }} className="rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-400 transition">Save card</button>
              <button onClick={() => setAddingCard(false)} className="rounded-full border border-line px-4 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition">Cancel</button>
            </div>
          </div>
        )}
      </Section>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-[12px] border border-line bg-surface p-1">
        {[
          { id: 'schedule'    as const, label: 'Scheduled'   },
          { id: 'history'     as const, label: 'History'     },
          { id: 'commissions' as const, label: 'Commissions' },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 rounded-[9px] py-2 text-xs font-medium transition ${
              tab === t.id ? 'bg-surface-2 text-white' : 'text-slate-500 hover:text-slate-300'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Scheduled */}
      {tab === 'schedule' && (
        <div className="rounded-[16px] border border-line bg-surface divide-y divide-line overflow-hidden">
          {SCHEDULED.map((s) => (
            <div key={s.id} className="flex items-center gap-4 px-5 py-4">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                s.status === 'upcoming' ? 'bg-amber-400/10' : 'bg-surface-2'
              }`}>
                <Clock className={`h-3.5 w-3.5 ${s.status === 'upcoming' ? 'text-amber-400' : 'text-slate-600'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-100">{s.desc}</div>
                <div className="text-xs text-slate-500">{s.dueDate}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-semibold text-slate-300">{fmt(s.amount)}</div>
                <div className={`text-[10px] capitalize ${s.status === 'upcoming' ? 'text-amber-400' : 'text-slate-500'}`}>{s.status}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* History */}
      {tab === 'history' && (
        <div className="rounded-[16px] border border-line bg-surface divide-y divide-line overflow-hidden">
          {TRANSFERS.map((t) => (
            <div key={t.id} className="flex items-center gap-4 px-5 py-4">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400/60" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-100">{t.ref}</div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-mono">{t.id}</span>
                  <span>·</span>
                  <span>{t.method}</span>
                  <span>·</span>
                  <span>{new Date(t.date).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-semibold text-emerald-400">{fmt(t.amount)}</span>
                <button
                  onClick={() => {
                    const rows = [['Reference', t.ref], ['Transaction', t.id], ['Method', t.method], ['Date', t.date], ['Amount AED', String(t.amount)], ['Status', t.status]]
                    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
                    const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob)
                    const a = document.createElement('a'); a.href = url; a.download = `receipt-${t.id}.csv`
                    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
                    toast.success('Receipt downloaded')
                  }}
                  className="text-slate-600 hover:text-slate-400 transition"
                >
                  <ArrowDownToLine className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between px-5 py-3 border-t border-line">
            <span className="text-xs text-slate-500">{TRANSFERS.length} transactions</span>
            <span className="text-xs text-slate-400">Total paid: <span className="text-emerald-400 font-medium">{fmt(totalHistory)}</span></span>
          </div>
        </div>
      )}

      {/* Commissions — real, from approved deals */}
      {tab === 'commissions' && (
        <div className="space-y-3">
          <div className="rounded-[16px] border border-line bg-surface divide-y divide-line overflow-hidden">
            {payouts.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-slate-500">No commission outstanding — all approved deals are settled.</div>
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
                    <div className="text-sm font-semibold text-gold">{fmt(c.outstandingAed)}</div>
                    <div className="text-[10px] text-slate-500">of {fmt(c.commissionAed)}</div>
                  </div>
                  <button
                    onClick={() => payCommission(c)}
                    disabled={payingId === c.id}
                    className="rounded-full bg-emerald-500/20 border border-emerald-400/30 px-3 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-500/30 transition flex items-center gap-1 disabled:opacity-50"
                  >
                    {payingId === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Pay now
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-[12px] border border-line bg-surface-2 px-4 py-3 flex items-center gap-2 text-xs text-slate-500">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-400/50" />
            Commission payouts are computed live from approved deals. &quot;Pay now&quot; records the payment against the deal.
          </div>
        </div>
      )}
    </div>
  )
}
