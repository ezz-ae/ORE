/**
 * Ads Coin — the ledger, as a bank would keep it.
 *
 * What this replaces is the reason it exists. Credits were a number on a
 * broker's row: `allocation +100` added to it, `spend -40` took away. Coin
 * appeared from nowhere and vanished into nowhere, so there was no answer to
 * "how much is in the system", no way to see where a hundred coins went, and
 * nothing stopping two screens disagreeing. A balance you can edit is not
 * money — it is a label.
 *
 * So: DOUBLE ENTRY. Every movement is a transfer with exactly two postings,
 * equal and opposite — one wallet debited, one credited. Coin is created in
 * exactly one place (an issue from the treasury) and destroyed in exactly one
 * place (a burn back to it), and both are themselves transfers, so the books
 * balance at every instant. The consequence that matters:
 *
 *     the sum of every wallet's balance and holds
 *     always equals what the treasury has issued
 *
 * That is checkable — `conservationError` below — and it is checked, which is
 * the difference between a banking system and a story about one.
 *
 * The pure half lives here: account numbers, building a balanced transfer,
 * projecting balances from postings, and the invariant. None of it needs a
 * database, so all of it is tested.
 */

/** Ads Coin is integral. There is no half-coin, and no floating point anywhere. */
export type Coins = number

export type WalletKind =
  /** The one account coin is issued FROM. May go negative — that is the float. */
  | 'treasury'
  /** The company's own spending account. */
  | 'operations'
  /** The autonomous ads budget. Brokers and the machine both draw on coin. */
  | 'lead_machine'
  /** One per broker. */
  | 'broker'

export type PostingKind =
  | 'issue'     // treasury → a wallet: new coin enters the system
  | 'burn'      // a wallet → treasury: coin leaves it
  | 'transfer'  // wallet → wallet, by account number
  | 'spend'     // wallet → operations, against real ad spend
  | 'refund'    // operations → wallet, a spend reversed
  | 'earn'      // treasury → broker, a bonus
  | 'hold'      // inside one wallet: balance → held
  | 'release'   // inside one wallet: held → balance

export interface Wallet {
  id: string
  accountNo: string
  kind: WalletKind
  ownerId: string | null
  label: string
  /** Spendable now. */
  balance: Coins
  /** Committed to a running campaign — still owned, not yet spent. */
  held: Coins
}

export interface Posting {
  walletId: string
  direction: 'debit' | 'credit'
  /** Always positive. The direction carries the sign. */
  amount: Coins
}

export interface Transfer {
  reference: string
  kind: PostingKind
  amount: Coins
  fromWalletId: string
  toWalletId: string
  memo: string
  postings: [Posting, Posting]
}

// ── Account numbers ───────────────────────────────────────────────────────────

/**
 * `FH-21-004472-9`
 *
 * Prefix · kind · serial · check digit. It is meant to be read aloud and typed
 * into a transfer box by someone looking at a screenshot, so it carries a Luhn
 * check digit: a single mistyped digit, or two transposed, is rejected here
 * rather than becoming a transfer to a wallet that happens to exist.
 */
const KIND_CODE: Record<WalletKind, string> = {
  treasury: '10', operations: '20', lead_machine: '21', broker: '30',
}
const CODE_KIND: Record<string, WalletKind> = Object.fromEntries(
  Object.entries(KIND_CODE).map(([k, v]) => [v, k as WalletKind]),
) as Record<string, WalletKind>

/** Luhn over the digits only. */
function luhn(digits: string): number {
  let sum = 0
  let dbl = true // computing the check digit: the rightmost body digit doubles
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48
    if (dbl) { d *= 2; if (d > 9) d -= 9 }
    sum += d
    dbl = !dbl
  }
  return (10 - (sum % 10)) % 10
}

export function formatAccountNo(kind: WalletKind, serial: number): string {
  const code = KIND_CODE[kind]
  const body = `${code}${String(Math.max(0, Math.floor(serial))).padStart(6, '0')}`
  return `FH-${code}-${body.slice(2)}-${luhn(body)}`
}

/** Parse and verify. Returns null for anything that is not a real number. */
export function parseAccountNo(raw: string): { kind: WalletKind; serial: number } | null {
  const cleaned = raw.trim().toUpperCase().replace(/\s+/g, '')
  const m = /^FH-(\d{2})-(\d{6})-(\d)$/.exec(cleaned)
  if (!m) return null
  const [, code, serial, check] = m
  const kind = CODE_KIND[code]
  if (!kind) return null
  if (luhn(`${code}${serial}`) !== Number(check)) return null
  return { kind, serial: Number(serial) }
}

export const isAccountNo = (raw: string): boolean => parseAccountNo(raw) !== null

// ── Amounts ───────────────────────────────────────────────────────────────────

/**
 * A movement must be a whole, positive, finite number of coins.
 *
 * Rejected here rather than at the database: NaN, Infinity and 0.1 all become
 * silent corruption once they reach a balance, and a zero-coin transfer is a
 * ledger row that says nothing happened.
 */
export function isValidAmount(n: unknown): n is Coins {
  return typeof n === 'number' && Number.isFinite(n) && Number.isInteger(n) && n > 0 && n <= 1_000_000_000
}

