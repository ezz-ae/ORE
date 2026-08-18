/**
 * Signatures, on Postgres.
 *
 * One row per signed movement, keyed on the movement's own idempotency
 * reference — so a retried request that posts once also signs once, and the
 * signature and the money are the same event rather than two rows that can
 * disagree.
 *
 * The terms are stored FIELD BY FIELD as well as hashed. A digest alone can
 * only ever answer "has this been altered", and the answer is useless if the
 * original figures are gone: nobody can re-derive what was signed in order to
 * check it. So the row carries the amount, both wallets, the beneficiary's name
 * as it was printed, the signer's name as it was printed, the sentence they
 * read, and the digest over all of it. `verifySignature` recomputes from the
 * stored fields and reports whether they still agree.
 *
 * See lib/freehold/signature.ts for what a signature is and — more importantly
 * — what it is not.
 */
import { createHash } from 'node:crypto'
import { query, ensureOnce } from '@/lib/db'
import {
  canonicalSignature, digest, statement, SIGNATURE_FORMAT, SYSTEM_SIGNER,
  type SignatureIntent, type SignedAction, type Hasher,
} from '@/lib/freehold/signature'

/** The same hash the ledger chain uses, for the same reason: one, named. */
export const sha256: Hasher = (input: string) =>
  createHash('sha256').update(input, 'utf8').digest('hex')

async function ensure(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_signatures (
      reference      text PRIMARY KEY,
      action         text NOT NULL,
      amount         bigint NOT NULL CHECK (amount > 0),
      from_wallet_id text NOT NULL,
      to_wallet_id   text NOT NULL,
      to_label       text NOT NULL DEFAULT '',
      to_account_no  text NOT NULL DEFAULT '',
      signer_id      text NOT NULL,
      signer_name    text NOT NULL DEFAULT '',
      authority      text NOT NULL DEFAULT '',
      statement      text NOT NULL DEFAULT '',
      format         text NOT NULL DEFAULT '${SIGNATURE_FORMAT}',
      digest         char(64) NOT NULL,
      at_ms          bigint NOT NULL,
      created_at     timestamptz NOT NULL DEFAULT now()
    )
  `)
  await query(`CREATE INDEX IF NOT EXISTS freehold_signatures_signer_idx
               ON freehold_signatures (signer_id, created_at DESC)`)
  await query(`CREATE INDEX IF NOT EXISTS freehold_signatures_to_idx
               ON freehold_signatures (to_wallet_id, created_at DESC)`)
}

export const ensureSignatureSchema = () => ensureOnce('freehold_signatures', ensure)

export interface StoredSignature extends SignatureIntent {
  reference: string
  statement: string
  digest: string
  /** Recomputed on read. False means a stored field no longer matches. */
  holds: boolean
}

const mapRow = (r: Record<string, unknown>): StoredSignature => {
  const intent: SignatureIntent = {
    action: String(r.action) as SignedAction,
    amount: Number(r.amount ?? 0),
    fromWalletId: String(r.from_wallet_id),
    beneficiary: {
      walletId: String(r.to_wallet_id),
      label: String(r.to_label ?? ''),
      accountNo: String(r.to_account_no ?? ''),
    },
    signerId: String(r.signer_id),
    signerName: String(r.signer_name ?? ''),
    authority: String(r.authority ?? ''),
    atMs: Number(r.at_ms ?? 0),
  }
  const recorded = String(r.digest ?? '')
  return {
    ...intent,
    reference: String(r.reference),
    statement: String(r.statement ?? ''),
    digest: recorded,
    // Recomputed from the stored fields every time it is read. A signature
    // nobody checks is decoration, and the cheapest moment to check one is the
    // moment somebody is looking at it.
    holds: (() => {
      try { return digest(sha256, intent) === recorded } catch { return false }
    })(),
  }
}

/**
 * Record a signature against a movement.
 *
 * ON CONFLICT DO NOTHING: the reference is the movement's idempotency key, so a
 * retry re-signs the same terms and the FIRST signature stands. Overwriting
 * would let a second call quietly replace what was agreed — the one thing a
 * signature must not allow.
 *
 * Never throws. A movement that posted must not be rolled back because its
 * receipt failed to write; the guard suite asserts the caller records the
 * signature, and a missing row is visible as a movement with no signature
 * rather than as money that vanished.
 */
export async function signMovement(
  reference: string,
  intent: SignatureIntent,
): Promise<{ ok: boolean; digest: string; statement: string }> {
  const line = statement(intent)
  let sig = ''
  try { sig = digest(sha256, intent) } catch { return { ok: false, digest: '', statement: line } }
  try {
    await ensureSignatureSchema()
    await query(
      `INSERT INTO freehold_signatures
         (reference, action, amount, from_wallet_id, to_wallet_id, to_label, to_account_no,
          signer_id, signer_name, authority, statement, format, digest, at_ms)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (reference) DO NOTHING`,
      [
        reference, intent.action, intent.amount, intent.fromWalletId,
        intent.beneficiary.walletId, intent.beneficiary.label, intent.beneficiary.accountNo,
        intent.signerId, intent.signerName, intent.authority ?? '', line,
        SIGNATURE_FORMAT, sig, intent.atMs,
      ],
    )
    return { ok: true, digest: sig, statement: line }
  } catch (err) {
    console.error('[signature] could not record', reference, err)
    return { ok: false, digest: sig, statement: line }
  }
}

/** The signature on one movement, or null when it was never signed. */
export async function signatureFor(reference: string): Promise<StoredSignature | null> {
  try {
    await ensureSignatureSchema()
    const rows = await query(`SELECT * FROM freehold_signatures WHERE reference = $1`, [reference])
    return rows[0] ? mapRow(rows[0]) : null
  } catch { return null }
}

/** Signatures on a set of movements, in one read. Keyed by reference. */
export async function signaturesFor(references: readonly string[]): Promise<Map<string, StoredSignature>> {
  const out = new Map<string, StoredSignature>()
  const unique = [...new Set(references.filter(Boolean))]
  if (!unique.length) return out
  try {
    await ensureSignatureSchema()
    const rows = await query(`SELECT * FROM freehold_signatures WHERE reference = ANY($1)`, [unique])
    for (const r of rows) {
      const s = mapRow(r)
      out.set(s.reference, s)
    }
  } catch { /* a receipt with no signature reads as unsigned, never as forged */ }
  return out
}

/**
 * The intent a machine-driven movement signs.
 *
 * Given its own helper so no caller has to remember to set SYSTEM_SIGNER and an
 * authority sentence — a forgotten authority would produce a signature that
 * says a movement was automatic and cannot say what allowed it, which is worse
 * than no signature because it looks complete.
 */
export const systemIntent = (i: {
  action: SignedAction
  amount: number
  fromWalletId: string
  beneficiary: SignatureIntent['beneficiary']
  authority: string
  atMs: number
}): SignatureIntent => ({
  action: i.action,
  amount: i.amount,
  fromWalletId: i.fromWalletId,
  beneficiary: i.beneficiary,
  signerId: SYSTEM_SIGNER,
  signerName: 'System',
  authority: i.authority,
  atMs: i.atMs,
})

export { canonicalSignature, SYSTEM_SIGNER }
