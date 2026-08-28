/**
 * THE MACHINE SPENDS ON LEADS AND THE BUSINESS IS PAID ON DEALS — locked.
 *
 * Every advertising decision in this product was made on cost per lead. The
 * rotate gate condemns on it, the grow gate scales on it, and the quality score
 * counts a win as a rate — one closed deal in twenty-five leads scores the same
 * whether the deal was AED 800,000 or AED 12,000,000. `deal_value_aed` is in
 * the CRM and reached no advertising decision anywhere.
 *
 * From this account:
 *
 *   cashoffer          25 leads   CPL AED 106   0 qualified   0 deals
 *   venice-investor     8 leads   CPL AED 331   5 qualified   2 deals
 *
 * On cost per lead the first wins three times over and the second is condemned
 * as "> 2× the best sibling". This suite locks the rules that stop that: judge
 * only on a rung the campaign has had time to reach, count deals rather than
 * dirhams so a villa cannot outvote a studio, and separate two campaigns only
 * on a real test rather than on which point estimate happens to be lower.
 *
 * Pure — no network, no clock. Runs in `pnpm guards`.
 */
import { readFileSync } from 'node:fs'
import { scoreLeads, type ScorableLead } from '../lib/freehold/campaign-score'
import { join } from 'node:path'
import {
  MONEY_RUNGS, MONEY_VERDICTS, DEFAULT_CYCLE, DEFAULT_DAYS_TO_CLOSE, DEFAULT_DAYS_TO_QUALIFY,
  MIN_CLOSED_FOR_CYCLE, MIN_DEALS_FOR_MEDIAN,
  costRange, costOn, countOn, maturedFor, judgementRung, compareMoney,
  returnPerDirham, cycleFromHistory, medianDeal, moneyStandings,
  standingOf, moneyProtects, moneyCondemns,
  type CampaignMoney,
} from '../lib/freehold/money-truth'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const code = (p: string): string =>
  readFileSync(join(process.cwd(), p), { encoding: 'utf8' })
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

const row = (o: Partial<CampaignMoney> & { campaignId: string }): CampaignMoney => ({
  spendAed: 1000, leads: 0, qualified: 0, deals: 0, revenueAed: 0, ageDays: 60, ...o,
})

console.log('\n── the two campaigns from the account ──')
{
  // Both mature — 60 days, past the six-week close cycle.
  const cheap = row({ campaignId: 'cashoffer', spendAed: 2650, leads: 25, qualified: 0, deals: 0 })
  const real = row({ campaignId: 'venice', spendAed: 2650, leads: 8, qualified: 5, deals: 2, revenueAed: 3_100_000 })

  check('on leads alone the cheap one looks three times better',
    costRange(2650, 25).lo < costRange(2650, 8).lo,
    `${costRange(2650, 25).lo.toFixed(0)} vs ${costRange(2650, 8).lo.toFixed(0)}`)

  // A mature campaign with a funnel is judged on the deal rung; one with no
  // qualified lead at all has no funnel to judge, so the shared ground is
  // 'qualified' — and that is where the old rule got it backwards.
  check('a mature campaign with a funnel is judged on DEALS',
    judgementRung(real) === 'deal', judgementRung(real))
  check('…and one with no funnel at all cannot be',
    judgementRung(cheap) === 'qualified', judgementRung(cheap))

  // THE FIX, AND IT IS NOT "THE OTHER ONE WINS". At this size 5 qualified
  // against 0 is p≈0.06 — real, but not yet proof. The old CPL rule had no
  // notion of proof and condemned venice outright as "> 2× the best sibling";
  // this one refuses to separate them, so NOTHING GETS PAUSED. That is the
  // whole improvement: the winner survives the fortnight it looked expensive.
  const cmp = compareMoney(real, cheap)
  check('the two have not separated yet, so neither is condemned',
    cmp.verdict === 'tied', `${cmp.verdict} on ${cmp.rung} (p=${cmp.p.toFixed(3)})`)
  check('…compared on the deepest ground they share', cmp.rung === 'qualified', cmp.rung)
  check('…and the p-value is carried, so a pause can cite it',
    cmp.p > 0 && cmp.p < 0.2, cmp.p.toFixed(3))

  // Let it run another two months and the answer arrives on its own.
  const cheapLater = row({ campaignId: 'cashoffer', spendAed: 9000, leads: 90, qualified: 0, deals: 0, ageDays: 120 })
  const realLater = row({ campaignId: 'venice', spendAed: 9000, leads: 30, qualified: 18, deals: 6, ageDays: 120 })
  const later = compareMoney(realLater, cheapLater)
  check('with real evidence the money campaign IS ahead',
    later.verdict === 'ahead', `${later.verdict} (p=${later.p.toFixed(4)})`)
  check('…and it is symmetric', compareMoney(cheapLater, realLater).verdict === 'behind')
  check('…on cost per qualified lead, where the cheap one bought none',
    later.rung === 'qualified', later.rung)
}

