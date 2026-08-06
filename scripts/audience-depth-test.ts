/**
 * Deeper seeds, honest layers, and a ladder that climbs for the right reason.
 *
 * Three modules, one thesis: extend an audience by understanding the data you
 * have, not by collecting more of it. Each has a specific way of being
 * flattering and wrong, and these assertions are aimed at those:
 *
 *  · seed-cohort  — reporting a seed as usable when Meta will not match enough
 *                   of it to build anything.
 *  · layer-audit  — letting a stack of five decorative layers feel like work.
 *  · lookalike-ladder — widening an audience that saturated because it was
 *                   failing, which is the exact opposite of the right move.
 *
 * Pure — no model, no database, no network. Runs in `pnpm guards`.
 */
import {
  scoreLead, splitCohorts, seedReadiness, seedUpload,
  META_MIN_MATCHED, SEED_QUALITY_FLOOR, type SeedLead,
} from '../lib/freehold/seed-cohort'
import {
  auditStack, levels, orDominance, auditGroupBalance, assessLevelOrder,
  mirrorOf, LEVEL_LABEL, INCLUSION_ORDER, EXCLUSION_ORDER,
  IGNORED_BELOW, type LayerProbe, type OrderedLevel,
} from '../lib/freehold/layer-audit'
import {
  assessTier, LADDER, FREQUENCY_CEILING, MIN_IMPRESSIONS_FOR_LADDER, type TierState,
} from '../lib/freehold/lookalike-ladder'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const lead = (o: Partial<SeedLead>): SeedLead =>
  ({ id: 'l', email: 'a@b.com', phone: '971501234567', status: 'new', ...o })

console.log('\n── a seed is built on outcomes, not on activity ──')
{
  const closed = scoreLead(lead({ status: 'closed' }))
  const qualified = scoreLead(lead({ status: 'qualified' }))
  const contacted = scoreLead(lead({ status: 'contacted' }))
  check('a closed buyer outranks a qualified lead', closed.quality > qualified.quality,
    `${closed.quality} vs ${qualified.quality}`)
  check('a qualified lead outranks someone who merely answered',
    qualified.quality > contacted.quality, `${qualified.quality} vs ${contacted.quality}`)
  check('the reason is legible', closed.reason.includes('closed'), closed.reason)

  // Behaviour score must never carry a seed on its own.
  const browsed = scoreLead(lead({ status: 'new', behaviourScore: 100 }))
  check('a thorough page-reader who did nothing else does not reach seed grade',
    browsed.quality < 40, String(browsed.quality))

  const blocked = scoreLead(lead({ status: 'closed', blocked: true }))
  check('a blocked person scores zero however good their status looks',
    blocked.quality === 0, String(blocked.quality))
  const badPhoneLost = scoreLead(lead({ status: 'lost', phone: '12' }))
  check('lost with an unusable phone scores zero', badPhoneLost.quality === 0)
}

console.log('\n── nothing takes the same weight ──')
{
  const big = scoreLead(lead({ status: 'closed', dealValueAed: 4_000_000 }))
  const small = scoreLead(lead({ status: 'closed', dealValueAed: 900_000 }))
  check('a bigger deal carries a bigger weight', big.weight > small.weight,
    `${big.weight} vs ${small.weight}`)
  const noDeal = scoreLead(lead({ status: 'qualified' }))
  check('a lead with no deal value still gets a positive weight',
    noDeal.weight >= 1, String(noDeal.weight))
  // Meta silently discards rows with a value <= 0, and a silently discarded
  // row is a row we thought we sent.
  const worst = scoreLead(lead({ status: 'new', valueRating: 0 }))
  check('even the worst-scoring lead never carries a zero weight',
    worst.weight >= 1, String(worst.weight))
}

