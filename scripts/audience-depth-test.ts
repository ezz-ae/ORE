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
  auditStack, levels, orDominance, auditGroupBalance, assessLevelOrder, touchDepth,
  mirrorOf, LEVEL_LABEL, LEVEL_ROLE, LEVEL_WEIGHT, INCLUSION_ORDER, EXCLUSION_ORDER,
  IGNORED_BELOW, type LayerProbe, type OrderedLevel,
} from '../lib/freehold/layer-audit'
import {
  assessTier, LADDER, FREQUENCY_CEILING, MIN_IMPRESSIONS_FOR_LADDER, type TierState,
} from '../lib/freehold/lookalike-ladder'
import {
  coldArms, warmArms, planArms, MIN_ARM_DAILY_AED, RETARGET_WEIGHT, ARM_DOCTRINE,
} from '../lib/freehold/level-arms'

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

console.log('\n── narrowing is a closer touch, not fewer people ──')
{
  // The doctrine: target 1, expect 2, appreciate 3, value 4, try 5.
  const weighted: OrderedLevel[] = [
    { name: 'Dubai property buyer persona', level: 1, hardRule: true,  index: 0 },
    { name: 'Household income top 10%',     level: 2, hardRule: false, index: 1 },
    { name: 'Interested in apartments',     level: 3, hardRule: false, index: 2 },
    { name: 'Actively looking to move',     level: 4, hardRule: false, index: 3 },
  ]
  const good = assessLevelOrder(weighted)
  check('the persona as the buy with the rest as weights is correct',
    good.correct, good.headline)
  check('…and the headline says level 1 is the buy',
    /Level 1 is the buy/.test(good.headline), good.headline)

  // THE DESTRUCTIVE STACK: every level as a hard AND.
  const allRules: OrderedLevel[] = weighted.map((l) => ({ ...l, hardRule: true }))
  const bad = assessLevelOrder(allRules)
  check('levels 2-4 as hard rules is flagged', !bad.correct, bad.headline)
  check('…and the headline names what it costs',
    /discards people who match four levels out of five/.test(bad.headline), bad.headline)
  check('…and the advice uses the level\'s own verb',
    /We expect this level, we do not require it/.test(bad.recommendation), bad.recommendation)
  check('the persona itself is never flagged for being a rule',
    !bad.ruledNotWeighted.some((l) => l.level === 1),
    bad.ruledNotWeighted.map((l) => l.level).join(','))

  const noPersona = assessLevelOrder([
    { name: 'Household income top 10%', level: 2, hardRule: false, index: 0 },
  ])
  check('a stack with no persona has no buy', noPersona.missingPersona, noPersona.headline)
  check('…and is not called correct', !noPersona.correct)

  const expRule = assessLevelOrder([
    ...weighted,
    { name: 'New behaviour trial', level: 5, hardRule: true, index: 4 },
  ])
  check('an experimental level used as a gate is called out',
    expRule.experimentalAsRule, JSON.stringify(expRule.ruledNotWeighted.map((l) => l.level)))
  check('…and the reason says an experiment must not become an assumption',
    /quietly becomes an assumption/.test(expRule.recommendation), expRule.recommendation)
  const expWeight = assessLevelOrder([...weighted, { name: 'New behaviour trial', level: 5, hardRule: false, index: 4 }])
  check('the same experiment carried as a weight is fine',
    expWeight.correct && !expWeight.experimentalAsRule, expWeight.headline)
}