console.log('\n── a rung a campaign has not had time to reach ──')
{
  // ELEVEN DAYS OLD. Dubai property does not close in eleven days; a campaign
  // with no deals yet has not failed at deals, it has not got there. Condemning
  // it here is the design-race error — a loser badge for a race never run.
  const young = row({ campaignId: 'young', ageDays: 11, leads: 12, qualified: 3, deals: 0 })
  check('a fortnight-old campaign is not judged on deals',
    judgementRung(young) === 'qualified', judgementRung(young))
  check('…and a three-day-old one is judged only on leads',
    judgementRung(row({ campaignId: 'x', ageDays: 3, leads: 5 })) === 'lead')

  // The comparison drops to the shallower of the two rungs — the deepest
  // ground they actually share.
  const old = row({ campaignId: 'old', ageDays: 90, leads: 20, qualified: 8, deals: 3 })
  check('an old campaign cannot beat a young one on a rung the young one lacks',
    compareMoney(old, young).rung === 'qualified', compareMoney(old, young).rung)

  check('the deal rung waits for the close cycle',
    maturedFor('deal', DEFAULT_CYCLE) === DEFAULT_DAYS_TO_CLOSE
    && maturedFor('qualified', DEFAULT_CYCLE) === DEFAULT_DAYS_TO_QUALIFY
    && maturedFor('lead', DEFAULT_CYCLE) === 0)
  // Six weeks, not one. Too short is the dangerous direction: it condemns the
  // winner for not closing a deal it was never given time to close.
  check('and the close cycle is weeks, not days', DEFAULT_DAYS_TO_CLOSE >= 28, String(DEFAULT_DAYS_TO_CLOSE))
}

console.log('\n── a villa does not outvote a studio ──')
{
  // The variance of the CATALOGUE, not of the campaign. One AED 12M villa does
  // not prove a campaign fifteen times better than one that closed a studio.
  const villa = row({ campaignId: 'villa', spendAed: 5000, leads: 10, qualified: 4, deals: 1, revenueAed: 12_000_000 })
  const studio = row({ campaignId: 'studio', spendAed: 5000, leads: 10, qualified: 4, deals: 1, revenueAed: 800_000 })
  check('two campaigns with one deal each on equal spend are TIED',
    compareMoney(villa, studio).verdict === 'tied', compareMoney(villa, studio).verdict)
  check('…and revenue never enters the comparison',
    costOn(villa, 'deal').lo === costOn(studio, 'deal').lo)

  // The revenue is still a fact and is still carried, for a human to read.
  check('the revenue is kept on the row', villa.revenueAed === 12_000_000)
}

