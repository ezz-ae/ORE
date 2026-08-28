/**
 * THE ADVISOR'S ADVICE HAS TO BE ACTIONABLE, AND ITS ACTIONS HAVE TO BE SAFE —
 * locked.
 *
 * The panel shipped with three actions and a prompt line reading
 * `"action": null for most suggestions`. So the most common outcome of asking
 * the AI what was wrong with a live campaign was a paragraph and a Discuss
 * button. The operator's verdict, verbatim: "so many boxes of AI and none of
 * them affective".
 *
 * Widening the vocabulary to six is the easy half. The half that needs locking
 * is that a wider vocabulary did NOT become a wider blast radius:
 *
 *   · a suggestion the model writes cannot pause the last live ad, or the last
 *     live ad set, or empty an ad set's placements — each of which stops
 *     delivery while the campaign still reads ACTIVE
 *   · the two destructive actions are gated on arithmetic done in code from
 *     fetched numbers. The model's confidence is not part of the test.
 *   · a proposed action that fails validation costs the suggestion its button
 *     and nothing else — the ADVICE survives, because dropping a real finding
 *     over one malformed field hides the finding
 *
 * These are those rules. Pure — no network. Runs in `pnpm guards`.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  ADVISOR_ACTION_TYPES, ACTION_SHAPES, actionShapeLines,
  validateAdvisorAction, adIsProvenWorse, liveAds, liveAdSets,
  MIN_DAILY_AED, MIN_AD_SPEND_TO_JUDGE,
  type AdvisorState, type AdvisorAd,
} from '../lib/freehold/advisor-actions'
import { safeBudgetStep } from '../lib/freehold/learning-phase'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const ad = (id: string, over: Partial<AdvisorAd> = {}): AdvisorAd => ({
  id, name: id, status: 'ACTIVE', spend: 0, leads: 0, ...over,
})

/** Two ad sets, two live ads each, two placements each. The healthy baseline. */
const state = (): AdvisorState => ({
  campaignStatus: 'ACTIVE',
  adSets: [
    {
      id: 'as1', status: 'ACTIVE', dailyBudgetAED: 200,
      placements: ['facebook:feed', 'instagram:stream'],
      condemnedPlacements: ['instagram:stream'],
      ads: [ad('a1', { spend: 1200, leads: 1 }), ad('a2', { spend: 1200, leads: 30 })],
    },
    {
      id: 'as2', status: 'ACTIVE', dailyBudgetAED: 150,
      placements: ['facebook:feed'],
      condemnedPlacements: [],
      ads: [ad('a3', { spend: 900, leads: 20 }), ad('a4', { spend: 900, leads: 22 })],
    },
  ],
})

const v = (raw: unknown, s: AdvisorState = state()) => validateAdvisorAction(raw, s, safeBudgetStep)

console.log('\n── the vocabulary is walkable, and every shape is described ──')
{
  // The prompt is built FROM the union rather than typed out beside it. A
  // seventh action added to the type and forgotten in the prompt is a
  // capability that ships and then never fires — invisible, because nothing
  // errors.
  check('every action type has a shape line',
    ADVISOR_ACTION_TYPES.every((t) => !!ACTION_SHAPES[t]?.trim()))
  const lines = actionShapeLines()
  check('the prompt lists every one of them',
    ADVISOR_ACTION_TYPES.every((t) => lines.includes(`"type":"${t}"`)), lines)
  check('the vocabulary is wider than the three it shipped with',
    ADVISOR_ACTION_TYPES.length >= 6, String(ADVISOR_ACTION_TYPES.length))
}

