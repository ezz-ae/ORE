/**
 * "STOP" MEANS MONEY IS MOVING WRONG RIGHT NOW — locked.
 *
 * The setup check and the targeting check both produce lists, and a list is
 * not an instruction. A screen of amber rows gets skimmed, and the row meaning
 * "you are paying to show a property ad to the wrong people" reads exactly
 * like the row meaning "consider naming your placements".
 *
 * decideAction collapses a campaign into one imperative. The rule that makes
 * it worth reading is the one this suite exists to hold: `stop_now` requires
 * BOTH a fault that misdirects delivery AND a campaign that is delivering.
 * A paused campaign with broken targeting is equally wrong and costs nothing,
 * and shouting about it is how "stop now" comes to mean nothing — which this
 * product has already lived through, with a panel that called eight live
 * interests retired and was then, correctly, ignored.
 *
 * Pure — no database, no network. Runs in `pnpm guards`.
 */
import {
  decideAction, rankActions, stopCount, shouldAlert,
  ACTION_SEVERITIES, ACTION_KEYS, type CampaignFacts,
} from '../lib/freehold/campaign-action'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const clean: CampaignFacts = {
  campaignId: 'c1', name: 'Dubai property — Quick', live: true, spendAed: 3783,
  expanding: false, expansionUnknown: false, noProperty: false,
  deadSignals: [], offPlatform: false, softGoal: false, deprecatedLocation: false,
}
const facts = (p: Partial<CampaignFacts>): CampaignFacts => ({ ...clean, ...p })

console.log('\n── a live campaign delivering to the wrong people is a stop ──')
{
  const expanding = decideAction(facts({ expanding: true }))
  check('Advantage expanding past the chosen audience stops the campaign',
    expanding.severity === 'stop_now' && expanding.key === 'stopExpanding', JSON.stringify(expanding))

  // WHY THIS ONE IS FIRST. Expansion does not appear as a missing interest —
  // the interests are all still displayed on the ad set. They are simply not
  // applied, so every other targeting verdict on the campaign is describing a
  // spec Meta is ignoring.
  const both = decideAction(facts({ expanding: true, noProperty: true, deadSignals: ['x'] }))
  check('…and it is named ahead of every other fault, because it overrides them',
    both.key === 'stopExpanding', both.key)

  check('a live campaign with no property signal anywhere is a stop',
    decideAction(facts({ noProperty: true })).severity === 'stop_now')
  const dead = decideAction(facts({ deadSignals: ['Property', 'Job seeking'] }))
  check('a live campaign carrying a retired targeting id is a stop',
    dead.severity === 'stop_now' && dead.key === 'stopDeadSignal', JSON.stringify(dead))
  check('…and it names which ones, so the fix is findable',
    dead.vars.signals === 'Property, Job seeking' && dead.vars.n === 2, JSON.stringify(dead.vars))
  check('a live campaign buying third-party inventory is a stop',
    decideAction(facts({ offPlatform: true })).severity === 'stop_now')
}

console.log('\n── the same faults, paused, are not an emergency ──')
{
  // THE RULE THE WHOLE MODULE TURNS ON. A guard that shouts at a campaign
  // spending nothing teaches people to dismiss it, and then the shout that
  // mattered arrives into a muted channel.
  for (const [label, p] of [
    ['expansion', { expanding: true }],
    ['no property signal', { noProperty: true }],
    ['a retired id', { deadSignals: ['x'] }],
  ] as Array<[string, Partial<CampaignFacts>]>) {
    const v = decideAction(facts({ ...p, live: false }))
    check(`${label} on a paused campaign is fix_today, not stop_now`,
      v.severity === 'fix_today', JSON.stringify(v))
  }

  // …AND IT IS STILL REPORTED. Downgrading is not the same as forgiving; the
  // campaign is exactly as broken and must not run again as it stands.
  check('a paused, broken campaign is never reported as ok',
    decideAction(facts({ live: false, noProperty: true })).key !== 'ok')

  // A live campaign that has not spent yet is one that is ABOUT to. Waiting
  // for the first dirham to call it a stop is waiting for the damage.
  check('a live campaign that has not spent yet still stops',
    decideAction(facts({ spendAed: 0, expanding: true })).severity === 'stop_now')
}

