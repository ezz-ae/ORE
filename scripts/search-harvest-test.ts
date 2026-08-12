/**
 * THE LOOP THAT LETS SEARCH RUN ITSELF — locked.
 *
 * Google names every real query that triggered an ad. Acting on that report is
 * the whole reason Search can be automated where Meta cannot: no creative
 * judgement is involved, only whether a phrase brought a lead at a payable
 * price or took money and brought nothing.
 *
 * Which means the failures are all one shape — ACTING ON TOO LITTLE. A wrong
 * negative is a real query silently blocked, and nothing in any report will
 * ever show what it would have brought. So these assertions are about the
 * floors, and about the two things the arithmetic must never be allowed to
 * overrule: a decision a person already made, and the company's own name.
 *
 * Pure — no network. Runs in `pnpm guards`.
 */
import {
  harvest, judgeTerm, isBrandTerm, targetCplFrom,
  HARVEST_VERDICTS, MIN_CLICKS_TO_NEGATIVE, WASTE_MULTIPLE, ADD_CPL_MULTIPLE,
  MAX_ADDS_PER_RUN, MIN_LEADS_FOR_TARGET,
  type SearchTerm, type HarvestContext,
} from '../lib/google/search-harvest'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const CPL = 200
const ctx = (o: Partial<HarvestContext> = {}): HarvestContext => ({
  targetCplAed: CPL,
  brandTerms: ['azizi venice', 'azizi'],
  known: [],
  ...o,
})
const term = (o: Partial<SearchTerm> = {}): SearchTerm => ({
  term: 'buy apartment dubai south', status: 'NONE',
  impressions: 500, clicks: 10, costAed: 100, conversions: 0, ...o,
})

console.log('\n── a decision somebody already made is never re-made ──')
{
  // A machine that overrules a person every night is a machine people switch
  // off, and then none of the rest of this matters.
  check('a term Google marked ADDED is settled',
    judgeTerm(term({ status: 'ADDED' }), ctx()).verdict === 'settled')
  check('…and one marked EXCLUDED is too',
    judgeTerm(term({ status: 'EXCLUDED', costAed: 9_000 }), ctx()).verdict === 'settled')
  check('…including the combined status Google also returns',
    judgeTerm(term({ status: 'ADDED_EXCLUDED' }), ctx()).verdict === 'settled')
  check('a term already in our own plan is not re-proposed',
    judgeTerm(term({ conversions: 2, costAed: 100 }), ctx({ known: ['buy apartment dubai south'] })).verdict === 'settled')
  check('…matched loosely enough that case and spacing do not defeat it',
    judgeTerm(term({ conversions: 2 }), ctx({ known: ['  Buy   Apartment Dubai South '] })).verdict === 'settled')
}

console.log('\n── the names this company sells are never blocked ──')
{
  // A brand query with no conversion YET is still the best traffic in the
  // account. Blocking it hands the name to whoever bids on it next.
  const brandWaste = term({ term: 'azizi venice payment plan', clicks: 40, costAed: 900, conversions: 0 })
  check('a brand term that looks like waste on the numbers is protected',
    judgeTerm(brandWaste, ctx()).verdict === 'protected', judgeTerm(brandWaste, ctx()).verdict)
  check('…and the identical numbers on a generic term ARE cut',
    judgeTerm({ ...brandWaste, term: 'free property valuation' }, ctx()).verdict === 'addNegative')

  // THE BUG A SUBSTRING TEST WOULD CAUSE: the developer "Azizi" would protect
  // "azizinvestments", and a short brand name would protect half the account.
  check('brand matching is on whole words, not substrings',
    isBrandTerm('azizi venice floor plan', ['azizi']) && !isBrandTerm('aziziland scam', ['azizi']),
    String(isBrandTerm('aziziland scam', ['azizi'])))
  check('an empty brand list protects nothing', !isBrandTerm('anything', ['', '  ']))

  // A brand term that CONVERTS is still added — protection is about never
  // cutting, not about never buying.
  check('a converting brand term is still proposed',
    judgeTerm(term({ term: 'azizi venice', conversions: 1, costAed: 150 }), ctx()).verdict === 'addKeyword')
}

console.log('\n── nothing is cut on evidence that cannot carry it ──')
{
  // Three clicks and no lead is ordinary variance, not evidence.
  check('a handful of clicks is not a verdict',
    judgeTerm(term({ clicks: 3, costAed: 30 }), ctx()).verdict === 'watch')

  check(`${WASTE_MULTIPLE} leads' worth of spend with nothing back is`,
    judgeTerm(term({ clicks: 5, costAed: CPL * WASTE_MULTIPLE }), ctx()).verdict === 'addNegative')
  check('…and one dirham under it is not',
    judgeTerm(term({ clicks: 5, costAed: CPL * WASTE_MULTIPLE - 1 }), ctx()).verdict === 'watch')

  // The second trigger catches the CHEAP query that bleeds quietly and never
  // shows up as a big number in any report.
  check(`${MIN_CLICKS_TO_NEGATIVE} clicks with no lead is cut even when it was cheap`,
    judgeTerm(term({ clicks: MIN_CLICKS_TO_NEGATIVE, costAed: 20 }), ctx()).verdict === 'addNegative')
  check('…and one click under it is not',
    judgeTerm(term({ clicks: MIN_CLICKS_TO_NEGATIVE - 1, costAed: 20 }), ctx()).verdict === 'watch')
}

