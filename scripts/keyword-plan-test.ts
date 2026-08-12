/**
 * WHAT THIS ACCOUNT IS ALLOWED TO BID ON — locked.
 *
 * A keyword is a real bid, in a real auction, with real money, and a wrong one
 * is worse than a missing one because it looks like work. So the assertions
 * here are about the four ways a generated plan spends money it should not:
 *
 *   · INVENTING a field. "apartments for sale in undefined" is a live bid.
 *   · Sending a click to a page that does not answer it — Google prices the
 *     click by exactly that, and a homepage answers nothing.
 *   · Advertising a property whose Trakheesi permit does not allow it.
 *   · Promising something the property cannot deliver, like a Golden Visa on a
 *     unit below the government threshold.
 *
 * Pure — no network. Runs in `pnpm guards`.
 */
import {
  planKeywords, selectProjectsToPlan, negativeKeywords, priceWord, planKeywordCount,
  AD_GROUP_KINDS, PLAN_WITHHELD, NEGATIVE_GROUPS,
  GOLDEN_VISA_AED, MIN_OPPORTUNITY_TO_PLAN, MAX_KEYWORD_CHARS,
  type PlanProject,
} from '../lib/google/keyword-plan'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const TODAY = new Date('2026-08-12T09:00:00+04:00')

const project = (o: Partial<PlanProject> = {}): PlanProject => ({
  slug: 'azizi-venice',
  name: 'Azizi Venice',
  area: 'Dubai South',
  developer: 'Azizi',
  type: 'apartment',
  startingPriceAED: 1_600_000,
  paymentPlan: '10/90',
  handoverYear: 2027,
  landingUrl: 'https://www.freeholdproperty.ae/site/azizi-venice',
  permitNumber: '71234567',
  permitExpiry: '2027-01-31',
  ...o,
})

const allText = (p: ReturnType<typeof planKeywords>) =>
  p.groups.flatMap((g) => g.keywords.map((k) => k.text))

console.log('\n── nothing is bid on that was not stored ──')
{
  // THE FAILURE THIS PREVENTS: a template that interpolates a missing field
  // produces "buy apartments undefined" and bids on it with real money.
  const bare = planKeywords(project({ area: null, developer: null, paymentPlan: null, handoverYear: null }), TODAY)
  const texts = allText(bare)
  check('no keyword contains an empty or undefined field',
    !texts.some((t) => /undefined|null|\bnan\b|\s{2,}/.test(t)), texts.filter((t) => /undefined|null/.test(t)).join(', '))
  check('…and the groups that needed those fields are WITHHELD, not guessed',
    bare.withheld.some((w) => w.kind === 'areaType' && w.why === 'noArea')
    && bare.withheld.some((w) => w.kind === 'developer' && w.why === 'noDeveloper'),
    JSON.stringify(bare.withheld))
  check('…while the project\'s own name still gets bought — it needs nothing else',
    bare.groups.some((g) => g.kind === 'projectName'), bare.groups.map((g) => g.kind).join(','))

  const full = planKeywords(project(), TODAY)
  // A complete record withholds nothing for a MISSING FIELD. It may still
  // withhold on a RULE — this fixture is priced under the Golden Visa
  // threshold — and those two are different failures with different answers:
  // one is somebody to chase for data, the other is the property itself.
  const fieldGaps = full.withheld.filter((w) => w.why.startsWith('no'))
  check('a complete record withholds nothing for a missing field',
    fieldGaps.length === 0, JSON.stringify(fieldGaps))
  check('…and the real field values are the ones used',
    allText(full).some((t) => t.includes('dubai south')) && allText(full).some((t) => t.includes('azizi')),
    allText(full).slice(0, 4).join(' | '))
}

console.log('\n── every click goes to the page that answers it ──')
{
  // Google prices a click by how well the page answers the query. A generic
  // homepage answers none of them, which is the single most common reason a
  // property Search account pays double.
  const p = planKeywords(project(), TODAY)
  check('every group carries a landing URL',
    p.groups.every((g) => !!g.landingUrl), p.groups.filter((g) => !g.landingUrl).map((g) => g.kind).join(','))
  check('…and it is the project\'s own page, not a homepage',
    p.groups.every((g) => g.landingUrl.includes('/site/azizi-venice')))

  const noPage = planKeywords(project({ landingUrl: null }), TODAY)
  check('no page means NOTHING is planned, rather than pointing somewhere wrong',
    noPage.blocked === 'noLandingPage' && noPage.groups.length === 0, String(noPage.blocked))
}

