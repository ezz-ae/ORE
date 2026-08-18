/**
 * EVERY MOVEMENT CARRIES A NAME AND A BENEFICIARY.
 *
 * The ledger already proved that a movement happened and had not been edited
 * since (ledger-chain.ts). What it could not answer was the question a finance
 * team actually asks about a payment: WHO AUTHORISED THIS ONE, and who was it
 * for. `actor` on a posting is the account that made the API call — it is an
 * audit trail, not a signature, and it says nothing about the beneficiary
 * beyond the destination wallet id.
 *
 * So each movement is SIGNED. A signature here is three things bound together:
 *
 *   · THE SIGNER — the one person answerable for it. The owner of the wallet
 *     the money leaves, or, when it leaves the bank itself, the admin who
 *     signed it out. Nobody else can sign for money that is not theirs.
 *   · THE BENEFICIARY — the wallet it is for, by name, not only by id. The
 *     beneficiary MAY be the signer: an admin taking cash out of the bank into
 *     their own wallet is a normal, honest movement, and a model that could not
 *     express it would push people into pretending it was something else.
 *   · THE TERMS — the exact amount, the exact accounts, the exact moment.
 *
 * ── WHAT YOU SEE IS WHAT YOU SIGN ────────────────────────────────────────
 *
 * `statement()` renders the sentence a person reads before they commit, and
 * `digest()` hashes the SAME fields the sentence is built from. That is the
 * whole point of putting them in one file: a screen that showed one thing and
 * recorded another would be worse than no signature, because it would carry a
 * name against terms nobody agreed to.
 *
 * ── THIS IS AN ATTESTATION, NOT PUBLIC-KEY CRYPTOGRAPHY ──────────────────
 *
 * Said plainly because the word "signature" invites a stronger claim than this
 * makes. There is no private key and no key pair: the server knows who was
 * signed in, and the signature binds that identity to these exact terms so the
 * terms cannot later be changed underneath the name. It proves the figures were
 * not altered after they were agreed. It does not prove the server itself is
 * honest — nothing held by one party ever does, and a screen that implied
 * otherwise would be selling a guarantee this design does not deliver.
 *
 * ── AND THE MACHINE SIGNS TOO ────────────────────────────────────────────
 *
 * Delivered ad spend is debited by a scheduled job with no human at the
 * keyboard. Rather than exempt it — an exemption is a hole, and holes get used
 * — it signs as SYSTEM_SIGNER and names the authority it is acting under: the
 * wallet somebody attached to that campaign. So "who is answerable" has an
 * answer on every row in the ledger, and the automatic ones say plainly that
 * they were automatic.
 *
 * Pure — no I/O, no clock, and the hash is injected, so this runs identically
 * on the server, in a browser checking its own receipt, and in `pnpm guards`.
 */

/** The version of the canonical form. Changing the fields changes this. */
export const SIGNATURE_FORMAT = 'fh-sig-1'

/**
 * The signer id used when no person pressed anything.
 *
 * A real email can never collide with it: `@` is required in every person id
 * (bank-db.ts `personId` is the email) and this has none.
 */
export const SYSTEM_SIGNER = 'system'

/** Walkable — what is being signed for. Each renders its own sentence. */
export const SIGNED_ACTIONS = [
  'send', 'move', 'mint', 'burn', 'spend', 'deposit', 'approveRequest',
] as const
export type SignedAction = (typeof SIGNED_ACTIONS)[number]

/**
 * Who a movement is for.
 *
 * The LABEL is carried, not only the id, because a signature has to stay
 * readable after the fact. A wallet can be relabelled, a person can leave, and
 * a receipt that says `w_u_ahmed@…` proves nothing to the person reading it two
 * years later. The id is what the money followed; the label is what was on
 * screen when somebody agreed to it, and both belong in the record.
 */
export interface Beneficiary {
  walletId: string
  /** The name shown at the moment of signing. Frozen, never re-resolved. */
  label: string
  /** The account number, as printed. */
  accountNo: string
}

/** The terms of one movement, exactly as they were agreed. */
export interface SignatureIntent {
  action: SignedAction
  /** Whole Cash. 1 Cash = AED 1. */
  amount: number
  /** The wallet the money leaves. The bank's own id when it leaves the bank. */
  fromWalletId: string
  beneficiary: Beneficiary
  /** The person answerable, or SYSTEM_SIGNER. */
  signerId: string
  /** The signer's name as shown. Frozen for the same reason as the label. */
  signerName: string
  /**
   * What entitled the signer to move this money, when nobody pressed anything.
   * Empty for a human signature — a person's entitlement is that it is their
   * wallet, and writing a sentence about it would invite writing a false one.
   */
  authority?: string
  /** Epoch milliseconds. */
  atMs: number
}

/** True when nobody was at the keyboard. */
export const isSystemSignature = (i: { signerId: string }): boolean =>
  i.signerId === SYSTEM_SIGNER

