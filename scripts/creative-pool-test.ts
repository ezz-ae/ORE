/**
 * THE CREATIVE POOL — locked.
 *
 * The pool exists to answer one question fast: what can this campaign run
 * that it has not run yet. Every assertion here is about a way that answer
 * can be wrong in a way that costs money:
 *
 *  · the same photo counted twice → two identical ads, and a "split test"
 *    between a design and itself
 *  · an image already running counted as new → a duplicate ad, and a
 *    frequency problem made worse by the thing meant to fix it
 *  · a brochure offered as launchable → a button that 400s at Meta, which is
 *    rule 3 of the recommendations module in a different costume
 *  · a video not marked as needing processing → a press that appears to hang,
 *    because nothing warned that Meta has a file to transcode first
 *
 * Pure — no network, no database, no canvas. Runs in `pnpm guards`.
 */
import {
  buildPool, poolReadiness, adsToAdd, mediaKey, isLaunchable, needsProcessing,
  MIN_ADS_FOR_ROTATION, POOL_DISPLAY_LIMIT, POOL_SOURCES, POOL_KINDS,
  type PoolItem,
} from '../lib/freehold/creative-pool'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const item = (o: Partial<PoolItem> & { url: string }): PoolItem => ({
  id: o.id ?? `x-${o.url}`, source: o.source ?? 'library', kind: o.kind ?? 'image',
  title: o.title ?? 'Untitled', ...o,
})
const ids = (p: PoolItem[]) => p.map((x) => x.id).join(' | ')

console.log('\n── one tile per picture ──')
{
  // The everyday case: a project's hero photo, and the same file saved into
  // the Library the day somebody exported it. One photograph.
  const pool = buildPool([
    item({ id: 'lib-1', source: 'library', url: 'https://cdn.example.com/hero.jpg?w=1200&sig=abc' }),
    item({ id: 'proj-1', source: 'project', url: 'https://cdn.example.com/hero.jpg', title: 'Marina hero' }),
  ])
  check('the same file from two sources is ONE tile', pool.length === 1, ids(pool))
  check('…and it keeps the source closest to the campaign',
    pool[0].source === 'project' && pool[0].id === 'proj-1', `${pool[0].source}/${pool[0].id}`)

  check('a cache-buster is not a different photograph',
    mediaKey('https://cdn.x/a.jpg?v=2') === mediaKey('http://cdn.x/a.jpg'))
  check('…but a different path is', mediaKey('https://cdn.x/a.jpg') !== mediaKey('https://cdn.x/b.jpg'))
}

console.log('\n── "unused" means unused ──')
{
  // The failure this rule answers to: the running ad's image arrives again
  // from the Library, the merge keeps the library copy, `inUse` is lost, and
  // the panel offers the operator the design that is already live.
  const pool = buildPool([
    item({ id: 'live-1', source: 'live', url: 'https://cdn.x/running.jpg', inUse: true }),
    item({ id: 'lib-9', source: 'library', url: 'https://cdn.x/running.jpg' }),
    item({ id: 'lib-2', source: 'library', url: 'https://cdn.x/fresh.jpg' }),
  ])
  check('a running design merged with its library copy stays marked as running',
    pool.find((p) => p.url.includes('running'))?.inUse === true, JSON.stringify(pool))
  const r = poolReadiness(pool)
  check('…and is NOT counted as new material', r.fresh === 1, JSON.stringify(r))
  check('…while still being visible', r.total === 2 && r.inUse === 1, JSON.stringify(r))
  check('unused sorts before used', pool[0].id === 'lib-2', ids(pool))
}

