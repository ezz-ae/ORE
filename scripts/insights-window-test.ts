/**
 * WHICH WINDOW A NUMBER IS FROM — locked.
 *
 * The screen that produced this module, on a live account, one minute apart:
 *
 *   Lead Machine home     cash offer new audiences · AED 204 · 1 lead
 *   Campaign page         cash offer new audiences · AED 501 · 2 leads
 *   home, every other campaign                     · AED 0   · 0 leads
 *
 * Neither screen computed anything wrong. The list ENDPOINT asked Meta a
 * different question — rolling 30 days, and only for campaigns whose status
 * was ACTIVE — then printed the answer in the same typeface as the detail
 * page's lifetime figure. A paused campaign that had spent real money and
 * brought real leads read as a campaign that never ran.
 *
 * So the assertions are about the two properties that stop it recurring: one
 * function decides what a screen prints, and a campaign missing from an
 * insights read is ABSENT rather than zero.
 *
 * Pure — no network. Runs in `pnpm guards`.
 */
import {
  headlineInsights, indexInsightsByCampaign, HEADLINE_WINDOW, RECENT_WINDOW,
  type CampaignInsightRow,
} from '../lib/meta/insights-window'
import type { MetaInsights } from '../lib/meta/types'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const ins = (spend: string, extra: Partial<MetaInsights> = {}): MetaInsights => ({
  impressions: '1000', clicks: '10', spend, date_start: '2026-01-01', date_stop: '2026-02-01', ...extra,
})

console.log('\n── a report never goes down ──')
{
  const lifetime = ins('501')
  const recent = ins('204')
  check('lifetime wins whenever it exists',
    headlineInsights(lifetime, recent)?.spend === '501',
    String(headlineInsights(lifetime, recent)?.spend))
  check('…and it is never the other way round',
    headlineInsights(lifetime, recent)?.spend !== '204')

  // A campaign switched off two months ago has a rolling window of zero and a
  // lifetime of everything it did. Printing the rolling one is the bug.
  check('a drained rolling window does NOT replace a real lifetime',
    headlineInsights(ins('501'), ins('0'))?.spend === '501')

  // A campaign launched an hour ago may have no lifetime row yet — Meta
  // backfills — so it shows its recent numbers rather than a blank.
  check('a campaign too new for a lifetime row still shows its recent numbers',
    headlineInsights(null, recent)?.spend === '204')
  check('nothing at all is null, not a zeroed row',
    headlineInsights(null, null) === null)
  check('undefined behaves as absent, not as a value',
    headlineInsights(undefined, undefined) === null)
}

console.log('\n── the two windows are named once, not spelled at each call site ──')
{
  check('the headline window is Meta\'s lifetime preset', HEADLINE_WINDOW === 'maximum')
  check('the judgement window is a ROLLING 30 days', RECENT_WINDOW === 'last_30d')
  // A calendar window erases every campaign's history at midnight on the 1st,
  // which froze the Ads Machine for the first days of every month.
  check('…and never a calendar month', String(RECENT_WINDOW) !== 'this_month')
}

console.log('\n── one call for the whole list, keyed by campaign ──')
{
  const rows: CampaignInsightRow[] = [
    { ...ins('501'), campaign_id: 'c1' },
    { ...ins('0'), campaign_id: 'c2' },
    { ...ins('93'), campaign_id: 'c3' },
  ]
  const map = indexInsightsByCampaign(rows)
  check('every campaign in the answer is findable by its id', map.size === 3, String(map.size))
  check('…with its own numbers', map.get('c1')?.spend === '501' && map.get('c3')?.spend === '93')

  // THE DISTINCTION THE OLD ROUTE COLLAPSED: a campaign that spent nothing is
  // a measurement of zero; a campaign Meta never mentions has no measurement.
  // The screens print those differently, so the map must not invent a row.
  check('a campaign that spent zero is a MEASUREMENT of zero',
    map.get('c2')?.spend === '0', JSON.stringify(map.get('c2')))
  check('a campaign Meta never mentioned is absent, not zero',
    map.get('c-never') === undefined)

  check('a row with no campaign_id is dropped rather than keyed on empty',
    indexInsightsByCampaign([{ ...ins('10') }]).size === 0)
  check('a blank campaign_id is dropped too',
    indexInsightsByCampaign([{ ...ins('10'), campaign_id: '   ' }]).size === 0)
  check('no rows at all is an empty map, never a throw', indexInsightsByCampaign([]).size === 0)
  check('null is an empty map too', indexInsightsByCampaign(null).size === 0)

  // Meta returns one row per campaign at this level. If it ever returns two,
  // keeping the FIRST preserves the order Meta chose rather than whichever
  // row happened to arrive last.
  const dupes = indexInsightsByCampaign([
    { ...ins('100'), campaign_id: 'c1' },
    { ...ins('999'), campaign_id: 'c1' },
  ])
  check('a duplicated campaign keeps the first row, not the last',
    dupes.get('c1')?.spend === '100', String(dupes.get('c1')?.spend))
}

console.log('\n── the fix stays fixed everywhere, not in one route ──')
{
  // THE RECURRENCE THIS BLOCK EXISTS FOR. /api/meta/campaigns was cured of
  // "insights only if ACTIVE, over a rolling 30 days" — and the campaigns
  // PAGE held its own copy of the same read, uncured, so seven paused
  // campaigns printed nothing while the one active campaign printed a figure
  // its own detail page disagreed with. One fix, two readers, one still wrong.
  //
  // A source scan rather than a call: the fault is a SHAPE, and it can be
  // written again in any file that lists campaigns.
  const dir = join(process.cwd())
  const files: string[] = []
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.next' || e.name.startsWith('.')) continue
      const full = join(d, e.name)
      if (e.isDirectory()) walk(full)
      else if (/\.tsx?$/.test(e.name)) files.push(full)
    }
  }
  for (const top of ['app', 'lib', 'components']) {
    try { walk(join(dir, top)) } catch { /* absent tree */ }
  }

  // The fault is a `status === 'ACTIVE'` test GUARDING an insights fetch, so
  // the two must be near each other. A file that merely contains both — the
  // advisor's pause-action guard, the autopilot's filter of what to act ON —
  // is not this bug, and a scan that flags those trains people to ignore it.
  const NEAR = 8
  const offenders: string[] = []
  for (const f of files) {
    const lines = readFileSync(f, 'utf8').split('\n')
    const gate = lines.map((l, i) => (/status\s*===\s*'ACTIVE'/.test(l) ? i : -1)).filter((i) => i >= 0)
    const fetches = lines.map((l, i) => (/getCampaignInsights\s*\(/.test(l) ? i : -1)).filter((i) => i >= 0)
    if (gate.some((g) => fetches.some((x) => x > g && x - g <= NEAR))) {
      offenders.push(f.replace(dir + '/', ''))
    }
  }
  check('no screen fetches insights only for ACTIVE campaigns — that is how a paused campaign that really spent prints zero',
    offenders.length === 0, offenders.join(', '))
}

if (failures > 0) {
  console.error(`\n${failures} insights-window rule(s) broken.`)
  process.exit(1)
}
console.log('\nOne window per question, and every campaign gets asked.\n')