console.log('\n── nothing fires on a difference that might be noise ──')
{
  // One deal against two, on the same spend, is not a separation — the
  // intervals overlap heavily. A machine that ranks on point estimates would
  // pause the first, and it would be pausing a coin flip.
  const a = row({ campaignId: 'a', spendAed: 3000, leads: 10, qualified: 5, deals: 2 })
  const b = row({ campaignId: 'b', spendAed: 3000, leads: 10, qualified: 5, deals: 1 })
  check('two deals against one is TIED, not a win',
    compareMoney(a, b).verdict === 'tied', compareMoney(a, b).verdict)

  // A real gap does separate: twelve deals against one, same money.
  const wide = row({ campaignId: 'wide', spendAed: 3000, leads: 40, qualified: 20, deals: 12 })
  check('a real gap does separate',
    compareMoney(wide, b).verdict === 'ahead',
    `${compareMoney(wide, b).verdict} p=${compareMoney(wide, b).p.toFixed(4)}`)
  check('…and cites a probability under the conventional line',
    compareMoney(wide, b).p < 0.05, compareMoney(wide, b).p.toFixed(4))

  // SPEND IS PART OF THE TEST, not just the counts. The same twelve deals
  // bought with four times the money is not the same result.
  const expensive = row({ campaignId: 'exp', spendAed: 12_000, leads: 40, qualified: 20, deals: 12 })
  check('the same deals on four times the money is not ahead',
    compareMoney(expensive, b).verdict !== 'ahead',
    compareMoney(expensive, b).verdict)

  // NOTHING SPENT ⇒ NOTHING TO COMPARE.
  check('a campaign that has not spent is too early',
    compareMoney(row({ campaignId: 'z', spendAed: 0 }), a).verdict === 'tooEarly')
  // Neither has produced anything on the shared rung: both ranges are
  // open-ended and more spending is the only thing that separates them.
  const empty1 = row({ campaignId: 'e1', spendAed: 500, leads: 0, ageDays: 2 })
  const empty2 = row({ campaignId: 'e2', spendAed: 500, leads: 0, ageDays: 2 })
  check('two campaigns with no results at all are too early, not tied',
    compareMoney(empty1, empty2).verdict === 'tooEarly', compareMoney(empty1, empty2).verdict)
}

console.log('\n── zero is not free ──')
{
  // The min-evidence position, applied to money: no deal on AED 20,000 is not
  // "cost per deal 0" and not "unknown" either — it is a floor, and the floor
  // is what a person would start to worry about.
  const none = costRange(20_000, 0)
  check('no result yet has a FLOOR, not a zero', none.lo > 0 && none.lo < 20_000, JSON.stringify(none))
  check('…and no ceiling, because none is supported', !Number.isFinite(none.hi))
  check('no spend at all is not a cost of zero either',
    costRange(0, 0).lo === 0 && !Number.isFinite(costRange(0, 0).hi))

  // More money on the same nothing is worse evidence, and says so.
  check('the floor rises as money goes in with nothing back',
    costRange(40_000, 0).lo > costRange(20_000, 0).lo,
    `${costRange(40_000, 0).lo.toFixed(0)} vs ${costRange(20_000, 0).lo.toFixed(0)}`)
}

console.log('\n── the account learns its own sales cycle ──')
{
  const few = cycleFromHistory([{ daysToQualify: 1, daysToClose: 3 }, { daysToQualify: 2, daysToClose: 4 }])
  // ONE FAST DEAL MUST NOT SET THE ACCOUNT'S PATIENCE TO THREE DAYS, which
  // would condemn every campaign older than a week for having closed nothing.
  check('below the floor the defaults stand',
    few.daysToClose === DEFAULT_DAYS_TO_CLOSE && few.measuredOn === 0,
    JSON.stringify(few))

  const many = cycleFromHistory(Array.from({ length: MIN_CLOSED_FOR_CYCLE }, (_, i) => ({
    daysToQualify: 3 + i, daysToClose: 20 + i,
  })))
  check('enough closed deals and the account uses its OWN cycle',
    many.measuredOn === MIN_CLOSED_FOR_CYCLE && many.daysToClose === 22,
    JSON.stringify(many))
  // A median, not a mean — one nine-month deal must not move the account.
  const withOutlier = cycleFromHistory([
    ...Array.from({ length: MIN_CLOSED_FOR_CYCLE }, () => ({ daysToQualify: 3, daysToClose: 20 })),
    { daysToQualify: 3, daysToClose: 270 },
  ])
  check('…measured as a median, so one nine-month deal cannot move it',
    withOutlier.daysToClose === 20, String(withOutlier.daysToClose))
}