console.log('\n── touch depth: more levels, closer touch ──')
{
  const only1 = touchDepth([1])
  const deep = touchDepth([1, 2, 4])
  const deepest = touchDepth([1, 2, 3, 4])
  check('matching the persona alone still scores', only1.score > 0, String(only1.score))
  check('more levels is a closer touch', deep.score > only1.score, `${deep.score} vs ${only1.score}`)
  check('and more again is closer still', deepest.score > deep.score, `${deepest.score} vs ${deep.score}`)
  check('a decision match is worth more than a money match',
    LEVEL_WEIGHT[4] > LEVEL_WEIGHT[2], `${LEVEL_WEIGHT[4]} vs ${LEVEL_WEIGHT[2]}`)
  check('an experimental match is worth the least of the positives',
    LEVEL_WEIGHT[5] < LEVEL_WEIGHT[2] && LEVEL_WEIGHT[5] < LEVEL_WEIGHT[3],
    String(LEVEL_WEIGHT[5]))

  // Outside the persona is not a weaker touch — it is a different person.
  const outside = touchDepth([2, 3, 4])
  check('money and intent without the persona scores zero', outside.score === 0, String(outside.score))
  check('…and says why', /different person/.test(outside.description), outside.description)

  check('the description is legible', deep.description === 'targeted persona + money + decision',
    deep.description)
  check('duplicates do not inflate the score',
    touchDepth([1, 2, 2, 2]).score === touchDepth([1, 2]).score)

  // The verbs are the doctrine.
  check('the roles are target, expect, appreciate, value, try',
    LEVEL_ROLE[1] === 'target' && LEVEL_ROLE[2] === 'expect' && LEVEL_ROLE[3] === 'appreciate' &&
    LEVEL_ROLE[4] === 'value' && LEVEL_ROLE[5] === 'try')
}

