/**
 * A CRON THIS PLAN CANNOT RUN BLOCKS EVERY DEPLOYMENT — locked.
 *
 * One line of vercel.json took production down for two days and nothing in the
 * repository could see it:
 *
 *     { "path": "/api/cron/settle-ad-spend", "schedule": "0 * * * *" }
 *
 * Hobby accounts permit one run per day per cron expression. An hourly one does
 * not get quietly downgraded — Vercel REFUSES THE WHOLE DEPLOYMENT at config
 * validation:
 *
 *     Error: Hobby accounts are limited to daily cron jobs.
 *     This cron expression (0 * * * *) would run more than once per day.
 *
 * ── WHY IT WENT UNNOTICED FOR TWO DAYS ───────────────────────────────────
 *
 * Because the deployment was never CREATED. There was no red row in the
 * deployments list, no failed build, no notification — merges landed on main
 * and the list simply stopped growing. Eight PRs shipped onto a repository that
 * could not deploy, and every gate we had went green the whole time: typecheck,
 * i18n, 94 guard suites and a clean production build all pass on a config
 * Vercel will reject, because none of them reads vercel.json.
 *
 * That is the same shape as the guards-registration failure — a gate for the
 * thing the other gates are structurally unable to see. This is that gate.
 *
 * ── THE RULE ─────────────────────────────────────────────────────────────
 *
 * Every schedule must run AT MOST ONCE PER DAY: a fixed minute and a fixed
 * hour. Needing something more often is legitimate and common — the ad
 * settlement genuinely wants to be hourly — but the schedule for it belongs in
 * .github/workflows, which is free and has no such limit. Putting it here
 * costs the whole pipeline.
 *
 * Pure — reads two files, no network. Runs in `pnpm guards`.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const root = process.cwd()
const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), { encoding: 'utf8' })) as {
  crons?: Array<{ path?: string; schedule?: string }>
}
const crons = vercel.crons ?? []

/**
 * How many times a day this expression fires.
 *
 * Only the minute and hour fields decide it. A field is "fixed" when it is a
 * single number. A wildcard, a step, a list and a range all fire more than
 * once, and each is a different way to make the same mistake.
 *
 * (The step form is deliberately not written out above: its two characters
 * would close this comment block, which is its own small lesson about writing
 * examples inside the thing they are an example of.)
 */
function runsPerDay(schedule: string): number {
  const parts = schedule.trim().split(/\s+/)
  if (parts.length !== 5) return Number.POSITIVE_INFINITY
  const [minute, hour] = parts

  const count = (field: string, range: number): number => {
    if (field === '*') return range
    if (field.includes('/')) {
      const [, step] = field.split('/')
      const n = Number(step)
      return Number.isFinite(n) && n > 0 ? Math.ceil(range / n) : range
    }
    if (field.includes(',')) return field.split(',').length
    if (field.includes('-')) {
      const [a, b] = field.split('-').map(Number)
      return Number.isFinite(a) && Number.isFinite(b) && b >= a ? b - a + 1 : range
    }
    return Number.isFinite(Number(field)) ? 1 : range
  }

  return count(minute, 60) * count(hour, 24)
}

console.log('\n── every cron runs at most once a day ──')
{
  check('there are crons to check', crons.length > 0, String(crons.length))

  const tooOften = crons
    .map((c) => ({ path: String(c.path ?? '?'), schedule: String(c.schedule ?? ''), n: runsPerDay(String(c.schedule ?? '')) }))
    .filter((c) => c.n > 1)

  // THE CHECK THIS FILE EXISTS FOR. A single one of these rejects the whole
  // deployment — not the cron, the deployment — and produces no failed build to
  // notice, because none is ever created.
  check('no schedule fires more than once a day', tooOften.length === 0,
    tooOften.map((c) => `${c.path} "${c.schedule}" runs ~${c.n}×/day`).join(', ')
      + ' — Hobby refuses the deployment. Move the schedule to .github/workflows.')

  // A malformed expression is worse than a frequent one: it may be accepted and
  // never fire, so the job silently stops and nothing reports it.
  const malformed = crons
    .map((c) => String(c.schedule ?? ''))
    .filter((s) => s.trim().split(/\s+/).length !== 5)
  check('every schedule has five fields', malformed.length === 0, malformed.join(', '))

  // Two entries on the same path at the same minute is one of them doing
  // nothing — legal, and always a copy-paste.
  const seen = crons.map((c) => `${c.path}@${c.schedule}`)
  const dupes = seen.filter((s, i) => seen.indexOf(s) !== i)
  check('no cron is declared twice', dupes.length === 0, [...new Set(dupes)].join(', '))
}

