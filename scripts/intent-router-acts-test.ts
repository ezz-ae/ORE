/**
 * THE INTENT ROUTER DECIDES SOMETHING — locked.
 *
 * The router computed the healthiest structural action from the day it shipped,
 * and nothing acted on it. Three pieces of evidence, all still in the repo when
 * this suite was written:
 *
 *   · /api/freehold/ads/route-intent says in its own header "the wizard shows
 *     this before the broker commits" and had no caller anywhere;
 *   · in the launch route the decision changed behaviour in exactly ONE branch,
 *     `autonomy === 3 && action === 'hold'` — and getAutonomyLevel() defaults
 *     to 1 and FAILS CLOSED to 1, so on a real account it is never 3;
 *   · every other verdict was written to the decision log as "the intent router
 *     recommended <action> ... fold the arms via Campaign Groups", which tells
 *     somebody, afterwards, what should have happened.
 *
 * Five actions, four that could never do anything, and the fifth behind a
 * switch that is off. That is a feature that costs money to maintain and
 * returns an opinion nobody reads.
 *
 * So this locks the two things that make it real: the launch route refuses a
 * self-competing launch at ANY autonomy level, and the refusal is a question
 * with a way through rather than a wall.
 *
 * Pure — reads source, no network. Runs in `pnpm guards`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  decideCampaignAction, routerBlocks, routerWarns, duplicateRefusal, duplicateWarning,
  DUPLICATE_ACTIONS,
  type CampaignIntent, type ProjectAdStructure, type RouterAction,
} from '../lib/meta/campaign-router'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const read = (p: string) => readFileSync(join(process.cwd(), p), { encoding: 'utf8' })

/**
 * The file with its comments removed.
 *
 * Both of the scans below fired on THIS suite's own subject matter the first
 * time they ran: the route's comment quotes the old log line it replaced, and
 * the wizard's comment quotes the wrong onClick it warns against. A guard that
 * fires on the prose explaining the fix is a guard somebody deletes — the same
 * fault the lead-attribution suite hit and fixed the same way.
 */
const code = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

const intent = (o: Partial<CampaignIntent> = {}): CampaignIntent => ({
  projectSlug: 'azizi-venice', objectiveKey: 'OUTCOME_LEADS', language: 'loc:6',
  audienceKey: 'aud:a', hasNewCreative: false, dailyBudgetAED: 200, brokerId: 'b1', ...o,
})
const running = (o: { learning?: boolean; ageDays?: number; leads?: number } = {}): ProjectAdStructure => ({
  projectSlug: 'azizi-venice',
  campaigns: [{
    id: 'c1', objectiveKey: 'OUTCOME_LEADS', status: 'ACTIVE',
    ageDays: o.ageDays ?? 2, leads: o.leads ?? 3, learning: o.learning ?? true,
    dailyBudgetAED: 300,
    adSets: [{ id: 's1', language: 'loc:6', audienceKey: 'aud:a', ads: [{ id: 'a1', creativeKey: 'k1' }] }],
  }],
})

console.log('\n── the verdict that must stop a launch ──')
{
  // THE CASE: same goal, same language, same audience, same creative, and the
  // running one is still in its first week. A second campaign splits the
  // budget, bids against the first, and resets the learning on both.
  const d = decideCampaignAction(intent(), running())
  check('an identical launch during learning is a HOLD', d.action === 'hold', d.action)
  check('…and it blocks', routerBlocks(d), d.action)
  check('…and it names the campaign it would compete with', d.targetCampaignId === 'c1',
    String(d.targetCampaignId))

  // Past learning it is not self-harm, only worse than the alternative.
  const grown = decideCampaignAction(intent(), running({ learning: false, ageDays: 40, leads: 60 }))
  check('the same setup past learning is a budget raise, not a hold',
    grown.action === 'increase_budget', grown.action)
  check('…so it warns rather than blocks', routerWarns(grown) && !routerBlocks(grown), grown.action)

  // Everything genuinely new goes through untouched. A gate that stopped these
  // would be a gate people disable.
  for (const [what, d2] of [
    ['a new objective', decideCampaignAction(intent({ objectiveKey: 'OUTCOME_TRAFFIC' }), running())],
    ['a new language', decideCampaignAction(intent({ language: 'loc:9' }), running())],
    ['a new audience', decideCampaignAction(intent({ audienceKey: 'aud:z' }), running())],
    ['a new creative', decideCampaignAction(intent({ hasNewCreative: true }), running())],
    ['nothing running at all', decideCampaignAction(intent(), { projectSlug: 'x', campaigns: [] })],
  ] as Array<[string, ReturnType<typeof decideCampaignAction>]>) {
    check(`${what} is not blocked`, !routerBlocks(d2), d2.action)
  }

  check('both duplicate actions are named',
    DUPLICATE_ACTIONS.includes('hold' as RouterAction)
    && DUPLICATE_ACTIONS.includes('increase_budget' as RouterAction))
  check('a missing decision blocks nothing', !routerBlocks(null) && !routerWarns(null))
}

