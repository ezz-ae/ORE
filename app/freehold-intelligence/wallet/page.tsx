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
import { formatInstant, formatInstantZoned } from '@/lib/freehold/clock'
import {
  Wallet as WalletIcon, Landmark, Loader2, ArrowDownLeft, ArrowUpRight,
  Copy, Check, Flame, PenLine, AlertTriangle, QrCode, Plus, X,
  Sparkles, RotateCcw, Megaphone, Lock, Unlock, ShieldCheck, ShieldAlert,
  Handshake,
} from 'lucide-react'
import { PageHeader, StatCard, Panel, PanelHeader, EmptyState, Button, fieldClass } from '@/components/freehold/ui'
import { useT } from '@/lib/i18n/provider'
import { cashText } from '@/lib/freehold/credits-shared'
import { shortHash } from '@/lib/freehold/ledger-chain'
import { AttributionPanel } from './attribution-panel'
import {
  BANK_REFUSALS, IDLE_AFTER_DAYS,
  type BankRefusal, type CashState, type DepositState, type SpendKind, type UseState,
} from '@/lib/freehold/bank'

/**
 * One row of the wallet's own history.
 *
 * Shaped by the server (walletActivity), not by the ledger: `direction` is in
 * or out from THIS wallet's point of view, the counterparty is already
 * resolved, and `state` carries the one thing a raw posting cannot say — a
 * recorded deposit that nobody has matched yet is money on its way, and a
 * wallet has to be able to show that.
 */
interface Activity {
  id: string
  kind: string
  direction: 'in' | 'out'
  amount: number
  counterparty: string | null
  counterpartyAccount: string | null
  memo: string
  state: 'confirmed' | 'pending' | 'rejected'
  at: string
}
interface Payee { id: string; accountNo: string; label: string }

/** What `verifyChain` answered — see lib/freehold/ledger-chain.ts. */
type ChainVerdict =
  | { ok: true; length: number; head: string }
  | { ok: false; brokenAt: number; reason: string; length: number }

/** One commission payment that actually arrived, with its date. */
interface CommissionPayment {
  amountAed: number
  receivedAt: string
  payoutAed: number
  reference: string
}
/** A deal this person closed, and where their money on it stands. */
interface Commission {
  dealId: string
  dealName: string
  status: string
  entitledAed: number
  paidAed: number
  awaitingAed: number
  state: string
  payments: CommissionPayment[]
}

interface WalletData {
  /** null when the proof could not be run. NOT the same as "it failed". */
  chain: ChainVerdict | null
  commissions: Commission[]
  wallet: { id: string; accountNo: string; balance: number; held: number } | null
  activity: Activity[]
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

/** Every refusal the server can send, in one list. */
const SAYABLE: readonly string[] = [...BANK_REFUSALS, 'notEnough', 'noSuchLot', 'error']
const isRefusal = (s: string): boolean => SAYABLE.includes(s)

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
  // WHY THE TAB IS NOT THERE, when it is not there for a reason other than
  // "this is not your tab". Null while it is genuinely not yours.
  const [bankError, setBankError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [note, setNote] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)

