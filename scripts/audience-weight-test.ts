/**
 * A WEIGHT IS NOT AN EXCLUSION — locked.
 *
 * This module exists because switching an audience off is a permanent decision
 * taken on a temporary sample: the audience stops producing the leads that
 * would overturn the verdict, so the first bad fortnight becomes the last word
 * on it. Every assertion below defends one of the two properties that keep a
 * weight from silently becoming the exclusion it replaced:
 *
 *   · it never reaches zero, so the audience keeps measuring itself;
 *   · it never moves on a sample that cannot support the claim.
 *
 * Pure — no model, no database, no network. Runs in `pnpm guards`.
 */
import {
  weighAudiences, weightFor, fieldRung,
  MIN_WEIGHT, MAX_WEIGHT, NEUTRAL_WEIGHT, MIN_FIELD_EVENTS,
  WEIGHT_RUNGS, WEIGHT_VERDICTS, weightReads, WEIGHT_SAY_BAND,
  type AudienceRecord,
} from '../lib/freehold/audience-weight'
import { lm_ads } from '../lib/i18n/dictionaries/lm_ads'
import { splitBudget, type SplitRow } from '../lib/freehold/budget-split'
import { medianMinutes } from '../lib/freehold/audience-outcomes'
import { SLOW_RESPONSE_MULTIPLE } from '../lib/freehold/hour-truth'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const rec = (key: string, leads: number, qualified: number, won = 0, wait?: number | null): AudienceRecord =>
  ({ key, leads, qualified, won, medianResponseMinutes: wait ?? null })
const byKey = (ws: ReturnType<typeof weighAudiences>, k: string) => ws.find((w) => w.key === k)!

console.log('\n── the floor is the whole point ──')
{
  check('MIN_WEIGHT is above zero — a weight deprioritises, it never excludes',
    MIN_WEIGHT > 0, String(MIN_WEIGHT))
  check('…and it leaves a real share, not a token one', MIN_WEIGHT >= 0.1, String(MIN_WEIGHT))
  check('the ceiling is above neutral and bounded', MAX_WEIGHT > NEUTRAL_WEIGHT && MAX_WEIGHT <= 5,
    String(MAX_WEIGHT))
  check('neutral is exactly 1 — it must be a no-op multiplier', NEUTRAL_WEIGHT === 1)

  // The source itself, so a later edit cannot quietly reintroduce the exclusion.
  const src = readFileSync(join(process.cwd(), 'lib/freehold/audience-weight.ts'), { encoding: 'utf8' })
  check('the floor is stated as a constant, not derived from data',
    /export const MIN_WEIGHT = 0\.\d+/.test(src))
  check('…and its comment says why it is not zero',
    /NOT AN EXCLUSION/.test(src) && /never 0/.test(src))
}

console.log('\n── nothing moves without a field to compare against ──')
{
  check('an empty account ranks nothing', fieldRung([]) === 'none')
  const thin = [rec('a', 40, 2), rec('b', 40, 2)]
  check(`a field under MIN_FIELD_EVENTS (${MIN_FIELD_EVENTS}) ranks nothing`,
    fieldRung(thin) === 'none', fieldRung(thin))
  check('…and every audience comes back neutral',
    weighAudiences(thin).every((w) => w.weight === NEUTRAL_WEIGHT && w.verdict === 'unknown'))

  const qualifiedField = [rec('a', 100, 10), rec('b', 100, 10)]
  check('enough qualified leads ranks on qualified', fieldRung(qualifiedField) === 'qualified')
  const dealField = [rec('a', 100, 40, 4), rec('b', 100, 40, 4)]
  check('enough deals ranks on deals — the rung the business is paid on',
    fieldRung(dealField) === 'deal')
}

