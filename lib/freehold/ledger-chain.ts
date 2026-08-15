/**
 * THE LEDGER, HASH-CHAINED — so editing history is detectable, not merely
 * discouraged.
 *
 * wallet.ts guarantees a movement is balanced. wallet-db.ts guarantees it is
 * atomic and happens once. Neither guarantees it is the movement that was
 * originally written: anybody with the database can change an amount, and every
 * check we had would still pass, because a balance re-derived from edited rows
 * agrees with the edited rows.
 *
 * So each movement is a BLOCK. It carries the hash of the block before it, and
 * its own hash is taken over its contents INCLUDING that link. Change one
 * amount in row 400 and its hash changes; block 401 still carries the old one;
 * `verifyChain` names 400 as the break. To forge a single row somebody must
 * recompute every block after it, which is exactly the property a chain buys.
 *
 * ── THIS IS NOT A BLOCKCHAIN AND DOES NOT PRETEND TO BE ──────────────────
 *
 * There is one writer and no consensus, so it proves TAMPER-EVIDENCE, not
 * decentralisation: it can prove the history has not been edited since it was
 * written, and it cannot stop the one writer from writing something false in
 * the first place. That distinction matters and is the reason the verify screen
 * says "unbroken since block 1", never "trustless".
 *
 * ── THE CANONICAL FORM IS THE WHOLE THING ────────────────────────────────
 *
 * A hash is only as good as the agreement about what was hashed. Every field
 * order, every separator, every number format is fixed here and nowhere else,
 * because two implementations that disagree by one space produce two different
 * hashes and the chain reads as broken when nothing is wrong.
 *
 * The rules the canonical form obeys, each because the alternative breaks:
 *
 *   · FIELDS IN A FIXED ORDER, never object key order. JSON.stringify follows
 *     insertion order, so the same data built by two code paths can serialise
 *     differently.
 *   · INTEGERS ONLY for amounts. A float is a different string on different
 *     platforms (0.1 + 0.2), and the ledger is integer Cash anyway.
 *   · TIMESTAMPS AS EPOCH MILLISECONDS, not as text. '2026-08-15T10:00:00Z'
 *     and '2026-08-15T10:00:00.000Z' are the same instant and different bytes.
 *   · SEPARATORS THAT CANNOT APPEAR IN A FIELD. A memo containing the separator
 *     could otherwise be crafted to shift a field boundary and collide with a
 *     different movement — so free text is length-prefixed rather than trusted.
 *
 * Pure — no I/O, no clock, and the hash is injected rather than imported, so
 * this module runs identically in Node, in a browser and in a guard suite.
 */

/**
 * What the chain hangs from.
 *
 * Sixty-four zeroes. The first block links to nothing, and a real hash here
 * would be a hash of something — which invites the question of what, and gives
 * a forger a place to start.
 */
export const GENESIS_HASH = '0'.repeat(64)

/** The version of the canonical form itself. */
export const CHAIN_FORMAT = 'fh-chain-1'

/**
 * One movement, as the chain sees it.
 *
 * Deliberately a SUBSET of a posting: the fields that define what happened, and
 * nothing derived. Including a derived field — a running balance, a formatted
 * amount — would make the hash depend on code rather than on facts, and every
 * change to that code would invalidate the history.
 */
export interface ChainEntry {
  /** Position in the chain, from 1. */
  seq: number
  /** The idempotency key of the movement. Unique in the ledger. */
  reference: string
  kind: string
  /** Whole Cash. */
  amount: number
  fromWalletId: string
  toWalletId: string
  memo: string
  /** Who caused it. Empty string for the machine. */
  actor: string
  /** Epoch milliseconds. */
  atMs: number
}

/**
 * The exact bytes that get hashed.
 *
 * Free text is written as `<byte length>:<text>`. That is what stops a memo of
 * `|to|` from moving a field boundary: the reader knows how far to read before
 * it reads, so no content can be mistaken for structure.
 */
export function canonicalise(e: ChainEntry, prevHash: string): string {
  const n = (v: number): string => {
    // A non-integer or non-finite amount cannot be canonicalised honestly, and
    // silently coercing one would let a corrupt row hash as though it were
    // clean. Refusing here means the movement is never written at all.
    if (!Number.isFinite(v) || !Number.isInteger(v)) {
      throw new Error(`ledger-chain: ${v} is not a whole number`)
    }
    return String(v)
  }
  const s = (v: string): string => {
    const text = v ?? ''
    // Byte length, not character length — a memo in Arabic is longer in bytes
    // than in characters, and a reader counting the wrong one reads the wrong
    // field.
    const bytes = new TextEncoder().encode(text).length
    return `${bytes}:${text}`
  }

  // FIXED ORDER. Never derived from Object.keys.
  return [
    CHAIN_FORMAT,
    n(e.seq),
    prevHash,
    s(e.reference),
    s(e.kind),
    n(e.amount),
    s(e.fromWalletId),
    s(e.toWalletId),
    s(e.memo),
    s(e.actor),
    n(e.atMs),
  ].join('|')
}

