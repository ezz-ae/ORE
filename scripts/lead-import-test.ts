/**
 * Bringing a real lead list in without corrupting the CRM.
 *
 * The Data Pool strips contacts by design, and it was the only import — so a
 * brokerage's twenty thousand leads landed as statistics nobody could ring.
 * This is the missing half, and the failures that matter are the ones that
 * quietly damage a working queue:
 *
 *  · the same person imported twice, so two brokers call them
 *  · thousands of names with no phone and no email filling the queue with
 *    people nobody can reach
 *  · a re-run of the same file doubling everything
 *
 * Pure — no database. Runs in `pnpm guards`.
 */
import { readFileSync } from 'node:fs'
import {
  planLeadImport, normalisePhone, normaliseEmail, normaliseStatus, parseBudget,
} from '../lib/freehold/lead-import'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

console.log('\n── one person is one lead, however their number was typed ──')
{
  // The same buyer, four ways a real export writes them.
  const p = planLeadImport([
    { name: 'Sara', phone: '+971 50 123 4567' },
    { name: 'Sara A', phone: '0501234567' },
    { name: 'S. Ahmed', phone: '971501234567' },
    { name: 'Sara Ahmed', phone: '050 123 4567' },
  ])
  check('four spellings of one number collapse to one lead',
    p.leads.length === 1, `${p.leads.length} leads`)
  check('…and the rest are counted as duplicates, not lost silently',
    p.duplicatesInFile === 3, String(p.duplicatesInFile))
  check('a genuinely different number is a different person',
    planLeadImport([
      { name: 'A', phone: '0501234567' }, { name: 'B', phone: '0509999999' },
    ]).leads.length === 2)
  check('email dedupes when there is no phone',
    planLeadImport([
      { name: 'A', email: 'X@Mail.com ' }, { name: 'B', email: 'x@mail.com' },
    ]).leads.length === 1)
  check('phone identifies before email — a broker calls, they do not write',
    planLeadImport([{ name: 'A', phone: '0501234567', email: 'a@b.com' }]).leads[0].dedupeKey.startsWith('p:'))
}

console.log('\n── a name with no way to reach them is not a lead ──')
{
  // Importing these fills a queue with people nobody can call, which is how a
  // broker learns to stop trusting the queue.
  const p = planLeadImport([
    { name: 'Reachable', phone: '0501234567' },
    { name: 'No contact at all' },
    { name: 'Bad phone', phone: '12' },
    { name: 'Bad email', email: 'not-an-email' },
    {},
  ])
  check('only the contactable row becomes a lead', p.leads.length === 1, String(p.leads.length))
  check('the unreachable ones are COUNTED, not dropped in silence',
    p.unreachable === 3, String(p.unreachable))
  check('a wholly empty row is counted separately from an unreachable one',
    p.empty === 1, String(p.empty))
  check('a contactable row with no name still imports rather than being refused',
    planLeadImport([{ phone: '0501234567' }]).leads.length === 1)
  check('…and gets an honest placeholder rather than a blank',
    planLeadImport([{ phone: '0501234567' }]).leads[0].name.length > 0)
}

console.log('\n── their export\'s words become our statuses ──')
{
  check('a won deal is closed', normaliseStatus('Won') === 'closed')
  check('sold is closed too', normaliseStatus('SOLD') === 'closed')
  check('junk is lost', normaliseStatus('Junk') === 'lost')
  check('follow-up is contacted', normaliseStatus('Follow Up') === 'contacted')
  check('a status we store passes through', normaliseStatus('qualified') === 'qualified')
  // An unplaceable status must not lose the lead.
  check('anything unrecognised becomes new, never dropped',
    normaliseStatus('Zzz') === 'new' && normaliseStatus('') === 'new')
}

console.log('\n── money and contact parsing survive real files ──')
{
  check('a formatted budget parses', parseBudget('AED 2,500,000') === 2500000)
  check('an empty budget is null, not zero', parseBudget('') === null)
  check('a nonsense budget is null', parseBudget('n/a') === null)
  check('a short number is not a phone', normalisePhone('123') === '')
  check('an email with no dot in the domain is refused', normaliseEmail('a@b') === '')
  check('an ordinary address is accepted', normaliseEmail(' A@B.co ') === 'a@b.co')
}

console.log('\n── the numbers add up, so nothing can hide ──')
{
  const rows = [
    { name: 'A', phone: '0501111111' },
    { name: 'B', phone: '0501111111' },
    { name: 'C' },
    {},
    { name: 'D', email: 'd@x.com' },
  ]
  const p = planLeadImport(rows)
  check('every row is accounted for in exactly one bucket',
    p.leads.length + p.duplicatesInFile + p.unreachable + p.empty === rows.length,
    `${p.leads.length}+${p.duplicatesInFile}+${p.unreachable}+${p.empty} of ${rows.length}`)
  check('an empty file does not throw', planLeadImport([]).leads.length === 0)
}

console.log('\n── contacts are kept out of the anonymised pool ──')
{
  const PAGE = readFileSync('app/freehold-intelligence/settings/data/page.tsx', 'utf8')
  // The pool's whole promise is that no contact reaches it. The split must be
  // by an explicit allowlist, not by removing a few known-bad keys.
  check('the pool payload is built from POOL_FIELDS only',
    /POOL_FIELDS as readonly string\[\]\)\.includes\(k\)/.test(PAGE),
    'the pool rows are not filtered to an allowlist')
  check('contact fields are named separately from pool fields',
    /const CONTACT_FIELDS = \[/.test(PAGE) && /const POOL_FIELDS = \[/.test(PAGE))
  check('no contact field appears in the pool list',
    !/POOL_FIELDS = \[[^\]]*'(name|phone|email)'/.test(PAGE),
    'a contact column would be sent to the shared pool')
}

if (failures > 0) {
  console.error(`\n${failures} lead-import rule(s) broken.`)
  process.exit(1)
}
console.log('\nA real lead list can come in, once, reachable.\n')