console.log('\n── a proven-bad fact earns a rule; a hoped-for positive earns a weight ──')
{
  const full: OrderedLevel[] = [
    { name: 'Buyer persona', level: 1, hardRule: true, index: 0 },
    { name: 'Household income top 10%', level: 2, hardRule: false, index: 1 },
    { name: 'Interested in apartments', level: 3, hardRule: false, index: 2 },
    { name: 'Actively looking', level: 4, hardRule: false, index: 3 },
  ]
  const mirrored = assessLevelOrder([...full, { name: 'Exclude low-income', level: -2, hardRule: true, index: 4 }])
  check('an inclusion and its mirror exclusion are flagged as the same job',
    mirrored.redundantMirrors.length === 1 && mirrored.redundantMirrors[0].level === 2,
    JSON.stringify(mirrored.redundantMirrors.map((r) => r.level)))
  check('…and the advice keeps the EXCLUSION, not the inclusion',
    /Keep the exclusion/.test(mirrored.recommendation), mirrored.recommendation)
  check('mirrorOf is symmetric', mirrorOf(2) === -2 && mirrorOf(-2) === 2)

  const cleanExclusion = assessLevelOrder([...full, { name: 'Negative trial', level: -5, hardRule: true, index: 4 }])
  check('an exclusion whose mirror inclusion is absent is not flagged',
    cleanExclusion.redundantMirrors.length === 0, JSON.stringify(cleanExclusion.redundantMirrors))

  const noMoney = assessLevelOrder([
    { name: 'Buyer persona', level: 1, hardRule: true, index: 0 },
    { name: 'Interested in apartments', level: 3, hardRule: false, index: 1 },
  ])
  check('a missing money level is reported even in a weighted stack',
    noMoney.missing.includes(2), JSON.stringify(noMoney.missing))
  check('…with the difference between a lead and a buyer stated',
    /difference between a lead and a buyer/.test(noMoney.recommendation), noMoney.recommendation)

  const unknown = assessLevelOrder([{ name: 'Mystery', level: null, index: 0 }])
  check('an unplaced layer is skipped, not guessed at',
    /could be placed/.test(unknown.headline), unknown.headline)
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

console.log('\n── every level is an ad set, because Meta only knows MUST ──')
{
  const arms = coldArms([1, 2, 3, 4])
  check('there is one arm per cumulative level', arms.length === 4, String(arms.length))
  check('the first arm is the persona alone',
    arms[0].levels.length === 1 && arms[0].levels[0] === 1, JSON.stringify(arms[0].levels))
  check('each arm adds exactly one level to the one before it',
    arms.every((a, i) => i === 0 || a.levels.length === arms[i - 1].levels.length + 1),
    arms.map((a) => a.levels.join('+')).join(' | '))
  check('the deepest arm carries every level', arms[3].levels.length === 4)
  check('an arm is weighted by the level it ADDS, not by its length',
    arms[3].weight === 2.5, String(arms[3].weight))
  check('the persona arm explains why it must exist',
    /never labelled/.test(arms[0].rationale), arms[0].rationale)
  check('a schema with only a persona produces exactly one arm',
    coldArms([1]).length === 1)
}

console.log('\n── weighting lives in the budget split ──')
{
  const plan = planArms(coldArms([1, 2, 3, 4]), 1000)
  check('every arm clears the delivery floor',
    plan.arms.every((p) => p.dailyBudgetAed >= MIN_ARM_DAILY_AED),
    plan.arms.map((p) => `${p.arm.label}:${p.dailyBudgetAed}`).join(' | '))
  const persona = plan.arms.find((p) => p.arm.kind === 'cold' && p.arm.levels.length === 1)!
  check('the persona arm keeps its floor', persona.share >= 0.25 - 1e-9, String(persona.share))
  check('shares sum to 1', Math.abs(plan.arms.reduce((n, p) => n + p.share, 0) - 1) < 1e-9)
  check('the headline says each arm is also an experiment',
    /clean experiment/.test(plan.headline), plan.headline)

  // A budget too small to split: arms are DROPPED, not launched starved.
  const tight = planArms(coldArms([1, 2, 3, 4]), 200)
  check('a tight budget drops arms rather than starving them',
    tight.arms.every((p) => p.dailyBudgetAed >= MIN_ARM_DAILY_AED),
    tight.arms.map((p) => p.dailyBudgetAed).join(','))
  check('…and says which were dropped and why',
    tight.notes.length > 0 && /below the AED 50/.test(tight.notes[0]), tight.notes.join(' '))
  check('…and keeps the persona arm', tight.arms.some((p) => p.arm.kind === 'cold' && p.arm.levels.length === 1))

  const hopeless = planArms(coldArms([1, 2, 3, 4]), 30)
  check('a budget below one arm plans nothing rather than something broken',
    hopeless.arms.length === 0, JSON.stringify(hopeless.arms.length))
  check('…and says so', /cannot support even one arm/.test(hopeless.headline), hopeless.headline)

  check('no budget produces no plan', planArms([], 500).arms.length === 0)
}

console.log('\n── retargeting is its own axis ──')
{
  const warm = warmArms(['saw_ad', 'visited', 'started_form'])
  check('the form-starter outweighs everyone', RETARGET_WEIGHT.started_form > RETARGET_WEIGHT.visited &&
    RETARGET_WEIGHT.visited > RETARGET_WEIGHT.saw_ad)
  check('and outweighs every cold level', RETARGET_WEIGHT.started_form > 2.5,
    String(RETARGET_WEIGHT.started_form))
  check('the form-starter arm says why it is usually starved',
    /usually starved/.test(warm.find((a) => a.rung === 'started_form')!.rationale))

  const mixed = planArms([...coldArms([1, 2, 4]), ...warm], 2000)
  check('cold and warm arms plan together',
    mixed.arms.some((p) => p.arm.kind === 'cold') && mixed.arms.some((p) => p.arm.kind === 'warm'))
  const starter = mixed.arms.find((p) => p.arm.kind === 'warm' && p.arm.rung === 'started_form')!
  const deepest = mixed.arms.find((p) => p.arm.kind === 'cold' && p.arm.levels.length === 3)!
  check('the form-starter arm outfunds the deepest cold arm',
    starter.dailyBudgetAed > deepest.dailyBudgetAed,
    `${starter.dailyBudgetAed} vs ${deepest.dailyBudgetAed}`)
  check('the doctrine travels with the plan',
    ARM_DOCTRINE.length === 4 && ARM_DOCTRINE.some((d) => /only offers MUST/.test(d)))
}

if (failures > 0) {
  console.error(`\n${failures} audience-depth rule(s) broken.`)
  process.exit(1)
}
console.log('\nAll audience-depth rules hold.\n')
