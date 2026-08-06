/**
 * Audience quality measured on impressions, locked — against the real account.
 *
 * The claim this module makes is strong enough to need proving: that ranking
 * audiences by cost per lead is reading noise, and that the same six days of
 * data separate cleanly when read on impressions instead.
 *
 * The account: AED 5,088 over Aug 1–6, 26 leads, 295,773 impressions, eight
 * ad sets in three campaigns. Cash offer and Reportage land at the SAME cost
 * per lead — 246.75 against 235.43, a 5% difference nobody would act on —
 * while Cash offer's audience converts 53× better per impression. Every
 * assertion below is checked against those figures, so a future change to the
 * statistics has to keep answering this account correctly.
 *
 * Pure — no model, no database, no network. Runs in `pnpm guards`.
 */
import { samePace, rank, compareAll, read, junkInventory, SIGNIFICANT_P, type Arm } from '../lib/freehold/inventory-quality'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))
const near = (a: number, b: number, tol = 0.02) => Math.abs(a - b) <= tol * Math.max(1e-9, Math.abs(b))

// The three campaigns, aggregated from the operator's August export.
const CAMPAIGNS: Arm[] = [
  { id: 'cash',      name: 'Cash offer',       spend: 3207.80, leads: 13, impressions: 15099 },
  { id: 'damac',     name: 'DAMAC',            spend: 1087.69, leads: 10, impressions: 93899 },
  { id: 'reportage', name: 'Reportage DATA AI', spend: 706.28, leads: 3,  impressions: 185576 },
]

console.log('\n── the exact test ──')
{
  check('identical rates give p = 1', near(samePace(10, 1000, 10, 1000), 1, 0.001),
    String(samePace(10, 1000, 10, 1000)))
  check('no events at all is not evidence of sameness — it returns 1', samePace(0, 500, 0, 500) === 1)
  check('an arm with no exposure cannot be tested', samePace(3, 0, 5, 100) === 1)
  check('the p-value is a probability', [0.5, 2, 10, 40].every((k) => {
    const p = samePace(k, 1000, k * 2, 1000)
    return p >= 0 && p <= 1
  }))
  // Two-sided: the direction of the difference must not change the answer.
  check('the test is symmetric', near(samePace(6, 6705, 3, 126276), samePace(3, 126276, 6, 6705), 1e-9))
  // A one-tailed p-value would be half this and would call coin flips findings.
  check('a 50/50 split of 10 events over equal exposure is not significant',
    samePace(5, 1000, 5, 1000) > 0.9, String(samePace(5, 1000, 5, 1000)))
  check('a 9/1 split of 10 events over equal exposure IS significant',
    samePace(9, 1000, 1, 1000) < SIGNIFICANT_P, String(samePace(9, 1000, 1, 1000)))
  // Large n must not overflow the binomial — lgamma, not factorials.
  check('2,000 events do not overflow', Number.isFinite(samePace(1200, 1e6, 800, 1e6)))
}

console.log('\n── the readings ──')
{
  const r = CAMPAIGNS.map(read)
  check('Cash offer reads CPM 212.45', near(r[0].cpm!, 212.45), String(r[0].cpm))
  check('Reportage reads CPM 3.81', near(r[2].cpm!, 3.81), String(r[2].cpm))
  check('Cash offer converts 861 per million impressions', near(r[0].lpm!, 861, 0.01), String(r[0].lpm))
  check('Reportage converts 16 per million impressions', near(r[2].lpm!, 16.2, 0.02), String(r[2].lpm))
  check('an arm with no impressions reads null, not zero',
    read({ id: 'x', name: 'x', spend: 10, leads: 0, impressions: 0 }).lpm === null)
  check('every reading carries its range', r.every((x) => x.lpmRange !== null && x.cplRange !== null))
}

console.log('\n── the thing cost per lead cannot see ──')
{
  const [cash, , rep] = CAMPAIGNS
  const cashCpl = cash.spend / cash.leads      // 246.75
  const repCpl = rep.spend / rep.leads         // 235.43
  check('the two campaigns sit within 5% on cost per lead',
    Math.abs(cashCpl - repCpl) / repCpl < 0.05, `${cashCpl.toFixed(2)} vs ${repCpl.toFixed(2)}`)

  const ratio = (cash.leads / cash.impressions) / (rep.leads / rep.impressions)
  check('…while one audience converts 53× better per impression', near(ratio, 53.26, 0.01), String(ratio))
  const p = samePace(cash.leads, cash.impressions, rep.leads, rep.impressions)
  check('and that difference is overwhelming, not marginal', p < 1e-9, p.toExponential(2))

  // The point, stated as a test: identical CPL, opposite verdict.
  const cmp = compareAll([cash, rep])[0]
  check('the comparison is established despite identical cost per lead', cmp.established)
  check('the sentence names the better audience', cmp.sentence.includes('Cash offer'), cmp.sentence)
}

