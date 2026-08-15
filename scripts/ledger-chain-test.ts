/**
 * EDITING HISTORY IS DETECTABLE — locked.
 *
 * The ledger was balanced, atomic and idempotent, and none of that says the
 * rows are the rows that were written. Anybody with the database could change
 * an amount and every check would still pass, because a balance re-derived from
 * edited rows agrees with the edited rows.
 *
 * The chain closes that, and this suite locks the properties the chain rests
 * on. They are all of the form "two people hashing the same movement get the
 * same string", and every one of them breaks silently:
 *
 *   1. The canonical form is FIXED — field order, number format, timestamps.
 *   2. Free text cannot shift a field boundary, however it is crafted.
 *   3. Changing any field changes the hash.
 *   4. An edited row is named, and everything before it is still proven.
 *   5. A DELETED block is caught — the attack a hash link alone misses.
 *
 * Pure — no network, no clock, and the hasher is injected. Runs in `pnpm guards`.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  GENESIS_HASH, CHAIN_FORMAT, CHAIN_BREAKS,
  canonicalise, hashEntry, verifyChain, nextBlock, shortHash,
  type ChainEntry, type ChainedEntry, type Hasher,
} from '../lib/freehold/ledger-chain'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const sha: Hasher = (s) => createHash('sha256').update(s, 'utf8').digest('hex')

const entry = (o: Partial<ChainEntry> = {}): ChainEntry => ({
  seq: 1, reference: 'send:abc', kind: 'transfer', amount: 400,
  fromWalletId: 'w_a', toWalletId: 'w_b', memo: 'for the deposit',
  actor: 'me@ezz.ae', atMs: 1_760_000_000_000, ...o,
})

/** A sound chain of n blocks. */
const chainOf = (n: number): ChainedEntry[] => {
  const out: ChainedEntry[] = []
  let head = { seq: 0, hash: GENESIS_HASH }
  for (let i = 1; i <= n; i++) {
    const { seq: _seq, ...body } = entry({ reference: `send:${i}`, amount: i * 10 })
    const b = nextBlock(sha, body, head)
    out.push(b)
    head = { seq: b.seq, hash: b.hash }
  }
  return out
}

console.log('\n── the canonical form is the whole thing ──')
{
  // A hash is only as good as the agreement about what was hashed. Two
  // implementations differing by one space produce two different hashes and the
  // chain reads as broken when nothing is wrong.
  const a = canonicalise(entry(), GENESIS_HASH)
  const b = canonicalise(entry(), GENESIS_HASH)
  check('the same movement canonicalises identically', a === b)
  check('the format version is in the bytes', a.startsWith(CHAIN_FORMAT), a.slice(0, 20))

  // FIELD ORDER IS FIXED, never Object.keys — JSON.stringify follows insertion
  // order, so the same data built by two code paths serialises differently.
  const reordered = canonicalise(
    // Deliberately built with the keys in a different order.
    { atMs: 1_760_000_000_000, actor: 'me@ezz.ae', memo: 'for the deposit',
      toWalletId: 'w_b', fromWalletId: 'w_a', amount: 400, kind: 'transfer',
      reference: 'send:abc', seq: 1 },
    GENESIS_HASH,
  )
  check('key order in the object cannot change the bytes', reordered === a)

  // INTEGERS ONLY. A float is a different string on different platforms, and
  // the ledger is integer Cash anyway — a fractional amount is corruption, and
  // silently coercing it would let a corrupt row hash as though it were clean.
  let threw = false
  try { canonicalise(entry({ amount: 0.1 + 0.2 }), GENESIS_HASH) } catch { threw = true }
  check('a fractional amount refuses to canonicalise', threw)
  threw = false
  try { canonicalise(entry({ amount: NaN }), GENESIS_HASH) } catch { threw = true }
  check('…and so does NaN', threw)
}

console.log('\n── free text cannot pretend to be structure ──')
{
  // THE ATTACK: a memo containing the field separator could shift a boundary so
  // two different movements canonicalise to the same string. Length-prefixing
  // means the reader knows how far to read BEFORE it reads.
  const sneaky = hashEntry(sha, entry({ memo: 'x|w_c|w_d|', reference: 'send:1' }), GENESIS_HASH)
  const plain = hashEntry(sha, entry({ memo: 'x', reference: 'send:1' }), GENESIS_HASH)
  check('a memo full of separators is not the same movement', sneaky !== plain)

  // The specific collision the prefix exists to prevent: moving content across
  // a boundary must not produce the same bytes.
  const left = canonicalise(entry({ memo: 'ab', actor: 'c' }), GENESIS_HASH)
  const right = canonicalise(entry({ memo: 'a', actor: 'bc' }), GENESIS_HASH)
  check('content cannot be shifted between two fields', left !== right)

  // BYTE LENGTH, NOT CHARACTER LENGTH. Arabic is longer in bytes than in
  // characters, and a reader counting the wrong one reads the wrong field.
  const arabic = canonicalise(entry({ memo: 'دفعة' }), GENESIS_HASH)
  check('the prefix counts bytes, not characters', arabic.includes('8:دفعة'), arabic.slice(-60))
}

