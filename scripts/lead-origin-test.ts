/**
 * A LEAD IS IDENTIFIED BY A NAME, NEVER BY A NUMBER — locked.
 *
 * The CRM printed `meta_form:120251276961280734` where it meant to say where
 * a lead came from. Unreadable on its own — and useless in exactly the case
 * this account runs: two ads inside one campaign, a different lead form on
 * each, done that way deliberately so the two ads do not bid against each
 * other. The campaign name then describes both leads equally; the form name
 * and the ad name are the only things that tell them apart, and they were the
 * two things no screen showed.
 *
 * Three rules, and all three have already been broken once:
 *
 *   1. NO ID IS EVER PRINTED AS A LABEL. Not as a fallback, not truncated,
 *      not "better than nothing". A reader can do nothing with the number, and
 *      showing it implies somebody chose it.
 *   2. THE NAMES ARE STORED AT SYNC, NOT RESOLVED AT RENDER. A name fetched
 *      when a screen draws is a Meta call per page load, and it vanishes the
 *      day the form is deleted. The lead outlives the form.
 *   3. EVERY SCREEN AGREES. The origin appeared on six CRM surfaces reading
 *      the same field; five of them rendered it raw. One label function, or
 *      the fix decays back to an id on whichever screen is edited next.
 *
 * Pure — no database, no network. Runs in `pnpm guards`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { dbLeadToCRM } from '../lib/freehold/crm-row'
import { leadOriginLabel, originIsUnnamed } from '../lib/freehold/lead-origin'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const between = (src: string, from: string, to: string): string => {
  const a = src.indexOf(from)
  const b = src.indexOf(to)
  if (a < 0 || b < 0 || b <= a) throw new Error(`lead-origin-test: cannot slice ${from} → ${to}`)
  return src.slice(a, b)
}

const code = (p: string): string =>
  readFileSync(join(process.cwd(), p), { encoding: 'utf8' })
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

const FORM_ID = 'meta_form:120251276961280734'
const FALLBACK = 'Instant form'

console.log('\n── two ads in one campaign are told apart ──')
{
  // THE CASE THE WHOLE FILE EXISTS FOR. Same campaign, same day, two leads —
  // and until the names shipped, the two rows were indistinguishable.
  const a = leadOriginLabel({ source: FORM_ID, formName: 'Jul26 | cashoffer | (B)', adName: '77 Shades' }, FALLBACK)
  const b = leadOriginLabel({ source: FORM_ID, formName: 'Jul26 | payment plan', adName: 'Reportage TH' }, FALLBACK)
  check('the form and the ad both appear', a === 'Jul26 | cashoffer | (B) · 77 Shades', a)
  check('…and two leads on one campaign read differently', a !== b, `${a} / ${b}`)

  // FORM FIRST. The form is the offer the person actually answered; the ad is
  // which creative carried them to it.
  check('the form leads the sentence', a.startsWith('Jul26 | cashoffer'), a)
}

console.log('\n── an id is never a label ──')
{
  const idOnly = leadOriginLabel({ source: FORM_ID }, FALLBACK)
  check('a form with no name resolved yet says what KIND it is', idOnly === FALLBACK, idOnly)
  check('…and the number appears nowhere in it', !idOnly.includes('120251276961280734'), idOnly)

  // A HALF-KNOWN ORIGIN STILL BEATS A NUMBER. An ad name with no form name
  // says which creative this person answered, which is real information.
  const adOnly = leadOriginLabel({ source: FORM_ID, adName: '77 Shades' }, FALLBACK)
  check('an ad name alone is used rather than falling back', adOnly === '77 Shades', adOnly)
  const formOnly = leadOriginLabel({ source: FORM_ID, formName: 'cashoffer B' }, FALLBACK)
  check('…and so is a form name alone', formOnly === 'cashoffer B', formOnly)

  // WHITESPACE IS NOT A NAME. Meta returns '' for a form whose name was never
  // set; a blank rendered as a label is a row that looks broken.
  const blank = leadOriginLabel({ source: FORM_ID, formName: '   ', adName: '' }, FALLBACK)
  check('a blank name is not a name', blank === FALLBACK, JSON.stringify(blank))
}

console.log('\n── a source that was already readable is left alone ──')
{
  // Not every lead comes from Meta. `direct` and `lp:penthouse-collection` are
  // human-readable as they stand and were never the complaint.
  check('a direct lead still says direct',
    leadOriginLabel({ source: 'direct' }, FALLBACK) === 'direct')
  check('a landing-page source is passed through',
    leadOriginLabel({ source: 'lp:penthouse-collection' }, FALLBACK) === 'lp:penthouse-collection')
  check('an empty source falls back rather than rendering nothing',
    leadOriginLabel({ source: '' }, FALLBACK) === FALLBACK)
  check('a missing source falls back too',
    leadOriginLabel({}, FALLBACK) === FALLBACK)

  // The caller decides what "no name" says, because the caller has the reader's
  // language. This module holds no English.
  check('the fallback is the caller\'s, not this module\'s',
    leadOriginLabel({ source: FORM_ID }, 'نموذج فوري') === 'نموذج فوري')
}

console.log('\n── the unnamed state is nameable, so the sync can repair it ──')
{
  check('an id-only origin is reported unnamed', originIsUnnamed({ source: FORM_ID }))
  check('…a named one is not', !originIsUnnamed({ source: FORM_ID, formName: 'cashoffer B' }))
  check('…and an ad name alone counts as named', !originIsUnnamed({ adName: '77 Shades' }))
}

console.log('\n── the names are written at sync, and old rows are repaired ──')
{
  const sync = code('lib/freehold/meta-lead-sync.ts')

  // RULE 2. Resolved once, on arrival, and stored — not looked up on render.
  check('the columns exist', /meta_form_name text/.test(sync) && /meta_ad_name text/.test(sync))
  check('the form name comes in as an argument, not from a per-render lookup',
    /formName\?: string \| null/.test(sync))
  check('ad names are resolved once per batch, not once per lead',
    /namesByIds\(leads\.map/.test(sync),
    'a per-lead lookup means one Meta call per lead on every sweep')
  check('both names are written on insert',
    /meta_form_name, meta_ad_name/.test(sync))

  // THE ROWS THAT ALREADY EXIST. Without the backfill the fix would only ever
  // apply to leads that have not arrived yet — and the 247 leads somebody is
  // looking at today would show a number forever.
  check('existing rows are backfilled by the sweep',
    /SET meta_form_name = COALESCE\(meta_form_name/.test(sync),
    'only new leads would ever get a name')
  check('…with COALESCE, so a later blank never erases a name we have',
    /meta_ad_name   = COALESCE\(meta_ad_name/.test(sync))
  check('the sweep passes the form its name', /syncLeadsToCrm\(form\.id, leads, form\.name\)/.test(sync))

  // A PARTIAL ANSWER IS WORSE THAN NONE. A batched name lookup that half-fails
  // would silently mislabel leads with somebody else's ad — the same failure
  // mode as the positional matching that once renamed two live interests to
  // "Beauty" (scripts/targeting-validity-test.ts).
  const client = code('lib/meta/client.ts')
  check('the ad-name lookup keys answers by the id Meta returned',
    /export async function namesByIds/.test(client) && /out\.set\(String\(\w+\.id\)/.test(client),
    'names are being paired with ads by position or by request order')
  check('…and never by the position of the id we asked about',
    !/batch\[i\]|unique\[i\]/.test(between(client, 'export async function namesByIds', 'export async function listAds')),
    'a short or reordered answer would hang somebody else\'s ad name on this lead')
}

console.log('\n── every CRM surface says it the same way ──')
{
  // RULE 3. Six surfaces read the same field. The label function is the only
  // thing keeping them from disagreeing, so each one must actually call it.
  const surfaces = [
    'app/freehold-intelligence/crm/page.tsx',
    'app/freehold-intelligence/crm/leads/[id]/page.tsx',
    'app/freehold-intelligence/crm/follow-up/page.tsx',
    'app/freehold-intelligence/crm/pipeline/page.tsx',
    'app/freehold-intelligence/crm/assignment/page.tsx',
    'app/freehold-intelligence/crm/inbox/page.tsx',
    'app/freehold-intelligence/crm/duplicates/page.tsx',
  ]
  for (const p of surfaces) {
    const src = code(p)
    const viaRow = /formName=\{/.test(src) // the list delegates to LeadSource
    check(`${p.replace('app/freehold-intelligence/crm/', '')} labels the origin`,
      /leadOriginLabel\(/.test(src) || viaRow,
      'this screen still renders the raw source string, ids and all')
    // NOT the render expression — four of these screens map the live lead into
    // a local shape whose field is also called `source`, and by then it holds
    // the label. The rule is that the LIVE lead's raw source never survives
    // that mapping: `source: l.source` is the shape of the bug.
    check(`  …and never copies the raw source across`,
      !/source:\s*l\.source\b/.test(src),
      'the raw `meta_form:120251…` is being carried into the screen again')
  }

  // THE ROW ITSELF. LeadSource is where the list shows it.
  const row = code('components/freehold/lead-row-actions.tsx')
  check('the lead row renders the origin from the names',
    /leadOriginLabel\(\{ formName, adName \}/.test(row))
  check('…and passes an EMPTY fallback, so an unnamed row shows no line at all',
    /leadOriginLabel\(\{ formName, adName \}, ''\)/.test(row),
    'the row would print a generic word on every unnamed lead — furniture the eye stops reading')

  // THE SERVER HAS TO SEND THEM, or every screen above silently shows nothing.
  const api = code('app/api/freehold/crm/leads/route.ts')
  check('the list API selects both names', /meta_form_name, meta_ad_name/.test(api))
  // ASSERTED BY RUNNING THE MAPPER, not by grepping for the assignment. This
  // check was pinned to the route file and broke the day the mapper moved to
  // lib/freehold/crm-row.ts — with the behaviour completely intact. A guard
  // that fails on a refactor and passes on a regression is worse than none.
  const mapped = dbLeadToCRM({
    id: 'l1', name: 'A', phone: '+971500000001', email: null, source: 'meta',
    project_slug: null, assigned_broker_id: null, status: 'new', priority: 'warm',
    created_at: new Date().toISOString(), last_contact_at: null, country: null,
    budget_aed: null, interest: null, message: null, landing_slug: null,
    updated_at: null, snooze_until: null, lead_code: null,
    duplicate_dismissed_at: null, utm_id: null, utm_campaign: null,
    value_rating: null, behaviour_score: null,
    meta_ad_id: '120', meta_form_name: 'Cash offer B', meta_ad_name: 'Volta static 3',
    archived: false, blocked: false,
  })
  check('…and returns them on the lead',
    mapped.formName === 'Cash offer B' && mapped.adName === 'Volta static 3',
    `${mapped.formName} / ${mapped.adName}`)
  check('…and adds the columns first, so a workspace read before its first sync still lists leads',
    /ADD COLUMN IF NOT EXISTS meta_form_name text/.test(api))

  // SEARCHABLE. "Show me the leads from cashoffer B" is a question about a
  // form, and it was unanswerable while the name was never on the row.
  const list = code('app/freehold-intelligence/crm/page.tsx')
  check('the form and ad names are searchable', /l\.formName \?\? ''/.test(list))
}

if (failures > 0) {
  console.error(`\n${failures} lead-origin rule(s) broken.`)
  console.error('A lead identified by a number is a lead nobody can talk about.')
  process.exit(1)
}
console.log('\nEvery lead says which form and which ad brought it, in words.\n')
