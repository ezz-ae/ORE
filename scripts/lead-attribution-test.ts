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
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

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

console.log('\n── the id that arrived in the name column ──')
{
  // THE DEFECT THIS RECOVERS FROM, and it was live for the whole account:
  // lib/meta/client.ts wrote `utm_campaign={{campaign.id}}` with no utm_id at
  // all. Every landing-page lead this account bought stored its campaign id in
  // the NAME column — invisible to the id match, and compared by the name
  // match against a human campaign name. Both missed. 571 CRM rows read
  // "General enquiry", and every per-campaign number was standing on nothing.
  const camps: CampaignRef[] = [
    { id: '120210000000001', name: 'Venice — buyers' },
    { id: '120210000000002', name: 'Marina — investors' },
  ]
  const recovered = bucketLeadsByCampaign(
    [{ id: 'l1', utmId: null, utmCampaign: '120210000000001' }],
    camps,
  )
  check('a lead whose id landed in the name column is recovered',
    recovered.get('120210000000001')?.attributed === 1, j(recovered))
  check('…and is not counted against any other campaign',
    recovered.get('120210000000002')?.attributed === 0)

  // IT MAY NEVER OVERRULE A GENUINE MATCH. Consulted last, and only for a
  // value shaped like a platform id.
  const both = bucketLeadsByCampaign(
    [{ id: 'l2', utmId: '120210000000002', utmCampaign: '120210000000001' }],
    camps,
  )
  check('a real utm_id still wins over an id sitting in the name column',
    both.get('120210000000002')?.attributed === 1 && both.get('120210000000001')?.attributed === 0,
    j(both))

  const named = bucketLeadsByCampaign(
    [{ id: 'l3', utmId: null, utmCampaign: 'Venice — buyers' }],
    camps,
  )
  check('a real campaign NAME still matches as it always did',
    named.get('120210000000001')?.attributed === 1, j(named))

  // THE FALSE POSITIVE A LOOSE TEST WOULD CREATE. A campaign somebody named
  // "2024" must not swallow every lead tagged with that year.
  const shortCamps: CampaignRef[] = [{ id: '2024', name: 'Spring push' }]
  const notAnId = bucketLeadsByCampaign(
    [{ id: 'l4', utmId: null, utmCampaign: '2024' }],
    shortCamps,
  )
  check('a short number is not treated as a platform id',
    notAnId.get('2024')?.attributed === 0, j(notAnId))

  // And a lead tagged with an id no campaign in this list owns stays
  // unattributed rather than being pushed into the nearest bucket.
  const stranger = bucketLeadsByCampaign(
    [{ id: 'l5', utmId: null, utmCampaign: '999999999999999' }],
    camps,
  )
  check('an unknown id in the name column belongs to nobody',
    [...stranger.values()].every((c) => c.attributed === 0), j(stranger))
}

console.log('\n── the launcher writes the id into the id ──')
{
  // The recovery above exists because of one string. This asserts the string,
  // so the recovery never has to grow a second generation of leads to rescue.
  const client = readFileSync(join(process.cwd(), 'lib/meta/client.ts'), { encoding: 'utf8' })
  // Read the CONSTANT, not the file. The header above it describes the bug in
  // prose, and a whole-file scan matched its own explanation — a guard that
  // fails on the sentence explaining why it exists is worse than no guard.
  const decl = client.slice(client.indexOf('const AD_URL_TAGS'))
  const tags = decl.slice(0, decl.indexOf('\n\n'))
  check('the tags constant exists to read', tags.includes('utm_source=meta'), tags.slice(0, 60))
  check('every ad we create carries utm_id={{campaign.id}}',
    tags.includes('utm_id={{campaign.id}}'), tags)
  check('…and utm_campaign carries the NAME, not the id again',
    tags.includes('utm_campaign={{campaign.name}}') && !tags.includes('utm_campaign={{campaign.id}}'),
    tags)
  check('…from ONE definition, so the creative paths cannot drift apart',
    (client.match(/url_tags: AD_URL_TAGS/g) ?? []).length >= 4,
    String((client.match(/url_tags:/g) ?? []).length))
}

console.log('\n\u2500\u2500 an empty quality panel says what it looked for \u2500\u2500')
{
  // `attributed: 0` has two causes that look identical on screen: the campaign
  // produced no leads, or leads arrived and the tag that connects them to this
  // campaign did not. The panel said one sentence for both — so a wiring fault
  // on OUR side read as a failed campaign, and the operator's conclusion was
  // that lead quality "always doesn't know anything".
  //
  // The rule: when it cannot score, it reports its own terms. What it searched
  // for, and how many leads in the CRM carry no campaign tag at all — the one
  // number that tells an empty campaign from a broken link.
  const quality = readFileSync(join(process.cwd(), 'lib/freehold/campaign-quality.ts'), { encoding: 'utf8' })
  check('the read reports the id and name it matched on',
    /matchedOn: \{ utmId: campaignId/.test(quality))
  check('…and counts leads carrying no campaign tag at all',
    /coalesce\(utm_id, ''\) = ''/.test(quality) && /coalesce\(utm_campaign, ''\) = ''/.test(quality))
  // Asked only when there is nothing to score: a second count on every healthy
  // campaign page is a query for a sentence nobody reads.
  check('…only when there is nothing to score',
    /if \(attributed === 0\) \{/.test(quality))

  const page = readFileSync(join(process.cwd(), 'app/freehold-intelligence/ads-live/meta/[id]/page.tsx'), { encoding: 'utf8' })
  check('the empty panel shows what it searched for',
    /lm\.cmd\.qualityLookedFor/.test(page))
  check('…and names the untagged leads when there are any',
    /quality\.untagged > 0/.test(page) && /lm\.cmd\.qualityUntagged/.test(page))
}

if (failures > 0) {
  console.error(`\n${failures} lead-attribution rule(s) broken.`)
  process.exit(1)
}
console.log('\nOne lead, one campaign — and a zero is a judgment.\n')
