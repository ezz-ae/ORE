/**
 * A SEND IS SIGNED BY THE PERSON, NOT AUTHORISED BY A COOKIE.
 *
 * Until now, whoever held the session could move somebody's money. A stolen
 * cookie, a borrowed laptop, a compromised server — any of them and the ledger
 * would record a payment that the account holder never made, correctly, with a
 * perfect audit trail pointing at them.
 *
 * So the wallet holds a KEY that never leaves the browser, and a send carries a
 * signature over what it is about to do. The server checks the signature
 * against the public key it has on file for that person before any money moves.
 * A stolen session can now read a balance and cannot spend it.
 *
 * ── WHAT THE SIGNATURE HAS TO COVER, AND WHY EACH ────────────────────────
 *
 * A signature proves consent to EXACTLY what was signed, and anything left out
 * is a field an attacker may change freely:
 *
 *   · THE AMOUNT and THE DESTINATION, or a man in the middle redirects the
 *     payment and the signature still verifies.
 *   · THE SENDER, or a captured signature is replayed from another account.
 *   · A NONCE, or the same signed payment is submitted a hundred times. It is
 *     the ledger reference too, so the idempotency spine and the anti-replay
 *     are the same string rather than two that can disagree.
 *   · AN EXPIRY, or a signature captured today works forever. Money movements
 *     are decided in seconds; a signature that outlives the decision is a
 *     liability with no upside.
 *   · THE ACTION, or a signature for a send is replayed as a burn.
 *
 * ── AND HAVING A KEY MUST MEAN USING IT ──────────────────────────────────
 *
 * The rule that makes the rest true: once a person has an active key, a send
 * WITHOUT a signature is refused. If an unsigned send still worked, an attacker
 * holding a stolen cookie would simply not sign, and the whole thing would be
 * decoration. `requiresSignature` is that rule and it lives here.
 *
 * ── WHY P-256 AND NOT ED25519 ────────────────────────────────────────────
 *
 * Ed25519 is the better curve and WebCrypto support for it is still uneven
 * across the browsers a brokerage actually runs. ECDSA P-256 with SHA-256 is in
 * every browser and in Node, with no library. A signature scheme that fails to
 * load on somebody's laptop is a signature scheme that gets switched off.
 *
 * Pure — no I/O, no crypto, no clock. The verification lives in
 * wallet-signing-server.ts; everything here is the agreement about what gets
 * signed, which is the half that has to be identical on both sides.
 */

/** The version of the signed form. In the bytes, so a future change cannot be
 *  replayed against this one. */
export const SIGNING_FORMAT = 'fh-sign-1'

/** The curve and digest, named once so the two sides cannot drift. */
export const SIGNING_ALGORITHM = { name: 'ECDSA', namedCurve: 'P-256' } as const
export const SIGNING_DIGEST = 'SHA-256'

/**
 * How long a signature is good for.
 *
 * Two minutes. Long enough to survive a slow phone, a retried request and a
 * clock a little out of step; short enough that a signature captured off the
 * wire is worthless before anybody can use it. Money movements are decided in
 * seconds — nothing here benefits from a longer window.
 */
export const INTENT_TTL_MS = 120_000

/**
 * How far ahead of us a client's clock may be.
 *
 * Thirty seconds. Browser clocks drift, and refusing a signature because
 * somebody's laptop is twenty seconds fast would be an unexplainable failure.
 * Allowing it to run far ahead would let a client mint long-lived signatures by
 * simply lying about the time.
 */
export const CLOCK_SKEW_MS = 30_000

/** Walkable — what a signed send is allowed to be. One action per signature. */
export const SIGNED_ACTIONS = ['send', 'spend'] as const
export type SignedAction = (typeof SIGNED_ACTIONS)[number]

/** Walkable — why a signature was refused. Each renders its own sentence. */
export const SIGNATURE_REFUSALS = [
  'missing', 'noKey', 'expired', 'fromTheFuture', 'badSignature', 'wrongSender', 'replayed',
] as const
export type SignatureRefusal = (typeof SIGNATURE_REFUSALS)[number]