console.log('\n── nothing the model says can stop delivery outright ──')
{
  // Each of these leaves a campaign reading ACTIVE while delivering nothing,
  // which is the exact state this product spent a week making legible. Turning
  // everything off is a decision with its own button, not a side effect of
  // accepting a tip about one creative.
  const oneAd: AdvisorState = {
    campaignStatus: 'ACTIVE',
    adSets: [{
      id: 'as1', status: 'ACTIVE', dailyBudgetAED: 200,
      placements: ['facebook:feed', 'instagram:stream'],
      condemnedPlacements: ['instagram:stream'],
      ads: [ad('a1', { spend: 5000, leads: 0 })],
    }],
  }
  check('the last live ad is never paused, however badly it is doing',
    v({ type: 'pause_ad', adSetId: 'as1', adId: 'a1' }, oneAd) === null)
  check('liveAds counts only ACTIVE ads', liveAds(oneAd, 'as1') === 1)

  check('the last live ad set is never paused',
    v({ type: 'pause_adset', adSetId: 'as1' }, oneAd) === null)
  check('liveAdSets counts only ACTIVE ad sets', liveAdSets(oneAd) === 1)

  const onePlacement: AdvisorState = {
    ...oneAd,
    adSets: [{ ...oneAd.adSets[0], placements: ['facebook:feed'], condemnedPlacements: ['facebook:feed'] }],
  }
  // An empty publisher_platforms is not "no placements" to Meta — it is
  // permission to choose, which means Audience Network, which this product
  // never buys.
  check('the last placement is never dropped, even when condemned',
    v({ type: 'drop_placement', adSetId: 'as1', placement: 'facebook:feed' }, onePlacement) === null)
}

console.log('\n── pausing an ad is decided by arithmetic, not by the model ──')
{
  // a1: AED 1200 for one lead. a2: AED 1200 for thirty. The lower bound on a1's
  // cost per lead is above the upper bound on the rest of the campaign's, so
  // the two have genuinely separated — this is a finding, not a ranking.
  const s = state()
  const every = s.adSets.flatMap((x) => x.ads)
  const bad = adIsProvenWorse(every.find((a) => a.id === 'a1')!, every)
  check('an ad burning 1200 for one lead is proven worse than its field',
    bad.proven, JSON.stringify(bad))
  check('…and the accepted action names it',
    JSON.stringify(v({ type: 'pause_ad', adSetId: 'as1', adId: 'a1' }))
      === JSON.stringify({ type: 'pause_ad', adSetId: 'as1', adId: 'a1' }))

  // The one that matters most. A model asked to find a loser will always find
  // one; the numbers are what decide whether it was right.
  check('a merely-behind ad is NOT paused, whatever the model claims',
    v({ type: 'pause_ad', adSetId: 'as2', adId: 'a3' }) === null)

  // Young creatives are the standard casualty of this kind of automation.
  const young: AdvisorState = {
    ...state(),
    adSets: state().adSets.map((x) => x.id !== 'as1' ? x : {
      ...x, ads: [ad('a1', { spend: MIN_AD_SPEND_TO_JUDGE - 1, leads: 0 }), ad('a2', { spend: 1200, leads: 30 })],
    }),
  }
  check('an ad below the attention floor is never judged',
    v({ type: 'pause_ad', adSetId: 'as1', adId: 'a1' }, young) === null)

  // Zero leads is real evidence once enough money has gone through it — the
  // case a point estimate cannot express at all ("CPL 0" or "unknown").
  const dry: AdvisorState = {
    ...state(),
    adSets: state().adSets.map((x) => x.id !== 'as1' ? x : {
      ...x, ads: [ad('a1', { spend: 4000, leads: 0 }), ad('a2', { spend: 1200, leads: 30 })],
    }),
  }
  check('spend with nothing to show for it is decidable, not "unknown"',
    v({ type: 'pause_ad', adSetId: 'as1', adId: 'a1' }, dry) !== null)

  // A one-ad campaign has no field to compare against. A comparison with no
  // field is not a finding.
  const alone = adIsProvenWorse(ad('solo', { spend: 9000, leads: 0 }), [ad('solo', { spend: 9000, leads: 0 })])
  check('an ad with no siblings is never "proven worse"', !alone.proven)

  check('an already-paused ad is not an action',
    v({ type: 'pause_ad', adSetId: 'as1', adId: 'a1' }, {
      ...state(),
      adSets: state().adSets.map((x) => x.id !== 'as1' ? x
        : { ...x, ads: [ad('a1', { spend: 1200, leads: 1, status: 'PAUSED' }), ad('a2', { spend: 1200, leads: 30 }), ad('a5', { spend: 800, leads: 12 })] }),
    }) === null)
}

