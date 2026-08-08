/**
 * The four colours, mixed — locked.
 *
 * A theme built from these was tried five times and thrown away. This is the
 * other way round: the colours arrive by being used, behind people's initials,
 * where a flat grey square was doing nothing anyway.
 *
 * Two rules, and both are the kind that rot quietly:
 *
 *   1. NOTHING BUT THE FOUR GIVEN COLOURS. "Colours are not inventable." A
 *      blend may mix them at any angle in any order, and may not introduce a
 *      fifth shade, a tint, or a "close enough" neighbour.
 *   2. THE SAME PERSON IS THE SAME COLOUR EVERYWHERE. The inbox, the board,
 *      the team page, the lead they own — and after every deploy. An avatar
 *      that changes between two screens is decoration, not identity.
 *
 * Pure — no model, no database, no network. Runs in `pnpm guards`.
 */
import { BLENDS, BLEND_COLORS, blendCss, blendFor, initialsOf } from '../lib/freehold/monogram'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

console.log('\n── only the given colours ──')
{
  const allowed = new Set<string>(BLEND_COLORS)
  const strays = BLENDS.flatMap((b) => b.stops).filter((c) => !allowed.has(c))
  check('no blend contains a colour that was not given', strays.length === 0, strays.join(', '))

  // Written as hex anywhere else in the CSS would let a fifth colour in
  // through the back door.
  const hexes = new Set(blendCss('Mostafa').match(/#[0-9a-f]{6}/gi)?.map((h) => h.toUpperCase()) ?? [])
  check('…and the CSS it produces contains nothing else either',
    [...hexes].every((h) => allowed.has(h as never)), [...hexes].join(', '))

  check('every blend has at least two stops — a "gradient" of one colour is a fill',
    BLENDS.every((b) => b.stops.length >= 2))
  check('no blend repeats the same colour twice in a row',
    BLENDS.every((b) => b.stops.every((c, i) => i === 0 || c !== b.stops[i - 1])))
  check('the angles differ, so the family is not one swatch repeated',
    new Set(BLENDS.map((b) => b.angle)).size >= 4)
}

console.log('\n── the same person is the same colour, everywhere and always ──')
{
  check('the same name gives the same blend',
    blendCss('Mostafa Ezz') === blendCss('Mostafa Ezz'))
  check('spacing and case do not change a person',
    blendCss('  mostafa ezz ') === blendCss('Mostafa Ezz'),
    `${blendCss('  mostafa ezz ')} vs ${blendCss('Mostafa Ezz')}`)
  check('a different person usually gets a different blend',
    blendCss('Mostafa Ezz') !== blendCss('Yamen Haddad'))
  check('an empty name still gets a real blend rather than a blank square',
    blendCss('').startsWith('linear-gradient('))
}

console.log('\n── the family is used, not just the first two colours ──')
{
  const names = ['Mostafa Ezz', 'Yamen Haddad', 'Bashar Ali', 'Cor Jansen', 'Layla Mansour',
    'Omar Khalid', 'Nadia Aziz', 'Sara Fahmy', 'Karim Adel', 'Huda Nasser',
    'Tarek Salem', 'Rana Zaki', 'Ali Hassan', 'Mona Farid', 'Ziad Rami']
  const used = new Set(names.map((n) => JSON.stringify(blendFor(n).stops)))
  check('a normal team spreads across most of the blends', used.size >= 4, `${used.size} of ${BLENDS.length}`)
  const everyColour = new Set(names.flatMap((n) => blendFor(n).stops))
  check('…and all four colours appear', everyColour.size === 4, [...everyColour].join(', '))
}

console.log('\n── the letters ──')
{
  check('two names give two letters', initialsOf('Mostafa Ezz') === 'ME')
  check('one name gives two of its own letters', initialsOf('Mostafa') === 'MO')
  check('three names use the first and the last', initialsOf('Ahmed Ali Hassan') === 'AH')
  check('extra spaces do not produce a blank', initialsOf('  Mostafa   Ezz  ') === 'ME')
  check('no name at all is a dot, never an empty box', initialsOf('') === '·')
  check('a non-Latin name keeps its own letters', initialsOf('مصطفى عز').length === 2,
    initialsOf('مصطفى عز'))
}

if (failures > 0) {
  console.error(`\n${failures} colour rule(s) broken.`)
  process.exit(1)
}
console.log('\nThe four colours, mixed — and nothing else.\n')
