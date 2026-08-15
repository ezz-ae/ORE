/**
 * Checking a signature, and remembering whose key it was.
 *
 * The rules are in wallet-signing.ts and are shared with the browser. This is
 * the half that cannot be: the key registry, the actual verification, and the
 * replay record.
 *
 * ── TRUST ON FIRST USE, AND NEVER AGAIN ──────────────────────────────────
 *
 * The first key a person registers is accepted on the strength of their
 * session — there is nothing stronger available at that moment, and demanding
 * one would mean nobody could ever start.
 *
 * ADDING A SECOND KEY IS THE DANGEROUS OPERATION, not the first. Somebody who
 * has stolen a session would simply register their own key and sign whatever
 * they liked. So a second key must be signed by an existing one, or added by an
 * admin who has confirmed the person out of band. That is the whole difference
 * between a key that means something and a key that is a formality.
 */
import { webcrypto } from 'node:crypto'
import { query, ensureOnce } from '@/lib/db'
import {
  SIGNING_ALGORITHM, SIGNING_DIGEST, signingPayload, checkFreshness, requiresSignature,
  type SignedIntent, type SignatureRefusal, type WalletKey,
} from '@/lib/freehold/wallet-signing'

async function ensure(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_wallet_keys (
      id         text PRIMARY KEY,
      user_id    text NOT NULL,
      public_key text NOT NULL,
      label      text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now(),
      revoked_at timestamptz
    )
  `)
  await query(`CREATE INDEX IF NOT EXISTS freehold_wallet_keys_user_idx
               ON freehold_wallet_keys (user_id) WHERE revoked_at IS NULL`)
  // ONE KEY BELONGS TO ONE PERSON. Two people registering the same public key
  // would mean either could sign as the other, and the ledger would name the
  // wrong one with complete confidence.
  await query(`CREATE UNIQUE INDEX IF NOT EXISTS freehold_wallet_keys_pk_uidx
               ON freehold_wallet_keys (public_key)`)

  // THE REPLAY RECORD. A nonce is spent the moment it is accepted, so the same
  // signed intent cannot be submitted twice — the primary key IS the check, so
  // two simultaneous submissions cannot both pass a read-then-write race.
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_signed_nonces (
      nonce      text PRIMARY KEY,
      user_id    text NOT NULL,
      used_at    timestamptz NOT NULL DEFAULT now()
    )
  `)
  await query(`CREATE INDEX IF NOT EXISTS freehold_signed_nonces_used_idx
               ON freehold_signed_nonces (used_at)`)
}

export const ensureSigningSchema = () => ensureOnce('freehold_wallet_keys', ensure)

// ── The registry ─────────────────────────────────────────────────────────────

export async function activeKeys(userId: string): Promise<WalletKey[]> {
  await ensureSigningSchema()
  const rows = await query(
    `SELECT public_key, label, created_at::text, revoked_at::text
       FROM freehold_wallet_keys
      WHERE user_id = $1 AND revoked_at IS NULL
      ORDER BY created_at`,
    [userId],
  )
  return rows.map((r) => ({
    publicKey: String(r.public_key),
    label: String(r.label ?? ''),
    createdAt: String(r.created_at),
    revokedAt: r.revoked_at == null ? null : String(r.revoked_at),
  }))
}

export const hasActiveKey = async (userId: string): Promise<boolean> =>
  (await activeKeys(userId)).length > 0

export type KeyResult =
  | { ok: true; first: boolean }
  | { ok: false; refusal: 'alreadyRegistered' | 'needsExistingKey' | 'badKey' | 'error' }

/**
 * Register a device key.
 *
 * The FIRST one is trusted on the session. A SECOND one is not: whoever holds a
 * stolen session would otherwise register their own key and sign at will, so it
 * has to be authorised by a key already on file — proof that the person adding
 * it is the person who holds the wallet.
 */
export async function registerKey(input: {
  userId: string
  publicKey: string
  label: string
  /** Required when this is not the person's first key. */
  proof?: { payload: string; signature: string }
}): Promise<KeyResult> {
  try {
    await ensureSigningSchema()
    if (!input.publicKey || input.publicKey.length < 40) return { ok: false, refusal: 'badKey' }
    if (!(await importKey(input.publicKey))) return { ok: false, refusal: 'badKey' }

    const existing = await activeKeys(input.userId)
    if (existing.some((k) => k.publicKey === input.publicKey)) {
      return { ok: false, refusal: 'alreadyRegistered' }
    }

    if (existing.length > 0) {
      // THE DANGEROUS OPERATION. An existing key must vouch for the new one,
      // and what it signs is the NEW PUBLIC KEY itself — a signature over
      // anything less would let an attacker reuse a captured one to enrol a
      // key of their choosing.
      const proof = input.proof
      if (!proof || proof.payload !== `enrol:${input.publicKey}`) {
        return { ok: false, refusal: 'needsExistingKey' }
      }
      const vouched = await anyKeyVerifies(existing, proof.payload, proof.signature)
      if (!vouched) return { ok: false, refusal: 'needsExistingKey' }
    }

    await query(
      `INSERT INTO freehold_wallet_keys (id, user_id, public_key, label)
       VALUES ($1, $2, $3, $4)`,
      [`key_${crypto.randomUUID()}`, input.userId, input.publicKey, input.label.slice(0, 60)],
    )
    return { ok: true, first: existing.length === 0 }
  } catch { return { ok: false, refusal: 'error' } }
}

