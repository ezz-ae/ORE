'use client'

/**
 * THE KEY THAT NEVER LEAVES THE BROWSER.
 *
 * Generated here, stored here, used here. The server sees the public half and
 * a signature; it never sees the private key and could not produce one, which
 * is what makes a signature mean something the session cookie does not.
 *
 * ── WHY INDEXEDDB AND NOT LOCALSTORAGE ───────────────────────────────────
 *
 * localStorage holds strings, so a private key would have to be exported to
 * text to live there — and a key that exists as a string is a key any script on
 * the page can read and send anywhere. IndexedDB stores the CryptoKey object
 * itself, and a key created with `extractable: false` cannot be turned back
 * into bytes by anything, including our own code.
 *
 * ── WHICH MAKES BACKUP A DECISION, NOT AN OVERSIGHT ──────────────────────
 *
 * A non-extractable key cannot be exported, so there is no backup file and a
 * cleared browser means a lost key. That is the right trade here and it is only
 * right because of what a lost key COSTS: nothing but the ability to sign. The
 * money is in the ledger, not in the key. Losing it means enrolling a new one
 * from another device — an inconvenience — while an exportable key means a
 * file somebody can copy, which is a permanent liability for the same money.
 *
 * A wallet whose key controls the only copy of the funds would need the
 * opposite answer. This one does not, and pretending otherwise would be
 * borrowing a threat model that does not apply.
 */
import {
  SIGNING_ALGORITHM, SIGNING_DIGEST, signingPayload, type SignedIntent,
} from '@/lib/freehold/wallet-signing'

const DB_NAME = 'freehold-wallet'
const STORE = 'keys'
const KEY_ID = 'signing'

/** Promise-wrapped IndexedDB. The callback API does not compose with anything. */
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function idb<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then((db) => new Promise<T>((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result as T)
    req.onerror = () => reject(req.error)
  }))
}

const b64 = (buf: ArrayBuffer): string => {
  const bytes = new Uint8Array(buf)
  let s = ''
  // Chunked: String.fromCharCode(...bytes) blows the argument limit on a large
  // buffer, which for a key is fine and for a signature is fine, and would
  // still be a landmine the day either grows.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(s)
}

export interface LocalKey {
  publicKey: string
  privateKey: CryptoKey
}

/** The key on this device, or null. */
export async function loadKey(): Promise<LocalKey | null> {
  try {
    const stored = await idb<{ publicKey: string; privateKey: CryptoKey } | undefined>(
      'readonly', (s) => s.get(KEY_ID),
    )
    return stored?.privateKey ? { publicKey: stored.publicKey, privateKey: stored.privateKey } : null
  } catch { return null }
}

/**
 * Make one, and keep it.
 *
 * `extractable: false` — see the header. The public half is exported once,
 * here, because the server needs it; the private half never becomes bytes.
 */
export async function createKey(): Promise<LocalKey | null> {
  try {
    const pair = await crypto.subtle.generateKey(SIGNING_ALGORITHM, false, ['sign', 'verify'])
    const publicKey = b64(await crypto.subtle.exportKey('spki', pair.publicKey))
    await idb('readwrite', (s) => s.put({ publicKey, privateKey: pair.privateKey }, KEY_ID))
    return { publicKey, privateKey: pair.privateKey }
  } catch { return null }
}

/** Forget it. Used when a key has been revoked server-side and this device
 *  should stop offering to sign with something nobody will accept. */
export async function forgetKey(): Promise<void> {
  try { await idb('readwrite', (s) => s.delete(KEY_ID)) } catch { /* already gone */ }
}

/**
 * Sign an intent.
 *
 * The payload is built by the SHARED module, never assembled here — the whole
 * point of a canonical form is that both sides produce identical bytes, and a
 * second implementation is a second opportunity to differ by a space.
 */
export async function signIntent(key: LocalKey, intent: SignedIntent): Promise<string> {
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: SIGNING_DIGEST },
    key.privateKey,
    new TextEncoder().encode(signingPayload(intent)),
  )
  return b64(sig)
}

/** Sign an arbitrary string — used to vouch for a new device's key. */
export async function signMessage(key: LocalKey, message: string): Promise<string> {
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: SIGNING_DIGEST },
    key.privateKey,
    new TextEncoder().encode(message),
  )
  return b64(sig)
}

/**
 * A nonce for one intent.
 *
 * `crypto.randomUUID` rather than a counter or a timestamp: it is the ledger
 * reference too, so a collision would not merely replay a signature, it would
 * collide with a real movement's idempotency key and be swallowed as a
 * duplicate.
 */
export const newNonce = (): string => `sig-${crypto.randomUUID()}`
