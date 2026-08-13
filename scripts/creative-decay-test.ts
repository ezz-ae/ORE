/**
 * A CREATIVE DIES SLOWLY AND EVERY NUMBER ON THE SCREEN IS AN AVERAGE — locked.
 *
 * Cost per lead, click-through, cost per thousand: all totals over a window. A
 * creative that worked brilliantly for a fortnight and has produced nothing
 * since still reads as a good creative, because both fortnights are inside the
 * same average. By the time the average moves enough to notice, the money is
 * gone.
 *
 * And the obvious diagnosis is wrong about half the time. "Results fell, so the
 * creative is tired" leads to a new picture, which takes a week and fixes
 * nothing when the real change was in the audience. This suite locks the
 * separation:
 *
 *   frequency ROSE + rate FELL  → fatigue        → new picture
 *   frequency FLAT + rate FELL  → audience moved → do not make a picture
 *
 * Pure — no network, no clock. Runs in `pnpm guards`.
 */
import {
  DECAY_VERDICTS, MIN_IMPRESSIONS_PER_HALF, FATIGUE_FREQUENCY_RISE,
  splitByExposure, readDecay, needsNewCreative, needsNewAudience,
  type CreativeDay,
} from '../lib/freehold/creative-decay'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

/** `n` days from the 1st, each identical. */
const run = (n: number, from: number, o: Omit<CreativeDay, 'day'>): CreativeDay[] =>
  Array.from({ length: n }, (_, i) => ({ ...o, day: `2026-06-${String(from + i).padStart(2, '0')}` }))

console.log('\n── the average hides the death ──')
{
  // Seven good days then seven dead ones. Leads per million goes 500 → 0, and
  // the fortnight's average still reads 250 — which is a perfectly respectable
  // number for a creative that has produced nothing in a week.
  const days = [
    ...run(7, 1, { impressions: 20_000, leads: 10, spendAed: 1000, frequency: 1.1 }),
    ...run(7, 8, { impressions: 20_000, leads: 0, spendAed: 1000, frequency: 1.9 }),
  ]
  const d = readDecay(days)
  check('the early half is measured on its own', d.early.leads === 70, String(d.early.leads))
  check('…and the recent half on its own', d.recent.leads === 0, String(d.recent.leads))
  check('the drop is called, not averaged away', d.verdict !== 'fresh', d.verdict)
  check('…and it cites a real probability', d.p < 0.05, d.p.toFixed(6))
  check('nothing of the old rate survives', d.survivingShare === 0, String(d.survivingShare))
}

console.log('\n── THE ONE EVERY DASHBOARD GETS WRONG ──')
{
  const base = { impressions: 20_000, spendAed: 1000 }
  // Same decline twice. The only difference is what happened to how often each
  // person saw it — and the two have opposite fixes.
  const tired = readDecay([
    ...run(7, 1, { ...base, leads: 12, frequency: 1.1 }),
    ...run(7, 8, { ...base, leads: 1, frequency: 1.9 }),   // the same people, again
  ])
  const moved = readDecay([
    ...run(7, 1, { ...base, leads: 12, frequency: 1.1 }),
    ...run(7, 8, { ...base, leads: 1, frequency: 1.1 }),   // new people, converting worse
  ])

  check('rising frequency with a falling rate is FATIGUE',
    tired.verdict === 'fatigued', `${tired.verdict} rise=${tired.frequencyRise.toFixed(2)}`)
  check('…so the answer is a new picture',
    needsNewCreative(tired) && !needsNewAudience(tired))

  // A NEW PICTURE FIXES NOTHING HERE, and making one costs a week.
  check('the SAME decline on flat frequency is not fatigue',
    moved.verdict === 'audienceMoved', `${moved.verdict} rise=${moved.frequencyRise.toFixed(2)}`)
  check('…so it does NOT ask for a new picture',
    !needsNewCreative(moved) && needsNewAudience(moved))
  check('both fell by the same amount, so only the frequency decided it',
    Math.abs((tired.survivingShare ?? 0) - (moved.survivingShare ?? 0)) < 1e-9,
    `${tired.survivingShare} vs ${moved.survivingShare}`)

  // Frequency drifts up on any ad set that keeps running. A threshold of zero
  // would call every decline fatigue — the exact failure this exists to stop.
  const drift = readDecay([
    ...run(7, 1, { ...base, leads: 12, frequency: 1.10 }),
    ...run(7, 8, { ...base, leads: 1, frequency: 1.10 + FATIGUE_FREQUENCY_RISE / 2 }),
  ])
  check('normal drift is not enough to call fatigue',
    drift.verdict === 'audienceMoved', `${drift.verdict} rise=${drift.frequencyRise.toFixed(3)}`)
  check('the fatigue bar is a real rise, not zero', FATIGUE_FREQUENCY_RISE > 0)
}