console.log('\n── the permit gate applies to the PLAN, not only to the launch ──')
{
  // Advertising a Dubai property without a valid Trakheesi permit is a
  // regulatory breach. The machine already stops LIVE campaigns on expiry; a
  // planner that proposed keywords anyway would be proposing the same breach
  // one step earlier, where it is easier to miss.
  const noPermit = planKeywords(project({ permitNumber: null }), TODAY)
  check('a project with no permit plans nothing', noPermit.blocked === 'noPermit', String(noPermit.blocked))

  const expired = planKeywords(project({ permitExpiry: '2026-08-11' }), TODAY)
  check('a permit that expired yesterday plans nothing', expired.blocked === 'permitExpired', String(expired.blocked))

  // The boundary matters: a permit is valid THROUGH its expiry date in Dubai
  // time, and treating it as dead at midnight UTC would stop a legal campaign
  // four hours early.
  const today = planKeywords(project({ permitExpiry: '2026-08-12' }), TODAY)
  check('…and one expiring today is still valid', today.blocked === null, String(today.blocked))
}

console.log('\n── never promise what the property cannot deliver ──')
{
  const rich = planKeywords(project({ startingPriceAED: GOLDEN_VISA_AED }), TODAY)
  check(`at exactly AED ${GOLDEN_VISA_AED.toLocaleString()} the visa group is bought`,
    rich.groups.some((g) => g.kind === 'goldenVisa'))

  const poor = planKeywords(project({ startingPriceAED: GOLDEN_VISA_AED - 1 }), TODAY)
  check('one dirham under the government threshold, and it is not',
    !poor.groups.some((g) => g.kind === 'goldenVisa'), poor.groups.map((g) => g.kind).join(','))
  check('…and the reason names the threshold rather than a missing field',
    poor.withheld.some((w) => w.kind === 'goldenVisa' && w.why === 'belowVisaThreshold'),
    JSON.stringify(poor.withheld))

  // A payment-plan keyword invented for a project with no stored plan is a
  // false claim in a live ad, not merely a bad bid.
  const noPlan = planKeywords(project({ paymentPlan: null }), TODAY)
  check('no stored payment plan means no payment-plan keywords',
    !noPlan.groups.some((g) => g.kind === 'paymentPlan'))
}

console.log('\n── budget keywords round UP, because rounding down cannot convert ──')
{
  // "under 1.5m" bought for a 1.6m property pays for a click that was never
  // going to buy it.
  const p = planKeywords(project({ startingPriceAED: 1_600_000 }), TODAY)
  const budget = p.groups.find((g) => g.kind === 'budget')
  check('a 1.6m property buys "under 2m", never "under 1.5m"',
    !!budget && budget.keywords.some((k) => k.text.includes('2m')) && !budget.keywords.some((k) => k.text.includes('1.5m')),
    budget?.keywords.map((k) => k.text).join(' | ') ?? 'none')

  check('prices read the way a person types them', priceWord(2_000_000) === '2m' && priceWord(800_000) === '800k',
    `${priceWord(2_000_000)} / ${priceWord(800_000)}`)
  check('…including the halves', priceWord(1_500_000) === '1.5m', priceWord(1_500_000))
}

console.log('\n── the structure is what makes Search cheap ──')
{
  const p = planKeywords(project(), TODAY)
  // Tight groups are the whole difference between a cheap Search account and
  // an expensive one: Google prices each keyword by how well the AD answers
  // it, and sixty keywords under one ad answers most of them badly.
  check('no ad group is a dumping ground',
    p.groups.every((g) => g.keywords.length <= 10), p.groups.map((g) => `${g.kind}:${g.keywords.length}`).join(','))
  check('…and every group has a distinct intent', new Set(p.groups.map((g) => g.kind)).size === p.groups.length)

  // BROAD MATCH IS NEVER EMITTED. Without conversion data to steer it, broad
  // is the fastest way to spend a Search budget on queries nobody meant. New
  // phrases are meant to enter through the search-terms harvest: evidence
  // first, bid second.
  check('no broad match is ever generated',
    !p.groups.some((g) => g.keywords.some((k) => k.matchType === 'BROAD')),
    p.groups.flatMap((g) => g.keywords.filter((k) => k.matchType === 'BROAD').map((k) => k.text)).join(','))
  check('the project name is bought on EXACT — the term this page answers best',
    p.groups.find((g) => g.kind === 'projectName')!.keywords.some((k) => k.matchType === 'EXACT'))

  // Google rejects a keyword over 80 characters at upload, and a partial
  // upload is a plan that silently did not happen.
  check(`nothing exceeds Google's ${MAX_KEYWORD_CHARS}-character limit`,
    allText(p).every((t) => t.length <= MAX_KEYWORD_CHARS),
    allText(p).filter((t) => t.length > MAX_KEYWORD_CHARS).join(','))

  const long = planKeywords(project({ name: 'A'.repeat(70), area: 'B'.repeat(40) }), TODAY)
  check('…even when the project name is absurdly long',
    allText(long).every((t) => t.length <= MAX_KEYWORD_CHARS))

  // THE BUG THIS CAUGHT: "azizi venice payment plan" belongs by theme to both
  // the name group and the payment-plan group, and putting it in both makes
  // two of this account's own ad groups bid against each other in the same
  // auction — Google picks one, the data splits, neither accumulates enough
  // history to be judged. Compared on text AND match type, because the same
  // term on EXACT and on PHRASE is two different bids and both are wanted.
  const pairs = p.groups.flatMap((g) => g.keywords.map((k) => `${k.text}|${k.matchType}`))
  const dupes = pairs.filter((t, i, a) => a.indexOf(t) !== i)
  check('no keyword is bought twice in one plan', dupes.length === 0, dupes.join(','))
  check('…while the same term on EXACT and PHRASE is still two deliberate bids',
    pairs.filter((x) => x.startsWith('azizi venice|')).length === 2,
    pairs.filter((x) => x.startsWith('azizi venice|')).join(','))
  check('the count is real', planKeywordCount(p) === allText(p).length)
}