console.log('\n── wrong about the outcome, not about the audience ──')
{
  // These waste the budget without misdirecting it at a stranger, so they do
  // not interrupt anybody's morning.
  check('optimising for views on a live campaign is fix_today, not a stop',
    decideAction(facts({ softGoal: true })).severity === 'fix_today')

  // The deprecated location type does not misdeliver at all — it freezes the
  // ad set so no later fix can be published. Silent is the one thing it must
  // not be, because the next edit will fail for no visible reason.
  const loc = decideAction(facts({ deprecatedLocation: true }))
  check('a deprecated location type is named rather than ignored',
    loc.severity === 'fix_today' && loc.key === 'fixLocation', JSON.stringify(loc))

  // ORDER MATTERS. A campaign that is both misdelivering and mis-optimising
  // gets the instruction that stops the bleeding.
  check('a stop outranks a soft goal',
    decideAction(facts({ expanding: true, softGoal: true })).severity === 'stop_now')
}

console.log('\n── "could not tell" is never an ok ──')
{
  // The exact case that spent money for a week while every gate showed green.
  const v = decideAction(facts({ expansionUnknown: true }))
  check('an unreadable expansion state is a watch, not a pass',
    v.severity === 'watch' && v.key === 'watchUnverified', JSON.stringify(v))
  check('…and a campaign with nothing wrong is the only ok',
    decideAction(clean).key === 'ok' && decideAction(clean).severity === 'ok')
}

console.log('\n── the alarm fires for stops and nothing else ──')
{
  const actions = [
    decideAction(facts({ campaignId: 'a', expanding: true })),
    decideAction(facts({ campaignId: 'b', softGoal: true })),
    decideAction(facts({ campaignId: 'c' })),
  ]
  check('the stop count is the number an alert leads with', stopCount(actions) === 1, String(stopCount(actions)))
  check('a stop raises the alarm', shouldAlert(actions))
  check('a fix_today on its own does not',
    !shouldAlert([decideAction(facts({ softGoal: true })), decideAction(clean)]),
    'a 6am page for a non-emergency trains people to mute the channel')
  check('…and neither does a clean account', !shouldAlert([decideAction(clean)]))
}

console.log('\n── worst first, then the one burning the most ──')
{
  const spend: Record<string, number> = { small: 100, big: 9000, fine: 50 }
  const ranked = rankActions([
    decideAction(facts({ campaignId: 'fine' })),
    decideAction(facts({ campaignId: 'small', expanding: true })),
    decideAction(facts({ campaignId: 'big', expanding: true })),
  ], (a) => spend[a.campaignId] ?? 0)
  check('stops come before everything else', ranked[0].severity === 'stop_now')
  check('…and the biggest spender leads the stops',
    ranked[0].campaignId === 'big', ranked.map((r) => r.campaignId).join(' → '))
  check('…and the healthy campaign is last', ranked[ranked.length - 1].campaignId === 'fine')
}

console.log('\n── the vocabulary is walkable, so nothing ships wordless ──')
{
  check('severities are distinct and ordered worst-first',
    new Set(ACTION_SEVERITIES).size === 4 && ACTION_SEVERITIES[0] === 'stop_now'
      && ACTION_SEVERITIES[ACTION_SEVERITIES.length - 1] === 'ok')
  check('every action key is distinct', new Set(ACTION_KEYS).size === ACTION_KEYS.length)

  // Every key the decider can return must be in the walkable list, or the i18n
  // audit cannot see it and it reaches a screen as its own key name.
  const produced = new Set<string>()
  const flags: Array<Partial<CampaignFacts>> = [
    {}, { expanding: true }, { noProperty: true }, { deadSignals: ['x'] }, { offPlatform: true },
    { softGoal: true }, { deprecatedLocation: true }, { expansionUnknown: true },
  ]
  for (const f of flags) {
    produced.add(decideAction(facts(f)).key)
    produced.add(decideAction(facts({ ...f, live: false })).key)
  }
  const stray = [...produced].filter((k) => !(ACTION_KEYS as readonly string[]).includes(k))
  check('every key the decider can return is declared', stray.length === 0, stray.join(', '))
}

if (failures > 0) {
  console.error(`\n${failures} campaign-action rule(s) broken.`)
  console.error('A guard that shouts at a paused campaign is a guard nobody reads.')
  process.exit(1)
}
console.log('\nStop means money is moving wrong right now, and nothing else does.\n')
