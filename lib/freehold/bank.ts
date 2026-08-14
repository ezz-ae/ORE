/**
 * THE BANK — where Cash comes from, who may move it, and what it leaves behind.
 *
 * wallet.ts is the ledger and it is sound: double entry, coin created in one
 * place and destroyed in one place, and a conservation invariant that is
 * actually checked. Nothing here changes any of that. This module is the
 * AUTHORITY layer on top — the rules about who may make a movement at all, and
 * the receipt every dirham leaving the system has to carry.
 *
 * One Cash is one dirham (credits-shared.ts). Everything below is dirhams.
 *
 * ── THE BANK ONLY DOES TWO THINGS: DEPOSIT AND MINT ──────────────────────
 *
 * Cash enters the world in the bank and nowhere else, by one of two doors, and
 * WHICH DOOR IT CAME THROUGH IS THE MOST IMPORTANT FACT ABOUT IT:
 *
 *   · DEPOSIT — real money arrived in the company account. Somebody paid for
 *     their own ads, a partner settled an invoice, the company funded itself.
 *     Anyone may record one, and it carries a TRANSACTION NUMBER, because that
 *     is the thing a bank statement can be read against. A deposit is a CREDIT
 *     in the bank's books.
 *
 *   · MINT — Cash with no cash in front of it. Only an admin, and it is the
 *     company extending value out of its own pocket: a promotion, a goodwill
 *     top-up, a line of credit for a broker who has earned one.
 *
 * Both produce spendable Cash and they must never be added together into a
 * single "money we have" figure. Deposited-versus-minted IS the solvency
 * question — how much of what everyone is holding is real money, and how much
 * is a promise the company has made. `backing()` answers it and the bank screen
 * shows both halves, always.
 *
 * ── A DEPOSIT IS A CLAIM UNTIL SOMEBODY CHECKS THE STATEMENT ─────────────
 *
 * Anyone may RECORD a deposit; recording one does not create Cash. It creates a
 * claim that money arrived, and an admin clears it against the bank statement.
 *
 * This is not bureaucracy bolted onto the user's rule, it is the only way the
 * rule can be true: if typing a transaction number credited a wallet instantly,
 * then anybody could type any number and give themselves AED 50,000 of real ad
 * spend. Depositing stays open to everyone — the money just becomes spendable
 * when the statement agrees, which is what "a cash transaction to the company
 * account" already means outside the software.
 *
 * ── MONEY IS PUSHED, NEVER PULLED ────────────────────────────────────────
 *
 * ANY WALLET MAY SEND TO ANY WALLET. There is no hierarchy in a transfer and no
 * team boundary — people pay each other. What there is NOT, anywhere, is an
 * operation that takes money OUT of somebody else's wallet.
 *
 * That is structural rather than a permission check, and the distinction is the
 * whole design: `authorise` requires the source wallet to be the actor's own,
 * with no branch accepting anybody else's, so no future screen can add one by
 * accident. It is also why "allocate" is gone. An admin funding a broker mints
 * in the bank, MOVES the Cash into their own wallet, and sends it like everyone
 * else — three visible steps whose middle one puts a named human between the
 * printing press and somebody's balance.
 *
 * ── IN THE BANK IT IS ANONYMOUS; ONCE IT MOVES IT IS A CHEQUE ────────────
 *
 * Cash sitting in the bank that has never moved belongs to nobody. Any admin
 * may burn from it, because there is no "whose" to violate — it is float.
 *
 * THE MOMENT AN ADMIN MOVES IT OUT, IT BECOMES A CHEQUE AND THAT ADMIN IS ITS
 * OWNER. From then on only the mover may burn it, however far it has travelled
 * since. The bank can see from the log where it went — a cheque sent on, split,
 * spent — but the right to destroy it does not travel with it.
 *
 * The reason is the reason for every rule in this file: a ledger where anybody
 * can annihilate anybody's money is not a bank, whatever the double entry says.
 * Tying the burn to the person who signed the money out means every destroyed
 * dirham has exactly one name against it, and that name is not the recipient's.
 *
 * ── AND EVERY DIRHAM THAT LEAVES CARRIES ITS RECEIPT ─────────────────────
 *
 * A spend is not an entry, it is a withdrawal. Cash becomes a dirham on the
 * DEBIT side and lands in the withdraw record with proof of what it bought:
 *
 *   · ADS pay themselves — the platform, the ad account and the campaign are
 *     the receipt, and they reconcile against the Meta and Google invoices
 *     without anybody re-typing anything. No cheque number is asked for,
 *     because inventing a reference for something the ad account can already
 *     prove is paperwork rather than control.
 *   · EVERYTHING ELSE needs a human reference: a cheque or transaction number.
 *     An image may be attached and is never required — a photograph is
 *     evidence, and a system that refuses to record a real payment because
 *     nobody could photograph the cheque teaches people to keep the books
 *     somewhere else.
 *
 * A withdrawal that can prove neither is REFUSED. Money leaving with no record
 * of where it went is the one failure a finance system exists to prevent.
 *
 * Pure — no I/O, no clock. Runs in `pnpm guards`.
 */
