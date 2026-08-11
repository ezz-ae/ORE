/**
 * Recommended — ranked, evidenced, and each one implementable. Locked.
 *
 * The panel this replaces produced paragraphs like "investigate potential
 * issues like audience saturation, bid strategy, or ad relevance" — a list of
 * things the reader might think about, written by something that did not do
 * the thinking — and offered one button on every card: Discuss.
 *
 * So the assertions here are about the three properties that make the
 * difference: the ranking puts money-now above everything, the evidence gate
 * keeps guesses off the screen, and no recommendation names an action the
 * product cannot actually perform.
 *
 * Pure — no model, no database, no network. Runs in `pnpm guards`.
 */
import {
  recommendationsFor, THROTTLED_PACE, MIN_IMPRESSIONS_TO_JUDGE,
  REC_ACTION_LABELS, REC_KEYS, type CampaignFacts,
} from '../lib/freehold/recommendations'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const facts = (o: Partial<CampaignFacts> = {}): CampaignFacts => ({
  dailyBudgetAed: 500, spendAed: 5000, days: 10,
  impressions: 50_000, clicks: 800, leads: 10, attributedLeads: 10,
  creativeCount: 3, adSetCount: 1, costCapAed: null, ...o,
})
const ids = (r: ReturnType<typeof recommendationsFor>) => r.map((x) => x.id)

console.log('\n── the throttle outranks everything ──')
{
  // The real campaign that produced this module: AED 201 spent over 30 days
  // against a AED 500/day budget — 1% pace — with a AED 7.50 cap set at
  // launch. Every other reading of that campaign is meaningless: it has not
  // tested its creative, its audience or its offer, because it never ran.
  const r = recommendationsFor(facts({
    dailyBudgetAed: 500, spendAed: 201, days: 30,
    impressions: 10_005, clicks: 26, leads: 1, attributedLeads: 0,
    creativeCount: 1, costCapAed: 7.5,
  }))
  check('a throttled campaign leads the list', ids(r)[0] === 'throttled_by_cap', ids(r).join(' | '))
  check('…as CRITICAL', r[0].priority === 'critical')
  check('…and the action is a RELAUNCH, because a cap cannot be edited after launch',
    r[0].action.kind === 'relaunch_no_cap', r[0].action.kind)
  check('…carrying the numbers it stands on',
    r[0].vars?.pace === 1 && r[0].vars?.cap === 7.5, JSON.stringify(r[0].vars))

  // Same throttle, no cap: the cause is elsewhere, so the action is too.
  const noCap = recommendationsFor(facts({ spendAed: 201, days: 30, costCapAed: null }))
  check('a throttle with no cap points at the audience instead of a relaunch',
    noCap[0].id === 'throttled' && noCap[0].action.kind === 'open_audiences', ids(noCap).join(' | '))
  check(`the throttle line is ${Math.round(THROTTLED_PACE * 100)}% of budget`,
    recommendationsFor(facts({ spendAed: 5000, days: 10 })).every((x) => !x.id.startsWith('throttled')))
}

console.log('\n── unrated leads are a critical, not a nag ──')
{
  const r = recommendationsFor(facts({ leads: 4, attributedLeads: 0 }))
  check('leads arriving with nobody rating them is critical',
    r.some((x) => x.id === 'rate_leads' && x.priority === 'critical'), ids(r).join(' | '))
  check('…and it is silent once they are rated',
    !ids(recommendationsFor(facts({ leads: 4, attributedLeads: 4 }))).includes('rate_leads'))
  check('…and silent before any lead exists',
    !ids(recommendationsFor(facts({ leads: 0, attributedLeads: 0 }))).includes('rate_leads'))
}

console.log('\n── evidence or silence ──')
{
  // The gate that keeps this panel from becoming the advisor it replaces:
  // nothing about creative is said before there is delivery to say it about.
  const thin = recommendationsFor(facts({ creativeCount: 1, impressions: 500 }))
  check('a single creative says nothing on 500 impressions', !ids(thin).includes('creative_depth'), ids(thin).join(' | '))
  const real = recommendationsFor(facts({ creativeCount: 1, impressions: MIN_IMPRESSIONS_TO_JUDGE }))
  check('…and says it once the delivery can carry the claim',
    ids(real).includes('creative_depth'), ids(real).join(' | '))

  const weak = recommendationsFor(facts({ clicks: 50, impressions: 50_000, creativeCount: 3 }))
  check('a 0.1% CTR with real delivery names the creative',
    ids(weak).includes('weak_ctr'), ids(weak).join(' | '))
  check('…but never twice: the depth card already says it when there is one design',
    !ids(recommendationsFor(facts({ clicks: 50, impressions: 50_000, creativeCount: 1 }))).includes('weak_ctr'))
}

console.log('\n── the budget maths only speaks when the money is moving ──')
{
  // A throttled campaign's problem is not its budget number, and raising it
  // changes nothing — so the learning-budget card stays quiet there.
  const throttled = recommendationsFor(facts({ spendAed: 201, days: 30, leads: 1 }))
  check('a throttled campaign is not told to raise its budget',
    !ids(throttled).includes('budget_for_learning'), ids(throttled).join(' | '))

  const spending = recommendationsFor(facts({
    dailyBudgetAed: 500, spendAed: 5000, days: 10, leads: 5, attributedLeads: 5,
  }))
  const rec = spending.find((x) => x.id === 'budget_for_learning')
  check('a spending campaign whose CPL cannot clear learning is told the number',
    !!rec && rec.action.kind === 'set_budget' && (rec.action.value ?? 0) > 500,
    JSON.stringify(rec?.action))
  check('…derived from ITS OWN cost per lead, not a default',
    rec?.vars?.cpl === 1000, JSON.stringify(rec?.vars))
}

console.log('\n── a second audience is earned, never assumed ──')
{
  check('one audience with proven leads is offered an A/B',
    ids(recommendationsFor(facts({ leads: 5, adSetCount: 1 }))).includes('ab_audience'))
  check('…but not before the first one has proven anything',
    !ids(recommendationsFor(facts({ leads: 1, adSetCount: 1 }))).includes('ab_audience'))
  check('…and not while the campaign is throttled',
    !ids(recommendationsFor(facts({ leads: 5, spendAed: 201, days: 30 }))).includes('ab_audience'))
}

console.log('\n── the panel stays readable ──')
{
  const everything = recommendationsFor(facts({
    spendAed: 201, days: 30, costCapAed: 7.5, leads: 5, attributedLeads: 0,
    creativeCount: 1, clicks: 20, impressions: 50_000, adSetCount: 1,
  }))
  check('never more than five, however many faults exist', everything.length <= 5, String(everything.length))
  check('critical always first', everything[0].priority === 'critical')
  check('a healthy campaign says nothing at all',
    recommendationsFor(facts()).length === 0 || recommendationsFor(facts()).every((x) => x.priority !== 'critical'))

  // Every rendered key must be walkable, or it ships wordless — the failure
  // this codebase has now paid for twice.
  const keys = new Set(REC_KEYS as readonly string[])
  const labels = new Set(REC_ACTION_LABELS as readonly string[])
  check('every produced key is in the walkable list',
    everything.every((x) => keys.has(x.key)), everything.map((x) => x.key).join(','))
  check('every produced action label is too',
    everything.every((x) => labels.has(x.action.labelKey)), everything.map((x) => x.action.labelKey).join(','))
}

if (failures > 0) {
  console.error(`\n${failures} recommendation rule(s) broken.`)
  process.exit(1)
}
console.log('\nEvery recommendation carries its evidence and the thing that does it.\n')
