/**
 * The relevance engine, locked.
 *
 * This is the module most able to do damage by being confidently wrong: it
 * ranks behaviours, placements and creatives, and an operator will spend money
 * on what it puts at the top. So the assertions are mostly about REFUSAL — the
 * 10× lift on six leads that must not be called a finding, the missing field
 * that must not become a comparison, the one-sided shortcut that would let
 * anything through at half the evidence.
 *
 * Fisher's exact p-values below are checked against published values for the
 * same tables (R's fisher.test / scipy.stats.fisher_exact), not against this
 * implementation's own output.
 *
 * Pure — no model, no database, no network. Runs in `pnpm guards`.
 */
import {
  fisherExact, assess, rankRelevance, tablesFor, assessEvents, soloBehaviourRows,
  MIN_LEADS_WITH_ATTRIBUTE, type AttributeCounts, type EventRow,
} from '../lib/freehold/relevance'
import { entitiesFromTargeting } from '../lib/freehold/audience-snapshot'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))
const near = (a: number, b: number, tol = 1e-4) => Math.abs(a - b) <= tol

const row = (o: Partial<EventRow>): EventRow => ({
  behaviorIds: [], behaviorNames: [], interestIds: [], interestNames: [],
  placements: [], creatives: [], creativeNames: [], won: false, ...o,
})

console.log('\n── Fisher\'s exact test, against published values ──')
{
  // The classic tea-tasting table: fisher.test(matrix(c(3,1,1,3),2)) = 0.4857
  check('the tea-tasting table gives 0.4857', near(fisherExact(3, 1, 1, 3), 0.485714, 1e-5),
    String(fisherExact(3, 1, 1, 3)))
  // fisher.test(matrix(c(1,9,11,3),2,byrow=TRUE)) = 0.0027594
  check('a strongly separated table gives 0.00276', near(fisherExact(1, 9, 11, 3), 0.0027594, 1e-6),
    String(fisherExact(1, 9, 11, 3)))
  // Perfect separation, 10 vs 10.
  check('perfect separation on 20 is decisive', fisherExact(10, 0, 0, 10) < 1e-4,
    String(fisherExact(10, 0, 0, 10)))
  // Perfect separation on FOUR is not — this is the one that catches a
  // one-sided implementation, which would return 0.5 here and call it real.
  check('perfect separation on 4 is NOT significant', fisherExact(1, 0, 0, 1) === 1,
    String(fisherExact(1, 0, 0, 1)))
  check('identical rates give p = 1', near(fisherExact(5, 5, 5, 5), 1, 1e-9))
  check('the result is symmetric under transposition',
    near(fisherExact(3, 1, 1, 3), fisherExact(1, 3, 3, 1)))
  check('an empty margin cannot be tested', fisherExact(0, 0, 4, 6) === 1)
  check('negative counts are refused rather than computed', fisherExact(-1, 2, 3, 4) === 1)
  check('a large table does not overflow', Number.isFinite(fisherExact(300, 700, 250, 750)))
}

console.log('\n── a big lift on a small sample is not a finding ──')
{
  // 3 of 6 progress vs 3 of 60 — a 10x lift that looks enormous on a screen.
  const flashy: AttributeCounts = {
    id: 'behavior:1', kind: 'behavior', value: 'Frequent Travellers',
    withTotal: 6, withWins: 3, withoutTotal: 60, withoutWins: 3,
  }
  const s = assess(flashy)
  check('the lift really is 10x', near(s.lift, 10, 1e-9), String(s.lift))
  check('…and it IS significant here — 6 vs 60 with that gap is real',
    s.verdict === 'relevant', `${s.verdict} p=${s.p}`)

  // Now the same lift on a table that cannot carry it.
  const thin: AttributeCounts = {
    id: 'behavior:2', kind: 'behavior', value: 'Thin',
    withTotal: 5, withWins: 2, withoutTotal: 100, withoutWins: 10,
  }
  const t = assess(thin)
  check('a 4x lift on 5 leads is undecided, not relevant',
    t.verdict === 'undecided', `${t.verdict} p=${t.p} lift=${t.lift}`)
  check('…and it says how many more leads would settle it',
    t.leadsNeeded !== null && t.leadsNeeded > 0, String(t.leadsNeeded))
  check('the sentence gives the count, not a verdict', /would settle it/.test(t.sentence), t.sentence)

  // When the COMPARISON group is the thin side, no amount of the attribute
  // helps — and saying "needs N more" would be a false promise.
  const thinControl: AttributeCounts = {
    id: 'behavior:9', kind: 'behavior', value: 'Thin control',
    withTotal: 5, withWins: 1, withoutTotal: 10, withoutWins: 0,
  }
  const tc = assess(thinControl)
  check('an unwinnable comparison returns no lead count rather than a fake one',
    tc.leadsNeeded === null, String(tc.leadsNeeded))
  check('…and says so plainly', /will not settle soon/.test(tc.sentence), tc.sentence)
}