import { MANAGEMENT_ROLES, type Role } from '@/lib/freehold/session-types'
import { isValidAmount, type Coins } from '@/lib/freehold/wallet'

/** Walkable — the two sides of the bank's book, in the words it prints. */
export const BANK_SIDES = ['credit', 'debit'] as const
export type BankSide = (typeof BANK_SIDES)[number]

/** Walkable — every way Cash can move, in the words the bank screen uses. */
export const BANK_ACTIONS = ['deposit', 'mint', 'move', 'send', 'burn', 'spend'] as const
export type BankAction = (typeof BANK_ACTIONS)[number]

/**
 * The two doors Cash comes through. Never summed into one number — see the
 * header: this is the solvency question, not a detail.
 */
export const CASH_ORIGINS = ['deposit', 'mint'] as const
export type CashOrigin = (typeof CASH_ORIGINS)[number]

/**
 * Walkable — where a recorded deposit stands.
 *
 * `claimed` money is NOT spendable. Only `cleared` has been seen on a bank
 * statement by somebody who can read one.
 */
export const DEPOSIT_STATES = ['claimed', 'cleared', 'rejected'] as const
export type DepositState = (typeof DEPOSIT_STATES)[number]

/** Walkable — what a parcel of Cash currently is. */
export const CASH_STATES = ['inBank', 'cheque', 'spent', 'burned'] as const
export type CashState = (typeof CASH_STATES)[number]

/** Walkable — what the money was for. Each renders its own word and proof rule. */
export const SPEND_KINDS = ['ads', 'commission', 'salary', 'vendor', 'refund', 'other'] as const
export type SpendKind = (typeof SPEND_KINDS)[number]

/**
 * The kinds whose receipt is the platform itself.
 *
 * Only ads. The ad account holds the invoice, the campaign id ties the spend to
 * what it bought, and both are readable by anything with the token — a stronger
 * record than a number somebody types. Every other kind leaves through a bank,
 * and a bank gives you a reference.
 */
export const SELF_EVIDENCING: readonly SpendKind[] = ['ads']

/** Walkable — why a movement was refused. Each renders its own sentence. */
export const BANK_REFUSALS = [
  'notAdmin', 'notYourMoney', 'notYourCheque', 'notYourMint', 'noTransactionNumber',
  'notCleared', 'noProof', 'badAmount', 'noSuchWallet', 'sameWallet',
] as const
export type BankRefusal = (typeof BANK_REFUSALS)[number]

/** Who is asking, and what they own. */
export interface Actor {
  userId: string
  role: Role
  /** The wallet they own. null for somebody with no account yet. */
  walletId: string | null
}

export const isAdmin = (role: Role): boolean =>
  (MANAGEMENT_ROLES as readonly string[]).includes(role)

/**
 * A parcel of Cash, tracked from the door it came through to the moment it is
 * gone.
 *
 * The lot is what makes the cheque rule enforceable. Without it "only the
 * person who moved this may burn it" has nothing to point at, because Cash in a
 * wallet is otherwise just a number and one dirham is any other dirham.
 */
