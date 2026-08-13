/**
 * NO PLACEHOLDER REACHES A PAID AD — locked.
 *
 * fmtPrice returned the literal string 'AED TBD' when a listing had no stored
 * price, and buildVariants interpolates that result into twenty-five places in
 * live ad copy. A project with a blank price field published paid ads reading
 * "Starting at AED TBD".
 *
 * Nobody sees this in review, because the person launching has a price in
 * their head and the wizard shows the copy in a small preview box. It only
 * surfaces on Facebook, in front of buyers, having been paid for.
 *
 * So this scans EVERY variant of EVERY angle for the tokens a placeholder
 * leaves behind. It is deliberately a token scan rather than an assertion
 * about fmtPrice: the failure is "a placeholder reached the copy", whatever
 * route it took to get there.
 *
 * Pure — no network. Runs in `pnpm guards`.
 */
import { buildVariants, PRICE_ON_REQUEST } from '../lib/meta/creative-gen'
import type { GenerateCreativePayload } from '../lib/meta/types'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

/** Tokens that mean "somebody meant to fill this in later". */
const PLACEHOLDERS = [
  'tbd', 'lorem', 'ipsum', 'undefined', 'null', 'nan',
  'xxx', 'placeholder', 'coming soon', 'to be confirmed', '[', '{{',
]

const ANGLES = ['investor', 'yield', 'golden_visa', 'end_user'] as const

const payload = (o: Partial<GenerateCreativePayload> = {}): GenerateCreativePayload => ({
  listingName: 'Azizi Venice',
  area: 'Dubai South',
  developer: 'Azizi',
  startingPrice: 1_600_000,
  paymentPlan: '10/90',
  angle: 'investor',
  cta: 'LEARN_MORE',
  ...o,
} as GenerateCreativePayload)

const textOf = (p: GenerateCreativePayload) =>
  buildVariants(p)
    .flatMap((v) => [v.primaryText, v.headline, v.description ?? ''])
    .join(' \n ')
    .toLowerCase()

console.log('\n── a project with no price still gets clean copy ──')
{
  // THE CASE THAT SHIPPED: startingPrice null, every price slot reading
  // "AED TBD" in a live advertisement.
  for (const angle of ANGLES) {
    const copy = textOf(payload({ startingPrice: null, angle }))
    const hit = PLACEHOLDERS.find((t) => copy.includes(t))
    check(`${angle}: no placeholder token in any variant`, !hit, hit ? `contains "${hit}"` : '')
  }
  check('…and the honest phrase is used instead',
    textOf(payload({ startingPrice: null })).includes(PRICE_ON_REQUEST),
    'no "price on request" anywhere')
}

console.log('\n── a claim about price is never made without one ──')
{
  // "From <price> — above the AED 2M threshold" is a statement about what the
  // property costs. With no price stored, this company cannot support it in a
  // paid ad, and a Golden Visa claim is a regulated promise, not a slogan.
  const noPrice = textOf(payload({ startingPrice: null, angle: 'golden_visa' }))
  check('the Golden Visa threshold is not claimed without a price',
    !noPrice.includes('2m threshold') && !noPrice.includes('golden visa eligible'),
    noPrice.slice(0, 120))

  // …and WITH a real price above the threshold, it is claimed as before.
  const priced = textOf(payload({ startingPrice: 2_500_000, angle: 'golden_visa' }))
  check('…and is claimed normally when the price supports it',
    priced.includes('golden visa'), priced.slice(0, 120))
}

console.log('\n── a priced project reads exactly as before ──')
{
  const copy = textOf(payload({ startingPrice: 1_600_000 }))
  check('the price is formatted, not withheld', copy.includes('aed 1.6m'), copy.slice(0, 100))
  check('…and no placeholder appears', !PLACEHOLDERS.some((t) => copy.includes(t)))

  const small = textOf(payload({ startingPrice: 850_000 }))
  check('a sub-million price reads in thousands', small.includes('aed 850k'), small.slice(0, 100))

  // Zero is not a price. It used to fall through the same `!n` branch as null,
  // which was right by accident; it is right on purpose now.
  check('a zero price is treated as no price',
    textOf(payload({ startingPrice: 0 })).includes(PRICE_ON_REQUEST))
}

console.log('\n── every angle produces usable copy ──')
{
  for (const angle of ANGLES) {
    const vs = buildVariants(payload({ angle }))
    check(`${angle}: produces variants`, vs.length > 0, String(vs.length))
    check(`${angle}: every variant has words in every slot`,
      vs.every((v) => v.primaryText.trim() && v.headline.trim()),
      vs.map((v) => `${v.headline.length}/${v.primaryText.length}`).join(' '))
  }
}

if (failures > 0) {
  console.error(`\n${failures} ad-copy rule(s) broken.`)
  process.exit(1)
}
console.log('\nNo paid advertisement carries a word somebody meant to replace.\n')
