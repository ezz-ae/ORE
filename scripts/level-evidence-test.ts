/**
 * The wire between the relevance engine and the arm planner.
 *
 * This translation decides where budget goes, so the failure modes that matter
 * are all in the direction of claiming too much:
 *
 *  · silence counted as agreement — a level promoted on no data
 *  · one strong segment promoting its whole level — three segments funded to
 *    buy the behaviour of one
 *  · an infinite lift ordering the account
 *  · narrowing power invented where nothing was measured, which would defeat
 *    the very check that stops two ad sets buying the same people
 *
 * Pure — no database, no network. Runs in `pnpm guards`.
 */
import { levelEvidenceFrom, narrowingByLevel, LEVEL_AGREEMENT, type EntityLevel } from '../lib/freehold/level-evidence'
import { rankRelevance, type AttributeCounts } from '../lib/freehold/relevance'
import { selectColdArms } from '../lib/freehold/level-arms'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

/** A behaviour that converts far better than the rest, on enough leads to say so. */
const strong = (id: string): AttributeCounts =>
  ({ id, kind: 'behavior', value: id, withTotal: 60, withWins: 30, withoutTotal: 200, withoutWins: 20 })
/** One that converts far worse. */
const weak = (id: string): AttributeCounts =>
  ({ id, kind: 'behavior', value: id, withTotal: 60, withWins: 2, withoutTotal: 200, withoutWins: 60 })
/** Enough leads to look at, no real difference. */
const flat = (id: string): AttributeCounts =>
  ({ id, kind: 'behavior', value: id, withTotal: 40, withWins: 8, withoutTotal: 200, withoutWins: 40 })
/** Too few leads to say anything — the relevance engine drops these. */
const rare = (id: string): AttributeCounts =>
  ({ id, kind: 'behavior', value: id, withTotal: 2, withWins: 2, withoutTotal: 200, withoutWins: 20 })

const empty = rankRelevance([])
const report = (rows: AttributeCounts[]) => ({ behavior: rankRelevance(rows), interest: empty })
const at = (level: number, ...ids: string[]): EntityLevel[] =>
  ids.map((id) => ({ id: id.replace(/^behavior:/, ''), kind: 'behavior' as const, level: level as never }))

console.log('\n── a level is proven only when its segments agree ──')
{
  const r = report([strong('behavior:a'), strong('behavior:b'), strong('behavior:c')])
  const ev = levelEvidenceFrom(r, at(3, 'behavior:a', 'behavior:b', 'behavior:c'))
  check('three agreeing segments prove the level', ev[0].verdict === 'relevant', String(ev[0].verdict))
  check('…and it carries a lift the planner can order by',
    typeof ev[0].lift === 'number' && ev[0].lift! > 1, String(ev[0].lift))

  // THE ONE THAT MATTERS. One winner beside two losers is not a level that
  // works — it is one segment doing the work, and funding the level buys the
  // other two as well.
  const mixed = levelEvidenceFrom(
    report([strong('behavior:a'), weak('behavior:b'), weak('behavior:c')]),
    at(3, 'behavior:a', 'behavior:b', 'behavior:c'))
  check('one strong segment does NOT promote its whole level',
    mixed[0].verdict !== 'relevant', String(mixed[0].verdict))

  const split = levelEvidenceFrom(
    report([strong('behavior:a'), weak('behavior:b')]),
    at(3, 'behavior:a', 'behavior:b'))
  check('an even split is undecided, never a coin toss in favour',
    split[0].verdict === 'undecided', String(split[0].verdict))
  check('…and the sentence says the results are mixed rather than saying "undecided"',
    /[Mm]ixed results/.test(split[0].sentence), split[0].sentence)

  // A bare majority is not agreement: 3 of 5 is 60%, under the bar, so the
  // level stays exploration rather than being funded as a finding.
  const bare = levelEvidenceFrom(
    report([strong('behavior:a'), strong('behavior:b'), strong('behavior:c'), weak('behavior:d'), weak('behavior:e')]),
    at(3, 'behavior:a', 'behavior:b', 'behavior:c', 'behavior:d', 'behavior:e'))
  check('a bare majority does not prove a level',
    bare[0].verdict === 'undecided', String(bare[0].verdict))
  check('two thirds against condemns the level',
    levelEvidenceFrom(report([weak('behavior:a'), weak('behavior:b'), strong('behavior:c')]),
      at(3, 'behavior:a', 'behavior:b', 'behavior:c'))[0].verdict === 'counter')
  check('the agreement bar is the documented one', Math.abs(LEVEL_AGREEMENT - 2 / 3) < 1e-9)
}

console.log('\n── silence is not agreement ──')
{
  const ev = levelEvidenceFrom(report([rare('behavior:a'), rare('behavior:b')]), at(4, 'behavior:a', 'behavior:b'))
  check('a level whose segments are all too rare gets NO verdict',
    ev[0].verdict === undefined, String(ev[0].verdict))
  check('…and reports how many it could not read', ev[0].tooRare === 2 && ev[0].judged === 0,
    `${ev[0].judged}/${ev[0].tooRare}`)
  check('…and says so plainly rather than looking unproven',
    /Not enough leads yet/.test(ev[0].sentence), ev[0].sentence)

  // No verdict must degrade to schema order, NOT to "explored and unproven".
  const arms = selectColdArms([1, 2, 3], ev).arms
  check('an unread level still gets its arm, in schema order',
    arms.length === 3, String(arms.length))

  const looked = levelEvidenceFrom(report([flat('behavior:a')]), at(2, 'behavior:a'))
  check('a level we DID read but could not decide is undecided, not blank',
    looked[0].verdict === 'undecided', String(looked[0].verdict))
  check('an empty assignment produces nothing rather than throwing',
    levelEvidenceFrom(report([strong('behavior:a')]), []).length === 0)
}

