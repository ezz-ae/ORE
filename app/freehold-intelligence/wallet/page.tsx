'use client'

/**
 * THE WALLET. Everybody has one, and the Bank lives inside it for management.
 *
 * ── WHY ONE SCREEN AND NOT TWO ───────────────────────────────────────────
 *
 * A director has a wallet exactly like a broker's — they hold Cash, they send
 * it, they get paid. Splitting "your money" from "the company's money" into two
 * apps would mean a director learning two mental models for the same object,
 * and it would put the mint button on a page whose whole job is showing one
 * person's balance. So: one app, and the Bank is a TAB that only appears for
 * management. What they can do is decided by the server (two separate routes);
 * this tab only decides what they can SEE.
 *
 * ── THE NUMBER IS THE POINT ──────────────────────────────────────────────
 *
 * One Cash is one dirham, so there is nothing to convert and nothing to
 * explain. What still has to be said out loud, in two places, is what the
 * number is NOT:
 *
 *   · a recorded deposit is not money yet, and the form says so before you
 *     press the button — a broker who believes they have topped up and then
 *     cannot launch will file a bug, and be right to.
 *   · real money and minted Cash never appear as one figure on the bank tab.
 *     The gap between them is how much of what everyone holds is a promise.
 *
 * ── AND EVERY REFUSAL IS A SENTENCE, NOT A CODE ──────────────────────────
 *
 * The server answers with a walkable refusal from bank.ts and this renders the
 * matching sentence. "notYourCheque" on screen is a bug report waiting to
 * happen; "only the person who signed this Cash out of the bank can destroy
 * it" is an answer.
 *
 * The rules are pure and live in lib/freehold/bank.ts. This screen reads.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Wallet as WalletIcon, Landmark, Loader2, ArrowDownLeft, ArrowUpRight,
  Copy, Check, Flame, PenLine, AlertTriangle,
} from 'lucide-react'
import { PageHeader, StatCard, Panel, PanelHeader, EmptyState, Button, fieldClass } from '@/components/freehold/ui'
import { useT } from '@/lib/i18n/provider'
import { cashText } from '@/lib/freehold/credits-shared'
import {
  BANK_REFUSALS, IDLE_AFTER_DAYS,
  type BankRefusal, type CashState, type DepositState, type SpendKind, type UseState,
} from '@/lib/freehold/bank'

interface Movement {
  reference: string
  kind: string
  walletId: string
  direction: 'debit' | 'credit'
  amount: number
  memo: string
  actor: string | null
  createdAt: string
}
interface Payee { id: string; accountNo: string; label: string }
interface WalletData {
  wallet: { id: string; accountNo: string; balance: number; held: number } | null
  movements: Movement[]
  payees: Payee[]
}

interface Lot {
  id: string
  origin: 'deposit' | 'mint'
  createdBy: string
  transactionRef: string | null
  deposit: DepositState
  amount: number
  remaining: number
  movedBy: string | null
  state: CashState
  note: string
  createdAt: string
}
interface Withdrawal {
  id: string; userId: string; userName: string | null; amount: number
  kind: SpendKind; reference: string; imageUrl: string | null; at: string
}
interface Use {
  walletId: string; userId: string | null; label: string
  fundedAed: number; spentAed: number; balanceAed: number
  daysSinceSpend: number | null; state: UseState
}
interface BankData {
  backing: { depositedAed: number; mintedAed: number; claimedAed: number }
  inBank: number
  heldAed: number
  imbalance: number
  lots: Lot[]
  withdrawals: Withdrawal[]
  use: Use[]
  redenomination: { ran: false } | { ran: true; at: string; by: string | null }
}

const isRefusal = (s: string): s is BankRefusal =>
  (BANK_REFUSALS as readonly string[]).includes(s)

/** Colour by what the state means to the reader, not by a palette order. */
const USE_TONE: Record<UseState, string> = {
  spending: 'text-emerald-300',
  // The finding. Amber, never grey — grey is what a reader skips.
  idle: 'text-amber-200',
  overdrawn: 'text-red-300',
  empty: 'text-slate-500',
}
const STATE_TONE: Record<CashState, string> = {
  inBank: 'text-slate-300',
  cheque: 'text-sky-300',
  spent: 'text-slate-500',
  burned: 'text-red-300',
}

