/**
 * WHICH CAMPAIGN A LEAD BELONGS TO — locked.
 *
 * This bucketing exists so the live screen can say the cheapest true thing in
 * the product — "2 leads, none rated" — without one database round trip per
 * campaign. The rule a SQL GROUP BY would get wrong, and which every assertion
 * here defends, is that a lead belongs to EXACTLY ONE campaign:
 *
 *   · A lead carries Meta's campaign id AND a campaign name. When they point
 *     at different campaigns — most often because somebody named a relaunch
 *     the same thing — counting it under both doubles a number this product
 *     claims traces back to one thing.
 *   · A rating of ZERO is a rating. "This lead was worthless" is the most
 *     useful sentence a broker writes, and treating it as unrated would put a
 *     "nobody rated these" line on the campaign whose leads were judged
 *     hardest.
 *
 * Pure — no database. Runs in `pnpm guards`.
 */
import { bucketLeadsByCampaign, type AttributableLead, type CampaignRef } from '../lib/freehold/lead-attribution'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const camps: CampaignRef[] = [
  { id: '120251', name: 'cash offer new audiences' },
  { id: '120252', name: 'Sea Legend One — Quick' },
]
const lead = (o: Partial<AttributableLead> & { id: string }): AttributableLead => ({ ...o })
const j = (m: Map<string, { attributed: number; rated: number }>) => JSON.stringify([...m])

console.log('\n── every campaign asked about gets an answer ──')
{
  const m = bucketLeadsByCampaign([], camps)
  check('a campaign with no leads is a MEASUREMENT of zero, not an absence',
    m.get('120251')?.attributed === 0 && m.get('120252')?.attributed === 0, j(m))
  check('…and nothing else appears in the map',
    m.size === 2, j(m))
  check('a campaign with no id is skipped rather than keyed on empty',
    bucketLeadsByCampaign([], [{ id: '', name: 'x' }]).size === 0)
}

console.log('\n── the id wins over the name ──')
{
  // The real conflict: a relaunch named the same as its predecessor. The id is
  // Meta's and exact; the name was typed and reused.
  const m = bucketLeadsByCampaign([
    lead({ id: 'l1', utmId: '120252', utmCampaign: 'cash offer new audiences' }),
  ], camps)
  check('a lead whose id and name disagree goes to the ID\'s campaign',
    m.get('120252')?.attributed === 1, j(m))
  check('…and NOT to the name\'s, which would double it',
    m.get('120251')?.attributed === 0, j(m))

  check('a lead with only a name still lands, case-insensitively',
    bucketLeadsByCampaign([lead({ id: 'l2', utmCampaign: 'CASH OFFER NEW AUDIENCES' })], camps)
      .get('120251')?.attributed === 1)
  check('…and whitespace does not lose it',
    bucketLeadsByCampaign([lead({ id: 'l3', utmCampaign: '  cash offer new audiences ' })], camps)
      .get('120251')?.attributed === 1)

  const stray = bucketLeadsByCampaign([
    lead({ id: 'l4', utmId: 'not-ours', utmCampaign: 'not ours either' }),
    lead({ id: 'l5' }),
  ], camps)
  check('a lead belonging to nothing we asked about is counted nowhere',
    stray.get('120251')?.attributed === 0 && stray.get('120252')?.attributed === 0, j(stray))

  // Two campaigns sharing a name is a real thing people do. The answer must at
  // least be stable rather than depending on row order.
  const dupeNames: CampaignRef[] = [{ id: 'a', name: 'Cash offer' }, { id: 'b', name: 'Cash offer' }]
  const d = bucketLeadsByCampaign([lead({ id: 'l6', utmCampaign: 'cash offer' })], dupeNames)
  check('when two campaigns share a name the earlier one keeps it',
    d.get('a')?.attributed === 1 && d.get('b')?.attributed === 0, j(d))
  check('…and the lead is still counted exactly once',
    (d.get('a')!.attributed + d.get('b')!.attributed) === 1)
}

console.log('\n── a rating of zero is a rating ──')
{
  const m = bucketLeadsByCampaign([
    lead({ id: 'l1', utmId: '120251', valueRating: 0 }),
    lead({ id: 'l2', utmId: '120251', valueRating: 8 }),
    lead({ id: 'l3', utmId: '120251', valueRating: null }),
    lead({ id: 'l4', utmId: '120251' }),
  ], camps)
  check('four leads land', m.get('120251')?.attributed === 4, j(m))
  check('a ZERO counts as rated — "worthless" is the most useful thing a broker says',
    m.get('120251')?.rated === 2, j(m))
  check('…and null and absent both mean unrated',
    m.get('120251')!.rated === 2)

  check('a campaign with leads and no ratings reports rated: 0, which is the line the screen says',
    bucketLeadsByCampaign([lead({ id: 'x', utmId: '120251' })], camps).get('120251')?.rated === 0)
}

console.log('\n── the count never exceeds the leads ──')
{
  const leads = Array.from({ length: 25 }, (_, i) =>
    lead({ id: `l${i}`, utmId: i % 2 ? '120251' : '120252', valueRating: i % 5 === 0 ? 7 : null }))
  const m = bucketLeadsByCampaign(leads, camps)
  const total = [...m.values()].reduce((n, c) => n + c.attributed, 0)
  check('every lead is counted once and only once', total === 25, String(total))
  check('rated never exceeds attributed in any bucket',
    [...m.values()].every((c) => c.rated <= c.attributed), j(m))
  check('junk input does not throw',
    bucketLeadsByCampaign(null as unknown as AttributableLead[], camps).size === 2)
}

if (failures > 0) {
  console.error(`\n${failures} lead-attribution rule(s) broken.`)
  process.exit(1)
}
console.log('\nOne lead, one campaign — and a zero is a judgment.\n')