console.log('\n── return per dirham, priced at the account median ──')
{
  check('below the floor there is no median at all',
    medianDeal([900_000, 1_100_000]) === null, String(medianDeal([900_000, 1_100_000])))
  check('at the floor there is', medianDeal([900_000, 1_000_000, 1_100_000]) === 1_000_000,
    String(medianDeal([900_000, 1_000_000, 1_100_000])))
  check(`the floor is ${MIN_DEALS_FOR_MEDIAN} deals`, MIN_DEALS_FOR_MEDIAN >= 3)
  check('a zero or negative value is not a deal', medianDeal([0, -5, 1_000_000, 1_000_000, 1_000_000]) === 1_000_000)

  const m = row({ campaignId: 'r', spendAed: 100_000, leads: 30, qualified: 12, deals: 5 })
  const ret = returnPerDirham(m, 1_000_000)
  check('return is a RANGE, never a single figure',
    !!ret && ret.lo > 0 && ret.hi > ret.lo, JSON.stringify(ret))
  check('…and it is withheld with no median to price it',
    returnPerDirham(m, null) === null)
  check('…and withheld on no spend', returnPerDirham(row({ campaignId: 'q', spendAed: 0 }), 1_000_000) === null)
}

console.log('\n── where every campaign stands against the field ──')
{
  const rows: CampaignMoney[] = [
    row({ campaignId: 'winner', spendAed: 3000, leads: 40, qualified: 20, deals: 12 }),
    row({ campaignId: 'loser', spendAed: 3000, leads: 10, qualified: 5, deals: 1 }),
    row({ campaignId: 'middle', spendAed: 3000, leads: 20, qualified: 10, deals: 4 }),
  ]
  const st = moneyStandings(rows, DEFAULT_CYCLE, 1_000_000)
  const of = (id: string) => st.find((s) => s.campaignId === id)!

  check('the one that beats somebody and loses to nobody is ahead',
    of('winner').verdict === 'ahead', of('winner').verdict)
  check('…and names who it beat, so the badge carries its evidence',
    of('winner').beats.includes('loser'), of('winner').beats.join(','))
  check('the one that is beaten says so', of('loser').verdict === 'behind', of('loser').verdict)
  check('…and names who beat it', of('loser').beatenBy.includes('winner'), of('loser').beatenBy.join(','))
  check('every standing carries its return range', st.every((s) => s.returnPerDirham !== null))

  // A SINGLE CAMPAIGN HAS NOBODY TO BEAT — the design-race rule, again.
  const alone = moneyStandings([rows[0]], DEFAULT_CYCLE, 1_000_000)
  check('one campaign on its own is never "ahead" of anything',
    alone[0].verdict === 'tooEarly', alone[0].verdict)
  check('an empty account does not throw', moneyStandings([]).length === 0)

  // Everything must be reachable, or the dictionary carries dead copy.
  const seen = new Set(st.map((s) => s.verdict))
  seen.add(alone[0].verdict)
  seen.add(compareMoney(rows[0], row({ campaignId: 'n', spendAed: 3000, leads: 20, qualified: 10, deals: 11 })).verdict)
  const missing = MONEY_VERDICTS.filter((v) => !seen.has(v))
  check('every verdict can happen — none is dead copy', missing.length === 0, missing.join(','))
  check('every rung can be judged on',
    MONEY_RUNGS.every((r) => countOn(rows[0], r) >= 0) && MONEY_RUNGS.length === 3)
}