console.log('\n── the negatives are the half that saves the money ──')
{
  const neg = negativeKeywords()
  const texts = neg.map((n) => n.text)
  // RENTAL is the big one: "apartments in dubai marina" pulls an enormous
  // rental audience, and those clicks are the majority of wasted spend in
  // every Dubai property account that has not excluded them.
  check('rental queries are excluded', texts.includes('rent') && texts.includes('for rent'), texts.slice(0, 5).join(','))
  check('job-seekers are excluded', texts.includes('job'))
  check('…and nothing is duplicated', new Set(texts).size === texts.length)

  // PHRASE, never BROAD: 'rent' as a broad negative would also block
  // "current", and blocking a real query is a silent loss no report shows.
  check('negatives are PHRASE — a broad negative blocks queries nobody meant to block',
    neg.every((n) => n.matchType === 'PHRASE'),
    neg.filter((n) => n.matchType !== 'PHRASE').map((n) => n.text).join(','))
  check('every negative group has terms behind it',
    NEGATIVE_GROUPS.every((g) => g.terms.length > 0))
}

console.log('\n── the opportunity layer decides WHO gets bought for ──')
{
  const a = project({ slug: 'a' }), b = project({ slug: 'b' }), c = project({ slug: 'c' }), d = project({ slug: 'd' })
  const scores = new Map<string, number | null>([
    ['a', 80], ['b', 55], ['c', MIN_OPPORTUNITY_TO_PLAN - 1], ['d', null],
  ])
  const sel = selectProjectsToPlan([a, b, c, d], scores)
  check('the strongest project is planned first', sel.plan[0].slug === 'a', sel.plan.map((p) => p.slug).join(','))
  check('…and one below the floor is not planned', !sel.plan.some((p) => p.slug === 'c'))
  check('…and is reported rather than silently dropped', sel.belowFloor.includes('c'), sel.belowFloor.join(','))

  // AN UNKNOWN IS NOT A LOW NUMBER. "We have not scored this" is answered by
  // scoring it; "this scored badly" is answered by not buying. Collapsing them
  // hides a whole project behind a verdict nobody made.
  check('an unscored project is kept separate from a low-scoring one',
    sel.unscored.includes('d') && !sel.belowFloor.includes('d'),
    `below=${sel.belowFloor.join(',')} unscored=${sel.unscored.join(',')}`)

  check('the limit is respected', selectProjectsToPlan([a, b], new Map([['a', 80], ['b', 70]]), 1).plan.length === 1)
}

console.log('\n── every kind and every reason is reachable ──')
{
  // Priced above the visa threshold, because goldenVisa is gated on a real
  // government rule rather than on data completeness — no single project can
  // reach every kind at every price.
  const kinds = new Set(planKeywords(project({ startingPriceAED: 2_500_000 }), TODAY).groups.map((g) => g.kind))
  const missingKinds = AD_GROUP_KINDS.filter((k) => !kinds.has(k))
  check('a complete, visa-eligible project reaches every ad-group kind',
    missingKinds.length === 0, missingKinds.join(','))

  const reasons = new Set<string>()
  for (const p of [
    planKeywords(project({ area: null, developer: null, paymentPlan: null, handoverYear: null, startingPriceAED: null }), TODAY),
    planKeywords(project({ startingPriceAED: 500_000 }), TODAY),
    planKeywords(project({ landingUrl: null }), TODAY),
    planKeywords(project({ permitNumber: null }), TODAY),
    planKeywords(project({ permitExpiry: '2020-01-01' }), TODAY),
    planKeywords(project({ name: '' }), TODAY),
  ]) {
    for (const w of p.withheld) reasons.add(w.why)
    if (p.blocked) reasons.add(p.blocked)
  }
  const missingReasons = PLAN_WITHHELD.filter((r) => !reasons.has(r))
  check('every withheld reason can actually happen — none is dead copy',
    missingReasons.length === 0, missingReasons.join(','))
}

if (failures > 0) {
  console.error(`\n${failures} keyword-plan rule(s) broken.`)
  process.exit(1)
}
console.log('\nEvery keyword traces to a stored fact, a real page, and a valid permit.\n')
