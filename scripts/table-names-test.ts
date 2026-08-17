/**
 * NO QUERY JOINS A TABLE CALLED `users` — locked.
 *
 * One join took the entire Bank off the screen:
 *
 *     LEFT JOIN users u ON u.id = w.user_id
 *
 * There is no `users` table in this schema — people live in
 * freehold_site_users. So listWithdrawals threw `relation "users" does not
 * exist`, GET /api/freehold/bank answered 500, and the Wallet page hid the
 * Bank tab entirely. A join added to fetch a display name removed a whole
 * feature, and the screen reported it as an absence.
 *
 * The key was wrong too: freehold_withdrawals.user_id holds personId(), a
 * LOWERCASED EMAIL. Correcting only the table name would have joined email
 * against id and shown every row with a blank name instead.
 *
 * ── WHY THIS SUITE IS NARROW ON PURPOSE ──────────────────────────────────
 *
 * The obvious guard is "every table named in SQL is a table this app
 * creates". I wrote it and threw it away: it cannot tell Postgres from
 * Google Ads GAQL (`FROM campaign`, `FROM ad_group` are valid there and are
 * not tables here), it trips over `UPDATE … SET`, `JOIN LATERAL` and
 * `FROM jsonb_array_elements(…)`, and proving the rest would need a real
 * schema dump rather than a text scan. A guard with false positives is a
 * guard somebody switches off, and then it protects nothing.
 *
 * So this checks the one name that actually shipped and is the most likely
 * to be reached for again. Narrow and true beats broad and noisy.
 *
 * Pure — reads source, no database. Runs in `pnpm guards`.
 */
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const files = execSync("git ls-files '*.ts'", { encoding: 'utf8' }).split('\n').filter(Boolean)

const offenders: string[] = []
let sawRealSql = false

for (const f of files) {
  if (f.startsWith('scripts/')) continue
  // Comments are prose. "read the rows FROM the ledger" is not a query.
  const src = readFileSync(f, { encoding: 'utf8' })
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

  for (const m of src.matchAll(/`([^`]*)`/g)) {
    const q = m[1]
    if (!/\b(SELECT|INSERT INTO|UPDATE|DELETE FROM)\b/i.test(q)) continue
    if (/freehold_site_users/.test(q)) sawRealSql = true
    // `users` as a whole word after FROM or JOIN, not freehold_site_users.
    for (const hit of q.matchAll(/\b(?:FROM|JOIN)\s+users\b/gi)) {
      offenders.push(`${f}: ${hit[0]}`)
    }
  }
}

console.log('\n── the join that took the Bank down ──')
{
  check('the scan reaches real SQL', sawRealSql,
    'no query mentioning freehold_site_users was found — the scanner is broken, not the code')
  check('no query selects FROM or JOINs a bare `users` table',
    offenders.length === 0,
    offenders.join(' · ') + ' — this schema has freehold_site_users, and its key is a lowercased email')
}

console.log('\n── and the withdraw join is keyed on what the column holds ──')
{
  const bank = readFileSync('lib/freehold/bank-db.ts', { encoding: 'utf8' })
  // personId() writes a lowercased email into user_id, so the join has to
  // compare against email. Joining on `u.id` is silently blank, not an error.
  check('withdrawals join freehold_site_users on the email',
    /LEFT JOIN freehold_site_users u ON lower\(u\.email\) = w\.user_id/.test(bank),
    'the display name will come back blank for every withdrawal')
  check('…and personId is still an email, which is why',
    /personId = \(u: \{ email: string \}\): string => u\.email\.trim\(\)\.toLowerCase\(\)/.test(bank))
}

if (failures > 0) {
  console.error(`\n${failures} table-name rule(s) broken.`)
  console.error('A query against a table that does not exist reaches production looking like a missing feature.')
  process.exit(1)
}
console.log('\nNo query asks this database for a table it does not have.\n')