export interface CashLot {
  id: string
  origin: CashOrigin
  /** The admin who minted it, or whoever recorded the deposit. */
  createdBy: string
  /**
   * The bank's own reference for a deposit. ALWAYS null for a mint — that
   * absence is the entire difference between the two doors, so it is a field
   * rather than a flag somebody could set inconsistently.
   */
  transactionRef: string | null
  /** Deposits only. A mint is `cleared` the moment it is made. */
  deposit: DepositState
  amount: Coins
  /** The admin who signed it out of the bank. Null while it is still float. */
  movedBy: string | null
  /** What of it is left — not yet spent, not yet burned. */
  remaining: Coins
  /** How the last of it went, once `remaining` reaches zero. */
  closedBy: 'spent' | 'burned' | null
}

/**
 * What this parcel of Cash is right now.
 *
 * `inBank` and `cheque` are the same money in different states, and the
 * difference is only who may destroy it.
 */
export function cashState(lot: CashLot): CashState {
  if (lot.remaining > 0) return lot.movedBy ? 'cheque' : 'inBank'
  return lot.closedBy === 'burned' ? 'burned' : 'spent'
}

/** Cash that exists and can be spent. A claimed deposit is not money yet. */
export const isSpendable = (lot: CashLot): boolean =>
  lot.deposit === 'cleared' && lot.remaining > 0

export type Authorisation =
  | { ok: true }
  | { ok: false; refusal: BankRefusal }

const no = (refusal: BankRefusal): Authorisation => ({ ok: false, refusal })

/**
 * MAY THIS ACTOR BURN THIS PARCEL?
 *
 * Split out from `authorise` because it is the rule most likely to be reached
 * for from somewhere else — a screen deciding whether to show the button, a
 * report explaining why a lot is stuck — and a rule with two implementations is
 * a rule with one bug.
 *
 * TWO RULES GOVERN BURNING AND THEY OVERLAP:
 *
 *   (a) nobody burns Cash they did not create;
 *   (b) Cash still in the bank has never moved, so it is not a cheque and any
 *       admin may burn it.
 *
 * Read literally they disagree about in-bank Cash created by somebody else, and
 * this is how they are reconciled — (b) is the carve-out and (a) is everything
 * outside it:
 *
 *   · IN THE BANK it is float. It belongs to nobody, nobody has signed for it,
 *     and any admin may burn it. There is no "whose" to violate.
 *   · ONCE MOVED it is a cheque, and tearing it up needs BOTH signatures on it:
 *     the admin who created it and the admin who signed it out. Usually the
 *     same person; when they are not, neither of them can destroy it alone.
 *
 * That last case can deadlock a parcel — A mints, B moves, and now nobody may
 * burn it. That is deliberate and it is the safe direction. Being unable to
 * destroy money is recoverable, because the money is still there to be spent or
 * sent back; being able to destroy somebody else's is not recoverable at all.
 */
export function mayBurn(actor: Actor, lot: CashLot): Authorisation {
  if (!isAdmin(actor.role)) return no('notAdmin')
  if (lot.remaining <= 0) return no('badAmount')
  // Still float. Nobody owns it, so there is no "whose" to violate.
  if (!lot.movedBy) return { ok: true }
  // A cheque. The signature that signed it out is the first requirement.
  if (lot.movedBy !== actor.userId) return no('notYourCheque')
  // …and you cannot destroy money you did not bring into the world, even if
  // you were the one who moved it.
  if (lot.createdBy !== actor.userId) return no('notYourMint')
  return { ok: true }
}

/**
 * What a spend claims to have bought.
 *
 * `reference` is a cheque or transaction number. `imageUrl` is optional and
 * always optional — see the header.
 */
export interface SpendProof {
  kind: SpendKind
  /** Ads: the platform's own ids, which reconcile against its invoices. */
  campaignId?: string | null
  adAccountId?: string | null
  /** Everything else: the cheque or transaction number. */
  reference?: string | null
  imageUrl?: string | null
}

/**
 * Does this spend carry a receipt?
 *
 * Ads prove themselves through the platform. Everything else needs a reference
 * somebody can look up on a bank statement. An image never satisfies this on
 * its own: a photograph with no number attached cannot be reconciled against
 * anything.
 */