console.log('\n── dropping a placement follows the audit, never the model ──')
{
  // The placement audit compares conversion rates with a significance test and
  // refuses to condemn a young placement. Letting a language model nominate one
  // instead would be a strict downgrade in evidence for the identical write.
  check('a condemned placement the ad set runs is accepted',
    JSON.stringify(v({ type: 'drop_placement', adSetId: 'as1', placement: 'instagram:stream' }))
      === JSON.stringify({ type: 'drop_placement', adSetId: 'as1', placement: 'instagram:stream' }))
  check('a placement the audit did NOT condemn is refused',
    v({ type: 'drop_placement', adSetId: 'as1', placement: 'facebook:feed' }) === null)
  // A write that changes nothing and reports success is worse than a refusal.
  check('a placement the ad set does not run is refused',
    v({ type: 'drop_placement', adSetId: 'as1', placement: 'audience_network' }) === null)
}

console.log('\n── budgets move through the learning guard, not a percentage ──')
{
  // 30% either way is past Meta's ~20% reset line, so the old ±30% clamp
  // APPROVED a learning reset while looking like a safety rail.
  const big = v({ type: 'set_budget', adSetId: 'as1', dailyBudgetAED: 5000 })
  check('a huge ask is taken to the line, not through it',
    !!big && big.type === 'set_budget' && big.dailyBudgetAED === Math.max(MIN_DAILY_AED, safeBudgetStep(200, 5000)),
    JSON.stringify(big))
  check('…and never below Meta\'s delivery floor',
    (() => { const r = v({ type: 'set_budget', adSetId: 'as1', dailyBudgetAED: 1 })
             return r === null || (r.type === 'set_budget' && r.dailyBudgetAED >= MIN_DAILY_AED) })())
  check('a step that lands where it started is not a button',
    v({ type: 'set_budget', adSetId: 'as1', dailyBudgetAED: 200 }) === null)
  check('an unknown ad set id is refused',
    v({ type: 'set_budget', adSetId: 'nope', dailyBudgetAED: 240 }) === null)
}

console.log('\n── status actions match the campaign\'s real status ──')
{
  check('pause is offered only on an ACTIVE campaign',
    v({ type: 'pause_campaign' }) !== null
    && v({ type: 'pause_campaign' }, { ...state(), campaignStatus: 'PAUSED' }) === null)
  check('resume is offered only on a PAUSED campaign',
    v({ type: 'resume_campaign' }, { ...state(), campaignStatus: 'PAUSED' }) !== null
    && v({ type: 'resume_campaign' }) === null)
  check('junk is refused rather than guessed at',
    v(null) === null && v('pause') === null && v({ type: 'delete_everything' }) === null)
}