console.log('\n── the exclusion cohort is PROVEN bad, never merely unproven ──')
{
  const leads: SeedLead[] = [
    lead({ id: 'won', status: 'closed' }),
    lead({ id: 'qual', status: 'qualified' }),
    lead({ id: 'new', status: 'new' }),
    lead({ id: 'blocked', status: 'qualified', blocked: true }),
    lead({ id: 'rated-bad', status: 'contacted', valueRating: 1 }),
    lead({ id: 'unreachable', status: 'lost', phone: '1' }),
  ]
  const c = splitCohorts(leads)
  check('closed and qualified form the seed',
    c.seed.map((l) => l.id).sort().join(',') === 'qual,won', c.seed.map((l) => l.id).join(','))
  check('a brand-new lead is neutral, not excluded',
    c.neutral.some((l) => l.id === 'new') && !c.exclude.some((l) => l.id === 'new'))
  check('blocked, badly-rated and unreachable are excluded',
    c.exclude.map((l) => l.id).sort().join(',') === 'blocked,rated-bad,unreachable',
    c.exclude.map((l) => l.id).join(','))
  check('the seed is ordered best-first', c.seed[0].id === 'won', c.seed[0].id)

  const unmatched = splitCohorts([lead({ id: 'x', status: 'closed', email: null, phone: null })])
  check('a closed buyer Meta cannot match is kept OUT of the seed',
    unmatched.seed.length === 0, JSON.stringify(unmatched.seed.map((l) => l.id)))
}

console.log('\n── readiness is measured in matched people, not rows ──')
{
  const none = seedReadiness(0)
  check('an empty seed says so', none.level === 'none', none.level)

  // 180 rows LOOKS fine and is not: about 90 will match, under Meta's floor.
  const flattering = seedReadiness(180)
  check('180 rows is reported as below Meta\'s minimum, not as a seed',
    flattering.level === 'below_meta_minimum', `${flattering.level} matched=${flattering.expectedMatched}`)
  check('…and the message says weighting and exclusion still work today',
    /Weighting and exclusion still work/.test(flattering.message), flattering.message)
  check('…and gives the number of further leads needed',
    flattering.moreNeeded > 0, String(flattering.moreNeeded))

  const thin = seedReadiness(600)
  check('600 rows builds a lookalike but a thin one', thin.level === 'thin', thin.level)
  check('…and says it behaves closer to broad targeting',
    /closer to broad targeting/.test(thin.message), thin.message)

  const ready = seedReadiness(2500)
  check('2,500 rows is a real seed', ready.level === 'ready', ready.level)
  check('the thresholds are the documented ones',
    META_MIN_MATCHED === 100 && SEED_QUALITY_FLOOR === 1000)

  const rows = seedUpload(splitCohorts([
    lead({ id: 'a', status: 'closed', dealValueAed: 2_000_000 }),
    lead({ id: 'b', status: 'closed', email: null, phone: null }),
  ]).seed)
  check('only matchable rows are uploaded', rows.length === 1, JSON.stringify(rows))
  check('and each carries its own value', rows[0].value === 2_000_000, String(rows[0].value))
}

