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
  standingsOf, leadPriceOf, FAIR_CHANCE_MULTIPLE, MIN_CONTENDERS, WINNER_P, DESIGN_STANDINGS,
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

console.log('\n── THREE ADS FROM A LIVE EXPORT, one day, one ad set ──')
{
  // The failure this section exists for, straight out of the account:
  //
  //   story full info   AED 611.05   1 lead
  //   New creative      AED  17.08   1 lead
  //   Mixed creative    AED  30.16   0 leads
  //
  // Both converters had exactly ONE lead, so the contender count passed and
  // the badge went to whoever cost less — an ad with a hundred and thirty-three
  // impressions. The same panel printed "needs AED 297 more" on that row.
  const rows: DesignRow[] = [
    { id: 'story', leads: 1, spendAed: 611.05, cpl: 611.05 },
    { id: 'new', leads: 1, spendAed: 17.08, cpl: 17.08 },
    { id: 'mixed', leads: 0, spendAed: 30.16, cpl: null },
  ]
  const s = standingsOf(rows)
  check('a lead here costs about AED 314', Math.round(s.leadPriceAed ?? 0) === 314, String(s.leadPriceAed))
  check('one lead against one lead is NOT a winner', s.winnerId === null, String(s.winnerId))
  check('…and the panel says so with a real probability',
    s.p > WINNER_P && s.p < 0.2, s.p.toFixed(4))

  // But the operator still wants to know which is ahead TODAY, and "ahead
  // today" is a true sentence where "winner" is not.
  check('the cheapest so far is LEADING, not blank', s.leadingId === 'new', String(s.leadingId))
  check('…and it is never both at once', !(s.winnerId && s.leadingId))
  check('the one given AED 30 of a AED 314 lead is still too early',
    standing(rows, 'mixed') === 'tooEarly', String(standing(rows, 'mixed')))

  // A WINNER AND A SHORTFALL ON ONE ROW is two rules disagreeing out loud.
  const badge = s.standings.find((x) => x.id === s.winnerId)
  check('no row is ever a winner with a shortfall still on it',
    !badge || badge.shortfallAed === 0, JSON.stringify(badge))
}

console.log('\n── a real race does get a winner ──')
{
  // Thirty leads against five on the same money: p ≈ 0.00002. That is a
  // difference somebody can act on, and the badge appears.
  const rows: DesignRow[] = [
    { id: 'a', leads: 30, spendAed: 3000, cpl: 100 },
    { id: 'b', leads: 5, spendAed: 3000, cpl: 600 },
  ]
  const s = standingsOf(rows)
  check('the cheaper lead wins', s.winnerId === 'a', String(s.winnerId))
  check('…on a probability under the conventional line', s.p < WINNER_P, s.p.toFixed(5))
  check('…and the other is a contender, because it genuinely competed',
    standing(rows, 'b') === 'contender', String(standing(rows, 'b')))
  check('two contenders is enough', s.contenders === MIN_CONTENDERS, String(s.contenders))

  // TEN AGAINST FOUR IS p = 0.18 — a 2.5x gap that is still a coin flip at
  // this size. It gets 'leading', not a badge.
  const close = standingsOf([
    { id: 'a', leads: 10, spendAed: 1000, cpl: 100 },
    { id: 'b', leads: 4, spendAed: 1000, cpl: 250 },
  ])
  check('a 2.5x gap on fourteen leads is only LEADING',
    close.winnerId === null && close.leadingId === 'a',
    `winner=${close.winnerId} leading=${close.leadingId} p=${close.p.toFixed(3)}`)

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
  // …but ONE cheap lead does not beat ten. AED 30 for a lead looks six times
  // better than AED 200 and on a single lead it is not proven — p = 0.30. It
  // leads, and leading is the honest word for it.
  check('…and leads on price without being crowned for one lead',
    s.winnerId === null && s.leadingId === 'cheap',
    `winner=${s.winnerId} leading=${s.leadingId} p=${s.p.toFixed(3)}`)
}

console.log('\n── every standing is reachable ──')
{
  const seen = new Set<string>()
  for (const rows of [
    // separated → winner + contender
    [{ id: 'a', leads: 30, spendAed: 3000, cpl: 100 }, { id: 'b', leads: 5, spendAed: 3000, cpl: 600 }],
    // not separated → leading + contender
    [{ id: 'a', leads: 3, spendAed: 300, cpl: 100 }, { id: 'b', leads: 2, spendAed: 300, cpl: 150 }],
    // funded and produced nothing → noLeads; barely funded → tooEarly
    [{ id: 'a', leads: 30, spendAed: 3000, cpl: 100 }, { id: 'b', leads: 5, spendAed: 3000, cpl: 600 },
     { id: 'd', leads: 0, spendAed: 900, cpl: null }, { id: 'c', leads: 0, spendAed: 5, cpl: null }],
  ] as DesignRow[][]) for (const s of standingsOf(rows).standings) seen.add(s.standing)
  const missing = DESIGN_STANDINGS.filter((s) => !seen.has(s))
  check('every standing can happen — none is dead copy', missing.length === 0, missing.join(','))

  check(`the fair-chance bar is one lead's worth (x${FAIR_CHANCE_MULTIPLE})`,
    FAIR_CHANCE_MULTIPLE >= 1 && FAIR_CHANCE_MULTIPLE <= 2)
  check('an empty panel does not throw',
    standingsOf([]).winnerId === null && standingsOf([]).leadingId === null
    && standingsOf([]).standings.length === 0)
  check(`the badge needs a probability under ${WINNER_P}`, WINNER_P === 0.05, String(WINNER_P))
}

if (failures > 0) {
  console.error(`\n${failures} design-race rule(s) broken.`)
  process.exit(1)
}
console.log('\nNo design is called a loser for a budget it was never given.\n')