console.log('\n── a verdict only where the interval clears the field rate ──')
{
  // 10/100 against 10/100: the Poisson interval on 10 spans the field rate.
  const tied = weighAudiences([rec('a', 100, 10), rec('b', 100, 10)])
  check('two identical audiences tie', byKey(tied, 'a').verdict === 'tied')
  check('…and a tie is exactly neutral, never a nudge',
    byKey(tied, 'a').weight === NEUTRAL_WEIGHT, String(byKey(tied, 'a').weight))

  // 2/100 against 30/100 — separated, and hard.
  const worse = weighAudiences([rec('bad', 100, 2), rec('good', 100, 30)])
  check('an audience whose leads provably convert worse is marked worse',
    byKey(worse, 'bad').verdict === 'worse', byKey(worse, 'bad').verdict)
  check('…and weighted down', byKey(worse, 'bad').weight < NEUTRAL_WEIGHT,
    String(byKey(worse, 'bad').weight))
  check('…but NEVER below the floor, however bad it looks',
    byKey(worse, 'bad').weight >= MIN_WEIGHT, String(byKey(worse, 'bad').weight))
  check('the counterpart is marked better', byKey(worse, 'good').verdict === 'better')
  check('…and never above the ceiling',
    byKey(worse, 'good').weight <= MAX_WEIGHT, String(byKey(worse, 'good').weight))

  check('the bound reported for "worse" is the one that faced the field rate',
    byKey(worse, 'bad').bound !== null && byKey(worse, 'bad').bound! < byKey(worse, 'bad').fieldRate!,
    JSON.stringify(byKey(worse, 'bad')))
  check('the bound reported for "better" is above it',
    byKey(worse, 'good').bound! > byKey(worse, 'good').fieldRate!)

  // A moderate, genuinely unclamped reading — proves the scale is real and not
  // a three-valued switch wearing a decimal.
  const mild = weighAudiences([rec('a', 100, 20), rec('b', 100, 10)])
  const w = byKey(mild, 'a').weight
  check('a moderate advantage lands strictly between neutral and the ceiling',
    w > NEUTRAL_WEIGHT && w < MAX_WEIGHT, String(w))
}

console.log('\n── an unknown is never a penalty ──')
{
  const withEmpty = weighAudiences([rec('never-run', 0, 0), rec('a', 100, 30), rec('b', 100, 3)])
  check('an audience with no leads is unknown, not worst',
    byKey(withEmpty, 'never-run').verdict === 'unknown')
  check('…and keeps a neutral weight, so it can still be tried',
    byKey(withEmpty, 'never-run').weight === NEUTRAL_WEIGHT)

  const alone = weighAudiences([rec('only', 200, 40)])
  check('one audience carrying the whole account cannot be compared to itself',
    byKey(alone, 'only').verdict === 'unknown' && byKey(alone, 'only').weight === NEUTRAL_WEIGHT,
    JSON.stringify(byKey(alone, 'only')))

  const noConversions = weighAudiences([rec('a', 100, 6), rec('b', 100, 0)])
  check('an audience the rest of the field never converted against is unranked',
    byKey(noConversions, 'a').verdict === 'unknown', byKey(noConversions, 'a').verdict)

  check('weightFor on an unmeasured key is neutral, not zero',
    weightFor(weighAudiences([rec('a', 100, 30), rec('b', 100, 3)]), 'nope') === NEUTRAL_WEIGHT)
  check('weightFor on a missing key is neutral', weightFor([], null) === NEUTRAL_WEIGHT)

  // The dominant arm is the one whose weight moves the most money, so it must
  // still be able to separate. Compared against the WHOLE it never could.
  const dominant = weighAudiences([rec('big', 900, 18), rec('small', 100, 30)])
  check('a dominant audience is compared against the REST, so it can still separate',
    byKey(dominant, 'big').verdict === 'worse', byKey(dominant, 'big').verdict)
}

console.log('\n── every walkable value is covered ──')
{
  check('rungs are walkable and include the no-signal answer',
    WEIGHT_RUNGS.includes('none') && WEIGHT_RUNGS.length === 3)
  check('verdicts are walkable and include unknown and unanswered',
    WEIGHT_VERDICTS.includes('unknown') && WEIGHT_VERDICTS.includes('unanswered') &&
    WEIGHT_VERDICTS.length === 5)
  const all = weighAudiences([rec('x', 0, 0), rec('bad', 100, 2), rec('good', 100, 30), rec('mid', 100, 10)])
  const seen = new Set(all.map((w) => w.verdict))
  check('a realistic table produces better, worse, tied and unknown together',
    ['better', 'worse', 'tied', 'unknown'].every((v) => seen.has(v as never)),
    [...seen].join(','))
  check('every weight in that table is inside the bounds',
    all.every((w) => w.weight >= MIN_WEIGHT && w.weight <= MAX_WEIGHT))
}

