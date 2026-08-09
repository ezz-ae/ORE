/**
 * Telling Meta which leads were real — locked.
 *
 * Meta only ever learns that a form was submitted, so it buys more of whatever
 * produces submissions. The CRM knows the rest, and sending that back is the
 * highest-leverage change available in the account. It is also the one with
 * the least room for error, because META HAS NO WAY TO TAKE AN EVENT BACK.
 *
 * Three rules, all of them the kind that fail silently and expensively:
 *
 *   1. Once per stage. A duplicate "this lead was worth a fortune" teaches the
 *      optimiser to chase a customer who only existed once.
 *   2. Forward only. Nothing is inferred and nothing is sent on a guess — the
 *      stage comes from a human moving the card or rating the lead.
 *   3. Nothing personal leaves in the clear, and no value is invented. A
 *      placeholder in `value` becomes the optimiser's idea of what a customer
 *      is worth.
 *
 * Pure — no model, no database, no network. Runs in `pnpm guards`.
 */
import { writeBackFor, writeBackEventId, QUALIFIED_STATUSES, WON_STATUSES } from '../lib/freehold/lead-stages'
import { buildQualifiedLeadEvent } from '../lib/meta/capi'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

console.log('\n── what counts as real ──')
{
  check('a qualified lead is reported', writeBackFor({ status: 'qualified' }).stage === 'qualified')
  check('so is one already viewing', writeBackFor({ status: 'viewing' }).stage === 'qualified')
  check('a closed deal is reported as a sale, not merely as qualified',
    writeBackFor({ status: 'closed' }).stage === 'won')
  check('a new lead is not reported at all — Meta already knows it submitted',
    writeBackFor({ status: 'new' }).stage === null)
  check('neither is a lost one', writeBackFor({ status: 'lost' }).stage === null)
  check('the broker’s own high rating counts before the card moves',
    writeBackFor({ status: 'new', valueRating: 8 }).stage === 'qualified')
  check('…and their low rating does not', writeBackFor({ status: 'new', valueRating: 2 }).stage === null)
  check('a rating of exactly 6 is the "buy more of this" line',
    writeBackFor({ status: 'new', valueRating: 6 }).stage === 'qualified' &&
    writeBackFor({ status: 'new', valueRating: 5 }).stage === null)
  check('the funnel and the optimiser agree on "qualified"',
    [...QUALIFIED_STATUSES].every((s) => writeBackFor({ status: s }).stage !== null) &&
    [...WON_STATUSES].every((s) => writeBackFor({ status: s }).stage === 'won'))
}

console.log('\n── once, and only once ──')
{
  check('a qualified lead is not reported twice',
    writeBackFor({ status: 'qualified', sent: ['qualified'] }).stage === null)
  check('…and a rating cannot sneak a second one through',
    writeBackFor({ status: 'new', valueRating: 9, sent: ['qualified'] }).stage === null)
  check('a lead that later closes still sends the sale',
    writeBackFor({ status: 'closed', sent: ['qualified'] }).stage === 'won')
  check('…but only the once', writeBackFor({ status: 'closed', sent: ['qualified', 'won'] }).stage === null)
  check('the event id is the same every time, so a retry cannot double count',
    writeBackEventId('lead-42', 'won') === writeBackEventId('lead-42', 'won'))
  check('…and the two stages of one lead are different events',
    writeBackEventId('lead-42', 'won') !== writeBackEventId('lead-42', 'qualified'))
}

console.log('\n── nothing personal leaves in the clear ──')
{
  const e = buildQualifiedLeadEvent({
    eventId: 'fh-qualified-1', stage: 'qualified',
    email: ' Buyer@Example.com ', phone: '050 123 4567', contentName: 'Reem Hills',
  })!
  const body = JSON.stringify(e)
  check('the email is not in the payload', !/buyer@example\.com/i.test(body), body.slice(0, 200))
  check('the phone digits are not in the payload', !/0501234567|501234567/.test(body))
  check('it is hashed to 64 hex characters',
    /^[a-f0-9]{64}$/.test((e.user_data as { em: string[] }).em[0]))
  check('the phone is hashed too and normalised first',
    /^[a-f0-9]{64}$/.test((e.user_data as { ph: string[] }).ph[0]))
  check('capital letters and stray spaces do not make a different person',
    JSON.stringify(buildQualifiedLeadEvent({ eventId: 'x', stage: 'qualified', email: 'buyer@example.com' })!.user_data)
    === JSON.stringify(buildQualifiedLeadEvent({ eventId: 'x', stage: 'qualified', email: ' BUYER@Example.com ' })!.user_data))
}

console.log('\n── the event says what it means ──')
{
  const q = buildQualifiedLeadEvent({ eventId: 'a', stage: 'qualified', phone: '0501234567' })!
  const w = buildQualifiedLeadEvent({ eventId: 'b', stage: 'won', phone: '0501234567' })!
  check('a qualified lead is a QualifiedLead event', q.event_name === 'QualifiedLead')
  check('a sale is a Purchase event', w.event_name === 'Purchase')
  check('the decision is marked as coming from our system, not a browser',
    q.action_source === 'system_generated')

  check('no value is sent when we do not know one',
    (q.custom_data as Record<string, unknown>).value === undefined,
    JSON.stringify(q.custom_data))
  const valued = buildQualifiedLeadEvent({ eventId: 'c', stage: 'won', phone: '0501234567', valueAED: 250000 })!
  check('a real value is sent with its currency',
    (valued.custom_data as Record<string, unknown>).value === 250000 &&
    (valued.custom_data as Record<string, unknown>).currency === 'AED')
  check('a zero or negative value is not sent as a value',
    (buildQualifiedLeadEvent({ eventId: 'd', stage: 'won', phone: '0501234567', valueAED: 0 })!
      .custom_data as Record<string, unknown>).value === undefined)

  check('a lead with no email and no phone sends nothing at all',
    buildQualifiedLeadEvent({ eventId: 'e', stage: 'qualified' }) === null)
  check('…and an unusable phone counts as nothing',
    buildQualifiedLeadEvent({ eventId: 'f', stage: 'qualified', phone: '123' }) === null)
}

if (failures > 0) {
  console.error(`\n${failures} write-back rule(s) broken.`)
  process.exit(1)
}
console.log('\nMeta hears the CRM’s judgment once, and never hears a guess.\n')