/**
 * A hash function, supplied by the caller.
 *
 * Injected rather than imported so this module has no dependency on node:crypto
 * or on WebCrypto and therefore runs unchanged in a guard suite, on the server
 * and in a browser that wants to check the chain for itself. A ledger only the
 * server can verify is a ledger you are asked to take on faith.
 */
export type Hasher = (input: string) => string

/** The hash of one block, given the chain it is joining. */
export const hashEntry = (h: Hasher, e: ChainEntry, prevHash: string): string =>
  h(canonicalise(e, prevHash))

export interface ChainedEntry extends ChainEntry {
  prevHash: string
  hash: string
}

/** Walkable — why a chain failed to verify. Each renders its own sentence. */
export const CHAIN_BREAKS = ['hashMismatch', 'linkMismatch', 'sequenceGap', 'badGenesis'] as const
export type ChainBreak = (typeof CHAIN_BREAKS)[number]

export type ChainVerdict =
  | { ok: true; length: number; head: string }
  | {
      ok: false
      /** The first block that does not add up. Everything before it is sound. */
      brokenAt: number
      reason: ChainBreak
      expected: string
      found: string
      length: number
    }

/**
 * Walk the chain and report the FIRST break.
 *
 * First, not all of them, and that is the useful answer: one edited row makes
 * every later block mismatch, so a list of "4,000 broken blocks" hides the one
 * fact worth having — which row was touched. Everything before `brokenAt` is
 * provably untouched.
 *
 * Entries must arrive oldest first. A caller that sorts them the other way gets
 * `sequenceGap` on the second block rather than a confident wrong answer.
 */
export function verifyChain(h: Hasher, entries: readonly ChainedEntry[]): ChainVerdict {
  let prev = GENESIS_HASH

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]

    // THE SEQUENCE IS PART OF THE PROOF. Without this check a whole block could
    // be DELETED and the remainder would still chain perfectly — the one attack
    // a hash link alone does not cover.
    if (e.seq !== i + 1) {
      return {
        ok: false, brokenAt: i + 1, reason: 'sequenceGap',
        expected: String(i + 1), found: String(e.seq), length: entries.length,
      }
    }

    if (e.prevHash !== prev) {
      return {
        ok: false, brokenAt: e.seq,
        reason: i === 0 ? 'badGenesis' : 'linkMismatch',
        expected: prev, found: e.prevHash, length: entries.length,
      }
    }

    let recomputed: string
    try {
      recomputed = hashEntry(h, e, prev)
    } catch {
      // A row that cannot even be canonicalised — a fractional amount, say — is
      // corrupt, and reporting it as a hash mismatch is the honest answer
      // rather than crashing the verifier and reporting nothing.
      return {
        ok: false, brokenAt: e.seq, reason: 'hashMismatch',
        expected: '(uncanonicalisable row)', found: e.hash, length: entries.length,
      }
    }

    if (recomputed !== e.hash) {
      return {
        ok: false, brokenAt: e.seq, reason: 'hashMismatch',
        expected: recomputed, found: e.hash, length: entries.length,
      }
    }

    prev = e.hash
  }

  return { ok: true, length: entries.length, head: prev }
}

/**
 * The next block, ready to write.
 *
 * `seq` and `prevHash` come from the caller because only the caller — holding a
 * lock on the ledger — can know what the head actually is. A function that
 * looked it up itself would be reading outside the transaction that is about to
 * write, which is exactly how two concurrent movements both become block 401.
 */
export function nextBlock(
  h: Hasher,
  entry: Omit<ChainEntry, 'seq'>,
  head: { seq: number; hash: string },
): ChainedEntry {
  const e: ChainEntry = { ...entry, seq: head.seq + 1 }
  return { ...e, prevHash: head.hash, hash: hashEntry(h, e, head.hash) }
}

/**
 * A hash, shortened for a screen.
 *
 * The ends, because that is what a person compares. The middle of a SHA-256 is
 * never read by anybody.
 */
export const shortHash = (hash: string): string =>
  hash.length <= 16 ? hash : `${hash.slice(0, 8)}…${hash.slice(-8)}`
