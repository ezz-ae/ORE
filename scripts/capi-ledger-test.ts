/**
 * WHAT WE TOLD META, AND WHAT META SAID BACK — locked.
 *
 * The sender was already careful: deterministic event ids, a stage guard
 * written before the send, hashed PII, `lead_id` so the outcome lands on the
 * ad that produced it. What it did with Meta's answer was `return true`.
 *
 * The response body — `events_received`, `fbtrace_id`, and the `messages`
 * array naming parameters Meta IGNORED — was read only on failure, printed to
 * a log nobody reads, and dropped.
 *
 * The successful path is the one that mattered. A 200 carrying warnings is
 * indistinguishable from a clean 200, so this account could have been sending
 * well-formed events for months while Meta silently discarded the field that
 * made them worth sending, and every screen would have said it was working.
 *
 * Same shape as the targeting guard, which computed the right verdict every
 * morning and returned it into a response body Vercel throws away. Correct
 * and unobservable is worth what wrong is.
 *
 * Runs in `pnpm guards`. Sends nothing.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  MATCH_KEYS, ATTRIBUTING_KEYS, matchKeysPresent, attributesToAd,
  readEventResponse, acceptedWithLoss, coverage,
} from '../lib/freehold/capi-ledger'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

console.log('\n── a 200 is not the same as a success ──')
{
  const clean = readEventResponse(200, { events_received: 1, fbtrace_id: 'A1' })
  check('a clean acceptance is ok and lossless',
    clean.ok && !acceptedWithLoss(clean), JSON.stringify(clean))

  // THE ASSERTION THAT WOULD HAVE CAUGHT THE SILENT FAILURE. Meta returns 200
  // and tells you, in `messages`, that it threw a parameter away.
  const warned = readEventResponse(200, {
    events_received: 1,
    messages: ['Invalid parameter: lead_id was ignored'],
  })
  check('a 200 carrying warnings is accepted AND flagged as lossy',
    warned.ok && acceptedWithLoss(warned), JSON.stringify(warned))

  // Separated from `ok` on purpose: the send did not fail, and retrying would
  // put a duplicate outcome event on the account — worse than a lossy one.
  check('…and lossy never reads as failed, so nothing is retried into a duplicate',
    warned.ok === true)

  const partial = readEventResponse(200, { events_received: 0 })
  check('accepting fewer events than were sent is lossy too',
    acceptedWithLoss(partial, 1), JSON.stringify(partial))

  const rejected = readEventResponse(400, { error: { message: 'Invalid access token' } })
  check('a real rejection is not ok', !rejected.ok && rejected.error === 'Invalid access token')
  check('…and a 200 carrying an error object is not ok either',
    !readEventResponse(200, { error: { message: 'nope' } }).ok)

  // Meta has changed this payload before. A missing count must read as
  // unknown, never as a number that would be mistaken for a fact.
  const bare = readEventResponse(200, {})
  check('a missing count is unknown, not zero', bare.eventsReceived === null)
  check('…and unknown is not treated as loss', !acceptedWithLoss(bare))
  check('a non-object body does not throw', readEventResponse(200, 'nonsense').ok)
}

console.log('\n── which identity went out, by name ──')
{
  const rich = matchKeysPresent({ leadId: 'L1', fbc: 'fb.1.x', email: 'a@b.co', phone: '', externalId: 'u1' })
  check('only the keys actually present are recorded',
    rich.join(',') === 'leadId,fbc,email,externalId', rich.join(','))
  check('an empty string is absence, not a key', !rich.includes('phone'))

  // The distinction the whole loop rests on: an event Meta cannot trace to an
  // ad teaches it about a PERSON while teaching it nothing about targeting.
  check('lead_id makes an event traceable to the ad', attributesToAd(['leadId']))
  check('…and so does the click cookie', attributesToAd(['fbc']))
  check('a hashed email alone does not', !attributesToAd(['email', 'externalId', 'fbp']))
  check('the attributing keys are the two Meta joins on directly',
    ATTRIBUTING_KEYS.every((k) => MATCH_KEYS.includes(k)) && ATTRIBUTING_KEYS.length === 2)

  // Values must never reach the ledger — it is written to a table and read on
  // screens, and an unhashed phone number belongs in neither.
  const keys = matchKeysPresent({ phone: '+971500000001', email: 'buyer@gmail.com' })
  check('the ledger records key NAMES, never values',
    !keys.join(',').includes('971') && !keys.join(',').includes('@'), keys.join(','))
}

console.log('\n── the gap between what we judged and what Meta heard ──')
{
  const c = coverage({ rated: 40, delivered: 30, attributing: 12 })
  check('missing is what was rated and never sent', c.missing === 10, String(c.missing))
  check('reach is delivered over rated', c.reach === 0.75, String(c.reach))
  // TWO NUMBERS, NOT ONE. A blended score would let a high reach hide a low
  // attribution, and those are different failures with different fixes.
  check('attribution is over DELIVERED, not over rated',
    c.attribution === 0.4, String(c.attribution))

  // A percentage of nothing is not 0%, it is no answer — the same rule the
  // rest of this product applies to every number facing a threshold.
  const none = coverage({ rated: 0, delivered: 0, attributing: 0 })
  check('nothing rated yields no percentage rather than a zero',
    none.reach === null && none.attribution === null)
  check('nothing delivered yields no attribution rather than a zero',
    coverage({ rated: 10, delivered: 0, attributing: 0 }).attribution === null)

  // Counts arrive from two separate queries and could disagree.
  const impossible = coverage({ rated: 5, delivered: 10, attributing: 99 })
  check('reach never exceeds 1 and attribution never exceeds delivered',
    impossible.reach === 1 && impossible.attribution === 1,
    `${impossible.reach} / ${impossible.attribution}`)
}

console.log('\n── and the sender actually records it ──')
{
  const capi = readFileSync(join(process.cwd(), 'lib/meta/capi.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

  check('the response body is read on success, not only on failure',
    /readEventResponse\(res\.status/.test(capi), 'the body is still discarded')
  check('every send reaches the ledger', /recordCapiEvent\(/.test(capi))
  check('…and the ledger write cannot fail the send',
    /void recordCapiEvent\(/.test(capi))
  check('…and records which identity keys went out',
    /matchKeysPresent\(/.test(capi) && /attributesToAd\(/.test(capi))

  // TWO SCREENS BOTH SAY "PIXEL" AND ONLY ONE USED TO REACH THIS API.
  //
  // The Pixel screen saves metaPixelId under the TRACKING provider — the id
  // every landing page fires. Integrations → Meta saves pixelId under the
  // META provider. capiCreds read only the second, so an operator could
  // choose their dataset, watch it apply to every landing page, and leave the
  // Conversions API silently unconfigured. On this account: 124 qualified
  // leads, zero reported stages, a dataset whose last_fired_time was null.
  check('the conversions API accepts the pixel from either screen',
    /getGlobalPixels\(/.test(capi), 'the tracking pixel is still invisible to CAPI')
  // The deliberate choice still wins: an account separating its server
  // dataset from its browser pixel must keep that separation.
  check('…with the Meta setting winning when both are present',
    capi.indexOf('getStoredMetaCreds') < capi.indexOf('getGlobalPixels'))
  check('…and which one was used is recorded, not inferred',
    /pixelSource: creds\.source/.test(capi))

  const db = readFileSync(join(process.cwd(), 'lib/freehold/capi-ledger-db.ts'), 'utf8')
  check('the ledger has a column for it rather than a note in the warnings',
    /pixel_source text/.test(db) && !/pixel_source:/.test(capi),
    'a source stuffed into messages would make every event read as lossy')
  // The event id is deterministic; the stage array on the lead is the first
  // guard against a duplicate. This is the last one, at the database, where a
  // race between two writers cannot get past it.
  check('the deterministic event id is unique at the database',
    /CREATE UNIQUE INDEX IF NOT EXISTS/.test(db) && /event_id/.test(db))
  check('a rejected event is recorded too — the half that used to vanish',
    /ok boolean NOT NULL/.test(db) && !/WHERE ok/.test(db.slice(0, db.indexOf('capiCoverage'))))
}

console.log(failures === 0
  ? '\n✅ every event is on the ledger, and a lossy acceptance cannot pass as a clean one.'
  : `\n❌ ${failures} CAPI-ledger guard(s) failed`)
process.exit(failures === 0 ? 0 : 1)