console.log('\n── the veto: a trial is not paused for cheap leads it does not need ──')
{
  // THE TRADE THIS EXISTS TO STOP. `expensive` buys leads at four times the
  // price and they are the only ones that ever qualify. The CPL gate wants it
  // paused and its budget moved to the trial selling nothing.
  const expensive = row({ campaignId: 'expensive', spendAed: 9000, leads: 20, qualified: 14, deals: 4, ageDays: 90 })
  const cheap = row({ campaignId: 'cheap', spendAed: 9000, leads: 80, qualified: 0, deals: 0, ageDays: 90 })

  const st = standingOf(expensive, [cheap])
  check('the money layer puts the expensive one ahead', st.verdict === 'ahead', st.verdict)
  check('…and it VETOES the pause', moneyProtects(st), JSON.stringify(st))
  check('…while the cheap one is condemned on the same evidence',
    moneyCondemns(standingOf(cheap, [expensive])), JSON.stringify(standingOf(cheap, [expensive])))

  // THE VETO MAY NEVER FIRE ON THE LEAD RUNG. There it is computing cost per
  // lead from the same numbers the CPL gate used, so a veto would be the gate
  // overruling itself with its own data. It must carry information the gate
  // does not have — which is what qualified and deal are.
  const youngA = row({ campaignId: 'ya', ageDays: 2, spendAed: 5000, leads: 50 })
  const youngB = row({ campaignId: 'yb', ageDays: 2, spendAed: 5000, leads: 5 })
  const younger = standingOf(youngA, [youngB])
  check('a lead-rung win is real…', younger.verdict === 'ahead', younger.verdict)
  check('…but never vetoes a pause', !moneyProtects(younger), younger.rung)
  check('…and never condemns either', !moneyCondemns(standingOf(youngB, [youngA])))

  check('a tie neither protects nor condemns', (() => {
    const t = standingOf(row({ campaignId: 't1', spendAed: 3000, leads: 10, qualified: 5, deals: 2 }),
      [row({ campaignId: 't2', spendAed: 3000, leads: 10, qualified: 5, deals: 1 })])
    return !moneyProtects(t) && !moneyCondemns(t)
  })())
  check('a trial with no rival is protected by nothing',
    !moneyProtects(standingOf(expensive, [])))
}

