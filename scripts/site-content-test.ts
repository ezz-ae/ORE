/**
 * The public site's editable words — the contract, locked.
 *
 * The field registry is what makes "edit any website content" safe: the
 * editor renders from it, the API validates against it, and the public pages
 * read only registered keys. These assertions hold the registry to the shape
 * the whole loop depends on.
 *
 * What is NOT tested here: the DB read/write (needs Postgres) and the JSX
 * fallbacks (needs a render). The rule they implement is asserted where it
 * lives — an override only ever REPLACES text, so an empty store renders the
 * site exactly as built. This suite guards the contract that keeps that true:
 * no duplicate keys, no unregistered pages, no field without a label.
 *
 * Pure — no model, no database, no network. Runs in `pnpm guards`.
 */
import { PAGE_CONTENT_FIELDS, CONTENT_PAGES } from '../lib/freehold/site-content'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

console.log('\n── the registry is the contract ──')
{
  check('every page the editor lists exists in the registry',
    CONTENT_PAGES.every((p) => Array.isArray(PAGE_CONTENT_FIELDS[p]) && PAGE_CONTENT_FIELDS[p].length > 0),
    CONTENT_PAGES.join(','))
  check('the four public pages are all editable',
    ['home', 'about', 'services', 'contact'].every((p) => CONTENT_PAGES.includes(p)),
    CONTENT_PAGES.join(','))

  for (const page of CONTENT_PAGES) {
    const fields = PAGE_CONTENT_FIELDS[page]
    const keys = fields.map((f) => f.key)
    check(`${page}: no duplicate field keys`, new Set(keys).size === keys.length, keys.join(','))
    check(`${page}: every field has a label and a kind`,
      fields.every((f) => f.label.trim().length > 0 && (f.kind === 'text' || f.kind === 'textarea')),
      JSON.stringify(fields))
  }

  // The contact page carries the facts that were previously hardcoded in
  // FOUR files with two disagreeing opening-hours values. They must stay
  // editable, or the disagreement comes back as a deploy-time fact.
  const contact = PAGE_CONTENT_FIELDS.contact.map((f) => f.key)
  check('contact page edits the address, the hours and the RERA number',
    ['address', 'hours', 'rera'].every((k) => contact.includes(k)), contact.join(','))
}

if (failures > 0) {
  console.error(`\n${failures} site-content rule(s) broken.`)
  process.exit(1)
}
console.log('\nThe website\'s words belong to the operator now.\n')