console.log('\n── the launch route acts on it ──')
{
  const route = read('app/api/meta/launch/route.ts')
  const blockAt = route.indexOf('routerBlocks(decision)')
  const buildAt = route.indexOf('launchFullCampaign({')

  check('the launch route reads the verdict', blockAt > 0, String(blockAt))
  check('…before it builds anything', blockAt > 0 && buildAt > blockAt, `block=${blockAt} build=${buildAt}`)

  const refusal = route.slice(blockAt, blockAt + 1600)
  check('the refusal returns the reserved credits', /releaseReservation\(\)/.test(refusal))
  check('…and is confirmable, not a wall', /confirmable: true/.test(refusal))
  check('…and names the campaign it collided with', /targetCampaignName/.test(refusal))

  // THE WHOLE POINT. The refusal must not be behind the autonomy switch: that
  // switch governs the machine SPENDING on its own, and this is the machine
  // declining to spend. getAutonomyLevel defaults to 1 and fails closed to 1,
  // so gating here would mean never.
  const beforeBlock = route.slice(0, blockAt)
  check('the refusal is NOT gated on the autonomy level',
    !/getAutonomyLevel\(\)[\s\S]{0,400}routerBlocks/.test(route)
    && beforeBlock.lastIndexOf('autonomy === 3') < 0,
    'an autonomy check precedes the refusal')

  // …and the override has to travel, or the button is decoration.
  check('the confirm flag is read from the request', /body\.confirmDuplicate !== true/.test(route))
  check('…and is part of the launch payload type',
    /confirmDuplicate\?: boolean/.test(read('lib/meta/types.ts')))

  // The softer verdict has to reach the operator too, or it is the same log
  // line with a different name.
  check('the increase_budget verdict rides out with the successful launch',
    /routerWarns\(decision\)/.test(route) && /duplicateWarning\(/.test(route),
    'the warning never leaves the server')

  // The old log line told somebody, afterwards, what should have happened.
  check('the log no longer says "fold the arms" instead of acting',
    !/fold the arms via Campaign Groups/.test(code('app/api/meta/launch/route.ts')),
    'the advisory log line is still there')
}

console.log('\n── the wizard asks, and can be answered ──')
{
  const wiz = read('app/freehold-intelligence/lead-machine/campaigns/new/page.tsx')
  check('the wizard recognises the refusal', /data\.type === 'duplicate'/.test(wiz))
  check('…and offers to launch anyway', /handleLaunch\(true\)/.test(wiz))
  check('…and a link to the campaign already running', /duplicate\.campaignId/.test(wiz))

  // THE BUG THIS ALMOST SHIPPED WITH. React passes the click event as the
  // first argument, and a MouseEvent is truthy — `onClick={handleLaunch}`
  // would have sent confirmDuplicate: true on every press of Run, silently
  // answering a question nobody was asked.
  check('the Run button never hands its click event to the confirm flag',
    !/onClick=\{handleLaunch\}/.test(code('app/freehold-intelligence/lead-machine/campaigns/new/page.tsx')),
    'onClick={handleLaunch} passes the MouseEvent as confirmDuplicate')
  check('…it calls it with no argument',
    /onClick=\{\(\) => void handleLaunch\(\)\}/.test(wiz))
}

console.log('\n── the sentences say what to do ──')
{
  const d = decideCampaignAction(intent(), running())
  const refusal = duplicateRefusal(d, 'Venice — investors EN')
  check('the refusal names the campaign', refusal.includes('Venice — investors EN'))
  check('…says nothing was spent', /no credits were spent/i.test(refusal), refusal)
  check('…and offers both ways forward',
    /add budget/i.test(refusal) && /change something/i.test(refusal), refusal)
  check('…and reads normally with no name',
    duplicateRefusal(d, null).includes('a campaign') && !duplicateRefusal(d, null).includes('“'))

  const warn = duplicateWarning(d, 'Venice — investors EN')
  check('the warning explains the cost of two', /bid against each other/i.test(warn), warn)
  check('…and neither sentence explains Meta mechanics to the operator',
    !/ad set|adset|delivery gate|learning phase/i.test(refusal), refusal)
}

if (failures > 0) {
  console.error(`\n${failures} intent-router rule(s) broken.`)
  process.exit(1)
}
console.log('\nThe router decides something, and the decision can be overruled out loud.\n')