console.log('\n── an attribute that predicts a WORSE lead ──')
{
  const bad: AttributeCounts = {
    id: 'behavior:3', kind: 'behavior', value: 'Bargain hunters',
    withTotal: 40, withWins: 1, withoutTotal: 40, withoutWins: 14,
  }
  const s = assess(bad)
  check('it is called counter, not merely "less relevant"', s.verdict === 'counter', s.verdict)
  check('the sentence says it predicts a worse lead',
    /worse lead/.test(s.sentence), s.sentence)
}

console.log('\n── ranking refuses to rank noise ──')
{
  const rows: AttributeCounts[] = [
    { id: 'b:1', kind: 'behavior', value: 'Strong', withTotal: 30, withWins: 15, withoutTotal: 60, withoutWins: 6 },
    { id: 'b:2', kind: 'behavior', value: 'Middling', withTotal: 20, withWins: 4, withoutTotal: 70, withoutWins: 17 },
    { id: 'b:3', kind: 'behavior', value: 'Rare', withTotal: 2, withWins: 2, withoutTotal: 88, withoutWins: 19 },
  ]
  const r = rankRelevance(rows)
  check('the rare attribute is dropped, not ranked',
    !r.signals.some((s) => s.value === 'Rare'), r.signals.map((s) => s.value).join(','))
  check('…and the count of dropped attributes is reported', r.tooRare === 1, String(r.tooRare))
  check('the strong one is proven relevant', r.relevant[0]?.value === 'Strong', r.relevant.map((s) => s.value).join(','))
  check('the middling one is undecided', r.undecided.some((s) => s.value === 'Middling'))
  // Sorted by p, not lift — a big lift on few leads must not head the list.
  check('the list is ordered by evidence, not by lift',
    r.signals[0].p <= r.signals[r.signals.length - 1].p)
  check('the next test names the proven attribute',
    /Strong/.test(r.nextTest), r.nextTest)
  check('…and refuses to claim Meta can deliver it',
    /not proof that Meta can deliver/.test(r.nextTest), r.nextTest)

  const nothing = rankRelevance([])
  check('an empty funnel says there is nothing to compare',
    /nothing to compare/.test(nothing.headline), nothing.headline)
  check('…and does not invent a next test',
    /Keep the current split/.test(nothing.nextTest), nothing.nextTest)
}

console.log('\n── a missing field is not a comparison ──')
{
  // Instant-form leads have no placement. Counting them as "without feed"
  // would manufacture a comparison out of an absent fact.
  const rows: EventRow[] = [
    ...Array.from({ length: 10 }, () => row({ placements: ['feed'], won: true })),
    ...Array.from({ length: 10 }, () => row({ placements: ['story'], won: false })),
    // 40 instant-form leads, no placement at all, none progressed.
    ...Array.from({ length: 40 }, () => row({ placements: [], won: false })),
  ]
  const tables = tablesFor(rows.map((r) => ({ ids: r.placements, names: r.placements, won: r.won })), 'placement')
  const feed = tables.find((t) => t.value === 'feed')!
  check('only leads that HAVE a placement enter the table',
    feed.withTotal + feed.withoutTotal === 20, String(feed.withTotal + feed.withoutTotal))
  check('feed reads 10 of 10, not 10 of 50', feed.withTotal === 10 && feed.withWins === 10,
    `${feed.withWins}/${feed.withTotal}`)
}

