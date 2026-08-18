/**
 * EVERY MOVEMENT CARRIES A NAME AND A BENEFICIARY — locked.
 *
 * The ledger could already prove a movement happened and had not been edited
 * since. It could not answer the question a finance team actually asks about a
 * payment: WHO AUTHORISED THIS ONE, and who was it for. `actor` on a posting is
 * the account that made the API call — an audit trail, not a signature.
 *
 * Four rules, and each one is a way this could rot back into decoration:
 *
 *   1. WHAT YOU SEE IS WHAT YOU SIGN. The sentence and the digest are built
 *      from the SAME fields. A screen showing one thing and recording another
 *      is worse than no signature at all, because it carries a name against
 *      terms nobody agreed to.
 *   2. THE DIGEST COVERS EVERYTHING THAT MATTERS. Any field a person would
 *      care about — amount, both accounts, the beneficiary's name, the signer,
 *      the moment — changes the digest when it changes. A field left out of the
 *      canonical form is a field somebody can alter afterwards for free.
 *   3. YOU SIGN FOR YOUR OWN MONEY. The bank is the single exception, and only
 *      for an admin, because cash in the bank belongs to nobody until somebody
 *      puts their name on it.
 *   4. IT IS AN ATTESTATION, AND SAYS SO. There is no key pair. The copy must
 *      never imply one — a guarantee this design does not deliver is worse
 *      than the honest, narrower one it does.
 *
 * Pure — no I/O. Runs in `pnpm guards`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import {
  canonicalSignature, digest, statement, signatureHolds, maySign,
  isSystemSignature, SIGNED_ACTIONS, SIGNATURE_FORMAT, SYSTEM_SIGNER,
  type SignatureIntent,
} from '../lib/freehold/signature'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const code = (p: string): string =>
  readFileSync(join(process.cwd(), p), { encoding: 'utf8' })
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

const h = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex')

const BASE: SignatureIntent = {
  action: 'send',
  amount: 5000,
  fromWalletId: 'w_u_ahmed@example.com',
  beneficiary: { walletId: 'w_u_sara@example.com', label: 'Sara Haddad', accountNo: 'FHBRK-000012' },
  signerId: 'ahmed@example.com',
  signerName: 'Ahmed Nasser',
  atMs: 1_755_000_000_000,
}

console.log('\n── the digest covers every term a person would argue about ──')
{
  const base = digest(h, BASE)
  // Each of these is a field somebody could be cheated on. If changing it
  // leaves the digest alone, it can be changed after the fact for free.
  const variants: Array<[string, SignatureIntent]> = [
    ['the amount', { ...BASE, amount: 50_000 }],
    ['the paying account', { ...BASE, fromWalletId: 'w_u_someone@example.com' }],
    ['the beneficiary account', { ...BASE, beneficiary: { ...BASE.beneficiary, walletId: 'w_u_other@example.com' } }],
    ['the beneficiary NAME', { ...BASE, beneficiary: { ...BASE.beneficiary, label: 'Someone Else' } }],
    ['the beneficiary account number', { ...BASE, beneficiary: { ...BASE.beneficiary, accountNo: 'FHBRK-000099' } }],
    ['the signer', { ...BASE, signerId: 'someone@example.com' }],
    ['the signer\'s name', { ...BASE, signerName: 'Someone Else' }],
    ['the moment', { ...BASE, atMs: BASE.atMs + 1 }],
    ['what was being signed for', { ...BASE, action: 'move' }],
  ]
  for (const [what, v] of variants) {
    check(`changing ${what} changes the signature`, digest(h, v) !== base,
      'this field can be altered after signing with no trace')
  }
  check('…and signing the same terms twice is the same signature',
    digest(h, { ...BASE }) === base)
}

console.log('\n── a signature detects the one thing it exists to detect ──')
{
  const sig = digest(h, BASE)
  check('unchanged terms still hold', signatureHolds(h, BASE, sig))
  check('a changed amount does not', !signatureHolds(h, { ...BASE, amount: 6000 }, sig),
    'the record could be rewritten and still read as signed')
}

console.log('\n── the canonical form cannot be shifted by its own content ──')
{
  // FREE TEXT IS LENGTH-PREFIXED. Without it a beneficiary named with the
  // separator in it could move a field boundary and collide with a different
  // movement — the same reasoning as ledger-chain.ts, and the same fix.
  const sneaky: SignatureIntent = {
    ...BASE,
    beneficiary: { ...BASE.beneficiary, label: 'Sara|w_u_thief@example.com|FHBRK-000099' },
  }
  check('a beneficiary name containing the separator does not forge a field',
    digest(h, sneaky) !== digest(h, {
      ...BASE,
      beneficiary: { walletId: 'w_u_thief@example.com', label: 'Sara', accountNo: 'FHBRK-000099' },
    }))
  check('…because free text carries its byte length',
    /const bytes = new TextEncoder\(\)\.encode\(text\)\.length/.test(code('lib/freehold/signature.ts')))
  check('the format is stamped into what is hashed',
    canonicalSignature(BASE).startsWith(SIGNATURE_FORMAT))

  // A NON-INTEGER AMOUNT CANNOT BE HASHED HONESTLY, so it is refused rather
  // than coerced — a coerced amount would sign as though it were clean.
  let threw = false
  try { digest(h, { ...BASE, amount: 12.5 }) } catch { threw = true }
  check('a fractional amount is refused, never rounded into a signature', threw,
    'a non-integer amount would be silently coerced and signed')
}

console.log('\n── what you see is what you sign ──')
{
  const line = statement(BASE)
  check('the sentence names the signer', line.includes('Ahmed Nasser'), line)
  check('…the amount', line.includes('5,000'), line)
  check('…and the beneficiary by name AND account', 
    line.includes('Sara Haddad') && line.includes('FHBRK-000012'), line)

  // EVERY ACTION HAS A SENTENCE. A missing one renders as `undefined` on a
  // receipt, which is how a signature stops being read at all.
  for (const action of SIGNED_ACTIONS) {
    const s = statement({ ...BASE, action })
    check(`"${action}" has a sentence of its own`, !!s && !s.includes('undefined'), s)
  }

  // The module holds no translations on purpose: a record that reads
  // differently depending on today's language setting is not a record.
  check('the module keeps one stored wording, not a translated one',
    !/from '@\/lib\/i18n|useT\(/.test(code('lib/freehold/signature.ts')),
    'the stored statement would change with the reader\'s language')
}

console.log('\n── you sign for your own money, and the bank is the exception ──')
{
  const BANK = 'w_bank'
  const mine = { userId: 'a@x.com', walletId: 'w_u_a@x.com', isAdmin: false }
  const admin = { userId: 'b@x.com', walletId: 'w_u_b@x.com', isAdmin: true }

  check('your own wallet: yes',
    maySign(mine, { fromWalletId: 'w_u_a@x.com', bankWalletId: BANK }).ok)
  check('somebody else\'s wallet: never, admin or not',
    !maySign(mine, { fromWalletId: 'w_u_c@x.com', bankWalletId: BANK }).ok
      && !maySign(admin, { fromWalletId: 'w_u_c@x.com', bankWalletId: BANK }).ok,
    'an admin could sign money out of somebody else\'s account')
  check('the bank: an admin may',
    maySign(admin, { fromWalletId: BANK, bankWalletId: BANK }).ok)
  check('…and nobody else',
    !maySign(mine, { fromWalletId: BANK, bankWalletId: BANK }).ok)
  check('somebody with no wallet at all signs nothing',
    !maySign({ userId: 'c@x.com', walletId: null, isAdmin: false },
      { fromWalletId: 'w_u_c@x.com', bankWalletId: BANK }).ok)

  // The refusal says WHICH of the two it was. "You cannot sign this" sends
  // somebody to ask why; "this is not your account" is already the answer.
  const r = maySign(mine, { fromWalletId: BANK, bankWalletId: BANK })
  check('a refusal names its reason', !r.ok && r.refusal === 'notAdmin', JSON.stringify(r))
}

console.log('\n── the machine signs too, and says that it is a machine ──')
{
  const auto: SignatureIntent = {
    ...BASE, action: 'spend', signerId: SYSTEM_SIGNER, signerName: 'System',
    authority: 'Wallet attached to campaign 120251276961280734',
  }
  check('an automatic movement is recognisable as one', isSystemSignature(auto))
  const line = statement(auto)
  // NEVER PHRASED AS A PERSON'S PROMISE. A machine cannot promise anything,
  // and dressing an automatic debit in the first person produces a signature
  // nobody can be held to.
  check('…and its sentence is not written in the first person',
    !line.startsWith('I,'), line)
  check('…and it names what allowed it',
    line.includes('120251276961280734'), line)
  check('the authority is part of what is signed',
    digest(h, auto) !== digest(h, { ...auto, authority: 'something else' }),
    'the stated authority could be swapped after the fact')
}

console.log('\n── the claim stays as narrow as the design ──')
{
  const src = readFileSync(join(process.cwd(), 'lib/freehold/signature.ts'), 'utf8')
  // Said in the header AND in the copy, because the word "signature" invites a
  // stronger claim than this makes.
  check('the module says plainly that this is not public-key cryptography',
    /NOT PUBLIC-KEY CRYPTOGRAPHY/.test(src),
    'the header no longer disclaims the stronger guarantee')
  // Comments stripped — this is about what the SCREEN says, and the file's own
  // reasoning about what not to claim would otherwise trip the check.
  const en = code('lib/i18n/dictionaries/wallet.ts')
  check('…and the screen claims only what it can prove',
    /proves the terms were not changed after you agreed them/.test(en),
    'the signing copy no longer states what it actually guarantees')
  check('…and never promises a private key',
    !/private key|key pair|cryptographically signed/i.test(en))
}

console.log('\n── every movement in the bank is signed ──')
{
  const bankDb = code('lib/freehold/bank-db.ts')
  // ONE HELPER, called from every path that posts. Signing inline in five
  // places is five chances for the sixth to be forgotten.
  check('there is one signing helper', /async function sign\(input: \{/.test(bankDb))
  check('…and it runs AFTER the money, never before',
    /if \(!posted\.ok\) return fromLedger\(posted\.refusal\)\s*\n\s*await sign\(/.test(bankDb),
    'a signature could be recorded for a transfer that then failed')

  for (const fn of ['send', 'move', 'mint', 'burn', 'spend']) {
    check(`${fn} is signed`, new RegExp(`action: '${fn}'`).test(bankDb),
      `a ${fn} would post with nobody's name on it`)
  }

  // Keyed on the movement's own idempotency reference, so a retry signs once
  // and the FIRST signature stands.
  const sigDb = code('lib/freehold/signature-db.ts')
  check('a signature is keyed on the movement it belongs to',
    /reference      text PRIMARY KEY/.test(sigDb))
  check('…and a retry never overwrites what was agreed',
    /ON CONFLICT \(reference\) DO NOTHING/.test(sigDb),
    'a second call could quietly replace the terms somebody signed')
  check('the terms are stored field by field, not only hashed',
    /amount         bigint/.test(sigDb) && /to_label       text/.test(sigDb),
    'nobody could re-derive what was signed in order to check it')
  check('…and every read recomputes the digest',
    /holds: \(\(\) =>/.test(sigDb),
    'a signature nobody checks is decoration')
}

if (failures > 0) {
  console.error(`\n${failures} signature rule(s) broken.`)
  console.error('A movement with no name against it is a movement nobody is answerable for.')
  process.exit(1)
}
console.log('\nEvery movement names who signed it, for whom, and on what terms.\n')
