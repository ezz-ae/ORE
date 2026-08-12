/**
 * A PICTURE THAT CANNOT FLATTER OR ACCUSE — locked.
 *
 * The placement panel's whole job is one comparison: which surfaces convert
 * and which take money. A bar makes a twenty-fold gap visible without reading
 * anything — and that is exactly why a bar can lie faster than a number can.
 *
 * Two ways it lies, and both are assertions here: drawing a surface nobody has
 * tested as a zero (an accusation), and drawing the only measurable surface at
 * full width (flattery by construction).
 *
 * Pure — no network. Runs in `pnpm guards`.
 */
import {
  barsFor, isMeasurable, MIN_IMPRESSIONS_FOR_BAR, MIN_BARS_TO_COMPARE,
  type BarInput,
} from '../lib/freehold/placement-bars'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const row = (o: Partial<BarInput> = {}): BarInput =>
  ({ id: 'x', lpm: 500, impressions: 10_000, ...o })
const fillOf = (rows: BarInput[], id: string) => barsFor(rows).bars.find((b) => b.id === id)?.fill

console.log('\n── the real comparison, drawn to scale ──')
{
  // THE CASE FROM THE SCREEN: instagram feed 2,129 per million against
  // facebook reels 108. Twenty-fold, and it was the last grey column.
  const rows: BarInput[] = [
    row({ id: 'ig', lpm: 2129 }),
    row({ id: 'fbreels', lpm: 108 }),
  ]
  const b = barsFor(rows)
  check('the chart is drawn', b.show)
  check('the best surface fills the bar', fillOf(rows, 'ig') === 1)
  check('…and the twenty-fold gap is a twentieth of the width',
    Math.abs((fillOf(rows, 'fbreels') ?? 0) - 108 / 2129) < 0.0001, String(fillOf(rows, 'fbreels')))
  check('the scale is the best MEASURABLE surface', b.topLpm === 2129, String(b.topLpm))
}

console.log('\n── no evidence is not a zero ──')
{
  // A surface with nothing behind it drawn as an empty bar among long ones
  // says "this one is terrible" about something nobody has tested. That is an
  // accusation the panel's own verdicts would never make.
  const rows: BarInput[] = [
    row({ id: 'good', lpm: 2000 }),
    row({ id: 'bad', lpm: 100 }),
    row({ id: 'untested', lpm: null, impressions: 0 }),
  ]
  check('a surface Meta reported nothing for gets NO bar',
    fillOf(rows, 'untested') === null, String(fillOf(rows, 'untested')))

  // A MEASURABLE ZERO IS DIFFERENT: it was tested, and it converted nobody.
  // That earns an empty bar, because it is a real result.
  const withZero: BarInput[] = [row({ id: 'good', lpm: 2000 }), row({ id: 'zero', lpm: 0 })]
  check('a tested surface that converted nobody DOES draw an empty bar',
    fillOf(withZero, 'zero') === 0, String(fillOf(withZero, 'zero')))

  // A handful of impressions can produce an enormous rate off one accident —
  // one lead on forty impressions is 25,000 per million and would take the
  // whole scale with it.
  // Two real surfaces, so the chart draws at all — otherwise this would be
  // testing the one-bar rule instead of the thin-evidence one.
  const thin: BarInput[] = [
    row({ id: 'real', lpm: 2000, impressions: 50_000 }),
    row({ id: 'other', lpm: 400, impressions: 20_000 }),
    row({ id: 'fluke', lpm: 25_000, impressions: MIN_IMPRESSIONS_FOR_BAR - 1 }),
  ]
  check('a rate off a handful of impressions never sets the scale',
    barsFor(thin).topLpm === 2000, String(barsFor(thin).topLpm))
  check('…and draws no bar of its own', fillOf(thin, 'fluke') === null)
  check('…while the real surface still fills it', fillOf(thin, 'real') === 1)
  check(`the floor is stated (${MIN_IMPRESSIONS_FOR_BAR} impressions)`,
    isMeasurable(row({ impressions: MIN_IMPRESSIONS_FOR_BAR }))
    && !isMeasurable(row({ impressions: MIN_IMPRESSIONS_FOR_BAR - 1 })))
}

console.log('\n── one bar is not a comparison ──')
{
  // With a single measurable surface the scale IS that surface, so it renders
  // full-width and reads as excellent whatever its actual rate. A picture that
  // flatters by construction is worse than no picture.
  const alone: BarInput[] = [
    row({ id: 'only', lpm: 3 }),
    row({ id: 'untested', lpm: null, impressions: 0 }),
  ]
  check(`under ${MIN_BARS_TO_COMPARE} measurable surfaces there is no chart`,
    !barsFor(alone).show)
  check('…and nothing is drawn full-width to imply it is good',
    fillOf(alone, 'only') === null, String(fillOf(alone, 'only')))

  check('two measurable surfaces is enough to compare',
    barsFor([row({ id: 'a', lpm: 10 }), row({ id: 'b', lpm: 5 })]).show)

  // Everything measurable at zero: nothing converted anywhere, so there is no
  // scale and no comparison to draw.
  const allZero = barsFor([row({ id: 'a', lpm: 0 }), row({ id: 'b', lpm: 0 })])
  check('all zeroes draws nothing rather than two full bars', !allZero.show)
}

console.log('\n── nothing is dropped from the list ──')
{
  // A surface that cannot be DRAWN is still taking spend, and hiding it would
  // hide the leak.
  const rows: BarInput[] = [
    row({ id: 'a', lpm: 900 }), row({ id: 'b', lpm: 300 }),
    row({ id: 'untested', lpm: null, impressions: 0 }),
  ]
  const b = barsFor(rows)
  check('every input comes back, drawable or not', b.bars.length === 3, String(b.bars.length))
  check('…in the order it was given',
    b.bars.map((x) => x.id).join(',') === 'a,b,untested', b.bars.map((x) => x.id).join(','))
  check('…carrying its own value, so the label cannot drift from the bar',
    b.bars.find((x) => x.id === 'b')?.lpm === 300)

  check('an empty list does not throw', barsFor([]).bars.length === 0 && !barsFor([]).show)
}

if (failures > 0) {
  console.error(`\n${failures} placement-bar rule(s) broken.`)
  process.exit(1)
}
console.log('\nThe picture says what the numbers say, or it is not drawn.\n')
