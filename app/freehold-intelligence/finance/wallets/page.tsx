'use client'

/**
 * Ads Coin — the bank.
 *
 * "treat the credit as a bank dashboard: it has capital, liquidity, in use,
 * transactions, requests. Each wallet has a clear account number, so if you
 * gave me your account number I can transfer to you from what I have."
 *
 * The four figures at the top are DERIVED from the wallets, never stored — a
 * stored total is the number that quietly stops matching the accounts it
 * claims to summarise. The health line is the same idea taken seriously: the
 * ledger is audited on every load, and if a single coin cannot be accounted
 * for the page says so at the top instead of showing a confident total.
 */

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Landmark, Wallet as WalletIcon, ArrowRightLeft, AlertTriangle, ShieldCheck,
  Copy, Plus, RotateCw,
} from 'lucide-react'
import { PageHeader, StatCard, Panel, Button, Modal, buttonClass, fieldClass } from '@/components/freehold/ui'
import { useT } from '@/lib/i18n/provider'
import { useSession } from '@/lib/freehold/use-session'
import { OWNER_ROLES } from '@/lib/freehold/session-types'
import { isAccountNo, type Wallet, type TreasuryPosition } from '@/lib/freehold/wallet'
import { load } from '@/app/freehold-intelligence/team/_lib'

interface LedgerRow {
  transferId: string; reference: string; kind: string; walletId: string
  direction: 'debit' | 'credit'; amount: number; memo: string
  actor: string | null; createdAt: string
}
interface Audit { ledgerNet: number; drifted: { walletId: string }[]; healthy: boolean }
interface Payload { wallets: Wallet[]; postings: LedgerRow[]; position: TreasuryPosition; audit: Audit }

const coins = (n: number) => n.toLocaleString()