export default function WalletPage() {
  const t = useT()
  const [tab, setTab] = useState<'wallet' | 'bank'>('wallet')
  const [data, setData] = useState<WalletData | null>(null)
  const [bank, setBank] = useState<BankData | null>(null)
  // `null` = not asked yet, false = asked and refused. The bank TAB only shows
  // once the server has actually let us read it, so nobody is offered a door
  // that will close in their face.
  const [canBank, setCanBank] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [note, setNote] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)

  const say = useCallback((code: string, fallback?: string) => {
    if (isRefusal(code) || code === 'notEnough' || code === 'noSuchLot' || code === 'error') {
      return t(`wal.no.${code}`)
    }
    return fallback ?? t('wal.no.error')
  }, [t])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/freehold/wallet', { cache: 'no-store' })
      if (!res.ok) throw new Error('wallet')
      setData(await res.json())
      setFailed(false)
    } catch { setFailed(true) } finally { setLoading(false) }

    // Asked separately and allowed to fail. A broker gets a 403 here and that
    // is not an error on their screen — it is simply not their tab.
    try {
      const res = await fetch('/api/freehold/bank', { cache: 'no-store' })
      if (res.ok) { setBank(await res.json()); setCanBank(true) } else { setCanBank(false) }
    } catch { setCanBank(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const post = useCallback(async (url: string, body: Record<string, unknown>) => {
    setNote(null)
    try {
      const res = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setNote({ tone: 'bad', text: say(String(json.error ?? '')) }); return null }
      await load()
      return json as Record<string, unknown>
    } catch { setNote({ tone: 'bad', text: t('wal.no.error') }); return null }
  }, [load, say, t])

  if (loading && !data) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" /> {t('wal.loading')}
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        eyebrow={t('wal.eyebrow')}
        title={tab === 'bank' ? t('bank.title') : t('wal.title')}
        subtitle={tab === 'bank' ? t('bank.subtitle') : t('wal.subtitle')}
      />

      {canBank && (
        <div className="flex gap-2">
          {(['wallet', 'bank'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                tab === k ? 'border-gold/40 bg-surface-2 text-slate-100' : 'border-line text-slate-400'
              }`}
            >
              {k === 'bank' ? <Landmark className="mr-1.5 inline h-3.5 w-3.5" /> : <WalletIcon className="mr-1.5 inline h-3.5 w-3.5" />}
              {t(k === 'bank' ? 'bank.tab.bank' : 'bank.tab.wallet')}
            </button>
          ))}
        </div>
      )}

      {note && (
        <p className={`rounded-lg border px-4 py-2.5 text-sm ${
          note.tone === 'ok' ? 'border-emerald-500/30 text-emerald-200' : 'border-red-500/30 text-red-200'
        }`}>{note.text}</p>
      )}

      {failed && <p className="text-sm text-amber-200">{t('wal.unavailable')}</p>}

      {tab === 'wallet'
        ? <MyWallet data={data} t={t} post={post} onNote={setNote} />
        : <TheBank data={bank} t={t} post={post} onNote={setNote} />}
    </div>
  )
}

// ─── The wallet everybody has ────────────────────────────────────────────────

function MyWallet({
  data, t, post, onNote,
}: {
  data: WalletData | null
  t: (k: string, v?: Record<string, string | number>) => string
  post: (url: string, body: Record<string, unknown>) => Promise<Record<string, unknown> | null>
  onNote: (n: { tone: 'ok' | 'bad'; text: string } | null) => void
}) {
  const [copied, setCopied] = useState(false)
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [busy, setBusy] = useState(false)
  const [depAmount, setDepAmount] = useState('')
  const [depRef, setDepRef] = useState('')

  // ONE KEY PER ATTEMPT, not per click. Regenerated only when the form changes,
  // so a double-click or a retry after a dropped connection pays once.
  const idem = useMemo(() => `${to}|${amount}|${memo}|${Date.now()}`, [to, amount, memo])

  const send = async () => {
    setBusy(true)
    const r = await post('/api/freehold/wallet', {
      action: 'send', toWalletId: to, amount: Number(amount), memo, reference: idem,
    })
    setBusy(false)
    if (r) {
      onNote({ tone: 'ok', text: t(r.duplicate ? 'wal.send.duplicate' : 'wal.send.done') })
      setAmount(''); setMemo('')
    }
  }

  const deposit = async () => {
    setBusy(true)
    const r = await post('/api/freehold/wallet', {
      action: 'deposit', amount: Number(depAmount), transactionRef: depRef,
    })
    setBusy(false)
    if (r) {
      onNote({ tone: 'ok', text: t(r.duplicate ? 'wal.deposit.duplicate' : 'wal.deposit.done') })
      setDepAmount(''); setDepRef('')
    }
  }

  const w = data?.wallet
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={t('wal.stat.balance')} Icon={WalletIcon}
          value={w ? cashText(w.balance) : '—'}
        />
        <StatCard
          label={t('wal.stat.held')} hint={t('wal.stat.heldHint')}
          value={w ? cashText(w.held) : '—'}
        />
        <StatCard
          label={t('wal.stat.account')} hint={t('wal.stat.accountHint')}
          value={
            <span className="flex items-center gap-2">
              <span className="font-mono text-base">{w?.accountNo ?? '—'}</span>
              {w && (
                <button
                  onClick={() => { void navigator.clipboard.writeText(w.accountNo); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
                  className="text-slate-400 hover:text-slate-200"
                  aria-label={t('wal.copy')}
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              )}
            </span>
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title={t('wal.send.title')} icon={<ArrowUpRight className="h-4 w-4" />} />
          <div className="space-y-3 p-5">
            <p className="text-sm text-slate-400">{t('wal.send.sub')}</p>
            <label className="block text-sm">
              <span className="text-slate-400">{t('wal.send.to')}</span>
              <select value={to} onChange={(e) => setTo(e.target.value)} className={`${fieldClass()} mt-1 w-full`}>
                <option value="">{t('wal.send.toPlaceholder')}</option>
                {(data?.payees ?? []).map((p) => (
                  <option key={p.id} value={p.id}>{p.label} · {p.accountNo}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-slate-400">{t('wal.send.amount')}</span>
              <input
                type="number" min={1} step={1} value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`${fieldClass()} mt-1 w-full`}
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-400">{t('wal.send.memo')}</span>
              <input
                value={memo} onChange={(e) => setMemo(e.target.value)}
                placeholder={t('wal.send.memoPlaceholder')}
                className={`${fieldClass()} mt-1 w-full`}
              />
            </label>
            <Button onClick={() => void send()} disabled={busy || !to || !amount}>
              {busy ? t('wal.send.sending') : t('wal.send.action')}
            </Button>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title={t('wal.deposit.title')} icon={<ArrowDownLeft className="h-4 w-4" />} />
          <div className="space-y-3 p-5">
            <p className="text-sm text-slate-400">{t('wal.deposit.sub')}</p>
            {/* THE SENTENCE THAT PREVENTS THE BUG REPORT. Said before the
                button, not after the press. */}
            <p className="rounded-lg border border-amber-500/25 px-3 py-2 text-sm text-amber-100/90">
              {t('wal.deposit.claimNote')}
            </p>
            <label className="block text-sm">
              <span className="text-slate-400">{t('wal.deposit.amount')}</span>
              <input
                type="number" min={1} step={1} value={depAmount}
                onChange={(e) => setDepAmount(e.target.value)}
                className={`${fieldClass()} mt-1 w-full`}
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-400">{t('wal.deposit.ref')}</span>
              <input
                value={depRef} onChange={(e) => setDepRef(e.target.value)}
                placeholder={t('wal.deposit.refPlaceholder')}
                className={`${fieldClass()} mt-1 w-full`}
              />
            </label>
            <Button variant="secondary" onClick={() => void deposit()} disabled={busy || !depAmount || !depRef.trim()}>
              {t('wal.deposit.action')}
            </Button>
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader title={t('wal.log.title')} />
        <div className="p-5">
          <p className="mb-3 text-sm text-slate-400">{t('wal.log.sub')}</p>
          {(data?.movements ?? []).length === 0
            ? <EmptyState title={t('wal.log.empty')} />
            : (
              <ul className="divide-y divide-line">
                {data!.movements.map((m) => (
                  <li key={`${m.reference}-${m.direction}`} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      {m.direction === 'credit'
                        ? <ArrowDownLeft className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                        : <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                      <span className="truncate text-slate-300">{t(`wal.kind.${m.kind}`)}</span>
                      {m.memo && <span className="truncate text-slate-500">· {m.memo}</span>}
                    </span>
                    <span className={m.direction === 'credit' ? 'text-emerald-300' : 'text-slate-300'}>
                      {m.direction === 'credit' ? '+' : '−'}{cashText(m.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
        </div>
      </Panel>
    </>
  )
}

// ─── The Bank, for management ────────────────────────────────────────────────

function TheBank({
  data, t, post, onNote,
}: {
  data: BankData | null
  t: (k: string, v?: Record<string, string | number>) => string
  post: (url: string, body: Record<string, unknown>) => Promise<Record<string, unknown> | null>
  onNote: (n: { tone: 'ok' | 'bad'; text: string } | null) => void
}) {
  const [mintAmount, setMintAmount] = useState('')
  const [mintNote, setMintNote] = useState('')
  const [busy, setBusy] = useState(false)

  const act = async (body: Record<string, unknown>, okKey?: string) => {
    setBusy(true)
    const r = await post('/api/freehold/bank', body)
    setBusy(false)
    if (r && okKey) onNote({ tone: 'ok', text: t(okKey) })
    return r
  }

  if (!data) return <EmptyState title={t('wal.unavailable')} />

  const b = data.backing
  return (
    <>
      {/* THE THREE FIGURES, KEPT APART. A single blended total is not a bank
          balance, it is a mood — and the day somebody pays a real invoice out
          of it is the day everyone finds out. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('bank.stat.deposited')} hint={t('bank.stat.depositedHint')}
          value={cashText(b.depositedAed)} accent="#34d399" Icon={ArrowDownLeft} />
        <StatCard label={t('bank.stat.minted')} hint={t('bank.stat.mintedHint')}
          value={cashText(b.mintedAed)} accent="#fbbf24" Icon={PenLine} />
        <StatCard label={t('bank.stat.claimed')} hint={t('bank.stat.claimedHint')}
          value={cashText(b.claimedAed)} />
        <StatCard label={t('bank.stat.inBank')} hint={t('bank.stat.inBankHint')}
          value={cashText(data.inBank)} Icon={Landmark} />
      </div>
      <p className="text-sm text-slate-400">{t('bank.backingNote')}</p>

      {/* A number, never a boolean: "the books are AED 40 out" is actionable. */}
      {data.imbalance !== 0 && (
        <p className="flex items-center gap-2 rounded-lg border border-red-500/30 px-4 py-2.5 text-sm text-red-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {t('bank.imbalance', { amount: cashText(Math.abs(data.imbalance)) })}
        </p>
      )}

      <Panel>
        <PanelHeader title={t('bank.mint.title')} icon={<PenLine className="h-4 w-4" />} />
        <div className="space-y-3 p-5">
          <p className="text-sm text-slate-400">{t('bank.mint.sub')}</p>
          <div className="grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
            <label className="block text-sm">
              <span className="text-slate-400">{t('bank.mint.amount')}</span>
              <input type="number" min={1} step={1} value={mintAmount}
                onChange={(e) => setMintAmount(e.target.value)}
                className={`${fieldClass()} mt-1 w-full`} />
            </label>
            <label className="block text-sm">
              <span className="text-slate-400">{t('bank.mint.note')}</span>
              <input value={mintNote} onChange={(e) => setMintNote(e.target.value)}
                placeholder={t('bank.mint.notePlaceholder')}
                className={`${fieldClass()} mt-1 w-full`} />
            </label>
            <Button
              disabled={busy || !mintAmount}
              onClick={async () => {
                const r = await act({ action: 'mint', amount: Number(mintAmount), note: mintNote }, 'bank.mint.done')
                if (r) { setMintAmount(''); setMintNote('') }
              }}
            >{t('bank.mint.action')}</Button>
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title={t('bank.lots.title')} />
        <div className="p-5">
          <p className="mb-3 text-sm text-slate-400">{t('bank.lots.sub')}</p>
          {data.lots.length === 0 ? <EmptyState title={t('bank.lots.empty')} /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="py-2 pr-4">{t('bank.lots.col.origin')}</th>
                    <th className="py-2 pr-4">{t('bank.lots.col.who')}</th>
                    <th className="py-2 pr-4">{t('bank.lots.col.ref')}</th>
                    <th className="py-2 pr-4">{t('bank.lots.col.amount')}</th>
                    <th className="py-2 pr-4">{t('bank.lots.col.left')}</th>
                    <th className="py-2 pr-4">{t('bank.lots.col.state')}</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.lots.map((lot) => (
                    <tr key={lot.id}>
                      <td className="py-2.5 pr-4 text-slate-300">{t(`bank.origin.${lot.origin}`)}</td>
                      <td className="py-2.5 pr-4 text-slate-400">{lot.createdBy}</td>
                      {/* A mint has no reference and never will — the dash is
                          the fact, not a missing value. */}
                      <td className="py-2.5 pr-4 font-mono text-xs text-slate-400">{lot.transactionRef ?? '—'}</td>
                      <td className="py-2.5 pr-4 text-slate-200">{cashText(lot.amount)}</td>
                      <td className="py-2.5 pr-4 text-slate-400">{cashText(lot.remaining)}</td>
                      <td className={`py-2.5 pr-4 ${STATE_TONE[lot.state]}`}>
                        {lot.deposit === 'claimed'
                          ? t('bank.deposit.claimed')
                          : lot.deposit === 'rejected'
                            ? t('bank.deposit.rejected')
                            : lot.state === 'cheque'
                              ? t('bank.state.cheque', { name: lot.movedBy ?? '' })
                              : t(`bank.state.${lot.state}`)}
                      </td>
                      <td className="py-2.5">
                        <div className="flex justify-end gap-2">
                          {lot.deposit === 'claimed' && (
                            <>
                              <Button size="sm" disabled={busy}
                                onClick={() => void act({ action: 'clearDeposit', lotId: lot.id })}>
                                {t('bank.act.clear')}
                              </Button>
                              <Button size="sm" variant="ghost" disabled={busy}
                                onClick={() => void act({ action: 'rejectDeposit', lotId: lot.id })}>
                                {t('bank.act.reject')}
                              </Button>
                            </>
                          )}
                          {lot.state === 'inBank' && lot.deposit === 'cleared' && (
                            <>
                              <Button size="sm" variant="secondary" disabled={busy}
                                title={t('bank.act.moveNote')}
                                onClick={() => void act({ action: 'move', lotId: lot.id })}>
                                {t('bank.act.move')}
                              </Button>
                              <Button size="sm" variant="ghost" disabled={busy}
                                title={t('bank.act.burnNote')}
                                onClick={() => {
                                  // Destroying money is irreversible, so it asks
                                  // — the one place on this screen that does.
                                  if (!window.confirm(t('bank.act.burnNote'))) return
                                  void act({ action: 'burn', lotId: lot.id, amount: lot.remaining })
                                }}>
                                <Flame className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                          {lot.state === 'cheque' && (
                            <Button size="sm" variant="ghost" disabled={busy}
                              title={t('bank.act.burnNote')}
                              onClick={() => {
                                if (!window.confirm(t('bank.act.burnNote'))) return
                                void act({ action: 'burn', lotId: lot.id, amount: lot.remaining })
                              }}>
                              <Flame className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title={t('bank.use.title')} />
        <div className="p-5">
          <p className="mb-3 text-sm text-slate-400">{t('bank.use.sub')}</p>
          {data.use.length === 0 ? <EmptyState title={t('bank.use.empty')} /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="py-2 pr-4">{t('bank.use.col.who')}</th>
                    <th className="py-2 pr-4">{t('bank.use.col.sent')}</th>
                    <th className="py-2 pr-4">{t('bank.use.col.spent')}</th>
                    <th className="py-2 pr-4">{t('bank.use.col.balance')}</th>
                    <th className="py-2 pr-4">{t('bank.use.col.last')}</th>
                    <th className="py-2">{''}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {/* Idle first. The whole reason this table exists is the
                      person who was funded and has not moved. */}
                  {[...data.use]
                    .sort((a, b) => (a.state === 'idle' ? 0 : 1) - (b.state === 'idle' ? 0 : 1))
                    .map((u) => (
                      <tr key={u.walletId}>
                        <td className="py-2.5 pr-4 text-slate-300">{u.label}</td>
                        <td className="py-2.5 pr-4 text-slate-400">{cashText(u.fundedAed)}</td>
                        <td className="py-2.5 pr-4 text-slate-400">{cashText(u.spentAed)}</td>
                        <td className="py-2.5 pr-4 text-slate-200">{cashText(u.balanceAed)}</td>
                        <td className="py-2.5 pr-4 text-slate-400">
                          {u.daysSinceSpend === null
                            ? t('bank.use.never')
                            : t('bank.use.daysAgo', { n: u.daysSinceSpend })}
                        </td>
                        <td className={`py-2.5 ${USE_TONE[u.state]}`}>{t(`bank.use.state.${u.state}`)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-slate-500">
                {t('bank.use.idleAfter', { n: IDLE_AFTER_DAYS })}
              </p>
            </div>
          )}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title={t('bank.withdraw.title')} />
        <div className="p-5">
          <p className="mb-3 text-sm text-slate-400">{t('bank.withdraw.sub')}</p>
          {data.withdrawals.length === 0 ? <EmptyState title={t('bank.withdraw.empty')} /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="py-2 pr-4">{t('bank.withdraw.col.what')}</th>
                    <th className="py-2 pr-4">{t('bank.lots.col.amount')}</th>
                    <th className="py-2 pr-4">{t('bank.withdraw.col.proof')}</th>
                    <th className="py-2 pr-4">{t('bank.withdraw.col.who')}</th>
                    <th className="py-2">{t('bank.withdraw.col.when')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.withdrawals.map((w) => (
                    <tr key={w.id}>
                      <td className="py-2.5 pr-4 text-slate-300">{t(`bank.kind.${w.kind}`)}</td>
                      <td className="py-2.5 pr-4 text-slate-200">{cashText(w.amount)}</td>
                      <td className="py-2.5 pr-4 font-mono text-xs text-slate-400">{w.reference}</td>
                      <td className="py-2.5 pr-4 text-slate-400">{w.userName ?? w.userId}</td>
                      <td className="py-2.5 text-slate-500">{new Date(w.at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Panel>

      {/* The one-off migration, offered only while it would do something. */}
      <Panel>
        <PanelHeader title={t('bank.redenom.title')} />
        <div className="space-y-3 p-5">
          <p className="text-sm text-slate-400">{t('bank.redenom.sub')}</p>
          {data.redenomination.ran ? (
            <p className="text-sm text-slate-500">
              {t('bank.redenom.ran', { date: new Date(data.redenomination.at).toLocaleDateString() })}
            </p>
          ) : (
            <Button
              variant="secondary" disabled={busy}
              onClick={async () => {
                const r = await act({ action: 'redenominate' })
                if (r) {
                  onNote({ tone: 'ok', text: t('bank.redenom.done', {
                    scaled: Number(r.scaled ?? 0),
                    added: cashText(Number(r.addedCash ?? 0)),
                    already: Number(r.alreadyDone ?? 0),
                  }) })
                }
              }}
            >{t('bank.redenom.action')}</Button>
          )}
        </div>
      </Panel>
    </>
  )
}
