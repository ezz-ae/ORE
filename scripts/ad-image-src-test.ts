/**
 * "The picture doesn't show up" — locked.
 *
 * Reported three times. Each fix chased a different half of the same problem:
 * an ad image has two handles, and each one is unusable in a different place.
 *
 *   • A blob: URL renders instantly but dies with the page that made it. Come
 *     back to the draft, or open it on the phone, and it points at nothing.
 *   • Meta's adimages CDN URL is durable but does not load in a plain <img>
 *     from our origin.
 *   • The hash outlives everything and is what actually launches, but a
 *     browser cannot render a hash.
 *
 * So the src is chosen, not guessed: the local copy while you work, and
 * /api/meta/adimages/<hash> — our own origin, server-fetched bytes —
 * everywhere else.
 *
 * Pure — no model, no database, no network. Runs in `pnpm guards`.
 */
import { adImageSrc } from '../lib/meta/ad-image-src'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const HASH = 'a1b2c3d4e5f6'
const ROUTE = `/api/meta/adimages/${HASH}`
const CDN = 'https://scontent.xx.fbcdn.net/v/t45.1600-4/abc_n.jpg'

console.log('\n── while you are working, the local copy wins ──')
{
  check('a blob: preview is used as-is, no round trip',
    adImageSrc('blob:https://app/abc', HASH) === 'blob:https://app/abc',
    adImageSrc('blob:https://app/abc', HASH))
  check('so is a data: image', adImageSrc('data:image/png;base64,AAA', HASH).startsWith('data:'))
}

console.log('\n── after a reload, or on another device, the hash carries it ──')
{
  check('a hash with no url renders through our own route',
    adImageSrc('', HASH) === ROUTE, adImageSrc('', HASH))
  check('…and undefined/null are the same as empty',
    adImageSrc(undefined, HASH) === ROUTE && adImageSrc(null, HASH) === ROUTE)
  check("Meta's CDN url never wins over the hash — it is the url that does not load",
    adImageSrc(CDN, HASH) === ROUTE, adImageSrc(CDN, HASH))
  check('a hash with a space or slash cannot break out of the route path',
    adImageSrc('', 'a b/c') === `/api/meta/adimages/${encodeURIComponent('a b/c')}`,
    adImageSrc('', 'a b/c'))
}

console.log('\n── with no hash, the url is all there is ──')
{
  check('a pasted https image is used directly',
    adImageSrc('https://freeholdproperty.ae/hero.jpg', '') === 'https://freeholdproperty.ae/hero.jpg')
  check("Meta's CDN url is still better than nothing when no hash exists",
    adImageSrc(CDN, '') === CDN)
  check('nothing at all is an empty string, never a broken route',
    adImageSrc('', '') === '' && adImageSrc(undefined, undefined) === '',
    JSON.stringify([adImageSrc('', ''), adImageSrc(undefined, undefined)]))
  check('whitespace is not a url', adImageSrc('   ', '') === '')
  check('…and whitespace is not a hash either', adImageSrc('', '   ') === '')
}

if (failures > 0) {
  console.error(`\n${failures} image-source rule(s) broken.`)
  process.exit(1)
}
console.log('\nAn uploaded picture is visible wherever the wizard is opened.\n')
