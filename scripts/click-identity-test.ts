/**
 * THE HANDLE THAT LETS THE CRM TALK BACK — locked.
 *
 * The CRM already talks back to Meta: a qualified lead and a closed deal go out
 * through lead-writeback, the value-based lookalike is built from closed
 * buyers, the exclusion from the ones brokers rejected. That loop is the most
 * valuable thing in this product.
 *
 * It had three breaks, and this suite locks the one that cannot be repaired
 * later:
 *
 *   1. NOTHING went back to Google. Its bidding optimised on form fills it
 *      could not tell apart, while the CRM two tables away knew which became a
 *      three-million-dirham deal.
 *   2. And an upload could not have been added, because Google only accepts an
 *      outcome against a click identifier — gclid / gbraid / wbraid — and this
 *      product captured none of the three. Not in the tracking template, not on
 *      the landing form, not in the leads table.
 *   3. Meta's `_fbc` was read at submission, spent on one Lead event and
 *      dropped, so the events that matter went out identified by a hashed email
 *      and phone alone.
 *
 * A deal value typed in next month still teaches Meta something. A click
 * identifier cannot be backfilled: it exists for one visit, and a visit that
 * ended without it written down is gone.
 *
 * Pure — reads source, no network. Runs in `pnpm guards`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CLICK_ID_PARAMS, CLICK_ID_CHANNEL, CLICK_ID_VALID_DAYS, GOOGLE_CLICK_TRACKING,
  EMPTY_IDENTITY, fbcFrom, readClickIdentity, canReportBack, withinUploadWindow,
} from '../lib/freehold/click-identity'
import { buildQualifiedLeadEvent } from '../lib/meta/capi'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const read = (p: string) => readFileSync(join(process.cwd(), p), { encoding: 'utf8' })
const code = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

const NOW = Date.UTC(2026, 7, 13, 12, 0, 0)

console.log('\n── what a visit can prove about where it came from ──')
{
  const g = readClickIdentity({ gclid: 'Cj0KEQ' }, {}, NOW)
  check('a Google click is captured', g.googleClickId === 'Cj0KEQ', String(g.googleClickId))
  check('…and the upload knows which field carried it',
    g.googleClickIdKind === 'gclid', String(g.googleClickIdKind))

  // gbraid and wbraid exist for traffic where gclid cannot be set. Dropping
  // them would silently lose every iOS and app click.
  check('an app click is captured too',
    readClickIdentity({ gbraid: 'AAA' }, {}, NOW).googleClickIdKind === 'gbraid')
  check('…and a web-to-app one', readClickIdentity({ wbraid: 'BBB' }, {}, NOW).googleClickIdKind === 'wbraid')
  check('gclid wins when more than one arrives',
    readClickIdentity({ gclid: 'G', gbraid: 'A' }, {}, NOW).googleClickIdKind === 'gclid')

  // A MISSING VALUE IS NULL, NEVER AN EMPTY STRING. An empty string in a
  // column reads as "we captured nothing here", which is indistinguishable
  // from "we never looked", and those are different failures.
  const none = readClickIdentity({}, {}, NOW)
  check('nothing captured is null, not an empty string',
    none.googleClickId === null && none.fbc === null && none.fbp === null,
    JSON.stringify(none))
  check('…and whitespace is nothing', readClickIdentity({ gclid: '   ' }, {}, NOW).googleClickId === null)
  check('the empty identity is the same shape', EMPTY_IDENTITY.googleClickId === null)
}

console.log('\n── Meta\'s cookie, and the visit where the pixel had not run ──')
{
  const withCookie = readClickIdentity({ fbclid: 'RAW' }, { _fbc: 'fb.1.111.COOKIE', _fbp: 'fb.1.222.333' }, NOW)
  check('the cookie is preferred — it is what the pixel wrote',
    withCookie.fbc === 'fb.1.111.COOKIE', String(withCookie.fbc))
  check('…and the browser id comes with it', withCookie.fbp === 'fb.1.222.333')

  // THE AD-BLOCKER VISIT. The pixel never ran, so there is no cookie — and
  // the raw parameter is sitting in the address bar. Meta documents the
  // format; rebuilding it is what its own pixel does.
  const rebuilt = readClickIdentity({ fbclid: 'RAW' }, {}, NOW)
  check('no cookie falls back to the raw parameter',
    rebuilt.fbc === `fb.1.${NOW}.RAW`, String(rebuilt.fbc))
  check('…in the format Meta specifies', /^fb\.1\.\d+\.RAW$/.test(rebuilt.fbc ?? ''))
  check('a rebuild needs a real timestamp', fbcFrom('RAW', 0) === null && fbcFrom('RAW', NaN) === null)
  check('…and a real id', fbcFrom('  ', NOW) === null)

  check('a visit with neither can report nothing back', !canReportBack(EMPTY_IDENTITY))
  check('…a Google click alone is enough',
    canReportBack(readClickIdentity({ gclid: 'G' }, {}, NOW)))
  check('…and a Meta cookie alone is enough',
    canReportBack(readClickIdentity({}, { _fbc: 'fb.1.1.X' }, NOW)))
}

console.log('\n── the window the platform will actually accept ──')
{
  const now = new Date('2026-08-13T12:00:00Z')
  check('a lead from last week can still be reported',
    withinUploadWindow('2026-08-06T12:00:00Z', now))
  // OUTSIDE THE WINDOW IS REFUSED HERE rather than sent and dropped. A queue
  // full of events the platform threw away looks exactly like one that works.
  check('one from six months ago cannot', !withinUploadWindow('2026-02-01T12:00:00Z', now))
  check(`the window is ${CLICK_ID_VALID_DAYS} days`, CLICK_ID_VALID_DAYS === 90)
  check('a lead with no date is not reportable', !withinUploadWindow(null, now))
  check('…nor a broken one', !withinUploadWindow('not a date', now))
  // A lead dated in the future is a clock problem, not a fresh click.
  check('a future date is not "very fresh"', !withinUploadWindow('2026-09-01T12:00:00Z', now))
}

console.log('\n── the ad has to ASK for the click id ──')
{
  // Auto-tagging puts a gclid on the landing URL only when it is switched on
  // in the account, and that is a setting nobody in this product can see.
  for (const p of ['gclid', 'gbraid', 'wbraid']) {
    check(`the tracking template requests ${p}`, GOOGLE_CLICK_TRACKING.includes(`${p}={${p}}`),
      GOOGLE_CLICK_TRACKING)
  }
  const client = code('lib/google/client.ts')
  check('…and every launched Google campaign carries it',
    /trackingUrlTemplate:[\s\S]{0,300}GOOGLE_CLICK_TRACKING/.test(client),
    'the template does not include the click tracking')
  check('the utm tags are still there — attribution must not regress',
    /utm_source=google[\s\S]{0,120}utm_id=\{campaignid\}/.test(client))
}

console.log('\n── it is captured, stored, and read back ──')
{
  const form = code('components/lp/lead-capture-form.tsx')
  for (const p of ['gclid', 'gbraid', 'wbraid', 'fbclid']) {
    check(`the landing form reads ${p}`, form.includes(`params.get("${p}")`), 'not read')
  }
  check('…and posts them with the lead', /click,/.test(form))

  const route = code('app/api/leads/route.ts')
  check('the lead row has somewhere to keep them',
    /google_click_id text/.test(route) && /meta_fbc text/.test(route))
  check('…and the insert actually writes them',
    /google_click_id, google_click_kind, meta_fbc, meta_fbp/.test(route))
  check('the identity is read through the one rule, not re-parsed inline',
    /readClickIdentity\(/.test(route))

  // THE HALF THAT WAS MISSING. The cookie was read at submission and spent on
  // one event; the outcome events fire weeks later.
  const wb = code('lib/freehold/lead-writeback.ts')
  check('the write-back SELECTS the stored cookie', /meta_fbc, meta_fbp/.test(wb))
  check('…and sends it with the outcome', /fbc: lead\.meta_fbc/.test(wb))
}

console.log('\n── the event still refuses to be unidentifiable ──')
{
  const base = { eventId: 'e1', stage: 'won' as const, valueAED: 3_000_000 }
  check('an event with nothing to match on is not sent',
    buildQualifiedLeadEvent({ ...base }) === null)
  check('…and an external id alone is still nothing',
    buildQualifiedLeadEvent({ ...base, externalId: 'lead-1' }) === null)

  // A CLICK COOKIE DOES identify somebody, so it is a match key.
  const byCookie = buildQualifiedLeadEvent({ ...base, fbc: 'fb.1.111.ABC' })
  check('a click cookie alone is enough to send', byCookie !== null)
  const ud = (byCookie?.user_data ?? {}) as Record<string, unknown>
  check('…and it goes out UNHASHED, because Meta matches it by equality',
    ud.fbc === 'fb.1.111.ABC', String(ud.fbc))

  // The email and phone must still be hashed — a raw one reaching Meta is a
  // privacy failure no retry logic repairs afterwards.
  const full = buildQualifiedLeadEvent({
    ...base, email: 'Buyer@Example.com', phone: '+971501234567', fbc: 'fb.1.1.X',
  })
  const fd = (full?.user_data ?? {}) as Record<string, string[]>
  check('the email is hashed', Array.isArray(fd.em) && /^[a-f0-9]{64}$/.test(fd.em[0]))
  check('the phone is hashed', Array.isArray(fd.ph) && /^[a-f0-9]{64}$/.test(fd.ph[0]))
  check('…and neither appears in the clear anywhere in the body',
    !JSON.stringify(full).toLowerCase().includes('buyer@example.com')
    && !JSON.stringify(full).includes('501234567'))
}

console.log('\n── the walkable lists ──')
{
  check('every click parameter names its channel',
    CLICK_ID_PARAMS.every((p) => !!CLICK_ID_CHANNEL[p]), CLICK_ID_PARAMS.join(','))
  check('both channels are represented',
    new Set(Object.values(CLICK_ID_CHANNEL)).size === 2)
}

if (failures > 0) {
  console.error(`\n${failures} click-identity rule(s) broken.`)
  process.exit(1)
}
console.log('\nThe handle that lets the CRM talk back is captured, kept, and used.\n')
