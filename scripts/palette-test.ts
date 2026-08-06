/**
 * Colour-extraction rules, locked.
 *
 * These colours light the gallery behind a creative. The failure mode is not a
 * crash — it is every ad glowing the same grey, because the most common colour
 * in almost any photograph is dark sky or bright wall. Each rule below is one
 * way that happens.
 *
 * Pure — `dominantColors` takes bytes, so no canvas is needed.
 */
import { dominantColors, luma, toHex } from '../lib/freehold/palette-extract'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

/** Build flat RGBA from [count, r, g, b, a?] groups. */
function pixels(...groups: [number, number, number, number, number?][]): Uint8ClampedArray {
  const total = groups.reduce((n, g) => n + g[0], 0)
  const out = new Uint8ClampedArray(total * 4)
  let i = 0
  for (const [n, r, g, b, a = 255] of groups) {
    for (let k = 0; k < n; k++) { out[i++] = r; out[i++] = g; out[i++] = b; out[i++] = a }
  }
  return out
}
const hexToRgb = (h: string) => ({
  r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16),
})
const near = (hex: string, r: number, g: number, b: number, tol = 40) => {
  const c = hexToRgb(hex)
  return Math.abs(c.r - r) <= tol && Math.abs(c.g - g) <= tol && Math.abs(c.b - b) <= tol
}

console.log('\n── the image’s real colour wins ──')
{
  // A sunset ad: mostly warm orange, some sky blue.
  const out = dominantColors(pixels([700, 230, 120, 40], [300, 60, 110, 200]), 3)
  check('the dominant orange is first', near(out[0], 230, 120, 40), out.join(' '))
  check('the second colour is the blue, not another orange', near(out[1], 60, 110, 200), out.join(' '))
  check('always returns the count asked for', out.length === 3, String(out.length))
  check('every value is a hex colour', out.every((c) => /^#[0-9a-f]{6}$/.test(c)), out.join(' '))
}

console.log('\n── sky and wall do not become the accent ──')
{
  // The realistic case: a night shot that is 80% near-black with a gold sign.
  const out = dominantColors(pixels([800, 6, 6, 8], [200, 212, 175, 55]), 3)
  check('the gold is chosen over the black majority', near(out[0], 212, 175, 55), out.join(' '))
  // And the mirror: a bright interior with one teal sofa.
  const bright = dominantColors(pixels([800, 250, 250, 248], [200, 30, 150, 150]), 3)
  check('the teal is chosen over the white majority', near(bright[0], 30, 150, 150), bright.join(' '))
}

console.log('\n── three shades of one colour is not a palette ──')
{
  // Nearly the same orange three times, plus one real blue.
  const out = dominantColors(
    pixels([500, 230, 120, 40], [400, 232, 124, 44], [300, 228, 118, 38], [200, 40, 90, 210]), 3)
  const first = hexToRgb(out[0]); const second = hexToRgb(out[1])
  const apart = (second.r - first.r) ** 2 + (second.g - first.g) ** 2 + (second.b - first.b) ** 2
  check('the second pick is genuinely a different colour', apart > 60 * 60,
    `${out[0]} vs ${out[1]}`)
  check('the blue makes it in', out.some((c) => near(c, 40, 90, 210)), out.join(' '))
}

console.log('\n── transparency is not a colour ──')
{
  // A logo PNG: a small red mark on a fully transparent field. Counting the
  // empty corner would tint every logo's backdrop identically.
  const out = dominantColors(pixels([900, 0, 0, 0, 0], [100, 200, 40, 40]), 3)
  check('the visible red is found', near(out[0], 200, 40, 40), out.join(' '))
}

console.log('\n── nothing usable still returns something usable ──')
{
  const empty = dominantColors(new Uint8ClampedArray(0), 3)
  check('no pixels → the fallback, not an empty array', empty.length === 3, JSON.stringify(empty))
  const allClear = dominantColors(pixels([500, 10, 20, 30, 0]), 3)
  check('fully transparent → the fallback', allClear.length === 3, JSON.stringify(allClear))
  const pureBlack = dominantColors(pixels([500, 0, 0, 0]), 3)
  check('a pure black frame still fills every slot', pureBlack.length === 3, JSON.stringify(pureBlack))
  check('and they are valid hex', pureBlack.every((c) => /^#[0-9a-f]{6}$/.test(c)), pureBlack.join(' '))
  const one = dominantColors(pixels([100, 120, 130, 140]), 5)
  check('asking for more than exist still returns that many', one.length === 5, String(one.length))
}

console.log('\n── the helpers behave ──')
{
  // The coefficients sum to 1 in decimal but not exactly in binary, so this
  // compares within epsilon rather than asserting an exact 1.
  check('white is bright', Math.abs(luma({ r: 255, g: 255, b: 255 }) - 1) < 1e-9,
    String(luma({ r: 255, g: 255, b: 255 })))
  check('black is dark', luma({ r: 0, g: 0, b: 0 }) === 0)
  check('green reads brighter than blue at equal value',
    luma({ r: 0, g: 200, b: 0 }) > luma({ r: 0, g: 0, b: 200 }))
  check('hex pads single digits', toHex({ r: 1, g: 2, b: 3 }) === '#010203', toHex({ r: 1, g: 2, b: 3 }))
  check('hex clamps out-of-range', toHex({ r: 300, g: -5, b: 128 }) === '#ff0080',
    toHex({ r: 300, g: -5, b: 128 }))
}

if (failures > 0) {
  console.error(`\n${failures} palette rule(s) broken.`)
  process.exit(1)
}
console.log('\nAll palette rules hold.\n')
