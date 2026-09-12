/**
 * WHAT THE MORNING GUARD MAY CHANGE WITHOUT ASKING — locked.
 *
 * "wire it to the morning guard with the verdicts deciding."
 *
 * This is a deliberate change to a stated policy. targeting-guard's own header
 * says "Nothing is paused automatically: pausing somebody's campaign without
 * them is a bigger mistake than the one being fixed." That still holds for
 * pausing and for budget. What changed is that one class of targeting fix may
 * now be applied unattended, on an account spending AED 3,500 a day.
 *
 * Three rules make that defensible, and each has a way of going wrong that
 * looks reasonable.
 *
 * ── ONE: THE VERDICT DECIDES WHETHER, NOT WHAT ───────────────────────────
 *
 * `worthApplying` says a fix is worth its learning reset. It says nothing
 * about what to change. Most gaps have no unambiguous answer — narrow the geo
 * to WHERE? Only a person knows the event is in Al Ain, and a guess spends a
 * budget in the wrong emirate. So only `advantageOn` is automatic: the fix is
 * `advantage_audience: 0`, there is no second question, and Advantage-off is
 * already this product's hardest rule.
 *
 * ── TWO: A RIGHT FIX REPEATED IS WORSE THAN A WRONG ONE ──────────────────
 *
 * A targeting edit re-enters learning. A guard that reapplies the same fix
 * every morning — because a read-back was imperfect, or somebody re-enabled it
 * in Ads Manager — would hold an ad set in the learning phase permanently
 * while reporting success daily. So a fix is attempted ONCE per (ad set, gap),
 * recorded whether it succeeded or failed.
 *
 * ── THREE: WHAT IT WILL NOT DO IS STILL SAID ─────────────────────────────
 *
 * The reason only one gap is automatic is that the others need a decision. An
 * operator never told about them cannot make it.
 *
 * Runs in `pnpm guards`. Applies nothing.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  AUTO_APPLICABLE, MAX_AUTO_EDITS, autoApplyPlan, needsAPerson,
} from '../lib/freehold/auto-apply'
import { TARGETING_GAPS, type GapFinding, type TargetingGap } from '../lib/freehold/targeting-diff'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const finding = (gap: TargetingGap, worthApplying = true): GapFinding => ({
  gap, resetsLearning: true, worthApplying,
  because: worthApplying ? 'learningIsWrong' : 'producing',
})

console.log('\n── the verdict decides whether; the list decides what ──')
{
  const sets = [{ adSetId: 's1', findings: [finding('advantageOn')] }]
  check('an Advantage override is fixed unattended',
    autoApplyPlan(sets, []).map((p) => p.adSetId).join(',') === 's1')

  // THE ASSERTION THAT KEEPS THIS HONEST. Every one of these is worth its
  // reset, and none has an unambiguous fix: narrow the geo to WHERE?
  for (const gap of TARGETING_GAPS.filter((g) => g !== 'advantageOn')) {
    check(`${gap} is reported, never applied`,
      autoApplyPlan([{ adSetId: 's1', findings: [finding(gap)] }], []).length === 0)
  }
  check('…and exactly one gap is automatic',
    AUTO_APPLICABLE.length === 1 && AUTO_APPLICABLE[0] === 'advantageOn',
    AUTO_APPLICABLE.join(','))

  // Not worth the reset means not applied, whatever the gap.
  check('a fix the verdict rejects is never applied',
    autoApplyPlan([{ adSetId: 's1', findings: [finding('advantageOn', false)] }], []).length === 0)
}

console.log('\n── a fix is attempted exactly once ──')
{
  const sets = [{ adSetId: 's1', findings: [finding('advantageOn')] }]
  check('an applied fix is not applied again',
    autoApplyPlan(sets, [{ adSetId: 's1', gap: 'advantageOn' }]).length === 0)

  // THE FAILURE THAT WOULD COST THE MOST. If the gap reappears — Meta
  // reverted it, or somebody re-enabled it in Ads Manager — a second write
  // would restart learning again. That is a finding for a person, not a retry.
  check('…even when the gap comes back',
    autoApplyPlan(sets, [{ adSetId: 's1', gap: 'advantageOn' }]).length === 0,
    'the guard would re-edit the same ad set every morning')

  check('history is matched per ad set, not globally',
    autoApplyPlan(
      [{ adSetId: 's2', findings: [finding('advantageOn')] }],
      [{ adSetId: 's1', gap: 'advantageOn' }],
    ).length === 1)
}

console.log('\n── the blast radius is bounded ──')
{
  const many = Array.from({ length: 10 }, (_, i) =>
    ({ adSetId: `s${i}`, findings: [finding('advantageOn')] }))
  check('one run edits at most MAX_AUTO_EDITS ad sets',
    autoApplyPlan(many, []).length === MAX_AUTO_EDITS, String(autoApplyPlan(many, []).length))
  // Not a rate limit — if the diff is wrong, this is how many ad sets it is
  // wrong about before a person sees the notification.
  check('…and that cap is small enough to notice',
    MAX_AUTO_EDITS > 0 && MAX_AUTO_EDITS <= 5, String(MAX_AUTO_EDITS))
  check('a cap of zero applies nothing rather than everything',
    autoApplyPlan(many, [], 0).length === 0)
}

console.log('\n── and what it will not do is still said ──')
{
  const sets = [
    { adSetId: 's1', findings: [finding('advantageOn'), finding('countryWide')] },
    { adSetId: 's2', findings: [finding('noPropertyGate'), finding('noExclusions', false)] },
  ]
  const person = needsAPerson(sets)
  check('every fix worth making that a person must make is reported',
    person.map((p) => p.gap).sort().join(',') === 'countryWide,noPropertyGate',
    person.map((p) => `${p.adSetId}:${p.gap}`).join(','))
  check('…and a fix the verdict rejected is not on that list either',
    !person.some((p) => p.gap === 'noExclusions'))
}

console.log('\n── and the guard actually does it ──')
{
  const route = readFileSync(join(process.cwd(), 'app/api/cron/targeting-guard/route.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

  check('the guard applies through the policy, not its own rule',
    /autoApplyPlan\(/.test(route) && /needsAPerson\(/.test(route))
  // updateAdSet with targeting would delete the qualifier, the exclusions,
  // the locales and the Advantage opt-out — turning expansion ON while
  // purporting to turn it off.
  check('…and writes through the read-modify-verify path, never updateAdSet',
    /patchAdSetTargeting\(/.test(route) && !/updateAdSet\(/.test(route),
    'a rebuild-style write would switch Advantage back on')
  check('…and records the attempt whether or not it worked',
    /freehold_targeting_applied/.test(route) && /outcome\.ok, outcome\.ok \? null/.test(route))
  check('…and always says so, not only when something else changed',
    /targeting_auto_applied/.test(route))
  check('acting can never break reporting',
    /The guard's reporting must survive its acting/.test(
      readFileSync(join(process.cwd(), 'app/api/cron/targeting-guard/route.ts'), 'utf8')))
}


console.log('\n── a guard that fails must say why, and leave a row saying so ──')
{
  const route = readFileSync(join(process.cwd(), 'app/api/cron/targeting-guard/route.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

  // THE FAILURE THIS EXISTS FOR. The Meta read was wrapped in `catch {}` with
  // no binding, so the reason Meta refused was discarded and the route
  // answered a bare 502. This cron then fired every morning from 5 to 10 Sep
  // 2026 and failed every time, on an account that had been spending AED
  // 3,500 a day — and nothing anywhere could say whether the token had
  // expired, the account was disabled, or Meta was down. Vercel's error
  // tracker saw nothing either: nothing was thrown and nothing was logged.
  check('the Meta read binds its error instead of discarding it',
    /catch \(err\)/.test(route) && !/\}\s*catch\s*\{\s*$/m.test(
      route.slice(route.indexOf('listCampaigns(), getAccountCampaignInsights()'),
                  route.indexOf('Could not read Meta'))),
    'catch {} threw away the only sentence that says what broke')
  check('…and the reason reaches the logs and the response',
    /console\.error\('\[targeting-guard\] could not read Meta:/.test(route)
    && /because,\s*checked: 0/.test(route))

  // A GAP IN THE RUNS TABLE MUST MEAN ONE THING. "The cron did not run" and
  // "the cron ran and failed" need different people to fix them, and they
  // looked identical because only the success path could write a row.
  check('a failed read still records a run', /await recordFailedRun\(because\)/.test(route))
  check('…and a suspended run records one too',
    /await recordSuspendedRun\(campaigns\.length, pending\.length\)/.test(route))
  check('…through one table definition, not three copies',
    (route.match(/CREATE TABLE IF NOT EXISTS freehold_targeting_guard_runs/g) ?? []).length === 1,
    'a second copy of the DDL is how the columns drift apart')

  // Bookkeeping must never eat the answer, and a failed read must never page
  // anybody — our own broken request is not the account's emergency.
  check('recording a failure cannot break the response',
    /async function recordFailedRun[\s\S]*?catch \{[\s\S]*?\}\s*\}/.test(route))
  check('…and never raises an alarm on our own failed read',
    /\[0, 0, false, JSON\.stringify\(\[\{ key: 'couldNotReadMeta'/.test(route),
    'a guard that pages somebody every morning is a guard that gets muted')
}

console.log('\n── and a suspended deployment does not act at all ──')
{
  const route = readFileSync(join(process.cwd(), 'app/api/cron/targeting-guard/route.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

  check('the guard checks whether this deployment is suspended',
    /deploymentSuspended\(process\.env/.test(route))

  // READ EVERYTHING, CHANGE NOTHING. The account is still monitored — the run
  // is recorded and the faults are reported — but nothing is written into the
  // ad account of a client we have stopped serving.
  const suspendedAt = route.indexOf('deploymentSuspended(process.env')
  const applyAt = route.indexOf('patchAdSetTargeting(')
  check('…before anything is applied',
    suspendedAt > 0 && applyAt > 0 && suspendedAt < applyAt,
    `suspended@${suspendedAt} apply@${applyAt}`)
  check('…and says so rather than reporting a silent no-op',
    /suspended: true/.test(route) && /Monitoring only/.test(route))
  check('…while the findings are still returned for a person',
    /needsAPerson: pending/.test(route))

  // THE COMMENT SAID "the run is recorded" AND THE RETURN SAT ABOVE THE ONLY
  // INSERT. A suspended deployment monitored the account and left no evidence
  // it had — the exact failure the rest of this route exists to prevent.
  const gateAt = route.indexOf('if (deploymentSuspended(process.env')
  const recordAt = route.indexOf('await recordSuspendedRun(', gateAt)
  const returnAt = route.indexOf('return NextResponse.json(', gateAt)
  check('the suspended path records its run before returning',
    gateAt > 0 && recordAt > gateAt && recordAt < returnAt,
    `gate@${gateAt} record@${recordAt} return@${returnAt}`)
}

console.log(failures === 0
  ? '\n✅ one fix, once, on at most three ad sets, and everything else is somebody\'s decision.'
  : `\n❌ ${failures} auto-apply guard(s) failed`)
process.exit(failures === 0 ? 0 : 1)