console.log('\n── the split spends the weight, and only the surplus ──')
{
  const arm = (id: string, over: Partial<SplitRow> = {}): SplitRow => ({
    campaignId: id, dailyBudgetAed: 400, standing: 'tied', saturated: false, ...over,
  })
  const opts = { capAed: 2000, costPerLeadAed: 50 }
  const targetOf = (res: ReturnType<typeof splitBudget>, id: string) =>
    res.plans.find((p) => p.campaignId === id)!.targetAed

  const plain = splitBudget([arm('a'), arm('b'), arm('c')], opts)
  const equal = plain.plans.map((p) => p.targetAed)
  check('with no weights the split is exactly the equal one it always was',
    new Set(equal).size === 1, equal.join(','))

  const weighted = splitBudget(
    [arm('a', { audienceWeight: 2 }), arm('b', { audienceWeight: 1 }), arm('c', { audienceWeight: MIN_WEIGHT })],
    opts,
  )
  check('the better audience takes more of the surplus',
    targetOf(weighted, 'a') > targetOf(weighted, 'b'), `a=${targetOf(weighted, 'a')} b=${targetOf(weighted, 'b')}`)
  check('the weaker one takes less', targetOf(weighted, 'c') < targetOf(weighted, 'b'),
    `c=${targetOf(weighted, 'c')} b=${targetOf(weighted, 'b')}`)

  // THE PROPERTY THAT MATTERS. A weighted-down arm is deprioritised, not shut
  // off: it keeps the base that lets it go on producing evidence.
  check('a weighted-down arm is never starved',
    weighted.plans.find((p) => p.campaignId === 'c')!.action !== 'starve',
    weighted.plans.find((p) => p.campaignId === 'c')!.action)
  // Not "at least its equal share" — the point of a weight is that the share
  // moves. The floor it may never cross is the LEARNING BASE, the money that
  // buys the evidence, which is what `perArmAed` is.
  check('…and keeps the full learning base, so it goes on producing evidence',
    plain.perArmAed !== null && targetOf(weighted, 'c') >= plain.perArmAed,
    `c=${targetOf(weighted, 'c')} base=${plain.perArmAed}`)

  check('the cap is still respected — a weight redistributes, it does not add money',
    weighted.plans.reduce((n, p) => n + p.targetAed, 0) <= opts.capAed + 2,
    String(weighted.plans.reduce((n, p) => n + p.targetAed, 0)))

  const broken = splitBudget(
    [arm('a', { audienceWeight: 0 }), arm('b', { audienceWeight: Number.NaN }), arm('c', { audienceWeight: -3 })],
    opts,
  )
  check('a zero, a NaN and a negative weight all fall back to neutral rather than starving an arm',
    new Set(broken.plans.map((p) => p.targetAed)).size === 1 && broken.plans.every((p) => p.action !== 'starve'),
    broken.plans.map((p) => `${p.campaignId}=${p.targetAed}/${p.action}`).join(' '))

  // Source scan: the weight must never reach the learning base.
  const src = readFileSync(join(process.cwd(), 'lib/freehold/budget-split.ts'), { encoding: 'utf8' })
  const baseLine = src.split('\n').find((l) => l.includes('const base =')) ?? ''
  check('the learning base is computed without any weight in it',
    !/audienceWeight|audienceWeightOf/.test(baseLine), baseLine.trim())
  check('the weight is applied where the surplus is shared out',
    /spare \* share/.test(src) && /audienceWeightOf/.test(src))
  check('…and the comment says why the base is off limits',
    /ONLY PLACE AUDIENCE QUALITY MAY SPEAK/.test(src))
}

