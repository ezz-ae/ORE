/**
 * WHAT THE CHAT IS TOLD BEFORE THE USER SPEAKS — locked.
 *
 * Every Expert conversation starts with a live snapshot of the platform loaded
 * into the model's context, and the master prompt's first rule is GROUND
 * EVERYTHING IN IT. That makes the context the most trusted text in the
 * system, which makes a stale sentence inside it the most dangerous.
 *
 * ── THE FAILURE THIS EXISTS FOR ──────────────────────────────────────────
 *
 * The `nextActions` on each context slice were string literals written when
 * this was a template:
 *
 *     'Connect HubSpot CRM'
 *     'Grant Meta/Google Ads access'
 *     'Resolve custom-domain DNS'
 *
 * This account has never used HubSpot. Meta has been connected since 1 Aug
 * 2026. The domain resolved months ago. None of it mattered: the literals rode
 * in on every turn, and the model — correctly following its grounding rule —
 * repeated them as findings about a business they were not true of.
 *
 * NO FABRICATION GUARD CAN CATCH THIS. Every check this codebase has for
 * invented content asks whether a claim traces to the context. These claims
 * WERE the context. The only place to stop it is here: a sentence in the
 * context that names an integration, a number or a piece of infrastructure
 * must be COMPUTED FROM the data it travels with.
 *
 * Pure — no network, no env, no clock. Runs in `pnpm guards`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  MAX_NEXT_ACTIONS, integrationActions, serverActions, leadMachineActions, sourceEvidence,
} from '../lib/freehold/mcp/next-actions'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

/** Source with comments stripped — a rule must not be satisfied by the
 *  sentence explaining it, and this file quotes the old literals above. */
const sourceOf = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

console.log('\n── nothing to do is an answer ──')
{
  // THE ASSERTION THAT MATTERS MOST. The old list told an account with every
  // integration connected to go and connect one. Silence is accurate; a stale
  // suggestion is not, and the model cannot tell them apart.
  check('a fully connected account gets no integration actions',
    integrationActions([
      { id: 'meta', name: 'Meta Ads', status: 'connected' },
      { id: 'neon', name: 'Neon', status: 'connected' },
    ]).length === 0)
  check('a server with nothing open gets no server actions',
    serverActions({ privateServer: { openTasks: 0, milestonesDone: 4, milestonesTotal: 4 } }).length === 0)
  check('a lead machine with nothing outstanding gets none either',
    leadMachineActions({ missingLandingPages: 0, pendingLandingReviews: 0, blockedByAccess: 0 }).length === 0)
  check('and missing data is silence, not a guess',
    serverActions(null).length === 0 && leadMachineActions(null).length === 0
    && integrationActions([]).length === 0)
}

console.log('\n── a name in the sentence is a name in the data ──')
{
  const actions = integrationActions([
    { id: 'meta', name: 'Meta Ads', status: 'connected' },
    { id: 'whatsapp', name: 'WhatsApp Cloud', status: 'not_connected', description: 'needs a phone number id' },
  ])
  check('only the broken one is named',
    actions.length === 1 && actions[0].startsWith('WhatsApp Cloud'), actions.join(' | '))
  check('…and its own note is the reason given',
    actions[0].includes('needs a phone number id'), actions[0])

  // THE PROPERTY THAT KILLS THE ORIGINAL BUG: a vendor with no row cannot be
  // named, because the only source of names is the rows.
  const everything = integrationActions([
    { id: 'meta', name: 'Meta Ads', status: 'connected' },
    { id: 'neon', name: 'Neon', status: 'connected' },
  ]).join(' ')
  check('a vendor that is not in the data is never named',
    !/hubspot|salesforce|zoho/i.test(everything), everything)

  // 'partial' is the state that fails silently, so it counts as broken.
  check('a half-configured integration counts as needing work',
    integrationActions([{ id: 'x', name: 'Tracking', status: 'partial' }]).length === 1)
  check('…and an unknown state is not silently treated as broken',
    integrationActions([{ id: 'x', name: 'Tracking', status: 'connected' }]).length === 0)

  check('a nameless row still produces a readable sentence',
    integrationActions([{ status: 'blocked' }])[0].length > 0,
    integrationActions([{ status: 'blocked' }])[0])
}