/**
 * Revoke one.
 *
 * A lost laptop is the case this exists for, and it must work from a DIFFERENT
 * device — so it is authorised by the session rather than by the key being
 * revoked, which is by definition unavailable.
 */
export async function revokeKey(userId: string, publicKey: string): Promise<boolean> {
  try {
    await ensureSigningSchema()
    const rows = await query<{ id: string }>(
      `UPDATE freehold_wallet_keys SET revoked_at = now()
        WHERE user_id = $1 AND public_key = $2 AND revoked_at IS NULL
        RETURNING id`,
      [userId, publicKey],
    )
    return rows.length > 0
  } catch { return false }
}

// ── Verification ─────────────────────────────────────────────────────────────

const b64 = (s: string): Uint8Array => Uint8Array.from(Buffer.from(s, 'base64'))

/** null for anything that is not a P-256 public key. */
async function importKey(spkiBase64: string): Promise<CryptoKey | null> {
  try {
    return await webcrypto.subtle.importKey(
      'spki', b64(spkiBase64), SIGNING_ALGORITHM, false, ['verify'],
    )
  } catch { return null }
}

async function anyKeyVerifies(
  keys: readonly WalletKey[],
  payload: string,
  signature: string,
): Promise<boolean> {
  for (const k of keys) {
    const key = await importKey(k.publicKey)
    if (!key) continue
    try {
      const good = await webcrypto.subtle.verify(
        { name: 'ECDSA', hash: SIGNING_DIGEST },
        key,
        b64(signature),
        new TextEncoder().encode(payload),
      )
      if (good) return true
    } catch { /* a malformed signature is a failed one, not an error */ }
  }
  return false
}

export type IntentVerdict = { ok: true } | { ok: false; refusal: SignatureRefusal }

/**
 * MAY THIS MOVEMENT PROCEED?
 *
 * The order is deliberate. Freshness and sender-binding are checked before the
 * signature because they are cheap and because their refusals are more useful:
 * "your clock is wrong" is an answer, "bad signature" for a clock problem is a
 * mystery.
 *
 * The nonce is spent LAST, after the signature has verified, so a bad signature
 * cannot burn a nonce the holder would need to retry with.
 */
export async function verifyIntent(input: {
  userId: string
  /** The wallet the server believes is theirs. Compared, never trusted from the client. */
  walletId: string
  intent: SignedIntent
  signature?: string
  nowMs: number
}): Promise<IntentVerdict> {
  await ensureSigningSchema()
  const keys = await activeKeys(input.userId)

  // HAVING A KEY MEANS USING IT. Without this the whole scheme is optional and
  // therefore absent: an attacker would simply omit the signature.
  if (!requiresSignature(keys.length > 0)) return { ok: true }
  if (!input.signature) return { ok: false, refusal: 'missing' }
  if (keys.length === 0) return { ok: false, refusal: 'noKey' }

  const fresh = checkFreshness(input.intent, input.nowMs)
  if (!fresh.ok) return { ok: false, refusal: fresh.refusal }

  // THE SIGNATURE SAYS WHOSE WALLET IT IS, AND SO DOES THE SESSION. If they
  // disagree, a captured intent is being replayed from another account and the
  // signature over it is perfectly valid.
  if (input.intent.fromWalletId !== input.walletId) {
    return { ok: false, refusal: 'wrongSender' }
  }

  let payload: string
  try { payload = signingPayload(input.intent) } catch { return { ok: false, refusal: 'badSignature' } }
  if (!(await anyKeyVerifies(keys, payload, input.signature))) {
    return { ok: false, refusal: 'badSignature' }
  }

  // SPEND THE NONCE. The primary key is the check, so two submissions racing
  // cannot both pass — one inserts, the other violates and is told `replayed`.
  try {
    const rows = await query<{ nonce: string }>(
      `INSERT INTO freehold_signed_nonces (nonce, user_id) VALUES ($1, $2)
       ON CONFLICT (nonce) DO NOTHING RETURNING nonce`,
      [input.intent.nonce, input.userId],
    )
    if (rows.length === 0) return { ok: false, refusal: 'replayed' }
  } catch { return { ok: false, refusal: 'replayed' } }

  return { ok: true }
}

/**
 * Forget nonces older than any signature could still be valid for.
 *
 * The table would otherwise grow forever to protect against replays of intents
 * that expired minutes after they were made. An hour is far beyond
 * INTENT_TTL_MS and leaves no window: a nonce whose intent is already expired
 * is refused on freshness before the replay check is ever reached.
 */
export async function forgetOldNonces(): Promise<number> {
  try {
    await ensureSigningSchema()
    const rows = await query<{ nonce: string }>(
      `DELETE FROM freehold_signed_nonces WHERE used_at < now() - interval '1 hour' RETURNING nonce`,
    )
    return rows.length
  } catch { return 0 }
}