console.log('\n── the machine actually reads it ──')
{
  const engine = readFileSync(join(process.cwd(), 'lib/freehold/ads-machine-engine.ts'), { encoding: 'utf8' })
  const rotate = engine.slice(engine.indexOf('── ROTATE'))

  check('the rotate gate builds money rows', /const moneyRow = /.test(rotate))
  check('…from the CRM-attributed count, not the Meta-reported one',
    /leads: s\.attributed/.test(rotate), 'moneyRow reads s.leads')
  // THE VETO IS THE POINT. Without this filter the money layer is a display.
  check('a protected trial is filtered OUT of the pause candidates',
    /\.filter\(\(s\) => verdictCondemned\(s\) \|\| !moneyProtected\(s\)\)/.test(rotate),
    'no veto filter found')
  // A human saying "these leads are junk" outranks any arithmetic about them.
  check('…but a human verdict still outranks the veto',
    /verdictCondemned\(s\) \|\| !moneyProtected/.test(rotate))
  check('money-condemned trials are pause candidates',
    /moneyCondemned\(s\)/.test(rotate) && /moneyCondemns\(moneyOf\(s\)\)/.test(rotate))
  check('…and the pause reason cites the probability',
    /st\.p/.test(rotate), 'reason does not carry p')
  check('the account\'s own sales cycle is read, not assumed',
    /accountMoneyBasis\(\)/.test(rotate) || /accountMoneyBasis\(\)/.test(engine))
  check('…and a failed read degrades to the stated defaults',
    /catch \{ \/\* defaults \*\/ \}/.test(engine))

  // The deal value has to travel from the CRM to the engine or none of the
  // above can fire. It shipped in the CRM and reached no ad decision at all.
  const quality = readFileSync(join(process.cwd(), 'lib/freehold/campaign-quality.ts'), { encoding: 'utf8' })
  check('the campaign quality read carries deal value',
    /revenueAed/.test(quality))

  // ASSERTED BY RUNNING IT, not by matching the shape of the branch it used to
  // live in. This scanned campaign-quality.ts for `if (s && WON.has(s)) { …
  // revenueAed += v` and broke the moment the arithmetic moved to
  // campaign-score.ts — while the RULE it protects was never at risk. The rule
  // is that a value stamped on a lead that later went cold is a hope, not a
  // receipt, and now that scoreLeads is pure that can simply be demonstrated.
  const lead = (o: Partial<ScorableLead>): ScorableLead => ({
    id: `m${Math.random()}`, status: 'new', blocked: null, phone: '+9715010000000',
    behaviour_score: null, value_rating: null, deal_value_aed: null, ...o,
  })
  const money = scoreLeads([
    lead({ status: 'closed', deal_value_aed: 1_000_000, phone: '+971501000001' }),
    lead({ status: 'converted', deal_value_aed: 250_000, phone: '+971501000002' }),
    // Both of these carry a value and neither closed.
    lead({ status: 'lost', deal_value_aed: 9_000_000, phone: '+971501000003' }),
    lead({ status: 'negotiation', deal_value_aed: 4_000_000, phone: '+971501000004' }),
  ])
  check('…and only counts money against a WON lead',
    money.revenueAed === 1_250_000, `AED ${money.revenueAed}`)
}

console.log('\n── a number Meta never gave us is withheld, never printed as zero ──')
{
  // THE THREE-STORY BUG, seen on a live account in one screenshot: the money
  // card said SPENT AED 0 beside LEADS 2, the designs list on the SAME page
  // said AED 42, and the home widget said AED 0 · 0 leads. Nothing was
  // computing a wrong figure — a MISSING insights row was being coerced to
  // zero, and the zero then read as authoritative.
  //
  // "AED 0" and "we have no figure" are different facts, and printing the
  // first when you mean the second is the same failure this whole product
  // keeps re-learning: a system with no way to say "I do not know" reports its
  // own gap as somebody else's result.
  const route = code('app/api/meta/campaigns/[id]/money/route.ts')
  check('a missing insights row is reported as unknown, not as zero spend',
    /const spendKnown = row\?\.spend != null/.test(route),
    'a campaign Meta did not answer for is being given a spend of 0')
  check('…and the flag reaches the screen', /spendKnown: m\.spendKnown/.test(route))

  const panel = code('components/freehold/money-ladder-panel.tsx')
  check('the money card withholds the figure rather than printing AED 0',
    /me\.spendKnown === false \? '—'/.test(panel),
    'the ladder still prints a zero it was never told')

  const widget = code('components/freehold/lead-machine/live-campaigns-widget.tsx')
  check('the home widget withholds it too',
    /const known = c\.insights != null/.test(widget) && /known \? aed\(spend\) : '—'/.test(widget),
    'the home screen and the campaign page can disagree again')
  check('…and never computes a cost per lead from a figure it does not have',
    /known && leads > 0 && spend > 0/.test(widget))

  // THE CAUSE, not only the symptom. One page of the account insights edge was
  // read and the rest dropped, so campaigns past the cut simply had no row.
  const client = code('lib/meta/client.ts')
  check('every page of the account campaign insights is read',
    /apiFetchAllPages<CampaignInsightRow>/.test(client),
    'a single page is read again — campaigns past the cut lose their numbers silently')
}

if (failures > 0) {
  console.error(`\n${failures} money rule(s) broken.`)
  console.error('A figure nobody gave us is not a zero.')
  process.exit(1)
}
console.log('\nA campaign is judged on the money it made, on a rung it had time to reach.\n')