console.log('\n── ranking admits what it cannot rank ──')
{
  const r = rank(CAMPAIGNS)
  check('Cash offer is the proven best audience',
    r.proven.length === 1 && r.proven[0].id === 'cash', r.proven.map((x) => x.id).join(','))
  check('Reportage is proven worst', r.disproven[0]?.id === 'reportage', r.disproven.map((x) => x.id).join(','))
  check('the headline names a real number, not a ranking',
    /861 leads per million/.test(r.headline), r.headline)

  // Two arms that have genuinely not separated must not be ranked.
  const twins: Arm[] = [
    { id: 'a', name: 'A', spend: 500, leads: 4, impressions: 10_000 },
    { id: 'b', name: 'B', spend: 500, leads: 5, impressions: 10_000 },
  ]
  const rt = rank(twins)
  check('two similar arms produce no winner', rt.proven.length === 0 && rt.disproven.length === 0)
  check('both land in "undecided", not in an order', rt.undecided.length === 2)
  check('the headline says so out loud', /Nothing has separated/.test(rt.headline), rt.headline)

  // An arm better than one thing and worse than another is not a winner.
  const three: Arm[] = [
    { id: 'hi',  name: 'Hi',  spend: 100, leads: 40, impressions: 10_000 },
    { id: 'mid', name: 'Mid', spend: 100, leads: 15, impressions: 10_000 },
    { id: 'lo',  name: 'Lo',  spend: 100, leads: 1,  impressions: 10_000 },
  ]
  const r3 = rank(three)
  check('an arm beaten by anything is not reported as proven',
    !r3.proven.some((x) => x.id === 'mid'), r3.proven.map((x) => x.id).join(','))
  check('the top arm still is', r3.proven[0]?.id === 'hi', r3.proven.map((x) => x.id).join(','))
  check('a single arm cannot be ranked against itself', rank([CAMPAIGNS[0]]).proven.length === 0)
  check('an empty account does not throw', rank([]).comparisons.length === 0)
}

console.log('\n── cheap junk inventory ──')
{
  const junk = junkInventory(CAMPAIGNS)
  check('Reportage is flagged: AED 3.81 CPM buying impressions that do not convert',
    junk.length === 1 && junk[0].id === 'reportage', junk.map((x) => x.id).join(','))
  check('the expensive-but-converting audience is NOT flagged',
    !junk.some((x) => x.id === 'cash'))

  // Cheap AND converting is a genuine bargain — it must survive.
  const bargain: Arm[] = [
    { id: 'cheap-good', name: 'Cheap and good', spend: 100,  leads: 20, impressions: 100_000 },
    { id: 'dear',       name: 'Expensive',      spend: 2000, leads: 20, impressions: 10_000 },
  ]
  check('a cheap audience that converts well is not called junk', junkInventory(bargain).length === 0,
    junkInventory(bargain).map((x) => x.id).join(','))

  // Cheap and unproven is not junk either — it just has not run.
  const young: Arm[] = [
    { id: 'young', name: 'Young', spend: 4,    leads: 0,  impressions: 1_000 },
    { id: 'known', name: 'Known', spend: 1000, leads: 20, impressions: 50_000 },
  ]
  check('a cheap arm with too little delivery is not condemned as junk',
    junkInventory(young).length === 0, junkInventory(young).map((x) => x.id).join(','))
  check('an account with no impressions yields nothing', junkInventory([]).length === 0)
}

console.log('\n── how much faster impressions decide ──')
{
  // The practical argument for the whole module: the same two audiences, and
  // how much evidence each basis needs before it can call the difference.
  const cash = CAMPAIGNS[0], rep = CAMPAIGNS[2]
  const impressionP = samePace(cash.leads, cash.impressions, rep.leads, rep.impressions)
  const spendP = samePace(cash.leads, cash.spend, rep.leads, rep.spend)
  check('on impressions the difference is decided',    impressionP < SIGNIFICANT_P, impressionP.toExponential(2))
  check('on cost per lead the SAME data decides nothing', spendP > 0.5, spendP.toFixed(3))
  check('the gap between the two bases is many orders of magnitude',
    spendP / impressionP > 1e9, String(spendP / impressionP))
}

if (failures > 0) {
  console.error(`\n${failures} inventory-quality rule(s) broken.`)
  process.exit(1)
}
console.log('\nAll inventory-quality rules hold.\n')