console.log('\n── the route actually spends it ──')
{
  // A weight nothing reads is the failure this repo keeps finding: a number
  // computed correctly, logged, and acted on by nobody. `audience-outcomes.ts`
  // sat in exactly that state until this change, so the wiring is asserted at
  // the source rather than trusted.
  const route = readFileSync(join(process.cwd(), 'app/api/ads/budget-split/route.ts'), { encoding: 'utf8' })

  check('the route computes the weights', /weighAudiences\(/.test(route))
  check('…from the audience outcomes the CRM already had',
    /audienceOutcomes\(\)/.test(route))
  check('…and knows which audience each campaign came from',
    /campaignAudienceKeys\(\)/.test(route))

  const rowsBlock = route.slice(route.indexOf('const rows: SplitRow[]'), route.indexOf('const cap ='))
  check('the weight reaches the SplitRow the allocator actually reads',
    /audienceWeight:\s*weightFor\(/.test(rowsBlock), rowsBlock.slice(0, 200))

  // BOTH READS MUST DEGRADE. They add a preference to an allocation that is
  // already correct without them; a database that will not answer must give
  // the neutral split, never a 502 on a panel that used to work.
  check('the outcomes read cannot fail the panel', /audienceOutcomes\(\)\.catch\(/.test(route))
  check('the campaign→audience read cannot fail the panel',
    /campaignAudienceKeys\(\)\.catch\(/.test(route))

  check('the rung is reported, so the screen never implies a precision the account lacks',
    /audienceRung/.test(route))
}

console.log('\n── the rota gets asked before the audience is blamed ──')
{
  // The same audience record twice. The only difference is how long its leads
  // waited for somebody to pick up the phone.
  const answered = weighAudiences([rec('slow', 100, 2, 0, 30), rec('good', 100, 30, 0, 30)])
  check('answered as fast as the rest, a bad rate is the audience',
    byKey(answered, 'slow').verdict === 'worse', byKey(answered, 'slow').verdict)
  check('…and it is weighted down', byKey(answered, 'slow').weight < NEUTRAL_WEIGHT)

  const ignored = weighAudiences([
    rec('slow', 100, 2, 0, 30 * SLOW_RESPONSE_MULTIPLE), rec('good', 100, 30, 0, 30),
  ])
  check('the identical rate, with leads left waiting, is the ROTA not the audience',
    byKey(ignored, 'slow').verdict === 'unanswered', byKey(ignored, 'slow').verdict)
  check('…and its budget is untouched — cutting it would delete the evidence',
    byKey(ignored, 'slow').weight === NEUTRAL_WEIGHT, String(byKey(ignored, 'slow').weight))
  check('…just under the multiple is still the audience, not the rota',
    weighAudiences([rec('slow', 100, 2, 0, 30 * SLOW_RESPONSE_MULTIPLE - 1), rec('good', 100, 30, 0, 30)])
      .find((w) => w.key === 'slow')!.verdict === 'worse')

  // ASYMMETRIC ON PURPOSE, the same way hour-truth only lets 'weak' drop an
  // hour. A winner answered fast is not re-examined: being wrong about a
  // winner costs surplus, being wrong about a loser costs the evidence.
  check('a WINNER is never withheld for being answered quickly',
    weighAudiences([rec('fast', 100, 30, 0, 5), rec('rest', 100, 3, 0, 200)])
      .find((w) => w.key === 'fast')!.verdict === 'better')

  check('an account nobody timed blames nobody',
    weighAudiences([rec('a', 100, 2), rec('b', 100, 30)]).find((w) => w.key === 'a')!.verdict === 'worse')
  check('an instant desk is never the yardstick for slowness',
    weighAudiences([rec('slow', 100, 2, 0, 90), rec('good', 100, 30, 0, 0)])
      .find((w) => w.key === 'slow')!.verdict === 'worse')

  check('the multiple is imported from hour-truth, not restated',
    /SLOW_RESPONSE_MULTIPLE/.test(
      readFileSync(join(process.cwd(), 'lib/freehold/audience-weight.ts'), { encoding: 'utf8' })
        .split('\n').filter((l) => l.startsWith('import')).join('\n')))

  check('the wait is a median, so one nine-day reply cannot condemn a quick desk',
    medianMinutes([5, 5, 5, 5, 13000]) === 5, String(medianMinutes([5, 5, 5, 5, 13000])))
  check('an even count takes the middle pair', medianMinutes([10, 20, 30, 40]) === 25)
  check('nobody answered is null, never zero', medianMinutes([null, undefined]) === null)
  check('an unanswered lead does not pull the median down',
    medianMinutes([null, 60, null]) === 60)
}

console.log('\n── the screen says the thing, not the multiplier ──')
{
  check('exactly neutral is worth no sentence', weightReads(NEUTRAL_WEIGHT) === null)
  check('a gap inside the band is worth no sentence — it is noise, not a finding',
    weightReads(NEUTRAL_WEIGHT + WEIGHT_SAY_BAND / 2) === null &&
    weightReads(NEUTRAL_WEIGHT - WEIGHT_SAY_BAND / 2) === null)
  check('at the band it speaks', weightReads(NEUTRAL_WEIGHT + WEIGHT_SAY_BAND) === 'more' &&
    weightReads(NEUTRAL_WEIGHT - WEIGHT_SAY_BAND) === 'less')
  check('the ceiling reads as more and the floor as less',
    weightReads(MAX_WEIGHT) === 'more' && weightReads(MIN_WEIGHT) === 'less')
  check('a floored weight is always outside the band, so the floor is never silent',
    NEUTRAL_WEIGHT - MIN_WEIGHT > WEIGHT_SAY_BAND, `${NEUTRAL_WEIGHT - MIN_WEIGHT} vs ${WEIGHT_SAY_BAND}`)
  check('a NaN says nothing rather than guessing', weightReads(Number.NaN) === null)

  const panel = readFileSync(join(process.cwd(), 'components/freehold/budget-split-panel.tsx'), { encoding: 'utf8' })
  check('the panel asks the module rather than keeping its own threshold',
    /weightReads\(/.test(panel) && !/audienceWeight\s*[<>]/.test(panel))
  check('the panel never prints the multiplier itself',
    !/\{p\.audienceWeight\}/.test(panel) && !/audienceWeight[^)]*toFixed/.test(panel))
  check('the rota line replaces the buyer line rather than joining it',
    /audienceVerdict === 'unanswered'/.test(panel) &&
    /audienceVerdict !== 'unanswered'/.test(panel))
  for (const locale of ['en', 'ar', 'ru'] as const) {
    check(`${locale}: the rota sentence exists and names the audience`,
      (lm_ads[locale]['split.audience.unanswered'] ?? '').includes('{audience}'))
  }
  check('the rung line is withheld unless the account earned one',
    /audienceRung === 'deal'/.test(panel) && /audienceRung === 'qualified'/.test(panel) &&
    !/audienceRung === 'none'/.test(panel))

  // THE PROMISE, IN EVERY LANGUAGE. A row that only said "takes less" reads as
  // "switched off", which is the thing this feature exists not to do — so the
  // 'less' copy carries a second sentence saying it keeps running, and a
  // translation that drops it fails here rather than on somebody's screen.
  for (const locale of ['en', 'ar', 'ru'] as const) {
    const d = lm_ads[locale]
    const less = d['split.audience.less'] ?? ''
    const more = d['split.audience.more'] ?? ''
    check(`${locale}: both audience sentences exist`, less.length > 0 && more.length > 0)
    check(`${locale}: 'less' names the audience`, less.includes('{audience}'))
    check(`${locale}: 'less' carries the second sentence promising it keeps running`,
      (less.match(/[.!?۔]/g) ?? []).length >= 2, less)
    check(`${locale}: 'more' does not`, (more.match(/[.!?۔]/g) ?? []).length === 1, more)
    check(`${locale}: both rung sentences exist`,
      (d['split.audience.rankedOnDeals'] ?? '').length > 0 &&
      (d['split.audience.rankedOnQualified'] ?? '').length > 0)
  }
}

if (failures > 0) {
  console.error(`\n${failures} audience-weight guard(s) broken.`)
  process.exit(1)
}
console.log('\nA weight deprioritises. It never excludes.\n')