console.log('\n── every cron points at a route that exists ──')
{
  // A path with no handler is a scheduled 404: it runs, it fails, and the work
  // it was supposed to do silently never happens.
  const missing = crons
    .map((c) => String(c.path ?? ''))
    .filter((p) => p && !existsSync(join(root, 'app', p, 'route.ts')))
  check('every cron path has a route handler', missing.length === 0, missing.join(', '))
}

console.log('\n── what needs to run more often runs somewhere that allows it ──')
{
  // THE AD SETTLEMENT IS THE ONE THAT MATTERS. Nothing is reserved at launch,
  // so it is the only brake on real spend — every hour it does not run is an
  // hour of Meta spend the company paid for and did not bill. Daily in
  // vercel.json is the BACKSTOP; the real cadence lives in Actions, which is
  // free and has no daily limit.
  const wf = join(root, '.github/workflows/settle-ad-spend.yml')
  check('the hourly settlement runs from GitHub Actions', existsSync(wf),
    'the only brake on ad spend is running once a day')

  if (existsSync(wf)) {
    const yml = readFileSync(wf, { encoding: 'utf8' })
    check('…on an hourly schedule', /cron: '0 \* \* \* \*'/.test(yml))
    check('…and it can be run by hand when somebody cannot wait',
      /workflow_dispatch/.test(yml))
    // A workflow that skips quietly when a secret is missing goes green every
    // hour while nothing is billed — the exact failure this file is about.
    check('…and fails loudly rather than skipping when a secret is missing',
      /::error::PRODUCTION_URL and CRON_SECRET/.test(yml))
    // Meta being unreachable is not a broken pipeline. The job deliberately
    // bills nothing and pauses nothing rather than stopping live campaigns
    // over our own failed read.
    check('…and treats an unreachable Meta as a warning, not a failure',
      /if \[ "\$code" = "502" \]/.test(yml))
    // Overlapping runs are safe (high-water mark) but a queued pile-up after an
    // outage would hammer the platform for nothing.
    check('…and never runs two settlements at once', /group: settle-ad-spend/.test(yml))

    // AND THE BACKSTOP IS STILL THERE. If the workflow is ever disabled,
    // settlement must degrade to daily rather than stop.
    const daily = crons.find((c) => String(c.path) === '/api/cron/settle-ad-spend')
    check('…while vercel.json keeps a daily backstop', !!daily,
      'disabling the workflow would stop settlement entirely')

    // A GREEN RUN REPORTING ZERO MUST MEAN THERE WAS NOTHING TO BILL.
    //
    // The first real run of this workflow printed "AED 0 billed, AED 0
    // unbilled, 0 paused" while live campaigns were spending. Both zeros were
    // honest — the route bills only campaigns carrying a meta_campaign_brokers
    // row, written by our launch route, and every campaign built by hand in
    // Ads Manager lacks one. It skipped all of them, correctly, and said
    // nothing about having done so. "Nothing to bill" and "nobody is being
    // billed for any of it" arrived as the same summary.
    check('…and the summary says how many campaigns were seen at all',
      /campaignsSeen/.test(yml),
      'a run that saw nothing and a run that billed none of forty both print 0')
    check('…and how much spend had no wallet behind it',
      /unattributedAed/.test(yml))
    check('…and warns about it, because no other number on the page shows it',
      /::warning::\$\{unattributed\} campaign\(s\) spending/.test(yml))
  }
}

console.log('\n── the settlement can tell "nothing to do" from "nothing seen" ──')
{
  const routePath = join(root, 'app/api/cron/settle-ad-spend/route.ts')
  const route = readFileSync(routePath, { encoding: 'utf8' })
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

  // Skipping an unattributed campaign is right — there is no wallet to bill and
  // inventing one would take money from whoever happened to be first in the
  // table. Skipping it SILENTLY is what made a spending account look idle.
  check('an unattributed campaign is counted, not merely skipped',
    /unattributed \+= 1/.test(route),
    'the skip is still silent')
  check('…with its spend, so the amount is knowable',
    /unattributedAed \+= spendAed/.test(route))

  // The count is only possible if spend is read BEFORE the owner check. The
  // original order returned early and threw the number away.
  const loop = route.slice(route.indexOf('for (const c of campaigns)'))
  const spendAt = loop.indexOf('const spendAed')
  const ownerAt = loop.indexOf('const owner =')
  check('spend is read before attribution is checked',
    spendAt >= 0 && ownerAt >= 0 && spendAt < ownerAt,
    'the owner check returns first, so unattributed spend cannot be measured')

  // A read failure must still never be reported as a quiet night.
  check('an unreachable Meta is still a 502, not a zero',
    /status: 502/.test(route))
}

if (failures > 0) {
  console.error(`\n${failures} cron rule(s) broken.`)
  console.error('A schedule this plan cannot run does not fail the cron — it refuses the deployment.')
  process.exit(1)
}
console.log('\nEvery schedule is one this account can actually run.\n')