console.log('\n── a creative that is fine is left alone ──')
{
  const steady = readDecay([
    ...run(7, 1, { impressions: 20_000, leads: 10, spendAed: 1000, frequency: 1.1 }),
    ...run(7, 8, { impressions: 20_000, leads: 10, spendAed: 1000, frequency: 1.4 }),
  ])
  check('a steady creative is FRESH', steady.verdict === 'fresh', steady.verdict)
  check('…and neither fix is proposed', !needsNewCreative(steady) && !needsNewAudience(steady))

  // GETTING BETTER IS NOT DYING, whatever the frequency did.
  const rising = readDecay([
    ...run(7, 1, { impressions: 20_000, leads: 2, spendAed: 1000, frequency: 1.1 }),
    ...run(7, 8, { impressions: 20_000, leads: 20, spendAed: 1000, frequency: 2.4 }),
  ])
  check('a creative getting better is never called tired', rising.verdict === 'fresh', rising.verdict)

  // A SMALL DROP THAT COULD BE CHANCE IS NOT A DROP. Ten leads against eight
  // is a Tuesday.
  const wobble = readDecay([
    ...run(7, 1, { impressions: 20_000, leads: 10, spendAed: 1000, frequency: 1.1 }),
    ...run(7, 8, { impressions: 20_000, leads: 8, spendAed: 1000, frequency: 1.9 }),
  ])
  check('a wobble is not a death', wobble.verdict === 'fresh', `${wobble.verdict} p=${wobble.p.toFixed(3)}`)
}

console.log('\n── nothing is judged on too little ──')
{
  const thin = readDecay([
    ...run(3, 1, { impressions: 400, leads: 4, spendAed: 100, frequency: 1.1 }),
    ...run(3, 4, { impressions: 400, leads: 0, spendAed: 100, frequency: 2.9 }),
  ])
  check(`under ${MIN_IMPRESSIONS_PER_HALF.toLocaleString('en-US')} impressions a side, nothing is claimed`,
    thin.verdict === 'tooEarly', thin.verdict)
  check('…and it is not quietly a "fresh"', thin.verdict !== 'fresh')

  // A LOPSIDED CALENDAR IS NOT A LOPSIDED COMPARISON — that is what cutting by
  // exposure buys. Seven fat days and one quiet one still split into two halves
  // that both carry real weight, so the run IS judged rather than withheld.
  const lopsided = readDecay([
    ...run(7, 1, { impressions: 50_000, leads: 30, spendAed: 3000, frequency: 1.1 }),
    ...run(1, 8, { impressions: 900, leads: 0, spendAed: 50, frequency: 1.2 }),
  ])
  check('a quiet last day does not withhold a verdict on a fat run',
    lopsided.verdict !== 'tooEarly', lopsided.verdict)
  check('…because both halves still carry real exposure',
    lopsided.early.impressions >= MIN_IMPRESSIONS_PER_HALF
    && lopsided.recent.impressions >= MIN_IMPRESSIONS_PER_HALF,
    `${lopsided.early.impressions} / ${lopsided.recent.impressions}`)

  // What DOES withhold it is a run that is thin overall, whatever its shape.
  const smallTotal = readDecay([
    ...run(4, 1, { impressions: 2000, leads: 3, spendAed: 200, frequency: 1.1 }),
    ...run(4, 5, { impressions: 2000, leads: 0, spendAed: 200, frequency: 2.2 }),
  ])
  check('a run that is thin overall is withheld', smallTotal.verdict === 'tooEarly', smallTotal.verdict)

  check('a creative with no days at all does not throw',
    readDecay([]).verdict === 'tooEarly')
  check('…and reports no surviving share rather than a zero',
    readDecay([]).survivingShare === null)
}