console.log('\n── which layers are actually doing anything ──')
{
  // Full stack 100k. Removing the interest doubles it (load-bearing);
  // removing the second behaviour changes nothing (ignored).
  const layers: LayerProbe[] = [
    { id: 'i1', name: 'Property investment', kind: 'interest', reachWithout: 200_000 },
    { id: 'b1', name: 'Frequent travellers', kind: 'behavior', reachWithout: 101_000 },
    { id: 'x1', name: 'Exclude existing leads', kind: 'exclusion', reachWithout: 130_000 },
  ]
  const a = auditStack({ full: 100_000, baseline: 900_000, layers })

  check('the interest is load-bearing', a.readings.find((r) => r.id === 'i1')!.verdict === 'load_bearing')
  check('the second behaviour is ignored', a.readings.find((r) => r.id === 'b1')!.verdict === 'ignored',
    a.readings.find((r) => r.id === 'b1')!.verdict)
  check('its ignorance rate is ~99%',
    a.readings.find((r) => r.id === 'b1')!.ignoranceRate > 0.98,
    String(a.readings.find((r) => r.id === 'b1')!.ignoranceRate))
  check('the exclusion is measured as a real bite',
    a.readings.find((r) => r.id === 'x1')!.verdict === 'load_bearing')
  check('the readings are ordered by what each layer does, not by input order',
    a.readings[0].id === 'i1', a.readings.map((r) => r.id).join(','))
  check('the recommendation names only the dead layer',
    /Frequent travellers/.test(a.recommendation) && !/Property investment/.test(a.recommendation),
    a.recommendation)
  check('the stack narrowing is reported against geo+age',
    Math.abs(a.stackNarrowing - (1 - 100_000 / 900_000)) < 1e-9, String(a.stackNarrowing))

  // The powers must NOT be presented as a share of a whole — layers overlap.
  const sum = a.readings.reduce((n, r) => n + r.narrowingPower, 0)
  check('individual powers are not forced to sum to 1', Math.abs(sum - 1) > 0.01, String(sum))

  // A stack of pure decoration.
  const dead = auditStack({
    full: 500_000, baseline: 505_000,
    layers: [
      { id: 'a', name: 'A', kind: 'interest', reachWithout: 501_000 },
      { id: 'b', name: 'B', kind: 'behavior', reachWithout: 502_000 },
    ],
  })
  check('a stack where nothing bites is called out as a costume',
    /wearing a costume/.test(dead.recommendation), dead.recommendation)

  const empty = auditStack({ full: 0, baseline: 0, layers: [] })
  check('no estimate does not become a confident 0%',
    /nothing can be measured/.test(empty.headline), empty.headline)
}

console.log('\n── level after level, in the order applied ──')
{
  const steps = levels(1_000_000, [
    { name: 'Interested in apartments', size: 400_000 },
    { name: 'Investor OR first-time buyer', size: 120_000 },
    { name: 'Frequent travellers', size: 119_000 },
  ])
  check('the first level removed 60%', Math.abs(steps[0].share - 0.6) < 1e-9, String(steps[0].share))
  check('the second level removed 70% of what reached it',
    Math.abs(steps[1].share - 0.7) < 1e-9, String(steps[1].share))
  check('the third level is redundant given the ones before it',
    steps[2].redundant, `${steps[2].share}`)
  check('a redundant level is under the same threshold the audit uses',
    steps[2].share < IGNORED_BELOW)
}

console.log('\n── the leak: a mass segment beside a narrow one ──')
{
  // The exact case: "interested in apartments" OR "investor".
  const d = orDominance([
    { id: 'a', name: 'Interested in apartments', size: 12_000_000 },
    { id: 'b', name: 'Investor', size: 300_000 },
  ])!
  check('the mass segment is identified as the dominant one',
    d.dominant.name === 'Interested in apartments', d.dominant.name)
  check('the narrow one is flagged as drowned', d.drowned[0].name === 'Investor')
  check('its ceiling contribution is under 3%', d.drowned[0].maxShare < 0.03,
    String(d.drowned[0].maxShare))
  check('the fix offered is structural, not deletion',
    /Move "Interested in apartments" to the BASE/.test(d.sentence), d.sentence)
  check('…and names the narrowing layer', /narrowing layer/.test(d.sentence))

  // Two intents of comparable scale genuinely blend — no flag.
  check('an investor OR a first-time buyer is a legitimate OR',
    orDominance([
      { id: 'b', name: 'Investor', size: 300_000 },
      { id: 'c', name: 'First-time buyer', size: 500_000 },
    ]) === null)

  check('a single entity cannot dominate anything',
    orDominance([{ id: 'a', name: 'Only', size: 9_000_000 }]) === null)
  check('an unmeasurable group is not reported as healthy',
    orDominance([{ id: 'a', name: 'A', size: null }, { id: 'b', name: 'B', size: null }]) === null)

  const groups = auditGroupBalance([
    { label: 'base', entities: [
      { id: 'a', name: 'Interested in apartments', size: 12_000_000 },
      { id: 'b', name: 'Investor', size: 300_000 },
    ] },
    { label: 'narrowing 1', entities: [
      { id: 'c', name: 'Investor', size: 300_000 },
      { id: 'd', name: 'First-time buyer', size: 500_000 },
    ] },
  ])
  check('only the unbalanced group is reported',
    groups.length === 1 && groups[0].label === 'base', groups.map((g) => g.label).join(','))
}

