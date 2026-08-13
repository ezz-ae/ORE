/**
 * A WINNER NEEDS SOMEBODY TO HAVE BEATEN — locked.
 *
 * From a live campaign:
 *
 *   cashoffer            WINNER   25 leads   CPL 106   spend AED 2,650
 *   cashoffer creative 1           0 leads   CPL —     spend AED 84
 *   cashoffer creative 2           0 leads   CPL —     spend AED 26
 *
 * A lead costs about AED 106 here. Creative 2 was given a quarter of that. It
 * did not lose — it never ran. The badge came from `ads.filter(leads > 0)`,
 * which crowns anything with a single lead whatever the others were allowed to
 * spend.
 *
 * And it is not cosmetic: the panel says the budget moves to the winner by
 * itself and puts a Pause button on every row, so the badge invites somebody
 * to switch off two designs on the strength of a race that never happened.
 *
 * Pure — no network. Runs in `pnpm guards`.
 */
import {
  standingsOf, leadPriceOf, FAIR_CHANCE_MULTIPLE, MIN_CONTENDERS, DESIGN_STANDINGS,
  type DesignRow,
} from '../lib/freehold/design-race'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const standing = (rows: DesignRow[], id: string) =>
  standingsOf(rows).standings.find((s) => s.id === id)?.standing

console.log('\n── the campaign from the screen ──')
{
  const rows: DesignRow[] = [
    { id: 'winner', leads: 25, spendAed: 2650, cpl: 106 },
    { id: 'c1', leads: 0, spendAed: 84, cpl: null },
    { id: 'c2', leads: 0, spendAed: 26, cpl: null },
  ]
  const s = standingsOf(rows)

  check('a lead here costs about AED 106', Math.round(s.leadPriceAed ?? 0) === 106, String(s.leadPriceAed))
  check('…so the design given AED 26 is TOO EARLY, not losing',
    standing(rows, 'c2') === 'tooEarly', String(standing(rows, 'c2')))
  check('…and so is the one given AED 84 — under one lead\'s worth',
    standing(rows, 'c1') === 'tooEarly', String(standing(rows, 'c1')))

  // ONE CONTENDER IS NOT A RACE. The badge is the loudest thing on the panel
  // and must not be the least evidenced.
  check('with nobody else in the race there is NO winner badge',
    s.winnerId === null, String(s.winnerId))
  check('…and the one design that ran is a contender, not a champion',
    standing(rows, 'winner') === 'contender', String(standing(rows, 'winner')))
  check('the shortfall says how much more it needs to be judged',
    s.standings.find((x) => x.id === 'c2')?.shortfallAed === 80,
    String(s.standings.find((x) => x.id === 'c2')?.shortfallAed))
}

console.log('\n── a real race does get a winner ──')
{
  const rows: DesignRow[] = [
    { id: 'a', leads: 10, spendAed: 1000, cpl: 100 },
    { id: 'b', leads: 4, spendAed: 1000, cpl: 250 },
  ]
  const s = standingsOf(rows)
  check('the cheaper lead wins', s.winnerId === 'a', String(s.winnerId))
  check('…and the other is a contender, because it genuinely competed',
    standing(rows, 'b') === 'contender', String(standing(rows, 'b')))
  check('two contenders is enough', s.contenders === MIN_CONTENDERS, String(s.contenders))

  // A design that spent its fair share and produced nothing IS losing, and
  // saying so is the whole point of the panel.
  const withLoser: DesignRow[] = [...rows, { id: 'c', leads: 0, spendAed: 900, cpl: null }]
  check('a design that had its budget and brought nothing says so',
    standing(withLoser, 'c') === 'noLeads', String(standing(withLoser, 'c')))
  check('…and it does not stop the winner being named',
    standingsOf(withLoser).winnerId === 'a')
}

console.log('\n── the price a fair chance is measured against ──')
{
  // Pooled across every converting design, not taken from the best one. The
  // winner's own price would set the bar by the cheapest performer and hold
  // everything else "unproven" for longer than is fair.
  const pooled = leadPriceOf([
    { id: 'a', leads: 10, spendAed: 1000, cpl: 100 },
    { id: 'b', leads: 10, spendAed: 3000, cpl: 300 },
  ])
  check('the price pools spend over leads across the converters',
    pooled === 200, String(pooled))
  check('…rather than taking the winner\'s own CPL', pooled !== 100)

  check('nothing converted anywhere means no price', leadPriceOf([
    { id: 'a', leads: 0, spendAed: 500, cpl: null },
  ]) === null)

  // WITH NO PRICE NOTHING CAN BE JUDGED. Not too early, not losing — there is
  // simply no yardstick, and inventing one would condemn a design on nothing.
  const blind: DesignRow[] = [
    { id: 'a', leads: 0, spendAed: 5000, cpl: null },
    { id: 'b', leads: 0, spendAed: 10, cpl: null },
  ]
  check('with no lead price, even a heavy spender is only too early',
    standing(blind, 'a') === 'tooEarly', String(standing(blind, 'a')))
  check('…and there is certainly no winner', standingsOf(blind).winnerId === null)
}

console.log('\n── leads outrank the budget test ──')
{
  // A design that CONVERTED has self-evidently had its chance, whatever it
  // spent — a cheap lead is the best possible evidence, not a disqualification.
  const rows: DesignRow[] = [
    { id: 'expensive', leads: 10, spendAed: 2000, cpl: 200 },
    { id: 'cheap', leads: 1, spendAed: 30, cpl: 30 },
  ]
  const s = standingsOf(rows)
  check('a design that converted on a tiny budget still counts as a contender',
    s.contenders === 2, String(s.contenders))
  check('…and wins if its lead was cheapest', s.winnerId === 'cheap', String(s.winnerId))
}

console.log('\n── every standing is reachable ──')
{
  const seen = new Set<string>()
  for (const rows of [
    [{ id: 'a', leads: 10, spendAed: 1000, cpl: 100 }, { id: 'b', leads: 2, spendAed: 1000, cpl: 500 }],
    [{ id: 'a', leads: 10, spendAed: 1000, cpl: 100 }, { id: 'b', leads: 0, spendAed: 900, cpl: null },
     { id: 'c', leads: 0, spendAed: 5, cpl: null }],
  ] as DesignRow[][]) for (const s of standingsOf(rows).standings) seen.add(s.standing)
  const missing = DESIGN_STANDINGS.filter((s) => !seen.has(s))
  check('every standing can happen — none is dead copy', missing.length === 0, missing.join(','))

  check(`the fair-chance bar is one lead's worth (x${FAIR_CHANCE_MULTIPLE})`,
    FAIR_CHANCE_MULTIPLE >= 1 && FAIR_CHANCE_MULTIPLE <= 2)
  check('an empty panel does not throw',
    standingsOf([]).winnerId === null && standingsOf([]).standings.length === 0)
}

if (failures > 0) {
  console.error(`\n${failures} design-race rule(s) broken.`)
  process.exit(1)
}
console.log('\nNo design is called a loser for a budget it was never given.\n')