/**
 * What the holder is about to do, as they agreed to it.
 *
 * Every field is in the signature. There is deliberately no room for a field
 * the server reads but the signature does not cover — that is the shape of
 * every signing bug worth having.
 */
export interface SignedIntent {
  action: SignedAction
  /** The signer's own wallet. Bound so a signature cannot be replayed elsewhere. */
  fromWalletId: string
  toWalletId: string
  amount: number
  memo: string
  /** Unique per intent. Also the ledger reference — one string, two jobs. */
  nonce: string
  /** When the holder signed, in epoch milliseconds. */
  atMs: number
}

/**
 * The exact bytes that get signed.
 *
 * Same discipline as the chain's canonical form and for the same reason: two
 * implementations differing by one space produce two different signatures, and
 * a valid payment reads as a forgery. Free text is length-prefixed in BYTES so
 * no memo can shift a field boundary and make one intent canonicalise as
 * another.
 */
export function signingPayload(intent: SignedIntent): string {
  const n = (v: number): string => {
    if (!Number.isFinite(v) || !Number.isInteger(v)) {
      throw new Error(`wallet-signing: ${v} is not a whole number`)
    }
    return String(v)
  }
  const s = (v: string): string => {
    const text = v ?? ''
    return `${new TextEncoder().encode(text).length}:${text}`
  }

  // FIXED ORDER. Never derived from Object.keys.
  return [
    SIGNING_FORMAT,
    s(intent.action),
    s(intent.fromWalletId),
    s(intent.toWalletId),
    n(intent.amount),
    s(intent.memo),
    s(intent.nonce),
    n(intent.atMs),
  ].join('|')
}

/**
 * Is this intent still good, and was it made in a plausible present?
 *
 * Two failures, not one. `expired` and `fromTheFuture` need different answers
 * on screen: the first means try again, the second means your clock is wrong —
 * and telling somebody to retry a signature their machine will keep making
 * badly is how a bug report becomes a support thread.
 */
export function checkFreshness(
  intent: Pick<SignedIntent, 'atMs'>,
  nowMs: number,
): { ok: true } | { ok: false; refusal: Extract<SignatureRefusal, 'expired' | 'fromTheFuture'> } {
  if (!Number.isFinite(intent.atMs)) return { ok: false, refusal: 'expired' }
  if (intent.atMs > nowMs + CLOCK_SKEW_MS) return { ok: false, refusal: 'fromTheFuture' }
  if (nowMs - intent.atMs > INTENT_TTL_MS) return { ok: false, refusal: 'expired' }
  return { ok: true }
}

/**
 * MUST THIS MOVEMENT BE SIGNED?
 *
 * The rule everything else rests on. Once a person has an active key, an
 * unsigned send is refused — because if it were merely preferred, an attacker
 * with a stolen cookie would simply not sign, and every line above this would
 * be decoration.
 *
 * Somebody with no key yet is not blocked: they have never been asked for one,
 * and locking a broker out of their own balance to enforce a security upgrade
 * they were never offered is a worse failure than the one being prevented. The
 * moment they create a key the requirement turns on, for them, permanently.
 */
export const requiresSignature = (hasActiveKey: boolean): boolean => hasActiveKey

/**
 * A public key as it travels and as it is stored.
 *
 * Raw SPKI, base64. Not a JWK: a JWK is an object, objects have key order, and
 * a fingerprint taken over one spelling of a key will not match the other. One
 * encoding, chosen here.
 */
export interface WalletKey {
  /** base64 SPKI. */
  publicKey: string
  /** What the holder calls the device. Theirs to name, ours to show. */
  label: string
  createdAt: string
  revokedAt: string | null
}

/**
 * The short form shown beside a device.
 *
 * People compare a fingerprint the way they compare an address — the ends. It
 * is derived from the stored base64 rather than re-hashed, so what is shown is
 * exactly what is stored and there is no second encoding to disagree.
 */
export const keyFingerprint = (publicKey: string): string => {
  const clean = publicKey.replace(/[^A-Za-z0-9]/g, '')
  return clean.length <= 16 ? clean : `${clean.slice(0, 8)}…${clean.slice(-8)}`
}
