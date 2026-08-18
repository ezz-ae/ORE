/**
 * ASKING FOR CASH, WHEN NOBODY CAN TAKE IT.
 *
 * This ledger has one structural rule above all others: money is PUSHED, never
 * pulled. There is no operation anywhere that reaches into somebody else's
 * wallet, and that is deliberate — see bank.ts. It is also the reason topping
 * up a broker used to mean messaging somebody and hoping they remembered.
 *
 * A REQUEST is the missing half. It is not a movement and it moves nothing: it
 * is a row saying who asked whom, for how much, and why. The money moves only
 * when the person being asked signs, and approving IS the transfer — the same
 * event, not two rows that can disagree. A request marked approved while no
 * Cash moved is exactly the kind of lie the ledger exists to make impossible.
 *
 * ── WHO CAN BE ASKED: ANYBODY, INCLUDING THE BANK ────────────────────────
 *
 * Wallet to wallet, or wallet to the bank. A broker asks the bank for float; a
 * broker asks a colleague to settle up; a manager asks the bank on the way to
 * paying somebody. The only difference between the two is WHO may answer:
 *
 *   · asked of a WALLET — only the person who owns it. Nobody may approve a
 *     payment out of an account that is not theirs, and an admin is not an
 *     exception, because an admin with that power is a pull operation wearing
 *     a different name.
 *   · asked of the BANK — an admin, because the bank belongs to nobody until
 *     somebody signs Cash out of it, and signing is what an admin does.
 *
 * ── THE BENEFICIARY IS ALWAYS THE ASKER ──────────────────────────────────
 *
 * You may ask for money for YOURSELF and for nobody else. This looks like a
 * limitation and is the safety property that makes approving cheap to think
 * about: "Ahmed is asking me for AED 5,000" is a decision a person can make in
 * a second. If a request could name a third party, every approval would carry
 * a second question — who is this actually paying — and the day somebody
 * approves without asking it is the day the request becomes a way to route
 * money to a stranger with a manager's signature on it.
 *
 * Somebody who wants to pay a third party can already do it: send. It takes
 * the same number of clicks and it is their own name on it.
 *
 * Pure — no I/O, no clock. Runs in `pnpm guards`.
 */
import type { Coins } from '@/lib/freehold/wallet'

/** Walkable — where a request stands. Each renders its own word. */
export const REQUEST_STATES = ['pending', 'approved', 'declined', 'cancelled'] as const
export type RequestState = (typeof REQUEST_STATES)[number]

/** Walkable — why a request or a decision was refused. Each has a sentence. */
export const REQUEST_REFUSALS = [
  'badAmount', 'noBeneficiary', 'notYourWallet', 'askingYourself',
  'notAdmin', 'notAskedOfYou', 'alreadyDecided', 'notYours', 'noSuchRequest',
] as const
export type RequestRefusal = (typeof REQUEST_REFUSALS)[number]

export interface CashRequest {
  id: string
  /** The wallet being asked. The bank's own id when the bank is being asked. */
  askedOfWalletId: string
  /** Where the Cash lands. Always the asker's own wallet — see the header. */
  beneficiaryWalletId: string
  amount: Coins
  reason: string
  state: RequestState
  /** The person who asked. */
  requestedBy: string
  decidedBy: string | null
  decidedAt: string | null
  /** The movement that settled it. Null unless approved. */
  transferId: string | null
  /** The signature the approver put on it. Null unless approved. */
  signatureId: string | null
  createdAt: string
}

export type RequestCheck = { ok: true } | { ok: false; refusal: RequestRefusal }
const no = (refusal: RequestRefusal): RequestCheck => ({ ok: false, refusal })

/** Who is asking or deciding, and what they own. */
export interface RequestActor {
  userId: string
  /** Their own wallet. null for somebody with no account yet. */
  walletId: string | null
  isAdmin: boolean
}

/**
 * MAY THIS PERSON MAKE THIS REQUEST?
 *
 * Ordered so the most fundamental answer comes first: being told "you cannot
 * ask yourself" about an amount that was never valid reads as nonsense.
 */
export function mayRequest(
  actor: RequestActor,
  req: { askedOfWalletId: string; beneficiaryWalletId: string; amount: Coins },
  isValidAmount: (n: number) => boolean,
): RequestCheck {
  if (!isValidAmount(req.amount)) return no('badAmount')
  if (!actor.walletId) return no('noBeneficiary')
  // The beneficiary is the asker. The whole safety argument is in the header.
  if (req.beneficiaryWalletId !== actor.walletId) return no('notYourWallet')
  if (!req.askedOfWalletId) return no('noBeneficiary')
  if (req.askedOfWalletId === req.beneficiaryWalletId) return no('askingYourself')
  return { ok: true }
}

/**
 * MAY THIS PERSON ANSWER IT?
 *
 * The bank is answered by any admin; a wallet is answered by the person who
 * owns it and by nobody else. Note there is no admin branch on the wallet case
 * — that absence is the design, not an oversight: an admin who could approve a
 * payment out of somebody else's wallet would be able to take their money, and
 * "money is pushed, never pulled" would be a slogan rather than a property.
 */
export function mayDecide(
  actor: RequestActor,
  req: Pick<CashRequest, 'askedOfWalletId' | 'state'>,
  bankWalletId: string,
): RequestCheck {
  if (req.state !== 'pending') return no('alreadyDecided')
  if (req.askedOfWalletId === bankWalletId) {
    return actor.isAdmin ? { ok: true } : no('notAdmin')
  }
  if (!actor.walletId || actor.walletId !== req.askedOfWalletId) return no('notAskedOfYou')
  return { ok: true }
}

/**
 * MAY THIS PERSON WITHDRAW IT?
 *
 * Only the asker, and only while it is still pending. Cancelling is separate
 * from declining on purpose: "I no longer need this" and "I am not paying
 * this" are different facts about the same row, and collapsing them would make
 * the log unreadable in the one case where somebody has to reconstruct what
 * happened.
 */
export function mayCancel(actor: RequestActor, req: Pick<CashRequest, 'requestedBy' | 'state'>): RequestCheck {
  if (req.state !== 'pending') return no('alreadyDecided')
  if (req.requestedBy !== actor.userId) return no('notYours')
  return { ok: true }
}

/**
 * The two piles a person needs, split by what they can DO about each.
 *
 * `waitingOnMe` is a to-do list; `waitingOnThem` is a receipt. A single list of
 * "requests" mixes the two and the actionable rows drown, which is how an
 * approval queue quietly becomes something nobody opens.
 */
export function splitRequests(
  actor: RequestActor,
  requests: readonly CashRequest[],
  bankWalletId: string,
): { waitingOnMe: CashRequest[]; waitingOnThem: CashRequest[]; settled: CashRequest[] } {
  const waitingOnMe: CashRequest[] = []
  const waitingOnThem: CashRequest[] = []
  const settled: CashRequest[] = []
  for (const r of requests) {
    if (r.state !== 'pending') { settled.push(r); continue }
    if (mayDecide(actor, r, bankWalletId).ok) waitingOnMe.push(r)
    else if (r.requestedBy === actor.userId) waitingOnThem.push(r)
    // A pending request between two other people is neither, and is not shown.
    // A wallet screen that listed everybody's asks would be publishing who is
    // short of money this month.
  }
  return { waitingOnMe, waitingOnThem, settled }
}
