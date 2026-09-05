/**
 * THE SITE GOES DOWN WITHOUT TAKING ANYTHING IRREVERSIBLE WITH IT — locked.
 *
 * A deliberate shutdown: one holding page for every route on every domain,
 * switched by an environment variable.
 *
 * Turning a site off is easy. Turning it off without causing damage that
 * outlives the shutdown is the part worth pinning, and there are three ways
 * to get it wrong that all look like success at the time.
 *
 *   LEADS ARRIVING RIGHT NOW. Meta pushes a leadgen webhook, retries for a
 *   while, and then GIVES UP. A lead dropped there is gone, not delayed —
 *   and it is somebody's customer, lost during a commercial dispute, with no
 *   way to reconstruct it afterwards.
 *
 *   SEARCH RANKING. A maintenance page on a 200 tells Google this is now the
 *   content of every URL on the site. Days of that costs rankings that take
 *   months to rebuild, long after whatever the shutdown achieved.
 *
 *   THE WAY BACK IN. An override that also locks out whoever must turn it
 *   off is an outage, not a lever.
 *
 * Runs in `pnpm guards`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  OVERRIDE_MODES, ALWAYS_LIVE, INTERNAL_PREFIXES, overrideMode, isHeldBack,
  hasBypass, holdingPage, RETRY_AFTER_SECONDS, DEFAULT_TITLE, DEFAULT_MESSAGE,
} from '../lib/freehold/site-override'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

console.log('\n── off unless somebody clearly said otherwise ──')
{
  check('nothing set means the site is up', overrideMode({}) === 'off')
  check('an empty value means up', overrideMode({ SITE_OVERRIDE: '' }) === 'off')
  // A TYPO MUST NEVER TAKE A SITE DOWN, and must never quietly leave one
  // down either — both directions of the same mistake.
  check('a typo means up, never down', overrideMode({ SITE_OVERRIDE: 'yes' }) === 'off',
    overrideMode({ SITE_OVERRIDE: 'yes' }))
  check('the word off means up', overrideMode({ SITE_OVERRIDE: 'off' }) === 'off')
  check('public and all are the two ways down',
    overrideMode({ SITE_OVERRIDE: 'public' }) === 'public'
    && overrideMode({ SITE_OVERRIDE: 'ALL' }) === 'all')
  check('every mode is walkable', OVERRIDE_MODES.length === 3)
}

console.log('\n── what must survive being switched off ──')
{
  // THE ASSERTION THAT MATTERS MOST. Meta retries a leadgen push and then
  // stops; a lead dropped here is gone, and it is somebody's customer.
  for (const mode of ['public', 'all'] as const) {
    check(`the Meta leadgen webhook stays up in "${mode}"`,
      !isHeldBack('/api/meta/webhook', mode))
    check(`  …and landing-page lead capture`, !isHeldBack('/api/leads', mode))
    check(`  …and the crons, whose gaps cannot be backfilled later`,
      !isHeldBack('/api/cron/targeting-guard', mode))
    check(`  …and health, so the outage can be told from a real one`,
      !isHeldBack('/api/health', mode))
  }
  check('every always-live path is a real path, not a pattern',
    ALWAYS_LIVE.every((p) => p.startsWith('/api/')), ALWAYS_LIVE.join(' '))
}

console.log('\n── the two depths, and they differ ──')
{
  // 'public' is the site going dark while the team keeps working — so leads
  // still get rated and the machine keeps learning through the shutdown.
  check('public darkens the marketing site', isHeldBack('/', 'public'))
  check('…and the landing pages', isHeldBack('/lp/dubai', 'public'))
  check('…while the team can still work', !isHeldBack('/freehold-intelligence/crm', 'public'))
  for (const p of INTERNAL_PREFIXES) {
    check(`  ${p} stays up in public mode`, !isHeldBack(p, 'public'))
  }

  check('all takes the internal surfaces too', isHeldBack('/freehold-intelligence/crm', 'all'))
  check('…and the public site with it', isHeldBack('/', 'all'))

  // A prefix must not swallow a route that merely starts with the same
  // letters — /reports must not exempt /reportsomething.
  check('a prefix does not swallow a longer unrelated path',
    isHeldBack('/reportsomething', 'public'), 'an unrelated path was exempted')
}

console.log('\n── the way back in ──')
{
  check('the right key gets through', !isHeldBack('/', 'all', { bypassed: true }))
  check('a wrong key does not', isHeldBack('/', 'all', { bypassed: false }))

  // AN UNSET KEY MATCHES NOTHING, NOT EVERYTHING. The inverse would leave the
  // override on and open at the same time — the worst of both.
  check('an unset key lets nobody through',
    !hasBypass('', undefined) && !hasBypass('anything', ''), 'an empty key was a skeleton key')
  check('a set key matches only itself',
    hasBypass('s3cret', 's3cret') && !hasBypass('S3CRET', 's3cret'))

  // Order matters: a lead must never depend on somebody holding a key.
  check('a lead endpoint is exempt even with no bypass',
    !isHeldBack('/api/leads', 'all', { bypassed: false }))
}

console.log('\n── the page itself ──')
{
  const html = holdingPage({ title: 'T', message: 'M', brand: 'B' })
  check('it renders with no external asset', !/https?:\/\//.test(html), html.slice(0, 80))
  check('…and escapes what it is given',
    !holdingPage({ title: '<script>x</script>', message: 'M', brand: 'B' }).includes('<script>x'))

  // 503 AND RETRY-AFTER, NEVER 200 AND NEVER noindex. On a 503 Google holds
  // the index; noindex would be unnecessary there and actively harmful if the
  // status were ever wrong.
  const proxy = readFileSync(join(process.cwd(), 'proxy.ts'), 'utf8')
  check('the holding page answers 503', /status: 503/.test(proxy), 'a 200 would get it indexed')
  check('…with Retry-After, so it reads as temporary', /'retry-after'/.test(proxy))
  check('…and is never cached', /'cache-control': 'no-store'/.test(proxy))
  check('…and does not tell crawlers to deindex', !/noindex/i.test(proxy))
  check('a day is long enough for a crawler to back off',
    RETRY_AFTER_SECONDS >= 3600, String(RETRY_AFTER_SECONDS))

  // THE DEFAULT SAYS NOTHING ABOUT WHY. The reason for a shutdown is between
  // the parties to it; a public page on a company's own domain stating it is
  // a published statement about that company, and not a default.
  check('the shipped message gives no reason',
    !/invoice|payment|pay|owed|unpaid|suspend/i.test(`${DEFAULT_TITLE} ${DEFAULT_MESSAGE}`),
    `${DEFAULT_TITLE} / ${DEFAULT_MESSAGE}`)
}

console.log('\n── and no Host header can step around it ──')
{
  const proxy = readFileSync(join(process.cwd(), 'proxy.ts'), 'utf8')
  const body = proxy.slice(proxy.indexOf('export async function proxy'))
  const overrideAt = body.indexOf('overrideMode(process.env)')
  const apiWallAt = body.indexOf('pathname.startsWith("/api/")')
  check('the override runs before the API wall and every host branch',
    overrideAt > 0 && apiWallAt > 0 && overrideAt < apiWallAt,
    `override@${overrideAt} apiWall@${apiWallAt}`)
}

console.log(failures === 0
  ? '\n✅ the site can go dark without losing a lead, a ranking, or the key.'
  : `\n❌ ${failures} site-override guard(s) failed`)
process.exit(failures === 0 ? 0 : 1)
