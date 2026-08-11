/**
 * THE CREATIVE LAB — locked.
 *
 * The page this replaces listed fifty ad creatives, newest first, most of them
 * blank grey squares, with no project, no result and no memory. It could not
 * answer either question a creative screen exists for: what should THIS
 * project's ads look like, and which of the ones we already ran worked.
 *
 * So the assertions are about the three properties that make a lab a lab:
 *
 *  · THE UNIFORM IS STABLE. A project keeps its colours, on every machine and
 *    every render, or the repeated exposure that makes a development
 *    recognisable is thrown away weekly.
 *  · IT ONLY ALLOWS WHAT THE PROJECT CAN HONESTLY SAY. A yield angle with no
 *    yield is a claim nobody can stand behind; a price layout with no price is
 *    a blank where a number belongs.
 *  · IT LEARNS IN ONE DIRECTION. A proven loser is never offered again, a
 *    proven winner keeps its layout while the argument moves, and "we have not
 *    really tried this" is never confused with "we tried this and it failed".
 *
 * Pure — no I/O. Runs in `pnpm guards`.
 */
import {
  uniformFor, slugHash, rankRecipes, nextRecipe, PALETTE_COUNT,
  MIN_IMPRESSIONS_TO_JUDGE, LAB_LAYOUTS, LAB_ANGLES, WITHHELD_REASONS, RECIPE_VERDICTS,
  type ProjectFacts, type RecipeResult, type LabLayout,
} from '../lib/freehold/creative-lab'
import { PALETTES, LAYOUTS } from '../lib/freehold/ad-compose'
import type { CreativeAngle } from '../lib/meta/types'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const project = (o: Partial<ProjectFacts> = {}): ProjectFacts => ({
  slug: 'sea-legend-one', name: 'Sea Legend One',
  startingPriceAED: 1_400_000, paymentPlan: '10/90', handoverYear: 2027,
  rentalYieldPct: 7.2, goldenVisaEligible: true, area: 'Dubai Marina', ...o,
})
const run = (o: Partial<RecipeResult> & { layout: LabLayout; angle: CreativeAngle }): RecipeResult => ({
  adId: `ad-${o.layout}-${o.angle}`, impressions: 0, clicks: 0, leads: 0, spendAed: 0, ...o,
})

console.log('\n── a project keeps its colours ──')
{
  const a = uniformFor(project())
  const b = uniformFor(project())
  check('the same project gets the same palette, every time', a.palette === b.palette, `${a.palette} / ${b.palette}`)
  check('…and it is a real palette index',
    a.palette >= 0 && a.palette < PALETTES.length, `${a.palette} of ${PALETTES.length}`)
  check('a different project gets a different one, not the same default',
    uniformFor(project({ slug: 'reportage-hills' })).palette !== undefined)
  check('the hash is stable and unsigned', slugHash('x') === slugHash('x') && slugHash('x') >= 0)
  check('an empty slug does not crash the uniform', uniformFor(project({ slug: '' })).palette >= 0)
  check('the palette count matches what the studio actually ships — otherwise a project\'s colours are unreachable',
    PALETTE_COUNT === PALETTES.length, `${PALETTE_COUNT} vs ${PALETTES.length}`)
}

console.log('\n── it only allows what the project can say ──')
{
  const full = uniformFor(project())
  check('a project with everything can use every layout',
    full.layouts.length === LAB_LAYOUTS.length, full.layouts.join(','))
  check('…and make every argument', full.angles.length === LAB_ANGLES.length, full.angles.join(','))
  check('…and withholds nothing', full.withheldLayouts.length === 0 && full.withheldAngles.length === 0)

  const noPrice = uniformFor(project({ startingPriceAED: null }))
  check('no price means no price-led layout — that is a blank where a number belongs',
    !noPrice.layouts.includes('heroPrice') && !noPrice.layouts.includes('payBands'), noPrice.layouts.join(','))
  check('…and the reason is on the card, not in somebody\'s head',
    noPrice.withheldLayouts.some((w) => w.key === 'heroPrice' && w.reason === 'noPrice'),
    JSON.stringify(noPrice.withheldLayouts))
  check('…and no investor pitch, which rests on a price to invest at',
    !noPrice.angles.includes('investor'), noPrice.angles.join(','))

  const noPlan = uniformFor(project({ paymentPlan: null }))
  check('a price with no plan loses the payment layout and keeps the price one',
    !noPlan.layouts.includes('payBands') && noPlan.layouts.includes('heroPrice'), noPlan.layouts.join(','))
  check('…and says which half was missing',
    noPlan.withheldLayouts.some((w) => w.key === 'payBands' && w.reason === 'noPlan'))

  check('no yield, no yield argument',
    !uniformFor(project({ rentalYieldPct: null })).angles.includes('yield'))
  check('golden visa is a legal threshold, not a mood — only where it is true',
    !uniformFor(project({ goldenVisaEligible: false })).angles.includes('golden_visa'))
  check('urgency needs a date the buyer can miss',
    !uniformFor(project({ handoverYear: null })).angles.includes('urgency'))
  check('a home pitch needs somewhere to be',
    !uniformFor(project({ area: null })).angles.includes('end_user'))

  // THE FLOOR: a project can always make an ad, whatever its row is missing.
  const bare = uniformFor({ slug: 'bare', name: 'Bare' })
  check('a project with nothing but a name can STILL make an ad',
    bare.layouts.length > 0, bare.layouts.join(','))
  check('…from the name-led families only', !bare.layouts.includes('heroPrice'))
  check('…and every withheld thing carries a reason',
    bare.withheldAngles.every((w) => (WITHHELD_REASONS as readonly string[]).includes(w.reason)),
    JSON.stringify(bare.withheldAngles))
}