console.log('\n── only what can actually become an ad ──')
{
  // Images and videos both reach Meta — the video path through /advideos, a
  // transcode wait and a cover frame (lib/meta/video-ad.ts). A brochure never
  // will: a PDF is not a creative object in any ad system, so a launch button
  // on one is exactly the action-that-cannot-be-performed the recommendations
  // module refuses to offer.
  check('an image can be launched', isLaunchable(item({ url: 'a.jpg', kind: 'image' })))
  check('a video can too — the /advideos path is real', isLaunchable(item({ url: 'a.mp4', kind: 'video' })))
  check('a brochure cannot — a PDF is not a creative, it is where numbers come from',
    !isLaunchable(item({ url: 'a.pdf', kind: 'pdf' })))

  // A video costs an upload and a transcode wait before the ad exists. That
  // is a fact the panel must state BEFORE the press and the write must budget
  // for, so it is a property of the item rather than a guess at the call site.
  check('a video is marked as needing processing', needsProcessing(item({ url: 'a.mp4', kind: 'video' })))
  check('an image is not', !needsProcessing(item({ url: 'a.jpg', kind: 'image' })))

  const pool = buildPool([
    item({ id: 'v', kind: 'video', url: 'https://cdn.x/tour.mp4' }),
    item({ id: 'p', kind: 'pdf', url: 'https://cdn.x/book.pdf' }),
    item({ id: 'i', kind: 'image', url: 'https://cdn.x/shot.jpg' }),
  ])
  check('launchable media sorts above sources', pool[0].id === 'i' || pool[0].id === 'v', ids(pool))
  check('…and the brochure sorts last', pool[2].id === 'p', ids(pool))
  const r = poolReadiness(pool)
  check('the counts separate what can run from what needs a tool first',
    r.fresh === 2 && r.sources === 1, JSON.stringify(r))
  check('…and say how many of the runnable ones are videos',
    r.freshVideos === 1, JSON.stringify(r))
}

console.log('\n── nothing enters the pool without a file ──')
{
  const pool = buildPool([
    item({ id: 'blank', url: '' }),
    item({ id: 'spaces', url: '   ' }),
    { id: 'weird', source: 'library', kind: 'audio' as unknown as PoolItem['kind'], url: 'https://cdn.x/a.mp3', title: 'x' },
    item({ id: 'real', url: 'https://cdn.x/ok.jpg' }),
  ])
  check('a tile with no file is not a tile', !pool.some((p) => p.id === 'blank' || p.id === 'spaces'), ids(pool))
  check('a kind the pool cannot render is dropped, not guessed at',
    !pool.some((p) => p.id === 'weird'), ids(pool))
  check('…and the real file survives', pool.length === 1 && pool[0].id === 'real', ids(pool))
}

console.log('\n── the shortfall is capped by what exists ──')
{
  // Offering a second ad when the pool holds one fresh photo would be
  // offering a duplicate, and a duplicate is not a second test.
  check(`an ad set with one ad and plenty of photos is short by ${MIN_ADS_FOR_ROTATION - 1}`,
    adsToAdd(1, 10) === MIN_ADS_FOR_ROTATION - 1, String(adsToAdd(1, 10)))
  check('…but with one fresh photo it is short by one',
    adsToAdd(1, 1) === 1, String(adsToAdd(1, 1)))
  check('an ad set already at the rotation is short by nothing',
    adsToAdd(MIN_ADS_FOR_ROTATION, 10) === 0)
  check('an empty pool asks for nothing', adsToAdd(0, 0) === 0)
  check('negatives never produce a negative ask', adsToAdd(-3, -3) === 0)
}

console.log('\n── the panel stays a decision, not a file browser ──')
{
  const many = Array.from({ length: POOL_DISPLAY_LIMIT + 25 }, (_, i) =>
    item({ id: `n${i}`, url: `https://cdn.x/${i}.jpg` }))
  check(`never more than ${POOL_DISPLAY_LIMIT} tiles`, buildPool(many).length === POOL_DISPLAY_LIMIT,
    String(buildPool(many).length))

  // Both catalogs are walked by the i18n dynamic-key guard; an empty one
  // would make that guard vacuously pass.
  check('every source is named', POOL_SOURCES.length >= 4)
  check('every kind is named', POOL_KINDS.length >= 3)
}

if (failures > 0) {
  console.error(`\n${failures} creative-pool rule(s) broken.`)
  process.exit(1)
}
console.log('\nThe pool shows what exists, once each, and only offers what can run.\n')