console.log('\n── every dimension of the registration event ──')
{
  const rows: EventRow[] = [
    ...Array.from({ length: 12 }, () => row({
      behaviorIds: ['b1'], behaviorNames: ['Expats'],
      placements: ['feed'], creatives: ['ad1'], creativeNames: ['Payment plan'], won: true,
    })),
    ...Array.from({ length: 30 }, () => row({
      behaviorIds: ['b2'], behaviorNames: ['Bargain'],
      placements: ['instagram_stories'], creatives: ['ad2'], creativeNames: ['Lifestyle'], won: false,
    })),
  ]
  const e = assessEvents(rows)
  check('the behaviour separates', e.behavior.relevant.some((s) => s.value === 'Expats'),
    e.behavior.headline)
  check('the placement separates', e.placement.relevant.some((s) => s.value === 'feed'),
    e.placement.headline)
  check('the creative separates', e.creative.relevant.some((s) => s.value === 'Payment plan'),
    e.creative.headline)
  check('the losing creative is named as counter',
    e.creative.counter.some((s) => s.value === 'Lifestyle'), e.creative.headline)
  check('interests with no data produce an empty report',
    e.interest.signals.length === 0, e.interest.headline)
}

console.log('\n── confounding is bounded, and the clean subset is reachable ──')
{
  const rows: EventRow[] = [
    ...Array.from({ length: 8 }, () => row({ behaviorIds: ['b1', 'b2'], behaviorNames: ['A', 'B'], won: true })),
    ...Array.from({ length: 8 }, () => row({ behaviorIds: ['b1'], behaviorNames: ['A'], won: true })),
    ...Array.from({ length: 8 }, () => row({ behaviorIds: ['b2'], behaviorNames: ['B'], won: false })),
  ]
  const all = assessEvents(rows).behavior
  check('a bundled behaviour is credited alongside its bunk-mate',
    all.signals.some((s) => s.value === 'B'), all.signals.map((s) => s.value).join(','))
  const solo = assessEvents(soloBehaviourRows(rows)).behavior
  check('the solo subset drops the bundled leads',
    solo.signals.every((s) => s.withTotal + s.withoutTotal === 16),
    solo.signals.map((s) => `${s.value}:${s.withTotal + s.withoutTotal}`).join(','))
  check('…and in the clean read A beats B', solo.relevant[0]?.value === 'A',
    solo.relevant.map((s) => s.value).join(','))
}

console.log('\n── what the snapshot freezes ──')
{
  const t = {
    countries: ['AE'], cityKeys: [], ageMin: 30, ageMax: 50,
    publisherPlatforms: ['facebook'],
    interests: [{ id: 'i1', name: 'Property' }],
    behaviors: [{ id: 'b1', name: 'Expats' }],
    narrowing: [{ interests: [{ id: 'i2', name: 'Luxury' }], behaviors: [{ id: 'b2', name: 'Travellers' }] }],
  }
  const e = entitiesFromTargeting(t)
  check('narrowing groups are captured too — a narrowed behaviour was still bought',
    e.behaviorIds.includes('b2') && e.interestIds.includes('i2'), JSON.stringify(e))
  check('base entities are captured', e.behaviorIds.includes('b1') && e.interestIds.includes('i1'))
  check('names ride along with ids', e.behaviorNames.includes('Travellers'))
  const dupe = entitiesFromTargeting({ ...t, narrowing: [{ behaviors: [{ id: 'b1', name: 'Expats' }] }] })
  check('an entity used twice is counted once', dupe.behaviorIds.filter((x) => x === 'b1').length === 1)
  check('an absent targeting spec yields nothing rather than throwing',
    entitiesFromTargeting(null).behaviorIds.length === 0)
}

console.log('\n── the minimum is a real constant, not a magic number ──')
{
  const near5: AttributeCounts = { id: 'x', kind: 'behavior', value: 'X', withTotal: MIN_LEADS_WITH_ATTRIBUTE, withWins: 5, withoutTotal: 50, withoutWins: 5 }
  check(`${MIN_LEADS_WITH_ATTRIBUTE} leads is enough to appear`, rankRelevance([near5]).signals.length === 1)
  check(`${MIN_LEADS_WITH_ATTRIBUTE - 1} is not`,
    rankRelevance([{ ...near5, withTotal: MIN_LEADS_WITH_ATTRIBUTE - 1, withWins: 4 }]).signals.length === 0)
  check('an attribute EVERY lead carries has no comparison group and is dropped',
    rankRelevance([{ ...near5, withoutTotal: 0, withoutWins: 0 }]).signals.length === 0)
}

if (failures > 0) {
  console.error(`\n${failures} relevance rule(s) broken.`)
  process.exit(1)
}
console.log('\nAll relevance rules hold.\n')