console.log('\n── the halves are cut where the impressions are ──')
{
  // A RAMPING CREATIVE IS THE NORMAL CASE. Cut down the middle of the calendar
  // and the early half is almost nothing, so every ramping ad in the account
  // would report "no change".
  const ramp: CreativeDay[] = [
    ...run(6, 1, { impressions: 500, leads: 0, spendAed: 20, frequency: 1.0 }),
    ...run(2, 7, { impressions: 40_000, leads: 20, spendAed: 2000, frequency: 1.5 }),
  ]
  const { early, recent } = splitByExposure(ramp)
  const impOf = (ds: CreativeDay[]) => ds.reduce((n, d) => n + d.impressions, 0)
  check('neither side is left empty', early.length > 0 && recent.length > 0,
    `${early.length}/${recent.length}`)
  check('…and the split is by exposure, not by day count',
    Math.abs(impOf(early) - impOf(recent)) < impOf(ramp),
    `${impOf(early)} vs ${impOf(recent)}`)

  // One day holding more than half the impressions must not empty the other
  // side — the reading would then be about nothing.
  const spike = splitByExposure([
    { day: '2026-06-01', impressions: 90_000, leads: 40, spendAed: 4000, frequency: 1.4 },
    { day: '2026-06-02', impressions: 1_000, leads: 0, spendAed: 50, frequency: 1.5 },
  ])
  check('a single spike day does not empty the recent half',
    spike.early.length === 1 && spike.recent.length === 1,
    `${spike.early.length}/${spike.recent.length}`)

  check('days out of order are still read in order',
    splitByExposure([
      { day: '2026-06-09', impressions: 10, leads: 0, spendAed: 1, frequency: 1 },
      { day: '2026-06-01', impressions: 10, leads: 0, spendAed: 1, frequency: 1 },
    ]).early[0].day === '2026-06-01')

  // A SINGLE DAY IS NOT A BEFORE AND AN AFTER. It lands entirely in the early
  // half, the recent half is empty, and the reading withholds rather than
  // comparing a day against nothing.
  const oneDay = [{ day: '2026-06-01', impressions: 80_000, leads: 40, spendAed: 4000, frequency: 1.4 }]
  check('one day leaves the recent half empty', splitByExposure(oneDay).recent.length === 0)
  check('…and the verdict is withheld, however fat that day was',
    readDecay(oneDay).verdict === 'tooEarly', readDecay(oneDay).verdict)
}

console.log('\n── a quiet day cannot move the frequency ──')
{
  // Two hundred impressions at a frequency of 4 is not evidence that people
  // are being hammered; it is a rounding artefact on a slow day.
  const d = readDecay([
    ...run(7, 1, { impressions: 20_000, leads: 12, spendAed: 1000, frequency: 1.1 }),
    ...run(6, 8, { impressions: 20_000, leads: 1, spendAed: 1000, frequency: 1.1 }),
    { day: '2026-06-14', impressions: 200, leads: 0, spendAed: 10, frequency: 4.0 },
  ])
  check('the recent frequency is impression-weighted, so the quiet day barely counts',
    d.recent.frequency < 1.2, d.recent.frequency.toFixed(3))
  check('…so a slow day does not turn an audience change into fatigue',
    d.verdict === 'audienceMoved', d.verdict)
}

console.log('\n── every verdict is reachable ──')
{
  const seen = new Set<string>()
  for (const days of [
    [...run(7, 1, { impressions: 20_000, leads: 12, spendAed: 1000, frequency: 1.1 }),
     ...run(7, 8, { impressions: 20_000, leads: 1, spendAed: 1000, frequency: 1.9 })],
    [...run(7, 1, { impressions: 20_000, leads: 12, spendAed: 1000, frequency: 1.1 }),
     ...run(7, 8, { impressions: 20_000, leads: 1, spendAed: 1000, frequency: 1.1 })],
    [...run(7, 1, { impressions: 20_000, leads: 10, spendAed: 1000, frequency: 1.1 }),
     ...run(7, 8, { impressions: 20_000, leads: 10, spendAed: 1000, frequency: 1.4 })],
    [...run(2, 1, { impressions: 300, leads: 1, spendAed: 20, frequency: 1.1 })],
  ]) seen.add(readDecay(days).verdict)
  const missing = DECAY_VERDICTS.filter((v) => !seen.has(v))
  check('every verdict can happen — none is dead copy', missing.length === 0, missing.join(','))
}

if (failures > 0) {
  console.error(`\n${failures} creative-decay rule(s) broken.`)
  process.exit(1)
}
console.log('\nA tired picture and a changed audience look identical, and are told apart.\n')