/**
 * The exact bytes that get hashed.
 *
 * Same rules as the chain's canonical form, for the same reasons: fixed field
 * order rather than object key order, integers only, epoch milliseconds, and
 * free text length-prefixed so no label containing a separator can shift a
 * field boundary. See ledger-chain.ts — the two forms are deliberately alike
 * so somebody who has read one can read the other.
 */
export function canonicalSignature(i: SignatureIntent): string {
  const n = (v: number): string => {
    if (!Number.isFinite(v) || !Number.isInteger(v)) {
      throw new Error(`signature: ${v} is not a whole number`)
    }
    return String(v)
  }
  const s = (v: string): string => {
    const text = v ?? ''
    const bytes = new TextEncoder().encode(text).length
    return `${bytes}:${text}`
  }

  return [
    SIGNATURE_FORMAT,
    s(i.action),
    n(i.amount),
    s(i.fromWalletId),
    s(i.beneficiary.walletId),
    s(i.beneficiary.label),
    s(i.beneficiary.accountNo),
    s(i.signerId),
    s(i.signerName),
    s(i.authority ?? ''),
    n(i.atMs),
  ].join('|')
}

/** A hash function, injected — see ledger-chain.ts for why it is not imported. */
export type Hasher = (input: string) => string

/** The signature itself: this signer, over these terms. */
export const digest = (h: Hasher, i: SignatureIntent): string => h(canonicalSignature(i))

/**
 * Does this signature still describe this movement?
 *
 * The check the receipt runs. A recomputed digest that no longer matches means
 * a field was changed after it was signed — which is the only thing a
 * signature can detect and the entire reason to keep one.
 */
export const signatureHolds = (h: Hasher, i: SignatureIntent, recorded: string): boolean =>
  digest(h, i) === recorded

/**
 * MAY THIS PERSON SIGN THIS?
 *
 * One rule, and it is the same rule the ledger already enforces structurally:
 * you sign for money leaving YOUR wallet. The bank is the single exception, and
 * it is not a loophole — cash in the bank belongs to nobody until somebody puts
 * their name on it, and this IS the act of putting a name on it.
 *
 * Returned as a reason rather than a boolean so a screen can say which of the
 * two it was. "You cannot sign this" sends somebody to ask why; "this is not
 * your wallet" is already the answer.
 */
export type SignRefusal = 'notYourWallet' | 'notAdmin' | 'noSigner'

export function maySign(
  signer: { userId: string; walletId: string | null; isAdmin: boolean },
  i: { fromWalletId: string; bankWalletId: string },
): { ok: true } | { ok: false; refusal: SignRefusal } {
  if (!signer.userId) return { ok: false, refusal: 'noSigner' }
  if (i.fromWalletId === i.bankWalletId) {
    return signer.isAdmin ? { ok: true } : { ok: false, refusal: 'notAdmin' }
  }
  if (!signer.walletId || signer.walletId !== i.fromWalletId) {
    return { ok: false, refusal: 'notYourWallet' }
  }
  return { ok: true }
}

/**
 * The sentence shown before signing, and stored with the signature.
 *
 * Built from the SAME fields the digest covers, so the record and the promise
 * cannot drift apart. Deliberately not translated in this module: it is a
 * record of what was agreed, and a receipt that reads differently depending on
 * the language the reader happens to have selected today is not a record. The
 * screen renders its own translated version ABOVE this line; this is the line
 * that gets kept.
 *
 * Amounts are written in AED because one Cash is one dirham and a signature is
 * the one place to be unambiguous about what was moved.
 */
export function statement(i: SignatureIntent): string {
  const aed = `AED ${i.amount.toLocaleString('en-US')}`
  const who = i.signerName || i.signerId
  const to = `${i.beneficiary.label} (${i.beneficiary.accountNo})`

  if (isSystemSignature(i)) {
    // Never phrased as a person's promise. A machine cannot promise anything,
    // and dressing an automatic debit in the first person is how a system ends
    // up with a signature nobody can be held to.
    return `Automatic: ${aed} from ${i.fromWalletId} to ${to}. ` +
      `Authorised by: ${i.authority || 'unstated'}.`
  }

  switch (i.action) {
    case 'mint':
      return `I, ${who}, create ${aed} of Cash in the bank.`
    case 'burn':
      return `I, ${who}, destroy ${aed} of Cash.`
    case 'move':
      return `I, ${who}, sign ${aed} out of the bank to ${to}.`
    case 'spend':
      return `I, ${who}, record ${aed} paid out to ${to}.`
    case 'deposit':
      return `I, ${who}, record ${aed} paid in to ${to}.`
    case 'approveRequest':
      return `I, ${who}, approve and transfer ${aed} to ${to}.`
    case 'send':
      return `I, ${who}, transfer ${aed} to ${to}.`
  }
}
