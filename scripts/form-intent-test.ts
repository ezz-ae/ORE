/**
 * HIGHER INTENT IS DECIDED BY THE PRODUCT, AND ONLY EVER UPWARDS — locked.
 *
 * `isOptimizedForQuality` was whatever the wizard had toggled and whatever the
 * form template hardcoded — the shape of the FORM deciding a question only the
 * thing being sold can answer. A plot handing over in six years cannot be
 * bought by somebody who needs somewhere to live, so a one-tap submission on
 * it is usually a mis-tap.
 *
 * The one-way rule is the assertion that matters: a derived default must never
 * be able to REMOVE the stricter form from a template that asked for it.
 *
 * Pure — no model, no database, no network. Runs in `pnpm guards`.
 */
import {
  chooseFormIntent, higherIntentFor, yearsToHandover,
  FORM_INTENTS, FORM_INTENT_REASONS, INVESTOR_HORIZON_YEARS, HIGH_TICKET_AED,
} from '../lib/meta/form-intent'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const at = (yearsToHandover: number | null, startingPriceAed: number | null = null) =>
  chooseFormIntent({ yearsToHandover, startingPriceAed })

console.log('\n── the horizon decides it ──')
{
  check('a six-year handover earns the stricter form',
    at(6).intent === 'higher' && at(6).reason === 'farHandover')
  check('exactly at the horizon earns it', at(INVESTOR_HORIZON_YEARS).intent === 'higher')
  check('just inside it does not — an end user is still in this market',
    at(INVESTOR_HORIZON_YEARS - 0.5).intent === 'volume')
  check('ready stock takes the volume, because a casual enquiry can be shown something',
    at(0).intent === 'volume' && at(0).reason === 'nearTermStock')
  check('a handover already passed is ready stock, not a far horizon',
    at(-2).intent === 'volume')
}

console.log('\n── the ticket decides it when the horizon does not ──')
{
  check('a high ticket on near stock still earns it',
    at(1, HIGH_TICKET_AED).intent === 'higher' && at(1, HIGH_TICKET_AED).reason === 'highTicket')
  check('under the line, near stock keeps the volume',
    at(1, HIGH_TICKET_AED - 1).intent === 'volume')
  check('the horizon is read FIRST — a far handover is farHandover whatever it costs',
    at(6, HIGH_TICKET_AED).reason === 'farHandover')
  check('a zero or negative price is no price at all',
    at(1, 0).reason === 'nearTermStock' && at(1, -5).reason === 'nearTermStock')
}

console.log('\n── an unknown never earns the stricter form ──')
{
  check('a listing that does not say when it hands over is unknownProduct',
    at(null).reason === 'unknownProduct')
  check('…and keeps the platform default rather than implying a judgement',
    at(null).intent === 'volume')
  check('a NaN is an unknown, not a zero',
    chooseFormIntent({ yearsToHandover: Number.NaN, startingPriceAed: null }).reason === 'unknownProduct')
  check('…but an unknown horizon with a high ticket still earns it on the price',
    at(null, HIGH_TICKET_AED).intent === 'higher')
}

console.log('\n── ONE WAY. The default can add it and can never take it away ──')
{
  for (const years of [null, -3, 0, 1, 2, 6]) {
    const product = at(years as number | null)
    check(`a template asking for higher intent keeps it at years=${String(years)}`,
      higherIntentFor(true, product) === true)
  }
  check('a template that did not ask can still be given it by the product',
    higherIntentFor(false, at(6)) === true)
  check('…and is left alone when the product does not earn it',
    higherIntentFor(false, at(0)) === false)

  const src = readFileSync(join(process.cwd(), 'lib/meta/form-intent.ts'), { encoding: 'utf8' })
  check('the one-way rule lives in one function, so no caller can invert it',
    /templateAsks \|\| product\.intent === 'higher'/.test(src))
  const engine = readFileSync(join(process.cwd(), 'lib/freehold/ads-machine-engine.ts'), { encoding: 'utf8' })
  check('the machine goes through it rather than combining the two itself',
    /higherIntentFor\(m\.higherIntent/.test(engine))
  check('…using the listing facts captured at plan time',
    /facts\?\.handoverYear/.test(engine) && /facts\?\.priceAED/.test(engine))
  const planner = readFileSync(join(process.cwd(), 'lib/freehold/ads-machine-planner.ts'), { encoding: 'utf8' })
  check('and the planner actually captures the handover year',
    /handoverYear: listing\?\.handoverYear/.test(planner))
}

console.log('\n── the year is read in the operation timezone ──')
{
  const src = readFileSync(join(process.cwd(), 'lib/meta/form-intent.ts'), { encoding: 'utf8' })
  check('never getFullYear() on the server clock — that is wrong four hours a day',
    !/now\.getFullYear\(\)/.test(src) && /OPERATION_TZ/.test(src))
  check('a null handover year has no distance', yearsToHandover(null) === null)
  check('an undefined one has none either', yearsToHandover(undefined) === null)
  const y = yearsToHandover(2030, new Date('2026-08-21T20:00:00Z'))
  check('2030 read on 21 Aug 2026 is four years out', y === 4, String(y))
  // 21:00 UTC on 31 December is already 01:00 on 1 January in Dubai. A server
  // clock would still say the old year and every horizon would be a year long.
  const ny = yearsToHandover(2030, new Date('2026-12-31T21:00:00Z'))
  check('…and the new year arrives in Dubai, not in UTC', ny === 3, String(ny))
}

console.log('\n── walkable ──')
{
  check('intents are walkable', FORM_INTENTS.length === 2)
  check('reasons are walkable', FORM_INTENT_REASONS.length === 4)
  const seen = new Set([at(6).reason, at(1, HIGH_TICKET_AED).reason, at(0).reason, at(null).reason])
  check('and every reason is produced by a real input', seen.size === FORM_INTENT_REASONS.length,
    [...seen].join(','))
}

if (failures > 0) {
  console.error(`\n${failures} form-intent guard(s) broken.`)
  process.exit(1)
}
console.log('\nThe product decides the form, and only ever upwards.\n')
