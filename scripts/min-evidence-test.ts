/**
 * The minimum-evidence rules, locked — with a real account's numbers.
 *
 * The case that started it, verbatim from Ads Manager: a campaign with AED
 * 50.02 spent and zero leads was reported as "Cost Per Result: AED 0.00", and
 * an AI summary then recommended changing the targeting off four link clicks.
 * We were doing the same thing to ourselves and worse — our autopilot computed
 * `cpl: leads > 0 ? spend / leads : 0` and handed that 0 to the rule engine,
 * so a `cpl < 100 → budget_up` rule read a campaign that had produced NOTHING
 * as the cheapest one in the account and raised its budget.
 *
 * The figures in the "real account" section are from the operator's own August
 * export (8 ad sets, AED 5,088 spent, 26 leads). They are the regression test:
 * whatever the constants become, these eight rows must keep producing the
 * conclusions a careful human draws from them.
 *
 * Pure — no model, no database, no network. Runs in `pnpm guards`.
 */
import {
  countBounds, rateRange, costRange, support, isWithheld, displayMetrics,
  MIN_ATTRIBUTED_FOR_QUALITY, type Evidence,
} from '../lib/freehold/min-evidence'
import { evaluateRules, type CampaignRule, type RuleMetric, type RuleOperator, type RuleAction } from '../lib/freehold/campaign-rules'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))
const near = (a: number, b: number, tol = 0.01) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b))

const ev = (p: Partial<Evidence>): Evidence => ({
  spend: 0, leads: 0, clicks: 0, impressions: 0, attributed: 0, qualityScore: null, ...p,
})

const rule = (metric: RuleMetric, operator: RuleOperator, threshold: number, action: RuleAction = 'pause'): CampaignRule => ({
  id: `r-${metric}-${operator}-${threshold}`, campaignId: null, name: `${metric} ${operator} ${threshold}`,
  metric, operator, threshold, action, actionValue: null, enabled: true,
  lastTriggeredAt: null, createdAt: '2026-08-06',
})

console.log('\n── the confidence bounds themselves ──')
{
  // Exact: P(X=0 | m) = e^-m = 0.025 → m = -ln(0.025) = 3.6889
  check('zero events bounds to [0, 3.689]', countBounds(0).lo === 0 && near(countBounds(0).hi, 3.688879, 1e-4),
    JSON.stringify(countBounds(0)))
  // Garwood exact for k=8 is [3.4534, 15.7632]; Byar must land on top of it.
  const b8 = countBounds(8)
  check('eight events matches the exact interval within 0.5%', near(b8.lo, 3.4534, 0.005) && near(b8.hi, 15.7632, 0.005),
    JSON.stringify(b8))
  check('the interval always contains the count', countBounds(26).lo < 26 && countBounds(26).hi > 26)
  check('it tightens as the sample grows',
    (countBounds(500).hi - countBounds(500).lo) / 500 < (countBounds(5).hi - countBounds(5).lo) / 5)
  check('a huge count does not overflow or underflow', Number.isFinite(countBounds(250_000).hi))
  check('a negative count is not a number of events', countBounds(-1).hi === Infinity)
}

console.log('\n── cost per lead with no leads ──')
{
  const zero = ev({ spend: 82.39 })
  check('the point estimate is null, never zero', displayMetrics(zero).cpl === null, String(displayMetrics(zero).cpl))

  // THE BUG. "cpl < 100 → raise the budget" on a campaign with no leads.
  const cheap = support('cpl', 'lt', zero)
  check('"cheap enough" cannot be decided with zero leads', isWithheld(cheap),
    JSON.stringify(cheap))
  const { matches } = evaluateRules([rule('cpl', 'lt', 100, 'budget_up')], zero)
  check('a budget raise does NOT fire on a campaign with zero leads', matches.length === 0,
    JSON.stringify(matches))

  // …but "too expensive" IS decidable, once enough money has gone through.
  const dear = support('cpl', 'gt', zero)
  check('"too expensive" is decidable with zero leads', !isWithheld(dear), JSON.stringify(dear))
  check('AED 82 and no lead means CPL is at least ~22',
    !isWithheld(dear) && near(dear.value, 82.39 / 3.688879, 0.01), JSON.stringify(dear))
  check('at AED 82 a "cpl > 150" pause does not fire yet',
    evaluateRules([rule('cpl', 'gt', 150)], zero).matches.length === 0)
  check('at AED 900 with still no lead, "cpl > 150" DOES fire',
    evaluateRules([rule('cpl', 'gt', 150)], ev({ spend: 900 })).matches.length === 1)
}

