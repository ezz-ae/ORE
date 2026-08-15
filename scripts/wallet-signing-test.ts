/**
 * A SIGNATURE COVERS EVERYTHING IT NEEDS TO — locked.
 *
 * A signature proves consent to exactly what was signed, and every field left
 * out is a field an attacker may change freely while the signature still
 * verifies. That failure is silent: the maths is correct, the check passes, and
 * the money goes somewhere else.
 *
 * So this suite signs real payloads with a real P-256 key and tries to break
 * them the ways they get broken:
 *
 *   1. Change the amount, the destination, the sender, the action — the
 *      signature must stop verifying every time.
 *   2. A signature is worthless after INTENT_TTL_MS, and a clock running ahead
 *      cannot mint a long-lived one.
 *   3. Free text cannot shift a field boundary.
 *   4. Having a key MEANS using it — the rule that stops the whole scheme from
 *      being optional and therefore absent.
 *
 * Pure — no network, no database. Uses node:webcrypto, the same primitive the
 * browser signs with. Runs in `pnpm guards`.
 */
import { webcrypto } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  SIGNING_FORMAT, SIGNING_ALGORITHM, SIGNING_DIGEST, INTENT_TTL_MS, CLOCK_SKEW_MS,
  SIGNED_ACTIONS, SIGNATURE_REFUSALS,
  signingPayload, checkFreshness, requiresSignature, keyFingerprint,
  type SignedIntent,
} from '../lib/freehold/wallet-signing'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const NOW = 1_760_000_000_000
const intent = (o: Partial<SignedIntent> = {}): SignedIntent => ({
  action: 'send', fromWalletId: 'w_a', toWalletId: 'w_b', amount: 400,
  memo: 'for the deposit', nonce: 'n-1', atMs: NOW, ...o,
})