// ── Transfers ─────────────────────────────────────────────────────────────────

export type TransferRefusal =
  | 'invalid_amount'
  | 'same_wallet'
  | 'insufficient_funds'
  | 'insufficient_held'
  | 'unknown_wallet'

export class TransferError extends Error {
  constructor(public readonly refusal: TransferRefusal) {
    super(refusal)
    this.name = 'TransferError'
  }
}

/**
 * Build the balanced pair for a movement.
 *
 * There is no way to construct a one-sided posting through this module, which
 * is the whole point: the only function that writes to the ledger takes a
 * `Transfer`, and a `Transfer` cannot exist without both halves.
 */
export function buildTransfer(input: {
  reference: string
  kind: PostingKind
  amount: Coins
  fromWalletId: string
  toWalletId: string
  memo?: string
}): Transfer {
  if (!isValidAmount(input.amount)) throw new TransferError('invalid_amount')
  if (input.fromWalletId === input.toWalletId && input.kind !== 'hold' && input.kind !== 'release') {
    // Sending coin to yourself is a no-op dressed as a transaction. Holds are
    // the deliberate exception: they move within one wallet.
    throw new TransferError('same_wallet')
  }
  return {
    reference: input.reference,
    kind: input.kind,
    amount: input.amount,
    fromWalletId: input.fromWalletId,
    toWalletId: input.toWalletId,
    memo: input.memo ?? '',
    postings: [
      { walletId: input.fromWalletId, direction: 'debit', amount: input.amount },
      { walletId: input.toWalletId, direction: 'credit', amount: input.amount },
    ],
  }
}

/**
 * May this wallet send this much?
 *
 * The treasury may go negative — that IS the issuance float, and the amount it
 * is negative by is exactly the coin in circulation. Every other wallet is
 * hard-limited to what it holds, because an overdraft nobody agreed to is how
 * a balance stops meaning anything.
 */
export function canSend(w: Pick<Wallet, 'kind' | 'balance'>, amount: Coins): boolean {
  if (!isValidAmount(amount)) return false
  if (w.kind === 'treasury') return true
  return w.balance >= amount
}

// ── Projection and the invariant ──────────────────────────────────────────────

/** Replay postings onto a starting balance. The ledger is the truth; a stored
 *  balance is only a cache of this. */
export function projectBalance(postings: Posting[], walletId: string, opening: Coins = 0): Coins {
  return postings.reduce((bal, p) => {
    if (p.walletId !== walletId) return bal
    return p.direction === 'credit' ? bal + p.amount : bal - p.amount
  }, opening)
}

/**
 * The books, checked.
 *
 * Returns 0 when every coin is accounted for, and the discrepancy otherwise.
 * Debits and credits over the whole ledger must cancel exactly — if they do
 * not, coin was created or destroyed outside an issue, and no screen built on
 * top can be trusted.
 */
export function conservationError(postings: Posting[]): number {
  let net = 0
  for (const p of postings) net += p.direction === 'credit' ? p.amount : -p.amount
  return net
}

export interface TreasuryPosition {
  /** Every coin ever issued and still in existence. */
  capital: Coins
  /** Sitting in spending wallets, unspent and unheld — free to move. */
  liquidity: Coins
  /** Committed to running campaigns. */
  inUse: Coins
  /** Issued but not yet distributed — still in operations. */
  undistributed: Coins
}

/**
 * The bank's own summary. Derived from wallets, never stored — a stored total
 * is the thing that drifts from the accounts it claims to summarise.
 */
export function treasuryPosition(wallets: Wallet[]): TreasuryPosition {
  const spending = wallets.filter((w) => w.kind !== 'treasury')
  const treasury = wallets.find((w) => w.kind === 'treasury')
  // The treasury's negative balance IS the coin in circulation.
  const capital = treasury ? Math.max(0, -treasury.balance) : spending.reduce((n, w) => n + w.balance + w.held, 0)
  const inUse = spending.reduce((n, w) => n + w.held, 0)
  const undistributed = spending.filter((w) => w.kind === 'operations').reduce((n, w) => n + w.balance, 0)
  const liquidity = spending.filter((w) => w.kind !== 'operations').reduce((n, w) => n + w.balance, 0)
  return { capital, liquidity, inUse, undistributed }
}

// ── Dirhams, as an asset ──────────────────────────────────────────────────────

/**
 * AED is recorded but NOT spendable. Ads Coin is the only token any part of
 * the system will accept, which keeps one question — "can this campaign run?"
 * — answerable from one number. Dirhams sit beside the coin as the asset that
 * backs it and as what the postpaid statement is denominated in.
 *
 * Deliberately not a currency conversion: nothing in the product converts AED
 * into coin at a rate, because a rate nobody agreed to is a way to lose money
 * quietly. Issuance is an explicit act with an explicit amount.
 */
export interface AssetPosition {
  /** Fils, so AED arithmetic is integral too — 1 AED = 100 fils. */
  aedFils: number
}

export const filsToAed = (fils: number): string =>
  (Math.round(fils) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const aedToFils = (aed: number): number => Math.round(aed * 100)