console.log('\n── cost per lead with few leads ──')
{
  // The operator's DAMAC ad set: 2 leads on AED 411.18. Point estimate 205.59,
  // but the honest range is roughly 57–1,698. Neither "under 150" nor
  // "over 300" is knowable from two leads.
  const thin = ev({ spend: 411.18, leads: 2 })
  check('the point estimate is still shown', near(displayMetrics(thin).cpl!, 205.59))
  check('"cpl > 300 → pause" does not fire on 2 leads',
    evaluateRules([rule('cpl', 'gt', 300)], thin).matches.length === 0)
  check('"cpl < 150 → budget_up" does not fire on 2 leads',
    evaluateRules([rule('cpl', 'lt', 150, 'budget_up')], thin).matches.length === 0)
  // The bounds are what fires, so an extreme threshold still can.
  check('"cpl > 50 → pause" DOES fire — even the optimistic reading is over 50',
    evaluateRules([rule('cpl', 'gt', 50)], thin).matches.length === 1)
  const m = evaluateRules([rule('cpl', 'gt', 50)], thin).matches[0]
  check('the fired value is the conservative bound, not the point estimate',
    m.currentValue < 205.59 && near(m.pointValue!, 205.59), `${m.currentValue} vs ${m.pointValue}`)
}

console.log('\n── click-through rate ──')
{
  // 59 impressions, no clicks. Meta will print "CTR 0.00%".
  const tiny = ev({ impressions: 59 })
  check('CTR from 59 impressions cannot condemn a campaign',
    evaluateRules([rule('ctr', 'lt', 0.5)], tiny).matches.length === 0)
  // 1,140 impressions, no clicks — now zero really does mean something.
  const real = ev({ impressions: 1140 })
  const r = rateRange(0, 1140, 100)
  check('at 1,140 impressions the upper bound on CTR is ~0.32%', near(r.hi, 0.3236, 0.01), String(r.hi))
  check('"ctr < 0.5 → pause" fires at 1,140 impressions with no clicks',
    evaluateRules([rule('ctr', 'lt', 0.5)], real).matches.length === 1)
  check('no impressions at all is withheld, not zero',
    isWithheld(support('ctr', 'lt', ev({}))))
  // The live Reportage set: 4 clicks on 816 impressions = 0.49%.
  const rep = ev({ impressions: 816, clicks: 4 })
  check('0.49% measured CTR does not fire a "ctr < 0.5" pause — the sample cannot tell',
    evaluateRules([rule('ctr', 'lt', 0.5)], rep).matches.length === 0)
}

console.log('\n── quality score ──')
{
  const one = ev({ attributed: 1, qualityScore: 0 })
  check('one cold lead reading 0/100 cannot pause a campaign',
    evaluateRules([rule('quality', 'lt', 60)], one).matches.length === 0)
  const oneGood = ev({ attributed: 1, qualityScore: 100 })
  check('one closed lead reading 100/100 cannot triple a budget',
    evaluateRules([rule('quality', 'gt', 95, 'budget_up')], oneGood).matches.length === 0)
  const enough = ev({ attributed: MIN_ATTRIBUTED_FOR_QUALITY, qualityScore: 30 })
  check(`at ${MIN_ATTRIBUTED_FOR_QUALITY} attributed leads the quality rule fires`,
    evaluateRules([rule('quality', 'lt', 60)], enough).matches.length === 1)
  check('no attributed leads is withheld with a reason, not silently skipped',
    isWithheld(support('quality', 'lt', ev({}))))
}

console.log('\n── counts are exact and never gated ──')
{
  check('"spend > 5000 → notify" fires on the real figure',
    evaluateRules([rule('spend', 'gt', 5000, 'notify')], ev({ spend: 5088.04 })).matches.length === 1)
  check('"leads < 1 → pause" is a fact about a count, and fires',
    evaluateRules([rule('leads', 'lt', 1)], ev({ spend: 82.39 })).matches.length === 1)
}

console.log('\n── withheld rules are reported, never swallowed ──')
{
  const { matches, withheld } = evaluateRules(
    [rule('cpl', 'lt', 100, 'budget_up'), rule('quality', 'lt', 60)],
    ev({ spend: 82.39, attributed: 1, qualityScore: 0 }),
  )
  check('nothing fires', matches.length === 0)
  check('both rules come back explained', withheld.length === 2, JSON.stringify(withheld))
  check('every reason names the actual shortfall',
    withheld.every((w) => w.reason.length > 20 && /lead/i.test(w.reason)),
    withheld.map((w) => w.reason).join(' | '))
  check('a disabled rule is neither fired nor reported as withheld',
    evaluateRules([{ ...rule('cpl', 'lt', 100), enabled: false }], ev({ spend: 82.39 })).withheld.length === 0)
}

