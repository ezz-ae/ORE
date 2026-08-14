/**
 * THE BANK — who may move money, and what a spent dirham has to leave behind.
 *
 * wallet.ts is the ledger and it is sound: double entry, coin created in one
 * place and destroyed in one place, and a conservation invariant that is
 * actually checked. Nothing here changes any of that. This module is the
 * AUTHORITY layer on top — the rules about who is allowed to make a movement
 * at all, and the receipt every movement out of the system must carry.
 *
 * ── MONEY IS PUSHED, NEVER PULLED ────────────────────────────────────────
 *
 * The rule the whole design rests on: there is no operation anywhere that takes
 * money OUT of somebody else's wallet. A team leader funds their team from
 * their own balance; they cannot reach into a member's account and take it
 * back. An admin can issue and allocate, and even an admin cannot pull.
 *
 * This is structural rather than a permission check, and that distinction is
 * the point: `authorise` requires the `from` wallet to be the actor's own, or
 * the treasury for an admin issuing new money. There is no branch that accepts
 * somebody else's wallet as a source, so no future screen can add one by
 * accident.
 *
 * ── AN ADMIN MAY ONLY DESTROY WHAT THEY THEMSELVES PUT IN ────────────────
 *
 * Burning is how money leaves the system, and it is bounded by the burner's own
 * net deposits. An admin who has deposited AED 50,000 and burned AED 20,000 may
 * burn AED 30,000 more and not one dirham beyond it. Without that bound, one
 * admin could destroy another's float — and a ledger where anybody can
 * annihilate anybody's money is not a bank, whatever the double entry says.
 *
 * ── AND EVERY DIRHAM THAT LEAVES CARRIES ITS RECEIPT ─────────────────────
 *
 * A spend is not an entry, it is a withdrawal, and it lands in the withdraw
 * record with proof of what it bought:
 *
 *   · ADS pay themselves — the platform, the ad account and the campaign are
 *     the receipt, and they are machine-verifiable. No cheque is asked for,
 *     because inventing a reference number for something the ad account can
 *     already prove is paperwork rather than control.
 *   · EVERYTHING ELSE needs a human reference: a cheque or transaction number.
 *     An image may be attached and is never required — a photograph is
 *     evidence, and a system that will not record a real payment because
 *     somebody could not photograph the cheque teaches people to keep the
 *     books somewhere else.
 *
 * A withdrawal that can prove neither is REFUSED. Money leaving with no record
 * of where it went is the one failure a finance system exists to prevent.
 *
 * Pure — no I/O, no clock. Runs in `pnpm guards`.
 */
import { MANAGEMENT_ROLES, type Role } from '@/lib/freehold/session-types'
import { isValidAmount, type Coins } from '@/lib/freehold/wallet'

/** Walkable — every way money can move, in the words the bank screen uses. */
export const BANK_ACTIONS = ['deposit', 'allocate', 'transfer', 'burn', 'spend'] as const
export type BankAction = (typeof BANK_ACTIONS)[number]

/** Walkable — what the money was for. Each renders its own word and its own
 *  proof rule. */
export const SPEND_KINDS = ['ads', 'commission', 'salary', 'vendor', 'refund', 'other'] as const
export type SpendKind = (typeof SPEND_KINDS)[number]

/**
 * The kinds whose receipt is the platform itself.
 *
 * Only ads. The ad account holds the invoice, the campaign id ties the spend to
 * what it bought, and both are readable by anything with the token — a stronger
 * record than a number somebody types. Every other kind leaves the system
 * through a bank, and a bank gives you a reference.
 */
export const SELF_EVIDENCING: readonly SpendKind[] = ['ads']

/** Walkable — why a movement was refused. Each renders its own sentence. */
export const BANK_REFUSALS = [
  'notAdmin', 'notYourMoney', 'notYourTeam', 'moreThanYouDeposited',
  'noProof', 'badAmount', 'noSuchWallet',
] as const
export type BankRefusal = (typeof BANK_REFUSALS)[number]

/** Who is asking, and what they may reach. */
export interface Actor {
  userId: string
  role: Role
  /** The wallet they own. null for somebody with no account yet. */
  walletId: string | null
  /** The user ids this person leads. Empty for everyone but a team leader. */
  teamMemberIds: readonly string[]
}

export const isAdmin = (role: Role): boolean =>
  (MANAGEMENT_ROLES as readonly string[]).includes(role)

/** One requested movement, before anything is written. */
export interface MoveRequest {
  action: BankAction
  amount: Coins
  /** The wallet the money leaves. 'treasury' for a deposit. */
  fromWalletId: string | 'treasury' | null
  /** The wallet it lands in. null for a burn (it returns to the treasury). */
  toWalletId: string | null
  /** The user who owns the destination, for the team check. */
  toUserId?: string | null
  /** For a burn: what this actor has deposited, less what they have burned. */
  burnableByActor?: Coins
  /** For a spend: what it was for and what proves it. */
  spend?: SpendProof
}