export default function WalletsPage() {
  const t = useT()
  const { user } = useSession()
  const canIssue = !!user && OWNER_ROLES.includes(user.role)

  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
  const [issueOpen, setIssueOpen] = useState(false)

  const [toAcc, setToAcc] = useState('')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [fromWalletId, setFromWalletId] = useState('w_operations')

  const refresh = useCallback(async () => {
    setLoading(true)
    const res = await load<Payload>('/api/freehold/finance/wallets')
    if (res.ok) { setData(res.data); setError(null) } else { setError(res.error); setData(null) }
    setLoading(false)
  }, [])
  useEffect(() => { void refresh() }, [refresh])

  async function send(action: 'issue' | 'transfer') {
    const n = Number(amount)
    if (!Number.isInteger(n) || n <= 0) { toast.error(t('bank.err.amount')); return }
    if (action === 'transfer' && !isAccountNo(toAcc)) { toast.error(t('bank.err.account')); return }
    setBusy(true)
    try {
      const res = await fetch('/api/freehold/finance/wallets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, amount: n, toAccountNo: toAcc, memo, fromWalletId }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) throw new Error(d?.error ?? `${res.status}`)
      toast.success(action === 'issue' ? t('bank.issued', { n: coins(n) }) : t('bank.sent', { n: coins(n) }))
      setSendOpen(false); setIssueOpen(false); setToAcc(''); setAmount(''); setMemo('')
      await refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('bank.err.failed'))
    } finally { setBusy(false) }
  }

  const pos = data?.position
  const walletName = (id: string) => data?.wallets.find((w) => w.id === id)?.label ?? id

  return (
    <div className="mx-auto max-w-6xl px-5 py-6 sm:px-6">
      <PageHeader
        eyebrow={t('bank.eyebrow')}
        title={t('bank.title')}
        subtitle={t('bank.subtitle')}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => void refresh()} disabled={loading} className={buttonClass('ghost', 'sm')}>
              <RotateCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {canIssue && (
              <button onClick={() => setIssueOpen(true)} className={buttonClass('ghost', 'sm')}>
                <Plus className="h-3.5 w-3.5" /> {t('bank.issue')}
              </button>
            )}
            <Button onClick={() => setSendOpen(true)} disabled={!data}>
              <ArrowRightLeft className="h-4 w-4" /> {t('bank.transfer')}
            </Button>
          </div>
        }
      />

      {error && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-400/25 bg-red-400/[0.06] px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
          <div className="min-w-0">
            <div className="text-sm font-medium text-red-100">{t('bank.err.read')}</div>
            <div className="truncate text-xs text-red-200/80">{error}</div>
          </div>
        </div>
      )}

      {/* The books, checked on every load. A dashboard that reports a total it
          has never verified is the thing this whole ledger replaced. */}
      {data && (
        <div className={`mb-5 flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-xs ${
          data.audit.healthy
            ? 'border-emerald-400/20 bg-emerald-400/[0.05] text-emerald-200/90'
            : 'border-red-400/30 bg-red-400/[0.07] text-red-100'
        }`}>
          {data.audit.healthy ? <ShieldCheck className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
          {data.audit.healthy
            ? t('bank.audit.ok')
            : t('bank.audit.broken', { n: data.audit.ledgerNet, w: data.audit.drifted.length })}
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t('bank.capital')}  value={pos ? coins(pos.capital) : '—'}       hint={t('bank.capitalHint')}  Icon={Landmark} />
        <StatCard label={t('bank.liquidity')} value={pos ? coins(pos.liquidity) : '—'}     hint={t('bank.liquidityHint')} Icon={WalletIcon} />
        <StatCard label={t('bank.inUse')}     value={pos ? coins(pos.inUse) : '—'}         hint={t('bank.inUseHint')}     Icon={ArrowRightLeft} />
        <StatCard label={t('bank.undist')}    value={pos ? coins(pos.undistributed) : '—'} hint={t('bank.undistHint')}    Icon={Landmark} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Accounts */}
        <section>
          <h2 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{t('bank.accounts')}</h2>
          <Panel>
            <ul className="divide-y divide-line">
              {(data?.wallets ?? []).map((w) => (
                <li key={w.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-100">{w.label}</div>
                    <button
                      onClick={() => { void navigator.clipboard?.writeText(w.accountNo); toast.success(t('bank.copied')) }}
                      className="mt-0.5 inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-500 transition hover:text-slate-300"
                      title={t('bank.copy')}
                    >
                      {w.accountNo} <Copy className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="text-end">
                    <div className="text-sm font-semibold tabular-nums text-white">{coins(w.balance)}</div>
                    {w.held > 0 && (
                      <div className="text-[11px] tabular-nums text-amber-300/80">{t('bank.held', { n: coins(w.held) })}</div>
                    )}
                  </div>
                </li>
              ))}
              {!loading && (data?.wallets.length ?? 0) === 0 && (
                <li className="px-4 py-6 text-center text-xs text-slate-500">{t('bank.noAccounts')}</li>
              )}
            </ul>
          </Panel>
        </section>

        {/* Transactions */}
        <section>
          <h2 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{t('bank.transactions')}</h2>
          <Panel>
            <ul className="divide-y divide-line">
              {(data?.postings ?? []).map((p, i) => (
                <li key={`${p.transferId}-${p.walletId}-${p.direction}-${i}`} className="flex items-center gap-3 px-4 py-2.5">
                  <span className={`text-sm font-semibold tabular-nums ${p.direction === 'credit' ? 'text-emerald-300' : 'text-slate-400'}`}>
                    {p.direction === 'credit' ? '+' : '−'}{coins(p.amount)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs text-slate-300">{walletName(p.walletId)}</span>
                    <span className="block truncate text-[11px] text-slate-600">
                      {t(`bank.kind.${p.kind}`)}{p.memo ? ` · ${p.memo}` : ''}
                    </span>
                  </span>
                  <time className="shrink-0 text-[10px] tabular-nums text-slate-600">
                    {new Date(p.createdAt).toLocaleDateString()}
                  </time>
                </li>
              ))}
              {!loading && (data?.postings.length ?? 0) === 0 && (
                <li className="px-4 py-6 text-center text-xs text-slate-500">{t('bank.noTx')}</li>
              )}
            </ul>
          </Panel>
        </section>
      </div>

      {/* ── Transfer ── */}
      <Modal open={sendOpen} onClose={() => setSendOpen(false)} title={t('bank.transfer')}>
        <form onSubmit={(e) => { e.preventDefault(); void send('transfer') }} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">{t('bank.from')}</label>
            <select value={fromWalletId} onChange={(e) => setFromWalletId(e.target.value)} className={fieldClass()}>
              {(data?.wallets ?? []).filter((w) => w.kind !== 'treasury').map((w) => (
                <option key={w.id} value={w.id}>{w.label} — {coins(w.balance)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">{t('bank.toAccount')}</label>
            <input value={toAcc} onChange={(e) => setToAcc(e.target.value.toUpperCase())}
              placeholder="FH-30-000001-7" className={`${fieldClass()} font-mono`} autoFocus />
            {/* Checked before anything moves: a mistyped digit must not become a
                transfer to a wallet that happens to exist. */}
            <p className={`mt-1.5 text-[11px] ${toAcc && !isAccountNo(toAcc) ? 'text-red-300' : 'text-slate-500'}`}>
              {toAcc && !isAccountNo(toAcc) ? t('bank.err.account') : t('bank.accountHint')}
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">{t('bank.amount')}</label>
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
              inputMode="numeric" placeholder="500" className={fieldClass()} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">{t('bank.memo')}</label>
            <input value={memo} onChange={(e) => setMemo(e.target.value)} className={fieldClass()} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setSendOpen(false)} className={buttonClass('ghost')}>{t('common.cancel')}</button>
            <button type="submit" disabled={busy || !amount || !isAccountNo(toAcc)} className={buttonClass('primary')}>
              {t('bank.send')}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Issue ── */}
      <Modal open={issueOpen} onClose={() => setIssueOpen(false)} title={t('bank.issue')}>
        <form onSubmit={(e) => { e.preventDefault(); void send('issue') }} className="space-y-4">
          <p className="text-xs leading-relaxed text-slate-500">{t('bank.issueBody')}</p>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">{t('bank.amount')}</label>
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
              inputMode="numeric" placeholder="10000" className={fieldClass()} autoFocus />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">{t('bank.memo')}</label>
            <input value={memo} onChange={(e) => setMemo(e.target.value)} className={fieldClass()} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setIssueOpen(false)} className={buttonClass('ghost')}>{t('common.cancel')}</button>
            <button type="submit" disabled={busy || !amount} className={buttonClass('primary')}>{t('bank.issue')}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
