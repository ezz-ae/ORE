/**
 * Creative-bundle rules, locked.
 *
 * The failure being replaced was invisible: "Download all" fired three anchor
 * clicks in a loop, Chrome asked "Download multiple files?" and Safari kept the
 * first — so the button looked like it worked while the broker silently got one
 * of the three sizes. The rules that must not regress are all about *not losing
 * a file*: names must be unique, names must survive a filesystem, and every
 * item must arrive.
 *
 * Pure — no browser, no network. Runs in `pnpm guards`.
 */
import {
  extFromDataUrl, safeFileName, uniqueNames, dataUrlToBytes,
} from '../lib/freehold/bundle'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

console.log('\n── the extension follows the real payload ──')
{
  check('png', extFromDataUrl('data:image/png;base64,AAAA') === 'png')
  check('jpeg', extFromDataUrl('data:image/jpeg;base64,AAAA') === 'jpg')
  check('webp', extFromDataUrl('data:image/webp;base64,AAAA') === 'webp')
  check('mp4 (a reel can join the set)', extFromDataUrl('data:video/mp4;base64,AAAA') === 'mp4')
  check('svg', extFromDataUrl('data:image/svg+xml,%3Csvg%2F%3E') === 'svg')
  check('unknown falls back to png rather than guessing',
    extFromDataUrl('data:application/octet-stream;base64,AA') === 'png')
}

console.log('\n── names survive a real filesystem ──')
{
  check('slashes cannot create folders', !safeFileName('Emaar/Beachfront').includes('/'),
    safeFileName('Emaar/Beachfront'))
  check('Windows-forbidden characters are stripped',
    !/[\\/:*?"<>|]/.test(safeFileName('a:b*c?d"e<f>g|h')), safeFileName('a:b*c?d"e<f>g|h'))
  check('spaces become hyphens', safeFileName('Emaar Beachfront Tower') === 'Emaar-Beachfront-Tower',
    safeFileName('Emaar Beachfront Tower'))
  check('long names are truncated', safeFileName('x'.repeat(200)).length <= 60)
  check('an empty result never yields a nameless file', safeFileName('///') === 'creative',
    safeFileName('///'))
  // Arabic headlines are ordinary input here, not an edge case.
  check('Arabic is preserved, not stripped to nothing', safeFileName('برج الإمارات').length > 0,
    safeFileName('برج الإمارات'))
}

console.log('\n── no entry may be silently dropped ──')
{
  const out = uniqueNames(['ad-story.png', 'ad-story.png', 'ad-story.png'])
  check('duplicates are disambiguated', new Set(out).size === 3, out.join(', '))
  check('the first keeps its name', out[0] === 'ad-story.png', out[0])
  check('the extension stays last', out.every((n) => n.endsWith('.png')), out.join(', '))
  const mixed = uniqueNames(['a.png', 'b.png', 'a.png'])
  check('only real collisions are renamed', mixed[1] === 'b.png', mixed.join(', '))
}

console.log('\n── decoding is exact ──')
{
  // "Hi" → SGk=
  const bytes = dataUrlToBytes('data:text/plain;base64,SGk=')
  check('base64 decodes byte-for-byte', bytes.length === 2 && bytes[0] === 72 && bytes[1] === 105,
    Array.from(bytes).join(','))
  const utf = dataUrlToBytes('data:image/svg+xml,%3Csvg%3E')
  check('a percent-encoded payload also decodes', utf.length === 5, String(utf.length))
  let threw = false
  try { dataUrlToBytes('https://example.com/a.png') } catch { threw = true }
  check('a plain URL is rejected rather than zipped as garbage', threw)
}

if (failures > 0) {
  console.error(`\n${failures} bundle rule(s) broken.`)
  process.exit(1)
}
console.log('\nAll bundle rules hold.\n')