console.log('\n── the level schema: order, gaps and mirrors ──')
{
  const full: OrderedLevel[] = [
    { name: 'Dubai property buyer persona', level: 1, index: 0 },
    { name: 'Household income top 10%',     level: 2, index: 1 },
    { name: 'Interested in apartments',     level: 3, index: 2 },
    { name: 'Actively looking to move',     level: 4, index: 3 },
  ]
  const good = assessLevelOrder(full)
  check('persona, money, product, decision is correct', good.correct, good.headline)
  check('…with no gaps', good.missing.length === 0, JSON.stringify(good.missing))

  // THE EXPENSIVE INVERSION: product interest applied before money.
  const inverted: OrderedLevel[] = [
    { name: 'Interested in apartments', level: 3, index: 0 },
    { name: 'Household income top 10%', level: 2, index: 1 },
  ]
  const bad = assessLevelOrder(inverted)
  check('product interest above money is out of order', !bad.correct, bad.headline)
  check('…and the headline says the stack pays to reach people it filters out',
    /pays to reach people it filters out/.test(bad.headline), bad.headline)
  check('…and the fix names both levels and the reason',
    /Apply "Household income top 10%" \(level 2, money\) before "Interested in apartments"/.test(bad.recommendation),
    bad.recommendation)

  // A stack with no money level at all.
  const noMoney = assessLevelOrder([
    { name: 'Buyer persona', level: 1, index: 0 },
    { name: 'Interested in apartments', level: 3, index: 1 },
    { name: 'Actively looking', level: 4, index: 2 },
  ])
  check('a missing money level is reported', noMoney.missing.includes(2), JSON.stringify(noMoney.missing))
  check('…with the difference between a lead and a buyer stated',
    /difference between a lead and a buyer/.test(noMoney.recommendation), noMoney.recommendation)

  // The mirror: including level 2 AND excluding level -2 is one job twice.
  const mirrored = assessLevelOrder([
    ...full,
    { name: 'Exclude low-income', level: -2, index: 4 },
  ])
  check('an inclusion and its mirror exclusion are flagged as the same job',
    mirrored.redundantMirrors.length === 1 && mirrored.redundantMirrors[0].level === 2,
    JSON.stringify(mirrored.redundantMirrors.map((r) => r.level)))
  check('…and the advice is to keep the inclusion',
    /Keep the inclusion/.test(mirrored.recommendation), mirrored.recommendation)
  check('mirrorOf is symmetric', mirrorOf(2) === -2 && mirrorOf(-2) === 2)

  // An exclusion with no matching inclusion is NOT redundant. -5 mirrors +5,
  // and this stack has no experimental level, so nothing is being done twice.
  const cleanExclusion = assessLevelOrder([
    ...full,
    { name: 'Negative behaviour trial', level: -5, index: 4 },
  ])
  check('an exclusion whose mirror inclusion is absent is not flagged',
    cleanExclusion.redundantMirrors.length === 0,
    JSON.stringify(cleanExclusion.redundantMirrors))

  // The experimental slot must be last — it may not constrain proven levels.
  const expEarly = assessLevelOrder([
    { name: 'New behaviour trial', level: 5, index: 0 },
    { name: 'Household income top 10%', level: 2, index: 1 },
  ])
  check('an experimental level above a proven one is called out',
    expEarly.experimentalTooEarly, JSON.stringify(expEarly))
  check('…and the reason says it must be droppable on its own',
    /without taking the proven levels with it/.test(expEarly.recommendation), expEarly.recommendation)
  const expLast = assessLevelOrder([...full, { name: 'New behaviour trial', level: 5, index: 4 }])
  check('an experimental level applied last is fine',
    !expLast.experimentalTooEarly && expLast.correct, expLast.headline)
  check('…and level 5 is never reported as a gap', !expLast.missing.includes(5 as never))

  // An unclassifiable layer must not become an accusation.
  const unknown = assessLevelOrder([{ name: 'Mystery', level: null, index: 0 }])
  check('an unplaced layer is skipped, not guessed at',
    unknown.correct && /could be placed/.test(unknown.headline), unknown.headline)
  check('the schema labels are the operator\'s own',
    LEVEL_LABEL[1] === 'Targeted persona' && LEVEL_LABEL[2] === 'Money' &&
    LEVEL_LABEL[4] === 'Decision' && LEVEL_LABEL[-4] === 'Not serious or scared')
  check('there are five inclusion levels and five exclusions',
    INCLUSION_ORDER.length === 5 && EXCLUSION_ORDER.length === 5)
}