console.log('\n── the route asks for an action, and can see the ads ──')
{
  const route = readFileSync(join(process.cwd(), 'app/api/freehold/ads/advisor/route.ts'), 'utf8')

  // THE LINE THAT CAUSED THE COMPLAINT. It told the model to make most of its
  // own advice unactionable, and it read as caution rather than as a defect.
  check('the prompt no longer tells the model to withhold actions',
    !/"action":\s*null for most suggestions/.test(route))
  check('the prompt is built from the walkable vocabulary, not a hand-typed list',
    /actionShapeLines\(\)/.test(route))

  // Without per-ad numbers the advisor can only ever describe the average of
  // every creative in the campaign — a number that belongs to none of them.
  check('the advisor fetches each ad\'s own spend and leads',
    /getAdResults\(campaignId\)/.test(route))
  check('the advisor fetches the placement breakdown it validates against',
    /getCampaignInsightsByPlacement\(campaignId\)/.test(route))
  check('the condemned list comes from the deterministic audit',
    /auditPlacements\(/.test(route))

  // Validation happens against fetched state, through the shared module — not
  // against the model's own reply, and not through a second copy of the rules.
  check('validation runs through the shared module',
    /validateAdvisorAction\(s\.action, state, safeBudgetStep\)/.test(route))
  check('the old local validator is gone',
    !/function validateAction\(/.test(route))

  // A failed action must not take the finding with it.
  check('a suggestion survives a failed action, keeping its advice',
    /action: validateAdvisorAction/.test(route)
    && /\.filter\(\(s\) => s\.title && s\.detail\)/.test(route))
}

console.log('\n── the page performs every action it offers ──')
{
  const page = readFileSync(join(process.cwd(), 'app/freehold-intelligence/ads-live/meta/[id]/page.tsx'), 'utf8')
  const accept = page.slice(page.indexOf('async function acceptSuggestion'), page.indexOf('async function syncAdvisor'))

  // An action the server can offer and the page cannot perform is a button
  // that ticks and changes nothing — the failure this whole change removes.
  for (const type of ADVISOR_ACTION_TYPES) {
    check(`accept handles ${type}`, accept.includes(`act.type === '${type}'`), accept.slice(0, 400))
  }
  // Every branch goes through a control the operator already has by hand, so a
  // model's press and a person's press are the same code path.
  check('pausing one ad goes through the page\'s own ad toggle',
    /setAdStatus\(act\.adSetId, act\.adId/.test(accept))
  check('pausing one ad set goes through the page\'s own ad-set toggle',
    /setAdSetStatus\(adSet, 'PAUSED'\)/.test(accept))
  // NOT a targeting write from the page: Meta replaces the whole targeting
  // object, so a naive write deletes the qualifier, the exclusions, the
  // languages and the Advantage opt-out. See lib/meta/placement-write.ts.
  check('dropping a placement goes through the read-back route',
    /proposals\/accept/.test(page) && /kind: 'placementStop'/.test(page))

  // The label IS the promise about what pressing it does to a live campaign.
  check('the button names the act rather than saying "Accept"',
    /lm\.cmd\.advisorDo\.\$\{s\.action\.type\}/.test(page))

  // "you click fix it does nothing": `repairAllLocations` has always written a
  // line per ad set saying what Meta now holds, and ONE of the two buttons
  // offering it never rendered that report. Pressing it spun for a second and
  // then showed nothing, which is indistinguishable from a button that does
  // nothing at all.
  //
  // The rule, stated so it survives the section moving: WHEREVER THE REPAIR IS
  // OFFERED, ITS ANSWER IS SHOWN. Every button that starts the repair must
  // have the report rendered alongside it.
  const offers = page.split('void repairAllLocations()').slice(1)
  check('the repair is offered somewhere', offers.length > 0)
  check('every repair button renders the report of what Meta now holds',
    offers.every((after) => /fixReport\.map/.test(after.slice(0, 1400))),
    `${offers.length} offer(s)`)
}

console.log('\n── one analysis, not two ──')
{
  const route = readFileSync(join(process.cwd(), 'app/api/freehold/ads/advisor/route.ts'), 'utf8')
  const page = readFileSync(join(process.cwd(), 'app/freehold-intelligence/ads-live/meta/[id]/page.tsx'), 'utf8')

  // THE SECOND MODEL IS GONE. /api/freehold/ads/refine ran its own call with
  // its own prompt over metrics posted up FROM THE BROWSER, while the advisor
  // fetched its own from Meta. Two analyses of two copies of the numbers,
  // rendered a centimetre apart, is the machinery for a screen that
  // contradicts itself — and this codebase already carries a note about
  // exactly that happening.
  check('the refiner endpoint is gone',
    !existsSync(join(process.cwd(), 'app/api/freehold/ads/refine/route.ts')))
  check('…and nothing calls it any more',
    !/ads\/refine/.test(page), 'the page still posts to the refiner')
  check('…and the page keeps no second analysis state',
    !/runRefine|refineBusy|setAnalysisText/.test(page))

  // The summary comes back from the SAME call, so it is held to the same
  // evidence rules as the suggestions it sits above.
  check('the summary is produced by the advisor call',
    /"working":\["\.\.\."\],"blocking":\["\.\.\."\]/.test(route), 'the prompt does not ask for it')
  check('…and returned with the suggestions',
    /summary: parsed\.summary/.test(route))
  check('…and parsed by one function, not two',
    /function parseAdvisor\(/.test(route) && !/function parseSuggestions\(/.test(route))

  // One analysis means the halves may not disagree.
  check('the model is told the two halves are one analysis',
    /never let a suggestion contradict the summary above it/.test(route))
  // Padding "working" to balance the columns is how a failing campaign gets a
  // reassuring left-hand column.
  check('…and told not to pad the good column',
    /never pad/.test(route) && /just to balance/.test(route))

  check('the page renders the summary from the advisor',
    /advisor\.summary\.working/.test(page) && /advisor\.summary\.blocking/.test(page))
  // One call, so one spinner. Two busy flags on one button is how a control
  // ends up enabled while half its work is still running.
  check('one button, one busy flag',
    /onClick=\{analyseAll\} disabled=\{advisorBusy\}/.test(page))
}

console.log(failures === 0
  ? '\n✅ advisor actions: the advice can be acted on, and the acts are bounded.'
  : `\n❌ ${failures} advisor-action guard(s) failed`)
process.exit(failures === 0 ? 0 : 1)