console.log('\n── changing anything changes the hash ──')
{
  const base = hashEntry(sha, entry(), GENESIS_HASH)
  const fields: Array<[string, Partial<ChainEntry>]> = [
    ['the amount', { amount: 401 }],
    ['who it came from', { fromWalletId: 'w_x' }],
    ['who it went to', { toWalletId: 'w_x' }],
    ['the reference', { reference: 'send:other' }],
    ['the kind', { kind: 'spend' }],
    ['the memo', { memo: 'something else' }],
    ['who did it', { actor: 'someone@else.ae' }],
    ['when', { atMs: 1_760_000_000_001 }],
    ['its position', { seq: 2 }],
  ]
  for (const [name, patch] of fields) {
    check(`changing ${name} changes the hash`,
      hashEntry(sha, entry(patch), GENESIS_HASH) !== base)
  }
  // …and the link itself is hashed, which is what makes it a CHAIN rather than
  // a column of independent hashes.
  check('changing the block before it changes this hash',
    hashEntry(sha, entry(), sha('different')) !== base)
}

console.log('\n── a sound chain verifies ──')
{
  const chain = chainOf(5)
  const v = verifyChain(sha, chain)
  check('five honest blocks verify', v.ok, v.ok ? '' : `${v.reason} at ${v.brokenAt}`)
  check('…and it reports its length', v.ok && v.length === 5)
  check('…and its head, which is what a later block will link to',
    v.ok && v.head === chain[4].hash)
  check('an empty ledger is sound, not broken', verifyChain(sha, []).ok)

  // The first block links to the genesis and nothing else.
  check('block one hangs from the genesis', chain[0].prevHash === GENESIS_HASH)
  check('the genesis is not a hash of anything', GENESIS_HASH === '0'.repeat(64))
}

console.log('\n── an edited row is named, and the rest is still proven ──')
{
  // THE WHOLE POINT. Somebody with database access changes an amount.
  const tampered = chainOf(5)
  tampered[2] = { ...tampered[2], amount: 999_999 }
  const v = verifyChain(sha, tampered)
  check('an edited amount breaks the chain', !v.ok)
  check('…at exactly the row that was edited', !v.ok && v.brokenAt === 3,
    v.ok ? 'verified' : String(v.brokenAt))
  check('…and says the hash no longer matches the row',
    !v.ok && v.reason === 'hashMismatch', v.ok ? '' : v.reason)

  // FIRST break, not all of them — one edit makes every later block mismatch,
  // and "4,000 broken blocks" hides the one fact worth having.
  check('everything before it is still proven',
    verifyChain(sha, tampered.slice(0, 2)).ok)

  // AND A DELETED BLOCK IS CAUGHT. This is the attack a hash link alone misses:
  // remove a row and the survivors would chain perfectly without the sequence.
  const deleted = chainOf(5).filter((_, i) => i !== 2)
  const d = verifyChain(sha, deleted)
  check('a deleted block is caught', !d.ok)
  check('…as a gap in the sequence, not as a hash fault',
    !d.ok && d.reason === 'sequenceGap', d.ok ? '' : d.reason)

  // A re-linked block — somebody tried to repair the chain after editing.
  const relinked = chainOf(3)
  relinked[1] = { ...relinked[1], prevHash: sha('forged') }
  const r = verifyChain(sha, relinked)
  check('a forged link is caught', !r.ok && r.reason === 'linkMismatch',
    r.ok ? 'verified' : r.reason)

  // A chain that does not start at the genesis is not this chain.
  const rooted = chainOf(2)
  rooted[0] = { ...rooted[0], prevHash: sha('elsewhere') }
  const g = verifyChain(sha, rooted)
  check('a chain rooted somewhere else is caught',
    !g.ok && g.reason === 'badGenesis', g.ok ? 'verified' : g.reason)
}

console.log('\n── the vocabulary is walkable and the display is honest ──')
{
  check('the break reasons are a walkable list',
    CHAIN_BREAKS.length > 0 && new Set(CHAIN_BREAKS).size === CHAIN_BREAKS.length)

  // Every reason must be reachable, or it is a sentence no screen will show.
  const reached = new Set<string>()
  for (const build of [
    () => { const c = chainOf(3); c[1] = { ...c[1], amount: 1 }; return c },
    () => { const c = chainOf(3); c[1] = { ...c[1], prevHash: sha('x') }; return c },
    () => chainOf(3).filter((_, i) => i !== 1),
    () => { const c = chainOf(2); c[0] = { ...c[0], prevHash: sha('x') }; return c },
  ]) {
    const v = verifyChain(sha, build())
    if (!v.ok) reached.add(v.reason)
  }
  const missing = CHAIN_BREAKS.filter((r) => !reached.has(r))
  check('every break reason can actually happen', missing.length === 0, missing.join(', '))

  // A person compares the ends of a hash. Nobody reads the middle of a SHA-256.
  const h = sha('anything')
  check('a hash shortens to its ends', shortHash(h) === `${h.slice(0, 8)}…${h.slice(-8)}`)
  check('…and a short one is left alone', shortHash('abc') === 'abc')
}

console.log('\n── the hasher is injected, so anybody can check the chain ──')
{
  // A ledger only the server can verify is a ledger you are asked to take on
  // faith. The module imports no crypto of its own, which is what lets a
  // browser recompute the same hashes with WebCrypto.
  const src = readFileSync(
    join(process.cwd(), 'lib/freehold/ledger-chain.ts'),
    { encoding: 'utf8' },
  ).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  check('the chain module imports nothing at all',
    !/^\s*import\s/m.test(src), 'it has a dependency')
  check('…and takes its hash as an argument', /export type Hasher/.test(src))
}

if (failures > 0) {
  console.error(`\n${failures} chain rule(s) broken.`)
  process.exit(1)
}
console.log('\nThe history cannot be edited without the edit being named.\n')
