/**
 * THE LIVE LINE — locked.
 *
 * The screen this replaces claimed "Live · 04:05 PM GST" — the BROWSER CLOCK —
 * over numbers that were two days old, beside a list of campaigns showing
 * spend and nothing else. No delivery state, no learning, no frequency, no
 * lead quality, no comparison between two ad sets, and no button anywhere near
 * a fault.
 *
 * So the assertions here are about the four things that make a line worth
 * reading on a busy day: it is true about the DATA and not about the clock, it
 * is ranked by money, it is short, and it carries the door to its own fix.
 *
 * Pure — no clock, no network. Runs in `pnpm guards`.
 */
import {
  signalsFor, dataFreshness, daysBetween, SIGNAL_IDS, SIGNAL_ACTIONS,
  STALE_AFTER_DAYS, FATIGUE_FREQUENCY, type LiveFacts,
} from '../lib/freehold/live-signals'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const facts = (o: Partial<LiveFacts> = {}): LiveFacts => ({
  status: 'ACTIVE', spendAed: 500, leads: 5, ratedLeads: 5,
  impressions: 50_000, clicks: 700, frequency: 1.4, liveAds: 3, days: 30,
  dataThrough: '2026-08-11', today: '2026-08-11', ...o,
})
const ids = (s: ReturnType<typeof signalsFor>) => s.map((x) => x.id).join(' | ')

console.log('\n── "live" is a claim about the data, not the clock ──')
{
  // The exact failure: a badge ticking every minute over a number nobody has
  // refreshed since Saturday.
  const stale = signalsFor(facts({ dataThrough: '2026-08-09', today: '2026-08-11' }))
  check(`${STALE_AFTER_DAYS} days behind is said out loud`,
    stale.some((s) => s.id === 'stale'), ids(stale))
  check('…and it says HOW far behind',
    stale.find((s) => s.id === 'stale')?.vars?.days === 2,
    JSON.stringify(stale.find((s) => s.id === 'stale')?.vars))
  check('…as a fault, not a note', stale.find((s) => s.id === 'stale')?.tone === 'bad')

  check('yesterday is normal reporting lag, not a fault',
    !ids(signalsFor(facts({ dataThrough: '2026-08-10', today: '2026-08-11' }))).includes('stale'))
  check('a campaign with no data at all makes no staleness claim',
    !ids(signalsFor(facts({ dataThrough: null }))).includes('stale'))

  check('the days maths is plain', daysBetween('2026-08-09', '2026-08-11') === 2)
  check('…and refuses nonsense rather than returning a number',
    daysBetween('not a date', '2026-08-11') === null)
  check('a month boundary is still two days',
    daysBetween('2026-07-30', '2026-08-01') === 2)
}

console.log('\n── the freshest edge of the data, or nothing ──')
{
  const f = dataFreshness([
    { dataThrough: '2026-08-09' }, { dataThrough: '2026-08-11' }, { dataThrough: null },
  ], '2026-08-11')
  check('the header reports the FRESHEST row, not an average',
    f?.daysBehind === 0 && f?.through === '2026-08-11', JSON.stringify(f))
  check('rows with no data are ignored rather than counted as ancient',
    dataFreshness([{ dataThrough: null }, { dataThrough: '2026-08-10' }], '2026-08-11')?.daysBehind === 1)
  check('nothing to report is NULL, so the screen says so instead of printing a time',
    dataFreshness([{ dataThrough: null }], '2026-08-11') === null)
  check('an empty screen is null too', dataFreshness([], '2026-08-11') === null)
}

console.log('\n── a blocked ad silences the rest ──')
{
  const b = signalsFor(facts({ deliveryBlocked: true, leads: 3, ratedLeads: 0, liveAds: 1, frequency: 9 }))
  check('one line only', b.length === 1, ids(b))
  check('…and it is the block', b[0].id === 'blocked' && b[0].tone === 'bad')
  check('…pointing at Meta\'s own words', b[0].action === 'open')
  check('no creative or rating advice reaches a dead ad',
    !ids(b).includes('oneDesign') && !ids(b).includes('unrated'))

  // A blocked ad set inside a paused campaign is still a block worth saying —
  // it is why the campaign will not run when switched back on.
  check('a paused campaign that Meta has also blocked still says so',
    signalsFor(facts({ status: 'PAUSED', deliveryBlocked: true }))[0].id === 'blocked')
}

console.log('\n── a paused campaign is not a problem to solve ──')
{
  const p = signalsFor(facts({ status: 'PAUSED', leads: 4, ratedLeads: 0, liveAds: 1 }))
  check('one flat line', p.length === 1 && p[0].id === 'paused', ids(p))
  check('…and no button — somebody switched it off on purpose', p[0].action === 'none')
}