  const say = useCallback((code: string, fallback?: string) => {
    if (isRefusal(code)) return t(`wal.no.${code}`)
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
    // A REFUSAL AND A FAILURE ARE NOT THE SAME ANSWER.
    //
    // This treated every non-200 as "not your tab", so a bank that threw a 500
    // vanished exactly like one a broker is not allowed to see — and the only
    // thing on screen was an absence. Somebody who IS management then has no
    // way to tell "I lack the role" from "it is broken", and no error to send
    // anybody. That is the same fault as a check with no way to say "I do not
    // know", one screen further out.
    try {
      const res = await fetch('/api/freehold/bank', { cache: 'no-store' })
      if (res.ok) {
        setBank(await res.json()); setCanBank(true); setBankError(null)
      } else if (res.status === 401 || res.status === 403) {
        // Genuinely not your tab. Show nothing — an explanation here would be
        // telling a broker about a door that is not theirs.
        setCanBank(false); setBankError(null)
      } else {
        // It IS your tab and it failed. Say so, with what the server said.
        const d = (await res.json().catch(() => ({}))) as { error?: string }
        setCanBank(true)
        setBankError(d.error ?? `The bank could not be read (HTTP ${res.status}).`)
      }
    } catch (err) {
      setCanBank(true)
      setBankError(err instanceof Error ? err.message : 'The bank could not be reached.')
    }
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

      {/* THE BANK IS YOURS AND IT BROKE. Printed here rather than swallowed,
          because the alternative is a manager staring at a missing tab with
          nothing to send anybody. */}
      {bankError && (
        <p className="flex items-start gap-2.5 rounded-lg border border-red-500/25 bg-red-500/[0.06] px-4 py-2.5 text-sm text-red-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t('bank.readFailed', { error: bankError })}</span>
        </p>
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

/**
 * The address, shortened the way an address is shortened.
 *
 * `FH-30-004472-9` is fourteen characters and the middle six are the only part
 * that differs between two accounts — so the ends are exactly what must survive
 * truncation. Nobody reads a full address; they check the first and last few
 * against what they expected and scan the QR for the rest.
 */
const shortAddress = (a: string): string =>
  a.length <= 12 ? a : `${a.slice(0, 6)}…${a.slice(-5)}`

/** What each movement is called on a wallet row, and which way it points. */
const ACTIVITY_ICON: Record<string, typeof ArrowUpRight> = {
  issue: Sparkles, earn: Sparkles, refund: RotateCcw, burn: Flame,
  spend: Megaphone, transfer: ArrowUpRight, hold: Lock, release: Unlock,
  deposit: ArrowDownLeft,
}

function MyWallet({
  data, t, post, onNote,
}: {
  data: WalletData | null
  t: (k: string, v?: Record<string, string | number>) => string
  post: (url: string, body: Record<string, unknown>) => Promise<Record<string, unknown> | null>
  onNote: (n: { tone: 'ok' | 'bad'; text: string } | null) => void
}) {
  const [sheet, setSheet] = useState<'none' | 'send' | 'receive' | 'deposit'>('none')
  const [detail, setDetail] = useState<Activity | null>(null)
  const [copied, setCopied] = useState(false)
  const [qr, setQr] = useState<string | null>(null)

  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [busy, setBusy] = useState(false)
  const [depAmount, setDepAmount] = useState('')
  const [depRef, setDepRef] = useState('')

  const w = data?.wallet ?? null

  // ONE KEY PER ATTEMPT, not per click, so a double-tap or a retry after a
  // dropped connection pays once.
  const idem = useMemo(() => `${to}|${amount}|${memo}|${Date.now()}`, [to, amount, memo])

  // Fetched only when the receive sheet is opened. The QR is rendered on the
  // server from the caller's own wallet, so there is nothing to pass and
  // nothing a crafted link could substitute.
  useEffect(() => {
    if (sheet !== 'receive' || qr) return
    void fetch('/api/freehold/wallet/qr', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.qr) setQr(String(j.qr)) })
      .catch(() => {})
  }, [sheet, qr])

  const copy = (text: string) => {
    void navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const send = async () => {
    setBusy(true)
    const r = await post('/api/freehold/wallet', {
      action: 'send', toWalletId: to, amount: Number(amount), memo, reference: idem,
    })
    setBusy(false)
    if (r) {
      onNote({ tone: 'ok', text: t(r.duplicate ? 'wal.send.duplicate' : 'wal.send.done') })
      setAmount(''); setMemo(''); setSheet('none')
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
      setDepAmount(''); setDepRef(''); setSheet('none')
    }
  }

  const chain = data?.chain
  const commissions = data?.commissions ?? []
  const activity = data?.activity ?? []
  const pending = activity.filter((a) => a.state === 'pending')
  const pendingIn = pending.reduce((n, a) => n + a.amount, 0)

  return (
    <>
      {/* ── THE BALANCE, AS ONE NUMBER ───────────────────────────────────────
          A wallet answers one question before any other: how much have I got.
          It is the largest thing on the screen for that reason, and the address
          sits under it because the second question is where people send it. */}
      <div className="rounded-2xl border border-line bg-gradient-to-b from-surface-2 to-surface p-6 sm:p-8">
        <p className="text-sm text-slate-400">{t('wal.stat.balance')}</p>
        <p className="mt-1 text-4xl font-semibold tabular-nums text-white sm:text-5xl">
          {w ? cashText(w.balance) : '—'}
        </p>

        {/* Incoming money is shown BESIDE the balance, never inside it. A
            recorded deposit is a claim, and adding it to the spendable figure
            would be the wallet lying about what can be spent right now. */}
        {pendingIn > 0 && (
          <p className="mt-1.5 text-sm text-amber-200">
            {t('wal.hero.pending', { amount: cashText(pendingIn) })}
          </p>
        )}
        {w && w.held > 0 && (
          <p className="mt-1 text-sm text-slate-400">
            {t('wal.hero.held', { amount: cashText(w.held) })}
          </p>
        )}

        {w && (
          <button
            onClick={() => copy(w.accountNo)}
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 font-mono text-xs text-slate-300 transition hover:border-gold/40 hover:text-white"
            title={w.accountNo}
          >
            {shortAddress(w.accountNo)}
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        )}

        {/* Three actions, equal weight, always in the same order. */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          {([
            ['send', ArrowUpRight, 'wal.act.send'],
            ['receive', QrCode, 'wal.act.receive'],
            ['deposit', Plus, 'wal.act.topUp'],
          ] as const).map(([id, Icon, key]) => (
            <button
              key={id}
              onClick={() => setSheet(id)}
              disabled={!w}
              className="flex flex-col items-center gap-2 rounded-xl border border-line bg-surface px-3 py-4 text-xs font-medium text-slate-200 transition hover:border-gold/40 hover:text-white disabled:opacity-40"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface-2">
                <Icon className="h-4 w-4" />
              </span>
              {t(key)}
            </button>
          ))}
        </div>
      </div>

      {/* ── ACTIVITY ──────────────────────────────────────────────────────── */}
      <Panel>
        <PanelHeader title={t('wal.log.title')} />
        <div className="p-2 sm:p-3">
          {activity.length === 0 ? (
            <div className="p-6">
              <EmptyState title={t('wal.log.empty')} />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {activity.map((a) => {
                const Icon = ACTIVITY_ICON[a.kind] ?? ArrowUpRight
                const inbound = a.direction === 'in'
                return (
                  <li key={`${a.id}-${a.direction}-${a.at}`}>
                    <button
                      onClick={() => setDetail(a)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-start transition hover:bg-surface-2"
                    >
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
                        a.state === 'pending' ? 'border-amber-400/30 text-amber-200'
                        : a.state === 'rejected' ? 'border-red-400/30 text-red-300'
                        : inbound ? 'border-emerald-400/30 text-emerald-300'
                        : 'border-line text-slate-300'
                      }`}>
                        <Icon className="h-4 w-4" />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-slate-200">
                          {t(`wal.kind.${a.kind}`)}
                          {a.counterparty && <span className="text-slate-400"> · {a.counterparty}</span>}
                        </span>
                        <span className="block truncate text-xs text-slate-500">
                          {a.state === 'confirmed'
                            ? formatInstant(a.at, 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })
                            : t(`wal.state.${a.state}`)}
                          {a.memo && ` · ${a.memo}`}
                        </span>
                      </span>

                      <span className={`shrink-0 text-sm tabular-nums ${
                        a.state !== 'confirmed' ? 'text-slate-500'
                        : inbound ? 'text-emerald-300' : 'text-slate-200'
                      }`}>
                        {inbound ? '+' : '−'}{cashText(a.amount)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </Panel>

      {/* ── THE PROOF ─────────────────────────────────────────────────────
          Every movement is a block carrying the hash of the one before it, so
          an edited row stops matching its own hash. This says whether that
          check passes — and it is on a BROKER'S screen, not only a manager's,
          because a proof only management can run is a reassurance rather than
          a proof.

          Three states, never two. "Could not check" is not "sound". */}
      {chain === null || chain === undefined ? (
        <p className="flex items-center gap-2 px-1 text-xs text-slate-500">
          <ShieldAlert className="h-3.5 w-3.5" /> {t('wal.chain.unknown')}
        </p>
      ) : chain.ok ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-xs text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          {t('wal.chain.ok', { n: chain.length })}
          <span className="font-mono text-slate-600">{shortHash(chain.head)}</span>
        </p>
      ) : (
        <p className="flex items-center gap-2 rounded-lg border border-red-500/30 px-3 py-2 text-xs text-red-200">
          <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
          {t('wal.chain.broken', { n: chain.brokenAt })}
        </p>
      )}

      {/* ── COMMISSION ─────────────────────────────────────────────────────
          The deal row always knew what a broker had earned; the wallet could
          not say WHEN any of it was coming, which is the only part of it
          anybody can plan around. A broker is paid pro rata on what the agency
          has actually received, so this shows both: what has landed, and what
          is still waiting on a payment that has not arrived yet. */}
      {commissions.length > 0 && (
        <Panel>
          <PanelHeader title={t('wal.comm.title')} icon={<Handshake className="h-4 w-4" />} />
          <div className="p-5">
            <p className="mb-4 text-sm text-slate-400">{t('wal.comm.sub')}</p>
            <ul className="space-y-4">
              {commissions.map((c) => (
                <li key={c.dealId} className="rounded-xl border border-line p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate text-sm text-slate-200">{c.dealName}</span>
                    <span className={`text-xs ${
                      c.state === 'paid' ? 'text-emerald-300'
                      : c.state === 'partly' ? 'text-amber-200' : 'text-slate-500'
                    }`}>{t(`wal.comm.state.${c.state}`)}</span>
                  </div>

                  {/* Paid and awaited, side by side and never summed — the
                      awaited half is money the agency has not been given yet,
                      and showing one total would promise it. */}
                  <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                    <span className="text-slate-300">
                      {t('wal.comm.paid')} <span className="tabular-nums">{cashText(c.paidAed)}</span>
                    </span>
                    {c.awaitingAed > 0 && (
                      <span className="text-slate-500">
                        {t('wal.comm.awaiting')} <span className="tabular-nums">{cashText(c.awaitingAed)}</span>
                      </span>
                    )}
                  </div>

                  {c.payments.length > 0 && (
                    <ul className="mt-3 space-y-1 border-t border-line pt-2">
                      {c.payments.map((p, i) => (
                        <li key={`${c.dealId}-${p.receivedAt}-${i}`}
                          className="flex items-center justify-between gap-3 text-xs">
                          <span className="text-slate-500">
                            {formatInstant(p.receivedAt, 'en-GB', { dateStyle: 'medium' })}
                            {p.reference && <span className="ms-2 font-mono">{p.reference}</span>}
                          </span>
                          <span className="tabular-nums text-emerald-300">+{cashText(p.payoutAed)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      )}

      {/* ── SHEETS ────────────────────────────────────────────────────────── */}

      {sheet === 'send' && (
        <Sheet title={t('wal.send.title')} onClose={() => setSheet('none')}>
          <p className="text-sm text-slate-400">{t('wal.send.sub')}</p>
          <label className="block text-sm">
            <span className="text-slate-400">{t('wal.send.to')}</span>
            <select value={to} onChange={(e) => setTo(e.target.value)} className={`${fieldClass()} mt-1 w-full`}>
              <option value="">{t('wal.send.toPlaceholder')}</option>
              {(data?.payees ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.label} · {shortAddress(p.accountNo)}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-400">{t('wal.send.amount')}</span>
            <input type="number" min={1} step={1} value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`${fieldClass()} mt-1 w-full text-lg tabular-nums`} />
          </label>
          {/* The balance, restated at the moment of spending it. */}
          {w && <p className="text-xs text-slate-500">{t('wal.send.have', { amount: cashText(w.balance) })}</p>}
          <label className="block text-sm">
            <span className="text-slate-400">{t('wal.send.memo')}</span>
            <input value={memo} onChange={(e) => setMemo(e.target.value)}
              placeholder={t('wal.send.memoPlaceholder')} className={`${fieldClass()} mt-1 w-full`} />
          </label>
          <Button onClick={() => void send()} disabled={busy || !to || !amount}>
            {busy ? t('wal.send.sending') : t('wal.send.action')}
          </Button>
        </Sheet>
      )}

      {sheet === 'receive' && (
        <Sheet title={t('wal.receive.title')} onClose={() => setSheet('none')}>
          <p className="text-sm text-slate-400">{t('wal.receive.sub')}</p>
          <div className="flex flex-col items-center gap-4 py-2">
            {qr
              // eslint-disable-next-line @next/next/no-img-element -- a data: URI generated server-side; there is nothing for the image optimiser to fetch.
              ? <img src={qr} alt={t('wal.receive.title')} className="h-56 w-56 rounded-xl bg-white p-2" />
              : <div className="flex h-56 w-56 items-center justify-center rounded-xl border border-line">
                  <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
                </div>}
            {w && (
              <button onClick={() => copy(w.accountNo)}
                className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 font-mono text-sm text-slate-200 hover:border-gold/40">
                {w.accountNo}
                {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </button>
            )}
          </div>
        </Sheet>
      )}

      {sheet === 'deposit' && (
        <Sheet title={t('wal.deposit.title')} onClose={() => setSheet('none')}>
          <p className="text-sm text-slate-400">{t('wal.deposit.sub')}</p>
          {/* THE SENTENCE THAT PREVENTS THE BUG REPORT, said before the button
              rather than after the press. */}
          <p className="rounded-lg border border-amber-500/25 px-3 py-2 text-sm text-amber-100/90">
            {t('wal.deposit.claimNote')}
          </p>
          <label className="block text-sm">
            <span className="text-slate-400">{t('wal.deposit.amount')}</span>
            <input type="number" min={1} step={1} value={depAmount}
              onChange={(e) => setDepAmount(e.target.value)}
              className={`${fieldClass()} mt-1 w-full text-lg tabular-nums`} />
          </label>
          <label className="block text-sm">
            <span className="text-slate-400">{t('wal.deposit.ref')}</span>
            <input value={depRef} onChange={(e) => setDepRef(e.target.value)}
              placeholder={t('wal.deposit.refPlaceholder')}
              className={`${fieldClass()} mt-1 w-full font-mono`} />
          </label>
          <Button variant="secondary" onClick={() => void deposit()}
            disabled={busy || !depAmount || !depRef.trim()}>
            {t('wal.deposit.action')}
          </Button>
        </Sheet>
      )}

      {/* THE RECEIPT. Every row opens one, because "what was this AED 400" is
          the question a log exists to answer and a truncated row cannot. */}
      {detail && (
        <Sheet title={t('wal.tx.title')} onClose={() => setDetail(null)}>
          <p className={`text-3xl font-semibold tabular-nums ${
            detail.direction === 'in' ? 'text-emerald-300' : 'text-slate-100'
          }`}>
            {detail.direction === 'in' ? '+' : '−'}{cashText(detail.amount)}
          </p>
          <dl className="divide-y divide-line text-sm">
            {([
              ['wal.tx.what', t(`wal.kind.${detail.kind}`)],
              ['wal.tx.status', t(`wal.state.${detail.state}`)],
              ['wal.tx.when', formatInstantZoned(detail.at, 'en-GB')],
              ['wal.tx.who', detail.counterparty ?? t('wal.tx.house')],
              ['wal.tx.account', detail.counterpartyAccount ?? '—'],
              ['wal.tx.memo', detail.memo || '—'],
              // The reference IS this system's transaction hash — the one
              // string that identifies the movement in the ledger, in the
              // withdraw record and in the platform invoice behind it.
              ['wal.tx.ref', detail.id],
            ] as const).map(([key, value]) => (
              <div key={key} className="flex items-start justify-between gap-4 py-2.5">
                <dt className="shrink-0 text-slate-500">{t(key)}</dt>
                <dd className="min-w-0 break-all text-end font-mono text-xs text-slate-300">{value}</dd>
              </div>
            ))}
          </dl>
          <Button variant="ghost" onClick={() => copy(detail.id)}>
            {copied ? t('wal.copied') : t('wal.tx.copyRef')}
          </Button>
        </Sheet>
      )}
    </>
  )
}

/**
 * A bottom sheet on a phone, a centred card on a desktop.
 *
 * Wallet actions are modal on purpose: sending money is the one thing on this
 * screen that must not be done half-looking at something else, and a form
 * sitting permanently in a column invites exactly that.
 */
function Sheet({
  title, onClose, children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  // Escape closes it. A modal over somebody's money that traps them is worse
  // than no modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6"
      onClick={onClose} role="presentation">
      <div
        className="w-full max-w-md space-y-4 rounded-t-2xl border border-line bg-surface p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
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
                      <td className="py-2.5 text-slate-500">{formatInstant(w.at, 'en-GB', { dateStyle: 'medium' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Panel>

      {/* THE SPEND NO WALLET IS CARRYING. Campaigns built in Ads Manager have
          no payer, so settlement walks past them: never billed, never paused,
          and absent from every figure above. This is where that is closed. */}
      <AttributionPanel onNote={onNote} />

      {/* The one-off migration, offered only while it would do something. */}
      <Panel>
        <PanelHeader title={t('bank.redenom.title')} />
        <div className="space-y-3 p-5">
          <p className="text-sm text-slate-400">{t('bank.redenom.sub')}</p>
          {data.redenomination.ran ? (
            <p className="text-sm text-slate-500">
              {t('bank.redenom.ran', { date: formatInstant(data.redenomination.at, 'en-GB', { dateStyle: 'medium' }) })}
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