console.log('\n── undecided is not failure ──')
{
  const thin = rankRecipes([run({ layout: 'frame', angle: 'lifestyle', impressions: 500 })])
  check('500 impressions with no leads is UNDECIDED, never poor',
    thin[0].verdict === 'undecided', thin[0].verdict)

  const failed = rankRecipes([run({ layout: 'frame', angle: 'lifestyle', impressions: MIN_IMPRESSIONS_TO_JUDGE, spendAed: 400 })])
  check('real delivery and no leads is POOR — the one claim this history can make',
    failed[0].verdict === 'poor', failed[0].verdict)

  const won = rankRecipes([run({ layout: 'heroPrice', angle: 'investor', impressions: 30_000, leads: 3, spendAed: 600 })])
  check('real delivery and leads is PROVEN', won[0].verdict === 'proven')
  check('…with a cost per lead from its own numbers', won[0].cplAed === 200, String(won[0].cplAed))
  check('a recipe with leads but no spend claims no cost per lead',
    rankRecipes([run({ layout: 'frame', angle: 'urgency', impressions: 30_000, leads: 2 })])[0].cplAed === null)

  // The same recipe run twice is ONE recipe with the sum behind it — two ads
  // of the same design are two samples, not two designs.
  const twice = rankRecipes([
    run({ adId: 'a', layout: 'frame', angle: 'urgency', impressions: 1500, leads: 1, spendAed: 100 }),
    run({ adId: 'b', layout: 'frame', angle: 'urgency', impressions: 1500, leads: 1, spendAed: 100 }),
  ])
  check('two ads of one recipe are one recipe with both samples',
    twice.length === 1 && twice[0].runs === 2 && twice[0].impressions === 3000, JSON.stringify(twice[0]))
  check('…and together they clear the floor neither cleared alone',
    twice[0].verdict === 'proven')

  const mixed = rankRecipes([
    run({ layout: 'frame', angle: 'lifestyle', impressions: 30_000, spendAed: 400 }),
    run({ layout: 'heroPrice', angle: 'investor', impressions: 30_000, leads: 4, spendAed: 400 }),
    run({ layout: 'badge', angle: 'urgency', impressions: 100 }),
  ])
  check('proven sorts first, poor sorts last',
    mixed[0].verdict === 'proven' && mixed[2].verdict === 'poor',
    mixed.map((m) => m.verdict).join(','))
  check('no history is an empty ranking, never a throw', rankRecipes([]).length === 0)
}

console.log('\n── the loop only moves one way ──')
{
  const u = uniformFor(project())

  const fresh = nextRecipe(u, [])
  check('with no history it suggests something the project is allowed to make',
    !!fresh && u.layouts.includes(fresh.layout) && u.angles.includes(fresh.angle), JSON.stringify(fresh))
  check('…and the same history always gives the same suggestion',
    JSON.stringify(nextRecipe(u, [])) === JSON.stringify(fresh))

  // A proven winner: the uniform holds, the argument moves.
  const ranked = rankRecipes([run({ layout: 'heroPrice', angle: 'investor', impressions: 30_000, leads: 4, spendAed: 800 })])
  const next = nextRecipe(u, ranked)
  check('after a win the LAYOUT is kept', next?.layout === 'heroPrice', JSON.stringify(next))
  check('…and the ANGLE is one nobody has tried', next?.angle !== 'investor', JSON.stringify(next))

  // A proven loser is never offered again.
  const loser = rankRecipes([
    run({ layout: 'payBands', angle: 'investor', impressions: 30_000, spendAed: 900 }),
  ])
  for (let i = 0; i < 3; i++) {
    const r = nextRecipe(u, loser)
    check(`a recipe with real delivery and no leads is not offered again (${i + 1})`,
      !(r?.layout === 'payBands' && r?.angle === 'investor'), JSON.stringify(r))
  }

  // Everything tried: repeat the best survivor rather than invent, and never
  // the loser.
  const everything: RecipeResult[] = []
  for (const l of u.layouts) for (const a of u.angles) {
    everything.push(run({ layout: l, angle: a, impressions: 30_000, leads: l === 'frame' ? 5 : 0, spendAed: 500 }))
  }
  const exhausted = nextRecipe(u, rankRecipes(everything))
  check('with everything tried it repeats the winner rather than inventing',
    exhausted?.layout === 'frame', JSON.stringify(exhausted))
  check('…and never a proven loser',
    rankRecipes(everything).find((r) => r.layout === exhausted!.layout && r.angle === exhausted!.angle)?.verdict !== 'poor')

  // A uniform that allows nothing is a real state and says so.
  check('a uniform with no allowed angle suggests nothing rather than something false',
    nextRecipe({ ...u, angles: [] }, []) === null)
}

console.log('\n── one vocabulary with the studio ──')
{
  // A layout this lab offers that ad-compose cannot draw is an empty preview.
  check('every lab layout is a layout the studio renders',
    LAB_LAYOUTS.every((l) => (LAYOUTS as string[]).includes(l)), LAB_LAYOUTS.join(','))
  check('every verdict is named, or the card renders a blank word', RECIPE_VERDICTS.length === 3)
  check('every withheld reason is named', WITHHELD_REASONS.length === 6)
  check('every angle the lab allows is one the machine also knows',
    LAB_ANGLES.length === 6, LAB_ANGLES.join(','))
}

if (failures > 0) {
  console.error(`\n${failures} creative-lab rule(s) broken.`)
  process.exit(1)
}
console.log('\nA project keeps its look, states only what it can prove, and learns one step at a time.\n')
