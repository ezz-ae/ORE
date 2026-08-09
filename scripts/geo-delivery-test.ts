/**
 * Did the money go where it was pointed — locked.
 *
 * A campaign targets the UAE. That is an instruction, not a receipt. This
 * reads Meta's country breakdown back and compares it to what was asked for,
 * so spend that landed somewhere nobody chose is visible instead of invisible.
 *
 * WHAT THIS FILE IS ALSO GUARDING AGAINST: a delivery fact being read as a
 * fact about people. Meta's `country` breakdown is where an ad was SHOWN. It
 * is not a nationality and does not become one by being counted — a resident,
 * a visitor and a citizen are the same row. The findings below are about
 * whether the geo TARGETING held, and nothing else.
 *
 * And the false-alarm direction, which this codebase has paid for: Meta's
 * location inference is imperfect at the edges — a traveller, a VPN, a foreign
 * SIM. A campaign that spent a dirham in a thousand somewhere unexpected has
 * not gone wrong, and saying so would train everyone to ignore the panel.
 *
 * Pure — no model, no database, no network. Runs in `pnpm guards`.
 */
import {
  checkGeoDelivery, STRAY_SPEND_SHARE, MIN_IMPRESSIONS_TO_JUDGE,
  type CountryDelivery,
} from '../lib/freehold/geo-delivery'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const row = (country: string, spend: number, impressions = 20_000, leads = 5): CountryDelivery =>
  ({ country, spend, impressions, leads })
const keys = (f: ReturnType<typeof checkGeoDelivery>) => f.map((x) => `${x.level}:${x.key}`)

console.log('\n── delivery that stayed where it was told ──')
{
  const f = checkGeoDelivery({ targeted: ['AE'], rows: [row('AE', 1000)] })
  check('a clean campaign says so rather than staying silent',
    keys(f).join() === 'ok:onTarget', keys(f).join(' | '))

  const trickle = checkGeoDelivery({ targeted: ['AE'], rows: [row('AE', 1000), row('IN', 20)] })
  check('a couple of per cent astray is noise, not a finding',
    keys(trickle).join() === 'ok:onTarget', keys(trickle).join(' | '))
  check(`the line is ${Math.round(STRAY_SPEND_SHARE * 100)}% of spend`,
    keys(checkGeoDelivery({ targeted: ['AE'], rows: [row('AE', 950), row('XX', 50)] })).join() === 'watch:strayed')
}

console.log('\n── money that went somewhere nobody chose ──')
{
  const f = checkGeoDelivery({ targeted: ['AE'], rows: [row('AE', 800), row('XX', 200)] })
  check('a fifth of the budget outside the target is reported',
    keys(f).join() === 'wrong:strayed', keys(f).join(' | '))
  check('…with the share, the money, and the one place to look at',
    f[0].vars?.pct === 20 && f[0].vars?.spend === 200 && f[0].vars?.where === 'XX',
    JSON.stringify(f[0].vars))
  check('…and it names what WAS targeted, so the reader can judge',
    String(f[0].vars?.places) === 'AE')

  const many = checkGeoDelivery({
    targeted: ['AE'],
    rows: [row('AE', 500), row('XX', 300), row('YY', 100), row('ZZ', 100)],
  })
  check('the biggest single offender is named, not a list',
    many[0].vars?.where === 'XX', JSON.stringify(many[0].vars))
  check('…while the total counts every one of them', many[0].vars?.spend === 500)
}

console.log('\n── a multi-country campaign is judged against ALL of its countries ──')
{
  const f = checkGeoDelivery({
    targeted: ['AE', 'SA'],
    rows: [row('AE', 600), row('SA', 400)],
  })
  check('a second targeted country is not treated as a stray',
    keys(f).join() === 'ok:onTarget', keys(f).join(' | '))
  check('case does not decide whether a country was targeted',
    keys(checkGeoDelivery({ targeted: ['ae'], rows: [row('AE', 1000)] })).join() === 'ok:onTarget')
}

console.log('\n── nothing is judged on nothing ──')
{
  check('no breakdown at all produces no finding',
    checkGeoDelivery({ targeted: ['AE'], rows: [] }).length === 0)
  check(`under ${MIN_IMPRESSIONS_TO_JUDGE} impressions produces none either`,
    checkGeoDelivery({ targeted: ['AE'], rows: [row('XX', 500, 200)] }).length === 0)
  check('a campaign with no recorded targeting cannot have strayed from it',
    checkGeoDelivery({ targeted: [], rows: [row('XX', 1000)] }).length === 0)
  check('rows Meta could not place are ignored, never counted as strays',
    keys(checkGeoDelivery({ targeted: ['AE'], rows: [row('AE', 1000), row('unknown', 500)] })).join() === 'ok:onTarget')
  check('zero spend produces no finding',
    checkGeoDelivery({ targeted: ['AE'], rows: [row('AE', 0)] }).length === 0)
}

if (failures > 0) {
  console.error(`\n${failures} geo-delivery rule(s) broken.`)
  process.exit(1)
}
console.log('\nThe money is checked against where it was pointed.\n')
