/**
 * THE SAME PERSON TWICE IS A QUESTION, NOT A VERDICT — locked.
 *
 * "from now the duplication doesnt mean disqualified — we need to smartly
 *  understand why this person registered 2 times and for which offers. if a
 *  lead register for apartment then tomorrow register for another apartment
 *  same price or same area he is active buyer."
 *
 * What was here before resolved that ambiguity in the worst available
 * direction. `scoreLeads` took every repeated phone number, counted all but
 * the first as a duplicate, and dropped them into the JUNK set — beside
 * blocked numbers and undialable phones. So the strongest buying signal a
 * funnel can produce was subtracted from the campaign that produced it, and
 * the ad machine was taught to buy less of it.
 *
 * These assertions pin the discriminator — WHAT they registered for and HOW
 * FAR APART — and, as hard, pin that the one genuinely wasteful case is still
 * caught. A rule that called everything a buying signal would be exactly as
 * useless as the one that called everything junk.
 *
 * Pure — no clock, no I/O. Runs in `pnpm guards`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  readRepeat, readCluster, REPEAT_VERDICTS,
  DOUBLE_SUBMIT_MINUTES, SHOPPING_WINDOW_DAYS, SAME_PRICE_TOLERANCE,
  type Registration,
} from '../lib/freehold/repeat-intent'
import { scoreLeads, type ScorableLead } from '../lib/freehold/campaign-score'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const T0 = Date.parse('2026-08-30T09:00:00Z')
const min = (n: number) => n * 60_000
const day = (n: number) => n * 86_400_000
const reg = (o: Partial<Registration> = {}): Registration => ({ atMs: T0, ...o })

console.log('\n── the one case that really is waste ──')
{
  // Same ad, minutes apart: somebody unsure the form went through. One
  // intention, charged twice.
  const r = readRepeat(
    reg({ adId: 'ad1', projectSlug: 'sea-legend' }),
    reg({ atMs: T0 + min(3), adId: 'ad1', projectSlug: 'sea-legend' }),
  )
  check('two submissions on one ad in minutes is a double submit',
    r.verdict === 'doubleSubmit', r.verdict)
  check('…and it IS waste', r.isWaste && !r.isBuyingSignal)
  check('…and says why', r.because.includes('withinMinutes') && r.because.includes('sameAd'))

  // An hour later on the same ad is a different act — they thought about it.
  const later = readRepeat(
    reg({ adId: 'ad1' }),
    reg({ atMs: T0 + min(DOUBLE_SUBMIT_MINUTES + 1), adId: 'ad1' }),
  )
  check('past the window it is no longer a double submit',
    later.verdict === 'sameOffer' && !later.isWaste, later.verdict)
}

console.log('\n── THE CASE THE OLD RULE THREW AWAY ──')
{
  // "register for apartment then tomorrow register for another apartment same
  // price or same area — he is active buyer."
  const sameArea = readRepeat(
    reg({ adId: 'ad1', projectSlug: 'sea-legend', area: 'Dubai Marina' }),
    reg({ atMs: T0 + day(1), adId: 'ad2', projectSlug: 'riverside-hills', area: 'Dubai Marina' }),
  )
  check('two properties in the same area, a day apart, is shopping',
    sameArea.verdict === 'comparing', sameArea.verdict)
  check('…and it is a BUYING SIGNAL, not waste',
    sameArea.isBuyingSignal && !sameArea.isWaste)
  check('…and says it was the area', sameArea.because.includes('sameArea'))

  const samePrice = readRepeat(
    reg({ projectSlug: 'a', area: 'Marina', priceAED: 1_800_000 }),
    reg({ atMs: T0 + day(2), projectSlug: 'b', area: 'JVC', priceAED: 2_000_000 }),
  )
  check('…or the same money in a different area', samePrice.verdict === 'comparing', samePrice.verdict)
  check('…and says it was the price', samePrice.because.includes('similarPrice'))

  // Area and price STRENGTHEN the reading; they are not required for it. The
  // score reads leads straight from the CRM, where a row has its project and
  // its ad but not the catalogue's area or price — a rule that needed those
  // could never fire from the one place that decides whether a campaign is
  // judged to have bought junk.
  const noDetail = readRepeat(
    reg({ projectSlug: 'a' }),
    reg({ atMs: T0 + day(1), projectSlug: 'b' }),
  )
  check('two different properties in a week is shopping even with no area or price',
    noDetail.verdict === 'comparing' && noDetail.isBuyingSignal, noDetail.verdict)
  const wayOff = readRepeat(
    reg({ projectSlug: 'a', priceAED: 1_000_000 }),
    reg({ atMs: T0 + day(2), projectSlug: 'b', priceAED: 9_000_000 }),
  )
  check('a studio and a villa is still somebody shopping, just not on price',
    wayOff.verdict === 'comparing' && !wayOff.because.includes('similarPrice'), wayOff.verdict)
  check('the tolerance is a stated fraction, not a magic number',
    SAME_PRICE_TOLERANCE > 0 && SAME_PRICE_TOLERANCE < 1)
}

console.log('\n── and the readings in between stay distinct ──')
{
  const again = readRepeat(
    reg({ projectSlug: 'sea-legend' }),
    reg({ atMs: T0 + day(7), projectSlug: 'sea-legend' }),
  )
  check('the same property a week later is a repeat, not a comparison',
    again.verdict === 'sameOffer' && !again.isBuyingSignal, again.verdict)

  // Beyond the shopping window two enquiries are two enquiries.
  const old = readRepeat(
    reg({ projectSlug: 'a', area: 'Marina' }),
    reg({ atMs: T0 + day(SHOPPING_WINDOW_DAYS + 5), projectSlug: 'b', area: 'Marina' }),
  )
  check('the same area a season later is returning, not comparing',
    old.verdict === 'returning', old.verdict)
  check('…and says the gap was the reason', old.because.includes('longGap'))

  check('every verdict is walkable', REPEAT_VERDICTS.length === 4)
  check('only one of the four is waste',
    REPEAT_VERDICTS.filter((v) => v === 'doubleSubmit').length === 1)
}

console.log('\n── order does not change the answer ──')
{
  const a = reg({ adId: 'ad1', projectSlug: 'x', area: 'Marina' })
  const b = reg({ atMs: T0 + day(1), adId: 'ad2', projectSlug: 'y', area: 'Marina' })
  check('a pair reads the same either way round',
    readRepeat(a, b).verdict === readRepeat(b, a).verdict)
  check('…and the hours apart are never negative',
    readRepeat(b, a).hoursApart >= 0)
}

console.log('\n── a cluster takes the strongest signal, not the newest pair ──')
{
  // Somebody who shopped two properties AND double-submitted one form has
  // still shopped. A rule reading only the last two would bury that.
  const r = readCluster([
    reg({ adId: 'ad1', projectSlug: 'a', area: 'Marina' }),
    reg({ atMs: T0 + day(1), adId: 'ad2', projectSlug: 'b', area: 'Marina' }),
    reg({ atMs: T0 + day(1) + min(2), adId: 'ad2', projectSlug: 'b', area: 'Marina' }),
  ])
  check('one accidental double submit does not bury the comparison',
    r?.verdict === 'comparing' && r.isBuyingSignal === true, r?.verdict)
  check('a single registration has nothing to read', readCluster([reg()]) === null)
}

console.log('\n── and the campaign score stopped calling it junk ──')
{
  const lead = (o: Partial<ScorableLead>): ScorableLead => ({
    id: `l${Math.random()}`, status: 'new', blocked: null, phone: '+971500000000',
    behaviour_score: null, value_rating: null, deal_value_aed: null,
    created_at: new Date(T0).toISOString(), ...o,
  })

  // THE REGRESSION THIS FILE EXISTS FOR. Same person, two different
  // properties, a day apart. Before: 1 duplicate, 1 junk. Now: neither.
  const shopper = scoreLeads([
    lead({ id: 'a', phone: '+971501111111', project_slug: 'sea-legend', meta_ad_id: 'ad1' }),
    lead({ id: 'b', phone: '+971501111111', project_slug: 'riverside', meta_ad_id: 'ad2',
           created_at: new Date(T0 + day(1)).toISOString() }),
  ])
  check('somebody shopping two properties is not junk', shopper.junk === 0, String(shopper.junk))
  check('…and is counted as comparing', shopper.comparing === 1, String(shopper.comparing))
  check('…and is not charged as a duplicate', shopper.duplicates === 0, String(shopper.duplicates))

  // The genuine waste still lands.
  const doubled = scoreLeads([
    lead({ id: 'c', phone: '+971502222222', project_slug: 'sea-legend', meta_ad_id: 'ad1' }),
    lead({ id: 'd', phone: '+971502222222', project_slug: 'sea-legend', meta_ad_id: 'ad1',
           created_at: new Date(T0 + min(2)).toISOString() }),
  ])
  check('a form submitted twice is still junk', doubled.junk === 1, String(doubled.junk))
  check('…and still counted as a duplicate', doubled.duplicates === 1, String(doubled.duplicates))

  // Blocked and undialable are untouched by any of this.
  const blocked = scoreLeads([lead({ id: 'e', phone: '+971503333333', blocked: true })])
  check('blocked leads are still junk', blocked.junk === 1)
}

console.log('\n── the CRM filter stopped calling it junk too ──')
{
  const f = readFileSync(join(process.cwd(), 'lib/freehold/crm-filters.ts'), 'utf8')
  // Read the CODE: the comment above the fix quotes the very field it removed,
  // and a raw scan matched its own explanation.
  const code = f.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  const junk = code.slice(code.indexOf("id: 'junk'"), code.indexOf("id: 'repeat'"))
  check('junk no longer includes a repeat', !/duplicateRisk/.test(junk), junk.slice(0, 200))
  // Its own filter, because "who came back" is a question a sales team asks on
  // purpose and the answer is a call list.
  check('registered-twice is its own filter', /id: 'repeat'/.test(f))
}

console.log(failures === 0
  ? '\n✅ a repeat is read, not written off — and the one real waste still is.'
  : `\n❌ ${failures} repeat-intent guard(s) failed`)
process.exit(failures === 0 ? 0 : 1)
