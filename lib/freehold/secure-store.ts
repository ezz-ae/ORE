import { scryptSync, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'

// Transparent envelope encryption for secrets kept at rest in Postgres
// (integration tokens). Protects against a DB-only compromise (e.g. a leaked
// snapshot) — the ciphertext is useless without the app's key, which lives in
// the environment, not the database.
//
// AES-256-GCM (authenticated). The key is derived from FH_CREDENTIALS_KEY, or
// FH_SESSION_SECRET as a fallback, via scrypt. Rotating that secret makes
// existing ciphertext unreadable, so treat it like any other signing secret.

const SECRET =
  process.env.FH_CREDENTIALS_KEY ||
  process.env.FH_SESSION_SECRET ||
  'fh-dev-insecure-credentials-key'

// Derived once per process. Fixed salt is fine: the secret is the real entropy
// and a per-value random IV gives distinct ciphertexts.
const KEY = scryptSync(SECRET, 'fh-cred-v1', 32)

/** Marker so we can tell an encrypted envelope from a legacy plaintext row. */
export interface SealedValue {
  __fhsec: 1
  iv: string
  tag: string
  ct: string
}

function isSealed(v: unknown): v is SealedValue {
  return !!v && typeof v === 'object' && (v as { __fhsec?: unknown }).__fhsec === 1
}

/** Encrypt a JSON-serialisable value into a storable envelope object. */
export function seal(value: unknown): SealedValue {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', KEY, iv)
  const pt = Buffer.from(JSON.stringify(value), 'utf8')
  const ct = Buffer.concat([cipher.update(pt), cipher.final()])
  const tag = cipher.getAuthTag()
  return { __fhsec: 1, iv: iv.toString('base64'), tag: tag.toString('base64'), ct: ct.toString('base64') }
}

/**
 * Decrypt an envelope back to its value. Backward compatible: a legacy
 * plaintext object (written before encryption existed) is returned as-is, so
 * old rows keep working and get re-encrypted on their next write. Returns null
 * only when an envelope is present but can't be decrypted (wrong key / tamper).
 */
export function open<T = unknown>(stored: unknown): T | null {
  if (!isSealed(stored)) return (stored ?? null) as T | null
  try {
    const iv = Buffer.from(stored.iv, 'base64')
    const tag = Buffer.from(stored.tag, 'base64')
    const ct = Buffer.from(stored.ct, 'base64')
    const decipher = createDecipheriv('aes-256-gcm', KEY, iv)
    decipher.setAuthTag(tag)
    const pt = Buffer.concat([decipher.update(ct), decipher.final()])
    return JSON.parse(pt.toString('utf8')) as T
  } catch {
    return null
  }
}