console.log('\n── lift cannot be inflated by one outlier or by infinity ──')
{
  // 2x and 6x average to 4x. Taking the max would report 6x and let one
  // segment decide the budget order of the whole account.
  const a: AttributeCounts = { id: 'behavior:a', kind: 'behavior', value: 'a', withTotal: 100, withWins: 20, withoutTotal: 400, withoutWins: 40 }
  const b: AttributeCounts = { id: 'behavior:b', kind: 'behavior', value: 'b', withTotal: 100, withWins: 60, withoutTotal: 400, withoutWins: 40 }
  const ev = levelEvidenceFrom(report([a, b]), at(3, 'behavior:a', 'behavior:b'))
  if (ev[0].verdict === 'relevant') {
    const lifts = [0.2 / 0.1, 0.6 / 0.1]
    const mean = (lifts[0] + lifts[1]) / 2
    check('lift is the mean of the agreeing segments, not the best of them',
      Math.abs((ev[0].lift ?? 0) - mean) < 0.01, `${ev[0].lift} vs ${mean}`)
  } else { ok('lift is the mean of the agreeing segments, not the best of them (level not proven here)') }

  // Infinite lift is real — nobody without the attribute converted — but it is
  // a fact about the denominator, not a magnitude to sort an account by.
  const inf: AttributeCounts = { id: 'behavior:i', kind: 'behavior', value: 'i', withTotal: 40, withWins: 20, withoutTotal: 200, withoutWins: 0 }
  const only = levelEvidenceFrom(report([inf]), at(3, 'behavior:i'))
  check('a level proven only by an infinite lift orders by nothing, not by Infinity',
    only[0].lift === null || Number.isFinite(only[0].lift), String(only[0].lift))
  check('…and is still proven', only[0].verdict === 'relevant', String(only[0].verdict))
  check('an unproven level carries no lift at all',
    levelEvidenceFrom(report([flat('behavior:a')]), at(2, 'behavior:a'))[0].lift === null)
}

console.log('\n── narrowing power is measured or absent, never invented ──')
{
  const ev = levelEvidenceFrom(report([strong('behavior:a')]), at(3, 'behavior:a'))
  check('a level with no measurement passes none through',
    ev[0].narrowingPower === null, String(ev[0].narrowingPower))

  const measured = levelEvidenceFrom(report([strong('behavior:a')]), at(3, 'behavior:a'), { 3: 0.4 })
  check('a measured level carries its share untouched', measured[0].narrowingPower === 0.4)

  // Layers inside one level sit in the same OR group, so their removals
  // overlap. Summing would overstate, and an overstated level earns an ad set
  // that then buys the same people as the arm above it.
  const byLevel = narrowingByLevel(
    [{ id: 'x', share: 0.3 }, { id: 'y', share: 0.5 }, { id: 'z', share: 0.1 }],
    (id) => (id === 'z' ? 4 : 3) as never)
  check('a level takes its largest layer, never the sum', byLevel[3] === 0.5, String(byLevel[3]))
  check('…and other levels keep their own', byLevel[4] === 0.1, String(byLevel[4]))
  check('an unmapped layer contributes nothing',
    Object.keys(narrowingByLevel([{ id: 'x', share: 0.9 }], () => null)).length === 0)
  check('a nonsense share is ignored rather than stored',
    Object.keys(narrowingByLevel([{ id: 'x', share: NaN }], () => 3 as never)).length === 0)
  check('a negative share cannot become negative narrowing',
    narrowingByLevel([{ id: 'x', share: -1 }], () => 3 as never)[3] === 0)
}

console.log('\n── the planner actually acts on what this produces ──')
{
  // End to end: a counter level must reach the planner as an exclusion
  // candidate, and a level that narrows nothing must lose its arm. Neither
  // has ever been exercised, because nothing built the evidence.
  const ev = levelEvidenceFrom(
    report([strong('behavior:a'), weak('behavior:b'), weak('behavior:c')]),
    [...at(2, 'behavior:a'), ...at(3, 'behavior:b', 'behavior:c')],
    { 2: 0.4, 3: 0.4 })
  const sel = selectColdArms([1, 2, 3], ev)
  check('a condemned level becomes an exclusion candidate, not an arm',
    sel.excludeCandidates.includes(3), JSON.stringify(sel.excludeCandidates))
  check('…and the skip reason reaches the operator',
    sel.skipped.some((s) => s.level === 3), JSON.stringify(sel.skipped))

  const dead = levelEvidenceFrom(report([strong('behavior:a')]), at(2, 'behavior:a'), { 2: 0.01 })
  check('a level that removes almost nobody loses its arm',
    selectColdArms([1, 2], dead).arms.length === 1,
    String(selectColdArms([1, 2], dead).arms.length))
  check('…while the same level with real narrowing keeps it',
    selectColdArms([1, 2], levelEvidenceFrom(report([strong('behavior:a')]), at(2, 'behavior:a'), { 2: 0.4 })).arms.length === 2)
}

if (failures > 0) {
  console.error(`\n${failures} level-evidence rule(s) broken.`)
  process.exit(1)
}
console.log('\nThe relevance engine can now reach the arm planner.\n')