console.log('\n── every line carries its own door ──')
{
  const unrated = signalsFor(facts({ leads: 4, ratedLeads: 0 }))
  check('leads with nobody rating them says the count',
    unrated.find((s) => s.id === 'unrated')?.vars?.n === 4, ids(unrated))
  check('…and the button rates them', unrated.find((s) => s.id === 'unrated')?.action === 'rate')

  const dear = signalsFor(facts({
    adSets: [
      { id: 'a1', name: 'adset 1', spendAed: 408, impressions: 26_487, leads: 2 },
      { id: 'a2', name: 'adset 2', spendAed: 93, impressions: 946, leads: 0 },
    ],
  }))
  const hit = dear.find((s) => s.id === 'dearAdSet')
  check('the ad set paying a multiple for nothing is named on the row', !!hit, ids(dear))
  check('…with the multiple', hit?.vars?.times === 6, JSON.stringify(hit?.vars))
  check('…and the button stops THAT ad set, by id',
    hit?.action === 'pauseAdSet' && hit?.targetId === 'a2', JSON.stringify(hit))

  // The costly mistake in the other direction.
  check('an expensive ad set that CONVERTS is never told to stop',
    !ids(signalsFor(facts({
      adSets: [
        { id: 'a1', name: 'cheap', spendAed: 408, impressions: 26_487, leads: 2 },
        { id: 'a2', name: 'dear but working', spendAed: 300, impressions: 950, leads: 3 },
      ],
    }))).includes('dearAdSet'))

  const burn = signalsFor(facts({ frequency: 4.2 }))
  check(`frequency over ${FATIGUE_FREQUENCY} is the fatigue line`,
    burn.find((s) => s.id === 'burning')?.vars?.freq === '4.2', ids(burn))
  check('…and it asks for designs, not budget',
    burn.find((s) => s.id === 'burning')?.action === 'addDesigns')

  const learn = signalsFor(facts({ leads: 5, days: 10 }))
  check('learning is stated as a DISTANCE, not a state',
    learn.find((s) => s.id === 'learning')?.vars?.need === 50, ids(learn))
  // Without an age gate this line appears on every row forever — almost no
  // Dubai property campaign reaches fifty leads in a week — and becomes the
  // wallpaper the eye skips.
  check('…and it stops being news once the campaign is a month old',
    !ids(signalsFor(facts({ leads: 5, days: 40 }))).includes('learning'),
    ids(signalsFor(facts({ leads: 5, days: 40 }))))
}

console.log('\n── unknown is not zero ──')
{
  // The cheap list read does not count rated leads or live ads. A screen that
  // cannot tell "none" from "not asked" invents faults on every row.
  const unknown = signalsFor(facts({ leads: 4, ratedLeads: null, liveAds: null }))
  check('leads with an UNKNOWN rating count produce no rating complaint',
    !ids(unknown).includes('unrated'), ids(unknown))
  check('…and an unknown ad count produces no "one design" claim',
    !ids(unknown).includes('oneDesign'), ids(unknown))
  check('a KNOWN zero still speaks',
    ids(signalsFor(facts({ leads: 4, ratedLeads: 0 }))).includes('unrated'))
}

console.log('\n── nothing is judged on delivery that has not happened ──')
{
  const thin = facts({ impressions: 400, clicks: 1, leads: 0, liveAds: 1, frequency: 5, spendAed: 40 })
  const s = signalsFor(thin)
  check('a campaign with 400 impressions is not told its creative is tired',
    !ids(s).includes('burning'), ids(s))
  check('…nor that one design is carrying it', !ids(s).includes('oneDesign'))
  check('…nor that nobody clicks', !ids(s).includes('noClicks'))
  check('…nor that it spent and brought nothing — it has barely started',
    !ids(s).includes('spendNoLeads'), ids(s))
}

console.log('\n── two lines, and silence when there is nothing to say ──')
{
  const everything = signalsFor(facts({
    dataThrough: '2026-08-05', leads: 3, ratedLeads: 0, frequency: 6, liveAds: 1,
    clicks: 20, impressions: 50_000, days: 30,
    adSets: [
      { id: 'a1', name: 'cheap', spendAed: 408, impressions: 26_487, leads: 3 },
      { id: 'a2', name: 'dear', spendAed: 93, impressions: 946, leads: 0 },
    ],
  }))
  check('never more than two lines, however many faults exist',
    everything.length === 2, ids(everything))
  check('and the worst is first', everything[0].tone === 'bad', ids(everything))

  const healthy = signalsFor(facts())
  check('a campaign doing what it should says one quiet line',
    healthy.length === 1 && healthy[0].id === 'steady', ids(healthy))
  check('…with no button on it', healthy[0].action === 'none')
  check('…and it is not a warning', healthy[0].tone === 'good')
}

console.log('\n── every line has a word, and every button a job ──')
{
  const seen = new Set<string>()
  const cases: LiveFacts[] = [
    facts({ deliveryBlocked: true }),
    facts({ status: 'PAUSED' }),
    facts({ dataThrough: '2026-08-01' }),
    facts({ leads: 4, ratedLeads: 0 }),
    facts({ frequency: 5 }),
    facts({ leads: 1, days: 7 }),
    facts({ liveAds: 1 }),
    facts({ clicks: 20 }),
    facts({ leads: 0, spendAed: 900 }),
    facts(),
    facts({ adSets: [
      { id: 'a1', name: 'c', spendAed: 408, impressions: 26_487, leads: 2 },
      { id: 'a2', name: 'd', spendAed: 93, impressions: 946, leads: 0 },
    ] }),
  ]
  for (const c of cases) for (const s of signalsFor(c)) seen.add(s.id)
  const missing = SIGNAL_IDS.filter((id) => !seen.has(id))
  check('every line this module can say is reachable — an unreachable one is dead copy',
    missing.length === 0, missing.join(','))

  const actions = new Set(cases.flatMap((c) => signalsFor(c).map((s) => s.action)))
  check('every action produced is in the walkable list',
    [...actions].every((a) => (SIGNAL_ACTIONS as readonly string[]).includes(a)), [...actions].join(','))
}

if (failures > 0) {
  console.error(`\n${failures} live-signal rule(s) broken.`)
  process.exit(1)
}
console.log('\nOne line, true about the data, with the fix beside it.\n')