/**
 * What a spend claims to have bought.
 *
 * `reference` is a cheque or transaction number. `imageUrl` is optional and
 * always optional — see the header.
 */
export interface SpendProof {
  kind: SpendKind
  /** Ads: the platform's own ids. */
  campaignId?: string | null
  adAccountId?: string | null
  /** Everything else: the cheque or transaction number. */
  reference?: string | null
  imageUrl?: string | null
}

export type Authorisation =
  | { ok: true }
  | { ok: false; refusal: BankRefusal }

/**
 * Does this spend carry a receipt?
 *
 * Ads prove themselves through the platform. Everything else needs a reference
 * somebody can look up in a bank statement. An image never satisfies this on
 * its own: a photograph with no number attached to it cannot be reconciled
 * against anything.
 */
export function hasProof(p: SpendProof | undefined): boolean {
  if (!p) return false
  if (SELF_EVIDENCING.includes(p.kind)) {
    return !!(p.campaignId && p.campaignId.trim()) || !!(p.adAccountId && p.adAccountId.trim())
  }
  return !!(p.reference && p.reference.trim())
}

/**
 * May this actor make this movement?
 *
 * The refusals are ordered so the most fundamental answers first: a bad amount
 * is a malformed request, and being told "you are not an admin" about a
 * movement that was never valid is a confusing thing to read.
 */
export function authorise(actor: Actor, req: MoveRequest): Authorisation {
  const no = (refusal: BankRefusal): Authorisation => ({ ok: false, refusal })

  if (!isValidAmount(req.amount)) return no('badAmount')

  switch (req.action) {
    // NEW MONEY ENTERS IN ONE PLACE AND ONLY AN ADMIN OPENS IT.
    case 'deposit':
      if (!isAdmin(actor.role)) return no('notAdmin')
      if (!req.toWalletId) return no('noSuchWallet')
      return { ok: true }

    // Allocation is the admin moving the company's money to somebody. It is
    // deliberately a separate action from a transfer, because it is the only
    // movement whose source is not the actor's own wallet.
    case 'allocate':
      if (!isAdmin(actor.role)) return no('notAdmin')
      if (!req.toWalletId) return no('noSuchWallet')
      return { ok: true }

    // A TRANSFER COMES OUT OF YOUR OWN POCKET. There is no branch here that
    // accepts somebody else's wallet as the source, which is what makes
    // "nobody can take from anybody" structural rather than a rule to remember.
    case 'transfer': {
      if (!req.toWalletId) return no('noSuchWallet')
      if (!actor.walletId || req.fromWalletId !== actor.walletId) return no('notYourMoney')
      if (isAdmin(actor.role)) return { ok: true }
      // A team leader funds their own team and nobody else's.
      const to = req.toUserId ?? ''
      if (to && actor.teamMemberIds.includes(to)) return { ok: true }
      return no('notYourTeam')
    }

    // Destroying money is bounded by what this actor put in.
    case 'burn': {
      if (!isAdmin(actor.role)) return no('notAdmin')
      const burnable = req.burnableByActor ?? 0
      if (req.amount > burnable) return no('moreThanYouDeposited')
      return { ok: true }
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
 * An ads withdrawal is filed under its campaign, so the withdraw record and the
 * campaign page can be read against each other without anybody re-typing an id.
 */
export function withdrawalReference(p: SpendProof): string {
  if (SELF_EVIDENCING.includes(p.kind)) {
    return (p.campaignId || p.adAccountId || '').trim()
  }
  return (p.reference ?? '').trim()
}

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
 * and money that was allocated and never used is invisible until somebody asks
 * why the pipeline is thin.
 */
export const IDLE_AFTER_DAYS = 14

export interface AccountUse {
  walletId: string
  userId: string | null
  label: string
  /** What they were given this period. */
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

export interface BankPosition {
  /** Everything ever put in, by everyone. */
  depositedAed: number
  /** Everything destroyed. */
  burnedAed: number
  /** Everything spent, which is the withdraw record's total. */
  withdrawnAed: number
  /** What is still sitting in accounts. */
  heldAed: number
}

/**
 * Does the bank add up?
 *
 * deposited − burned − withdrawn should equal what is still held. A non-zero
 * answer is money that appeared or vanished, and it is returned as a number
 * rather than a boolean so a screen can say HOW FAR out it is — "the books are
 * wrong" is not actionable, "the books are AED 40 out" is.
 */
export const bankImbalance = (p: BankPosition): number =>
  Math.round((p.depositedAed - p.burnedAed - p.withdrawnAed - p.heldAed) * 100) / 100