async function main() {
const pair = await webcrypto.subtle.generateKey(SIGNING_ALGORITHM, true, ['sign', 'verify'])
const other = await webcrypto.subtle.generateKey(SIGNING_ALGORITHM, true, ['sign', 'verify'])

const sign = async (i: SignedIntent, key = pair.privateKey): Promise<ArrayBuffer> =>
  webcrypto.subtle.sign(
    { name: 'ECDSA', hash: SIGNING_DIGEST }, key,
    new TextEncoder().encode(signingPayload(i)),
  )

const verify = async (i: SignedIntent, sig: ArrayBuffer, key = pair.publicKey): Promise<boolean> =>
  webcrypto.subtle.verify(
    { name: 'ECDSA', hash: SIGNING_DIGEST }, key, sig,
    new TextEncoder().encode(signingPayload(i)),
  )

console.log('\n── a real signature verifies, and only over what was signed ──')
{
  const sig = await sign(intent())
  check('an untouched intent verifies', await verify(intent(), sig))

  // EVERY FIELD AN ATTACKER WOULD WANT TO CHANGE. Each of these passing would
  // be a silent hole: correct maths, passing check, money elsewhere.
  const tamper: Array<[string, Partial<SignedIntent>]> = [
    ['the amount', { amount: 40_000 }],
    ['the destination', { toWalletId: 'w_attacker' }],
    ['the sender', { fromWalletId: 'w_someone_else' }],
    ['the action', { action: 'spend' }],
    ['the memo', { memo: 'something else' }],
    ['the nonce', { nonce: 'n-2' }],
    ['the time it was signed', { atMs: NOW + 1 }],
  ]
  for (const [name, patch] of tamper) {
    check(`changing ${name} breaks the signature`, !(await verify(intent(patch), sig)))
  }

  // A DIFFERENT KEY IS A DIFFERENT PERSON.
  check('somebody else\'s key does not verify it', !(await verify(intent(), sig, other.publicKey)))
  const theirs = await sign(intent(), other.privateKey)
  check('…and their signature does not verify against ours', !(await verify(intent(), theirs)))
}

console.log('\n── free text cannot pretend to be structure ──')
{
  // The same attack the chain's canonical form defends against: a memo crafted
  // to shift a field boundary so two different intents sign identically.
  const a = signingPayload(intent({ memo: 'x|w_c|', toWalletId: 'w_b' }))
  const b = signingPayload(intent({ memo: 'x', toWalletId: 'w_c||w_b' }))
  check('a crafted memo cannot forge a destination', a !== b)

  const left = signingPayload(intent({ memo: 'ab', nonce: 'c' }))
  const right = signingPayload(intent({ memo: 'a', nonce: 'bc' }))
  check('content cannot be shifted between two fields', left !== right)

  check('the format version is in the bytes',
    signingPayload(intent()).startsWith(SIGNING_FORMAT))

  // Key order in the object must not change the bytes — the same JSON.stringify
  // trap as the chain.
  const reordered = signingPayload({
    atMs: NOW, nonce: 'n-1', memo: 'for the deposit', amount: 400,
    toWalletId: 'w_b', fromWalletId: 'w_a', action: 'send',
  })
  check('key order cannot change the bytes', reordered === signingPayload(intent()))

  let threw = false
  try { signingPayload(intent({ amount: 1.5 })) } catch { threw = true }
  check('a fractional amount refuses to be signed', threw)
}

console.log('\n── a signature does not live forever ──')
{
  check('a fresh intent is good', checkFreshness({ atMs: NOW }, NOW).ok)
  check('…and one made a minute ago still is',
    checkFreshness({ atMs: NOW - 60_000 }, NOW).ok)

  const old = checkFreshness({ atMs: NOW - INTENT_TTL_MS - 1 }, NOW)
  check('past the window it is refused', !old.ok)
  check('…as expired', !old.ok && old.refusal === 'expired', old.ok ? '' : old.refusal)

  // A CLOCK RUNNING AHEAD MUST NOT MINT A LONG-LIVED SIGNATURE. Without this a
  // client simply lies about the time and its signature is valid for a year.
  const future = checkFreshness({ atMs: NOW + CLOCK_SKEW_MS + 1_000 }, NOW)
  check('a clock far ahead is refused', !future.ok)
  // A DIFFERENT ANSWER, deliberately: "try again" is wrong advice for a machine
  // that will keep signing badly.
  check('…and told so, rather than told to retry',
    !future.ok && future.refusal === 'fromTheFuture', future.ok ? '' : future.refusal)
  check('a little drift is forgiven', checkFreshness({ atMs: NOW + 5_000 }, NOW).ok)
  check('a nonsense timestamp is refused', !checkFreshness({ atMs: NaN }, NOW).ok)

  check('the window is short — money is decided in seconds',
    INTENT_TTL_MS <= 5 * 60_000, String(INTENT_TTL_MS))
}

console.log('\n── having a key means using it ──')
{
  // THE RULE THE WHOLE SCHEME RESTS ON. If an unsigned send still worked for
  // somebody who has a key, an attacker with a stolen cookie would simply not
  // sign, and every check above would be decoration.
  check('a holder with a key must sign', requiresSignature(true))
  // …and somebody who has never been offered a key is not locked out of their
  // own balance to enforce an upgrade they never saw.
  check('a holder with no key yet is not locked out', !requiresSignature(false))
}

console.log('\n── the server enforces what the module states ──')
{
  const code = (p: string): string =>
    readFileSync(join(process.cwd(), p), { encoding: 'utf8' })
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  const db = code('lib/freehold/wallet-signing-db.ts')

  /**
   * The body of one function.
   *
   * Ordering checks must be scoped: `freehold_signed_nonces` appears first in
   * the CREATE TABLE at the top of the file, so an indexOf over the whole
   * source compares the verification against the schema and answers a question
   * nobody asked.
   */
  const between = (from: string, to: string): string => {
    const a = db.indexOf(from)
    const b = db.indexOf(to)
    if (a < 0 || b < 0 || b <= a) throw new Error(`wallet-signing-test: cannot slice ${from} → ${to}`)
    return db.slice(a, b)
  }
  const verifyFn = between('export async function verifyIntent', 'export async function forgetOldNonces')

  check('the requirement comes from the shared rule, not a local if',
    /requiresSignature\(/.test(verifyFn))
  check('the sender is compared against the SESSION\'s wallet',
    /input\.intent\.fromWalletId !== input\.walletId/.test(db))
  check('…and refused as the wrong sender', /refusal: 'wrongSender'/.test(db))

  // THE NONCE IS SPENT AFTER THE SIGNATURE VERIFIES, so a bad signature cannot
  // burn a nonce the holder needs to retry with.
  check('the nonce is spent only after the signature verifies',
    verifyFn.indexOf('anyKeyVerifies(keys, payload') < verifyFn.indexOf('freehold_signed_nonces'))
  // …and the primary key IS the check, so two racing submissions cannot both
  // pass a read-then-write.
  check('replay is stopped by the database, not by a read',
    /ON CONFLICT \(nonce\) DO NOTHING RETURNING nonce/.test(db))

  // A SECOND KEY IS THE DANGEROUS ONE. Whoever stole a session would otherwise
  // enrol their own key and sign at will.
  check('a second key must be vouched for by an existing one',
    /needsExistingKey/.test(db) && /anyKeyVerifies\(existing/.test(db))
  check('…over the new public key itself, so a captured proof cannot be reused',
    /proof\.payload !== `enrol:\$\{input\.publicKey\}`/.test(db))
  check('one public key belongs to one person',
    /CREATE UNIQUE INDEX IF NOT EXISTS freehold_wallet_keys_pk_uidx/.test(db))
  // Revoking must work from a different device — the lost laptop is the case.
  check('revoking is authorised by the session, not by the lost key',
    /export async function revokeKey\(userId: string/.test(db))
}

console.log('\n── the vocabulary is walkable ──')
{
  for (const [name, list] of [
    ['signed actions', SIGNED_ACTIONS], ['refusals', SIGNATURE_REFUSALS],
  ] as const) {
    check(`${name} is a non-empty walkable list`,
      list.length > 0 && new Set(list).size === list.length)
  }
  check('the curve is named once and shared', SIGNING_ALGORITHM.namedCurve === 'P-256')
  check('a fingerprint shows the ends, which is what people compare',
    keyFingerprint('A'.repeat(40)).includes('…'))
  check('…and a short key is shown whole', keyFingerprint('abc') === 'abc')
}

if (failures > 0) {
  console.error(`\n${failures} signing rule(s) broken.`)
  process.exit(1)
}
console.log('\nA stolen session can read a balance and cannot spend it.\n')
}

main().catch((e) => {
  // A suite that cannot run must not report success — an unhandled rejection
  // would otherwise exit 0 and read as green.
  console.error('\nwallet-signing-test could not run:', e)
  process.exit(1)
})