console.log('\n── the ladder climbs for the right reason ──')
{
  const base: TierState = { ratio: 0.01, impressions: 400_000, reach: 240_000, leads: 40, spend: 6000, previousReach: 235_000 }
  const account = { leads: 100, impressions: 1_200_000 }

  const saturated = assessTier(base, account)
  check('frequency 1.67 with flat reach and real leads widens',
    saturated.action === 'widen', `${saturated.action}: ${saturated.reason}`)
  check('…to the next rung, not to the top', saturated.nextRatio === 0.02, String(saturated.nextRatio))
  check('the frequency is reported', saturated.frequency > FREQUENCY_CEILING)

  // THE INVERSION THIS EXISTS TO PREVENT: saturated because it is failing.
  const failing = assessTier({ ...base, leads: 0 }, account)
  check('a saturated tier with no leads is STOPPED, never widened',
    failing.action === 'stop', `${failing.action}: ${failing.reason}`)
  check('…and the reason says widening would buy more of what is failing',
    /more of something that is not working/.test(failing.reason), failing.reason)

  const provablyWorse = assessTier({ ...base, leads: 4 }, account)
  check('a saturated tier that converts provably worse is stopped',
    provablyWorse.action === 'stop', `${provablyWorse.action}: ${provablyWorse.reason}`)

  // Still growing — hold.
  const growing = assessTier({ ...base, previousReach: 150_000 }, account)
  check('a tier still finding new people holds', growing.action === 'hold', growing.reason)

  const lowFreq = assessTier({ ...base, impressions: 260_000 }, account)
  check('frequency under the ceiling holds', lowFreq.action === 'hold', lowFreq.reason)

  // First observation: no growth reading yet. Must NOT be read as flat.
  const firstLook = assessTier({ ...base, previousReach: null }, account)
  check('one reach reading is not evidence that reach stopped growing',
    firstLook.action === 'hold', `${firstLook.action}: ${firstLook.reason}`)
  check('…and it says a second reading is what settles it',
    /measured once/.test(firstLook.reason), firstLook.reason)

  const tooEarly = assessTier({ ...base, impressions: MIN_IMPRESSIONS_FOR_LADDER - 1, reach: 1000 }, account)
  check('frequency on a small sample decides nothing',
    tooEarly.action === 'too_early', tooEarly.reason)

  const top = assessTier({ ...base, ratio: LADDER[LADDER.length - 1] }, account)
  check('the widest rung cannot widen further', top.action === 'hold' && top.nextRatio === null)
  check('…and says to change the seed instead',
    /Change the seed/.test(top.reason), top.reason)

  const noRef = assessTier(base)
  check('without an account reference the test is described as weak',
    /weak test/.test(noRef.reason), noRef.reason)
}

if (failures > 0) {
  console.error(`\n${failures} audience-depth rule(s) broken.`)
  process.exit(1)
}
console.log('\nAll audience-depth rules hold.\n')