export function hasProof(p: SpendProof | undefined): boolean {
  if (!p) return false
  const has = (v: string | null | undefined) => !!(v && v.trim())
  if (SELF_EVIDENCING.includes(p.kind)) return has(p.campaignId) || has(p.adAccountId)
  return has(p.reference)
}

/** One requested movement, before anything is written. */
export interface MoveRequest {
  action: BankAction
  amount: Coins
  /** The wallet the money leaves. null when it comes out of the bank itself. */
  fromWalletId: string | null
  /** The wallet it lands in. null for a burn — it leaves the world. */
  toWalletId: string | null
  /** Deposits: the bank's reference for the money that actually arrived. */
  transactionRef?: string | null
  /** Burns: the parcel being destroyed. */
  lot?: CashLot
  /** Spends: what it was for and what proves it. */
  spend?: SpendProof
}

/**
 * May this actor make this movement?
 *
 * The refusals are ordered so the most fundamental answers first: a bad amount
 * is a malformed request, and being told "you are not an admin" about a
 * movement that was never valid is a confusing thing to read.
 */
export function authorise(actor: Actor, req: MoveRequest): Authorisation {
  if (!isValidAmount(req.amount)) return no('badAmount')

  switch (req.action) {
    // ANYONE MAY RECORD REAL MONEY ARRIVING — and it is a claim, not Cash,
    // until an admin has seen it on the statement. The transaction number is
    // required because without it there is nothing to clear the claim against.
    case 'deposit':
      if (!req.transactionRef || !req.transactionRef.trim()) return no('noTransactionNumber')
      return { ok: true }

    // CASH WITH NO CASH IN FRONT OF IT. Admins only, and deliberately without a
    // reference field: a mint that carried one would look like a deposit in
    // every report, which is the one confusion this whole model exists to
    // prevent.
    case 'mint':
      if (!isAdmin(actor.role)) return no('notAdmin')
      return { ok: true }

    // SIGNING CASH OUT OF THE BANK. This is the act that creates a cheque and
    // names its owner, so it is an admin's own signature and the destination is
    // the admin's own wallet — an admin who wants somebody else to have it
    // sends it afterwards, in the open, like anybody else.
    case 'move': {
      if (!isAdmin(actor.role)) return no('notAdmin')
      if (!actor.walletId) return no('noSuchWallet')
      if (req.toWalletId !== actor.walletId) return no('notYourMoney')
      return { ok: true }
    }

    // ANY WALLET TO ANY WALLET, OUT OF YOUR OWN POCKET. There is no branch here
    // that accepts somebody else's wallet as the source, which is what makes
    // "nobody can take from anybody" structural rather than a rule to remember.
    case 'send': {
      if (!req.toWalletId) return no('noSuchWallet')
      if (!actor.walletId || req.fromWalletId !== actor.walletId) return no('notYourMoney')
      if (req.toWalletId === req.fromWalletId) return no('sameWallet')
      return { ok: true }
    }

    // Destroying money. The whole rule lives in mayBurn.
    case 'burn': {
      if (!req.lot) return no('badAmount')
      if (req.lot.deposit !== 'cleared') return no('notCleared')
      if (req.amount > req.lot.remaining) return no('badAmount')
      return mayBurn(actor, req.lot)
    }

    // A SPEND IS A WITHDRAWAL AND IT LEAVES A RECEIPT.
    case 'spend': {
      if (!actor.walletId || req.fromWalletId !== actor.walletId) {
        // An admin may spend from a company wallet they do not personally own.
        if (!isAdmin(actor.role)) return no('notYourMoney')
      }
      if (!hasProof(req.spend)) return no('noProof')
      return { ok: true }
    }
  }
}

/** One row of the withdraw record — every dirham that left the system. */
export interface Withdrawal {
  id: string
  walletId: string
  /** Who spent it. */
  userId: string
  amount: Coins
  kind: SpendKind
  /** Ads: the campaign. Everything else: the cheque or transaction number. */
  reference: string
  /** Optional and always optional. */
  imageUrl: string | null
  at: string
}