console.log('\n── the real account, August 1–6 ──')
{
  // Eight ad sets from the operator's export. `verdict` is what a careful
  // human concludes; the gate must not contradict it.
  const sets: Array<{ name: string; spend: number; leads: number; impressions: number }> = [
    { name: 'Cash offer / New Leads',      spend: 1850.73, leads: 6, impressions: 6705 },
    { name: 'Cash offer / Test',           spend: 1357.07, leads: 7, impressions: 8394 },
    { name: 'DAMAC / Test',                spend: 676.51,  leads: 8, impressions: 92728 },
    { name: 'DAMAC',                       spend: 411.18,  leads: 2, impressions: 1171 },
    { name: 'Reportage / DATA AI (B)',     spend: 457.91,  leads: 3, impressions: 126276 },
    { name: 'Reportage / DATA AI (A)',     spend: 248.37,  leads: 0, impressions: 59300 },
    { name: 'Reportage / Townhouse',       spend: 82.39,   leads: 0, impressions: 1140 },
    { name: 'Reportage / Townhouse Test',  spend: 3.88,    leads: 0, impressions: 59 },
  ]

  const over = (t: number) => sets.filter((s) =>
    evaluateRules([rule('cpl', 'gt', t)], ev({ spend: s.spend, leads: s.leads })).matches.length === 1)
  const under = (t: number) => sets.filter((s) =>
    evaluateRules([rule('cpl', 'lt', t, 'budget_up')], ev({ spend: s.spend, leads: s.leads })).matches.length === 1)

  // The measured CPLs run 84.56 to 308.46 — a 3.6× spread that looks decisive
  // on a dashboard. After AED 5,088 and 26 leads it supports exactly two
  // statements, and this is the test that keeps us honest about that.
  check('exactly one ad set is provably worse than AED 100 per lead',
    over(100).length === 1 && over(100)[0].name === 'Cash offer / New Leads',
    over(100).map((s) => s.name).join(', '))
  check('exactly one ad set is provably better than AED 200 per lead',
    under(200).length === 1 && under(200)[0].name === 'DAMAC / Test',
    under(200).map((s) => s.name).join(', '))

  // The tempting mistake, blocked: 6 leads at a measured 308.46 still cannot
  // carry "this is over AED 200" — the honest floor is about 142.
  const worst = sets[0]
  check('a measured CPL of 308 on 6 leads does NOT prove CPL > 200',
    evaluateRules([rule('cpl', 'gt', 200)], ev({ spend: worst.spend, leads: worst.leads })).matches.length === 0)
  check('…and the same ad set DOES prove CPL > 100',
    evaluateRules([rule('cpl', 'gt', 100)], ev({ spend: worst.spend, leads: worst.leads })).matches.length === 1)

  // The best performer measures 84.56 — but eight leads only carry it under 200.
  const damac = sets[2]
  check('the account\'s best ad set is not provably under 100, on eight leads',
    evaluateRules([rule('cpl', 'lt', 100, 'budget_up')], ev({ spend: damac.spend, leads: damac.leads })).matches.length === 0)

  // Nothing in this account should be pausable for zero leads at these spends.
  const zeroLead = sets.filter((s) => s.leads === 0)
  const wronglyPaused = zeroLead.filter((s) =>
    evaluateRules([rule('cpl', 'gt', 200)], ev({ spend: s.spend, leads: s.leads })).matches.length > 0)
  check('no zero-lead ad set is condemned at these spends (max AED 248)',
    wronglyPaused.length === 0, wronglyPaused.map((s) => s.name).join(', '))

  // The old code would have raised the budget on every one of them.
  const oldWouldRaise = zeroLead.filter((s) => (s.leads > 0 ? s.spend / s.leads : 0) < 100)
  check('the OLD arithmetic would have raised the budget on all three zero-lead sets',
    oldWouldRaise.length === 3, String(oldWouldRaise.length))
  const nowRaised = zeroLead.filter((s) =>
    evaluateRules([rule('cpl', 'lt', 100, 'budget_up')], ev({ spend: s.spend, leads: s.leads })).matches.length > 0)
  check('the new gate raises none of them', nowRaised.length === 0, nowRaised.map((s) => s.name).join(', '))
}

console.log('\n── the gate stops binding at scale ──')
{
  // A rule an operator sets must eventually be able to fire. Note how much
  // volume that takes: 200 leads still carries ±15% on the cost, because
  // Poisson noise on 200 events is ±14%. This is not the gate being strict —
  // it is what the numbers were always worth.
  const big = ev({ spend: 30_000, leads: 200 })   // measured CPL 150
  check('"cpl > 125" fires at 200 leads', evaluateRules([rule('cpl', 'gt', 125)], big).matches.length === 1)
  check('"cpl < 180" fires at 200 leads', evaluateRules([rule('cpl', 'lt', 180, 'budget_up')], big).matches.length === 1)
  const r200 = costRange(30_000, 200)
  check('200 leads pins the cost to about ±15%',
    r200.lo > 150 * 0.85 && r200.hi < 150 * 1.16, `${r200.lo.toFixed(1)}–${r200.hi.toFixed(1)}`)
  const r2000 = costRange(300_000, 2000)
  check('2,000 leads pins it to ±5%',
    r2000.lo > 150 * 0.95 && r2000.hi < 150 * 1.05, `${r2000.lo.toFixed(1)}–${r2000.hi.toFixed(1)}`)
  check('a tight rule that is true at scale does fire',
    evaluateRules([rule('cpl', 'gt', 142)], ev({ spend: 300_000, leads: 2000 })).matches.length === 1)
}

if (failures > 0) {
  console.error(`\n${failures} minimum-evidence rule(s) broken.`)
  process.exit(1)
}
console.log('\nAll minimum-evidence rules hold.\n')
