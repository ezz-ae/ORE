/**
 * Payment-plan template rules, locked.
 *
 * These layouts came from ads running in Dubai now, which sell on TERMS: the
 * finance hook is read first, the total price is the largest thing on the
 * page, and the down payment sits in a badge over the render.
 *
 * The rule that matters is the gate. An ad that renders with a blank where the
 * price belongs is worse than no ad at all — it looks finished, so it goes
 * out, and it goes out to a paying audience. Everything here is about refusing
 * to produce that.
 *
 * Pure — the gate and the registry are data, so no canvas is needed.
 */
import {
  LAYOUTS, PAY_LAYOUTS, isPayLayout, missingPayFields, PALETTES,
  type LayoutKey, type Overlay,
} from '../lib/freehold/ad-compose'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

/** A complete payment-plan ad, as the reference ads are. */
const full: Overlay = {
  eyebrow: '', footnote: '', price: '', priceUnit: '',
  headline: 'تاون هاوس بسعر ممتاز مع افضل خطة سداد في موقع استراتيجي في دبي',
  financeHook: '٨٠٪ عند الاستلام مع امكانية السداد بتمويل بنكي على ٢٥ عاماً',
  totalPrice: '2,830,000',
  totalLabel: 'أجمالي السعر',
  downPct: '20%',
  downLabel: 'دفعة أولى',
  terms: 'والباقي يسدد عند الاستلام أو بتمويل عقاري',
}

console.log('\n── the family exists and is reachable ──')
{
  for (const l of PAY_LAYOUTS) {
    check(`${l} is a real layout the gallery offers`, LAYOUTS.includes(l), l)
    check(`${l} is flagged as a payment layout`, isPayLayout(l))
  }
  check('the older layouts are NOT payment layouts',
    !isPayLayout('heroPrice') && !isPayLayout('frame') && !isPayLayout('badge'))
  check('nothing was dropped from the original set',
    (['heroPrice', 'frame', 'statFooter', 'splitCard', 'badge'] as LayoutKey[])
      .every((l) => LAYOUTS.includes(l)))
}

console.log('\n── a complete ad passes ──')
{
  check('payBands is satisfied', missingPayFields('payBands', full).length === 0,
    missingPayFields('payBands', full).join(','))
  check('payBadge is satisfied', missingPayFields('payBadge', full).length === 0,
    missingPayFields('payBadge', full).join(','))
  const withReturn = { ...full, returnvalue: '75,000', returnLabel: 'استرد سنوياً' }
  check('payReturn is satisfied once the return figure is there',
    missingPayFields('payReturn', withReturn).length === 0,
    missingPayFields('payReturn', withReturn).join(','))
}

console.log('\n── a half-filled ad is refused, and the gap is named ──')
{
  // The whole point: each of these renders "fine" and ships an ad with a hole.
  const noPrice = { ...full, totalPrice: '' }
  check('no total price is caught', missingPayFields('payBands', noPrice).includes('totalPrice'),
    missingPayFields('payBands', noPrice).join(','))
  const noHook = { ...full, financeHook: '' }
  check('no finance hook is caught', missingPayFields('payBands', noHook).includes('financeHook'))
  const noDown = { ...full, downPct: '' }
  check('no down payment is caught', missingPayFields('payBands', noDown).includes('downPct'))
  const noHead = { ...full, headline: '   ' }
  check('a whitespace-only headline is still missing', missingPayFields('payBands', noHead).includes('headline'))

  const empty: Overlay = { eyebrow: '', headline: '', price: '', priceUnit: '', footnote: '' }
  const all = missingPayFields('payBands', empty)
  check('an empty overlay reports every field, not just the first', all.length >= 4, all.join(','))
}

console.log('\n── payReturn needs its second column ──')
{
  // Its footer is two columns. Without the return figure one half is blank,
  // which is exactly what makes an ad look unfinished.
  check('the return figure is required for payReturn',
    missingPayFields('payReturn', full).includes('returnValue'),
    missingPayFields('payReturn', full).join(','))
  check('but NOT for the other two',
    !missingPayFields('payBands', full).includes('returnValue') &&
    !missingPayFields('payBadge', full).includes('returnValue'))
}

console.log('\n── the gate only applies where it should ──')
{
  const empty: Overlay = { eyebrow: '', headline: '', price: '', priceUnit: '', footnote: '' }
  for (const l of ['heroPrice', 'frame', 'statFooter', 'splitCard', 'badge'] as LayoutKey[]) {
    check(`${l} is never blocked by payment fields`, missingPayFields(l, empty).length === 0,
      missingPayFields(l, empty).join(','))
  }
}

console.log('\n── the palettes are real and legible ──')
{
  check('the three ad palettes were added', PALETTES.length >= 8, String(PALETTES.length))
  check('every palette has all five roles',
    PALETTES.every((p) => p.bg && p.bg2 && p.ink && p.accent && p.chip))
  check('every colour is a hex value',
    PALETTES.every((p) => [p.bg, p.bg2, p.ink, p.accent, p.chip].every((c) => /^#[0-9a-fA-F]{6}$/.test(c))),
    JSON.stringify(PALETTES.find((p) => ![p.bg, p.bg2, p.ink, p.accent, p.chip].every((c) => /^#[0-9a-fA-F]{6}$/.test(c)))))
  // Band text is drawn in ink on bg — if those match, the headline vanishes.
  check('no palette hides its own text', PALETTES.every((p) => p.ink.toLowerCase() !== p.bg.toLowerCase()))
}

if (failures > 0) {
  console.error(`\n${failures} ad-template rule(s) broken.`)
  process.exit(1)
}
console.log('\nAll ad-template rules hold.\n')