console.log('\n── without a target CPL there is no such thing as too expensive ──')
{
  // A GUESSED target would cut real queries, and a wrong negative is invisible
  // forever: nothing in any report shows what a blocked query would have done.
  const blind = ctx({ targetCplAed: null })
  check('no target means nothing is ever cut',
    judgeTerm(term({ clicks: 200, costAed: 5_000 }), blind).verdict === 'watch',
    judgeTerm(term({ clicks: 200, costAed: 5_000 }), blind).verdict)
  check('…and nothing is added either, because "cheap" has no meaning',
    judgeTerm(term({ conversions: 3, costAed: 60 }), blind).verdict === 'watch')

  // The target itself is refused on a small sample, for the same reason.
  check(`a target CPL from under ${MIN_LEADS_FOR_TARGET} leads is refused`,
    targetCplFrom(1_000, MIN_LEADS_FOR_TARGET - 1) === null)
  check('…and computed from enough of them',
    targetCplFrom(1_000, 5) === 200, String(targetCplFrom(1_000, 5)))
  check('…and never from zero spend', targetCplFrom(0, 50) === null)
}

console.log('\n── converting is not the same as worth buying ──')
{
  check('a query that converted at target is proposed',
    judgeTerm(term({ conversions: 1, costAed: CPL }), ctx()).verdict === 'addKeyword')
  check(`…and up to ${ADD_CPL_MULTIPLE}x target, which allows a small sample to be unlucky`,
    judgeTerm(term({ conversions: 1, costAed: CPL * ADD_CPL_MULTIPLE }), ctx()).verdict === 'addKeyword')

  // A term that produces leads is never junk. It is expensive, and expensive
  // and worthless have completely different answers.
  const dear = judgeTerm(term({ conversions: 1, costAed: CPL * 4 }), ctx())
  check('a query that converted EXPENSIVELY is watched, never negatived',
    dear.verdict === 'watch', dear.verdict)

  // EXACT, not phrase: this exact phrase is the thing that converted, and a
  // phrase add buys a wider set on the strength of a narrower result.
  check('an added query is bought on EXACT',
    judgeTerm(term({ conversions: 2, costAed: 100 }), ctx()).matchType === 'EXACT')

  check('the cost per lead is carried, not just the verdict',
    judgeTerm(term({ conversions: 2, costAed: 300 }), ctx()).vars.cpa === 150)
  check('…and is null rather than zero when nothing converted',
    judgeTerm(term(), ctx()).vars.cpa === null)
}

console.log('\n── the report becomes two lists and a number ──')
{
  const rows: SearchTerm[] = [
    { term: 'cheap query a', status: 'NONE', impressions: 900, clicks: 20, costAed: 600, conversions: 0 },
    { term: 'cheap query b', status: 'NONE', impressions: 900, clicks: 30, costAed: 900, conversions: 0 },
    { term: 'good query', status: 'NONE', impressions: 100, clicks: 5, costAed: 150, conversions: 2 },
    { term: 'better query', status: 'NONE', impressions: 100, clicks: 4, costAed: 80, conversions: 2 },
    { term: 'azizi venice', status: 'NONE', impressions: 400, clicks: 30, costAed: 800, conversions: 0 },
  ]
  const h = harvest(rows, ctx())

  check('the cheapest converter is proposed first — if only some can be taken, take those',
    h.adds[0].term === 'better query', h.adds.map((a) => a.term).join(','))
  check('the biggest leak is listed first, so it is seen even if nobody reads on',
    h.negatives[0].term === 'cheap query b', h.negatives.map((n) => n.term).join(','))
  check('the brand term is in neither list', !h.negatives.some((n) => n.term === 'azizi venice'))
  check('…and is still shown rather than dropped from the report',
    h.watching.some((w) => w.term === 'azizi venice'))

  // The number that answers "what did this actually do for me".
  check('the waste found is real money, added up', h.wasteFoundAed === 1500, String(h.wasteFoundAed))

  // A SILENT CAP READS AS "we covered everything". It never may.
  const many = Array.from({ length: MAX_ADDS_PER_RUN + 7 }, (_, i) => ({
    term: `converter ${i}`, status: 'NONE', impressions: 100, clicks: 3, costAed: 50 + i, conversions: 1,
  }))
  const capped = harvest(many, ctx())
  check(`no more than ${MAX_ADDS_PER_RUN} keywords are proposed in one run`,
    capped.adds.length === MAX_ADDS_PER_RUN, String(capped.adds.length))
  check('…and the number left behind is reported, never silently dropped',
    capped.addsCapped === 7, String(capped.addsCapped))
  check('…while every negative is kept, because stopping waste has no reason to be rationed',
    harvest([...rows, ...rows.map((r) => ({ ...r, term: `${r.term} 2` }))], ctx()).negatives.length === 4)

  check('an empty report produces empty lists, not a crash',
    harvest([], ctx()).adds.length === 0 && harvest([], ctx()).wasteFoundAed === 0)
}

console.log('\n── every verdict is reachable ──')
{
  const seen = new Set<string>()
  for (const r of [
    judgeTerm(term({ conversions: 1, costAed: 100 }), ctx()),
    judgeTerm(term({ clicks: 40, costAed: 900 }), ctx()),
    judgeTerm(term({ clicks: 2 }), ctx()),
    judgeTerm(term({ status: 'ADDED' }), ctx()),
    judgeTerm(term({ term: 'azizi venice', clicks: 40, costAed: 900 }), ctx()),
  ]) seen.add(r.verdict)
  const missing = HARVEST_VERDICTS.filter((v) => !seen.has(v))
  check('every verdict this module can reach has a case', missing.length === 0, missing.join(','))
}

if (failures > 0) {
  console.error(`\n${failures} search-harvest rule(s) broken.`)
  process.exit(1)
}
console.log('\nThe account says what to buy and what to stop paying for.\n')
