/**
 * A CAMPAIGN'S OWN KIT — locked (the pure half).
 *
 * The design decision this suite defends is not the table. It is that a
 * campaign asset IS A LIBRARY ITEM rather than a second store — which is what
 * makes it one click from the editors and exportable to any folder, because
 * those are the Library's own behaviours. The two pure pieces that make that
 * safe are the folder name and the kind check:
 *
 *  · A folder name that collides with one somebody made by hand would file a
 *    campaign's kit into a stranger's folder, or scatter it.
 *  · A kind GUESSED from an unknown extension puts a broken tile in the pool —
 *    a .zip filed as an image renders an empty frame that cannot be launched
 *    and cannot be explained.
 *
 * Runs in `pnpm guards`. The attach/detach/adopt half is I/O and lives in the
 * route; what is asserted here is everything a database cannot get wrong for
 * us.
 */
import { campaignFolder, assetKindOf } from '../lib/freehold/campaign-assets'
import { POOL_KINDS, POOL_SOURCES } from '../lib/freehold/creative-pool'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

console.log('\n── the folder is findable and cannot be collided with ──')
{
  check('a campaign folder is named for the campaign',
    campaignFolder('cash offer new audiences').includes('cash offer new audiences'),
    campaignFolder('cash offer new audiences'))
  check('…behind a prefix, so a campaign called "2026" cannot land in a hand-made folder of that name',
    campaignFolder('2026') !== '2026' && campaignFolder('2026').startsWith('Campaign'),
    campaignFolder('2026'))
  check('a nameless campaign still gets a real folder rather than an empty one',
    campaignFolder('').trim().length > 'Campaign · '.length, JSON.stringify(campaignFolder('')))
  check('whitespace is collapsed, so two spellings of one name are one folder',
    campaignFolder('cash   offer') === campaignFolder('cash offer'), campaignFolder('cash   offer'))
  check('an absurd name is cut rather than stored whole',
    campaignFolder('x'.repeat(500)).length < 100, String(campaignFolder('x'.repeat(500)).length))
}

console.log('\n── an unknown file is refused, never guessed ──')
{
  check('a jpg is an image', assetKindOf('https://cdn.x/a.jpg') === 'image')
  check('a png with a cache-buster is still an image',
    assetKindOf('https://cdn.x/a.png?v=2') === 'image')
  check('an uppercase MOV is a video', assetKindOf('https://cdn.x/A.MOV') === 'video')
  check('a pdf is a pdf', assetKindOf('https://cdn.x/book.pdf') === 'pdf')

  // The whole point: a mystery file is refused at the write rather than filed
  // as an image and rendered as an empty frame that cannot be launched.
  check('a zip is refused', assetKindOf('https://cdn.x/pack.zip') === null)
  check('a URL with no extension is refused rather than assumed to be an image',
    assetKindOf('https://cdn.x/watch/abc') === null)
  check('an empty string is refused', assetKindOf('') === null)

  // The pool renders a data: URL for anything composed in the browser, so the
  // adoption path has to read one — from its header, not from a path.
  check('a data: image is an image', assetKindOf('data:image/jpeg;base64,AAAA') === 'image')
  check('a data: pdf is a pdf', assetKindOf('data:application/pdf;base64,AAAA') === 'pdf')
  check('a data: URL of an unsupported type is refused',
    assetKindOf('data:text/html;base64,AAAA') === null)
}

console.log('\n── one vocabulary with the pool ──')
{
  // Every kind this can file must be a kind the pool can render, or an
  // adopted asset becomes a tile the pool silently drops.
  for (const url of ['a.jpg', 'a.mp4', 'a.pdf']) {
    const k = assetKindOf(url)
    check(`${url} files as a kind the pool renders`,
      !!k && (POOL_KINDS as string[]).includes(k), String(k))
  }
  check('the pool has a source for a campaign\'s own kit, or attaching would be invisible',
    (POOL_SOURCES as string[]).includes('campaign'), POOL_SOURCES.join(','))
  check('…and it outranks the shelf it is drawn from, because it records a decision',
    POOL_SOURCES.indexOf('campaign') < POOL_SOURCES.indexOf('library'), POOL_SOURCES.join(','))
}

if (failures > 0) {
  console.error(`\n${failures} campaign-asset rule(s) broken.`)
  process.exit(1)
}
console.log('\nA campaign keeps its own kit, on the shelf everything else lives on.\n')