console.log('\n── every number in an action came from the data ──')
{
  const s = serverActions({ privateServer: { openTasks: 7, milestonesDone: 2, milestonesTotal: 5 } })
  check('the open-task count is the real count', s[0] === 'Review 7 open tasks', s.join(' | '))
  check('…and it reads correctly at one',
    serverActions({ privateServer: { openTasks: 1 } })[0] === 'Review 1 open task')
  check('the milestone remainder is arithmetic on given numbers',
    s.some((a) => a.includes('remaining 3 of 5')), s.join(' | '))

  const l = leadMachineActions({ missingLandingPages: 12, pendingLandingReviews: 4, blockedByAccess: 1 })
  check('the lead-machine counts are the real counts',
    l[0].includes('12') && l[1].includes('4') && l[2].includes('1'), l.join(' | '))

  // A backlog dump is not advice — the model leads with the first item, so a
  // long list buries the one that matters.
  check('a list is capped',
    leadMachineActions({ missingLandingPages: 1, pendingLandingReviews: 1, blockedByAccess: 1 }).length
      <= MAX_NEXT_ACTIONS
    && integrationActions(Array.from({ length: 10 }, (_, i) =>
      ({ id: `i${i}`, name: `I${i}`, status: 'blocked' }))).length === MAX_NEXT_ACTIONS)
  check('…and that cap is small enough to be read', MAX_NEXT_ACTIONS > 0 && MAX_NEXT_ACTIONS <= 5,
    String(MAX_NEXT_ACTIONS))
}

console.log('\n── the model is told where its evidence came from, without an "or" ──')
{
  // Told its evidence "might be mock", a grounded model either distrusts the
  // whole slice or cites the hedge as fact. The code knows which branch it
  // took, so there is no reason to make the model guess.
  for (const src of ['registry', 'runtime', 'empty'] as const) {
    const e = sourceEvidence(src, 'integration connection status')
    check(`"${src}" states one source`, e.length === 1 && !/\bor\b|mock|when available/i.test(e[0]), e[0])
  }
  // NOTHING WAS READ and NOTHING IS WRONG must not read the same.
  check('an empty read is distinguishable from a clean one',
    sourceEvidence('empty', 'x')[0] !== sourceEvidence('registry', 'x')[0])
}

console.log('\n── and the tool executor actually uses them ──')
{
  const exec = sourceOf('lib/freehold/mcp/execute-tool.ts')

  check('the context slices derive their actions',
    /integrationActions\(/.test(exec) && /serverActions\(/.test(exec)
    && /leadMachineActions\(/.test(exec) && /sourceEvidence\(/.test(exec))

  // THE REGRESSION, NAMED. If any of these strings comes back, the chat is
  // telling a business to do something nobody checked was true.
  for (const dead of [
    'Connect HubSpot CRM', 'Grant Meta/Google Ads access', 'Configure tracking and WhatsApp',
    'Resolve custom-domain DNS', 'Connect CRM and ad accounts',
    'Prioritize listings with active landing pages', 'Resolve blockers before ad launch',
    'mock fallback', 'when available',
  ]) {
    check(`"${dead}" is not in the context any more`, !exec.includes(dead))
  }

  // A number with no referent is worse than a missing one: it is copyable,
  // so the fabrication rules read it as grounded.
  check('no invented counter is manufactured from another counter',
    !/aiRecommendedActions/.test(exec) && !/pendingAdRequests/.test(exec),
    'an integer with no source was being handed to the model')
}

console.log('\n── and the public prompt is what the file says it is ──')
{
  const gem = sourceOf('lib/gemini.ts')

  // A PROMPT ASSEMBLED FROM AN UNTRACKED FILE. `loadCodexPrompt()` appended
  // data.md from process.cwd() — a file not in this repository — AFTER the
  // rule "use only verified project rows supplied in the context", so whatever
  // it held read as verified rows and outranked the live database. Reading the
  // code told you nothing about what the model had been told.
  check('the public prompt is not read off disk at runtime',
    !/readFileSync|loadCodexPrompt|data\.md/.test(gem),
    'the shipped prompt depended on a file that is not in the repository')
  check('…and it is the constant in this file',
    /export const PUBLIC_SYSTEM_PROMPT = DEFAULT_PUBLIC_SYSTEM_PROMPT/.test(gem))

  // An unverifiable boast about scale is an instruction to answer from memory:
  // the broker prompt claimed the whole database while the route appends a
  // handful of rows, so the gap between the two was filled by invention.
  check('no prompt claims access to data the route does not supply',
    !/3500\+|full property database/i.test(gem),
    'the prompt promised a database the request never carries')
}

console.log(failures === 0
  ? '\n✅ nothing in the chat\'s context is older than the data it travels with.'
  : `\n❌ ${failures} context-truth guard(s) failed`)
process.exit(failures === 0 ? 0 : 1)