/**
 * The reference a withdrawal is filed under.
 *
 * An ads withdrawal is filed under its campaign, so the withdraw record, the
 * campaign page and the platform's invoice can be read against each other
 * without anybody re-typing an id.
 */
export function withdrawalReference(p: SpendProof): string {
  if (SELF_EVIDENCING.includes(p.kind)) return (p.campaignId || p.adAccountId || '').trim()
  return (p.reference ?? '').trim()
}

// ─── What the bank is actually holding ───────────────────────────────────────

export interface Backing {
  /** Real money that arrived and was seen on a statement. */
  depositedAed: number
  /** Money the company printed. */
  mintedAed: number
  /** Recorded as arrived, not yet seen on a statement. Not money yet. */
  claimedAed: number
}

/**
 * How much of the float is real.
 *
 * Returned as three separate numbers, and they must stay separate on screen.
 * A single "we have AED 900,000" that silently blends AED 200,000 of real
 * deposits with AED 700,000 the company printed is not a bank balance, it is a
 * mood — and the day somebody tries to pay a real invoice out of it is the day
 * everyone finds out.
 */
export function backing(lots: readonly CashLot[]): Backing {
  let depositedAed = 0
  let mintedAed = 0
  let claimedAed = 0
  for (const lot of lots) {
    if (lot.origin === 'mint') { mintedAed += lot.amount; continue }
    if (lot.deposit === 'cleared') depositedAed += lot.amount
    else if (lot.deposit === 'claimed') claimedAed += lot.amount
    // A rejected deposit is neither money nor a promise. It is a mistake, and
    // it is counted nowhere.
  }
  return { depositedAed, mintedAed, claimedAed }
}

export interface BankPosition {
  /** Everything that ever became real Cash — cleared deposits plus mints. */
  issuedAed: number
  /** Everything destroyed. */
  burnedAed: number
  /** Everything spent, which is the withdraw record's total. The debit side. */
  withdrawnAed: number
  /** What is still sitting in wallets and in the bank. */
  heldAed: number
}

/**
 * Do the books add up?
 *
 * issued − burned − withdrawn should equal what is still held. A non-zero
 * answer is money that appeared or vanished, and it is returned as a number
 * rather than a boolean so a screen can say HOW FAR out it is — "the books are
 * wrong" is not actionable, "the books are AED 40 out" is.
 */
export const bankImbalance = (p: BankPosition): number =>
  Math.round((p.issuedAed - p.burnedAed - p.withdrawnAed - p.heldAed) * 100) / 100

// ─── Spend analysis ──────────────────────────────────────────────────────────

/** Walkable — how an account is doing with the money it was given. */
export const USE_STATES = ['spending', 'idle', 'overdrawn', 'empty'] as const
export type UseState = (typeof USE_STATES)[number]

/**
 * How long money may sit untouched before it is worth naming.
 *
 * Fourteen days. Long enough that somebody funded on Friday is not chased on
 * Monday, short enough that a month's budget cannot quietly do nothing. Idle
 * money is the finding this report exists for: overspending announces itself,
 * and money that was sent and never used is invisible until somebody asks why
 * the pipeline is thin.
 */
export const IDLE_AFTER_DAYS = 14

export interface AccountUse {
  walletId: string
  userId: string | null
  label: string
  /** What they were sent this period. */
  fundedAed: number
  /** What they actually spent. */
  spentAed: number
  balanceAed: number
  /** Days since their last spend. null when they have never spent. */
  daysSinceSpend: number | null
  state: UseState
}

/**
 * Read one account.
 *
 * `empty` and `idle` are kept apart deliberately: an account with nothing in it
 * is not sitting on money, and telling somebody they are idle when they have
 * nothing to spend is how a report loses its reader.
 */
export function readUse(a: Omit<AccountUse, 'state'>): UseState {
  if (a.balanceAed < 0) return 'overdrawn'
  if (a.balanceAed <= 0 && a.fundedAed <= 0) return 'empty'
  if (a.balanceAed <= 0) return 'spending'
  // Never spent at all, or not for a fortnight, while holding money.
  if (a.daysSinceSpend === null || a.daysSinceSpend >= IDLE_AFTER_DAYS) return 'idle'
  return 'spending'
}
