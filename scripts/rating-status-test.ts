/**
 * A RATING MOVES THE LEAD, AND MOVES IT NO FURTHER THAN IT MAY — locked.
 *
 * "let the rate shift the lead — it seems freehold are okay with rating and
 *  that's it — so better we shift the lead status according to their rate."
 *
 * The observation behind it is correct and was costing the account real money.
 * Rating is one click; dragging a card through six columns is not. So this
 * team rates and does not drag, the status column sat at 'new' across the
 * whole business, and the follow-up queue, the team metrics, the money ladder
 * and the campaign funnel all read that column and reported a business that
 * had done nothing.
 *
 * The product had already made this exact judgment call in the other
 * direction: `writeBackFor` reports `qualified` to Meta on
 * `rating >= VALUABLE_RATING`. The CRM simply never agreed with its own rule.
 *
 * ── BUT AN AUTOMATION THAT MOVES LEADS CAN INVENT A BUSINESS ─────────────
 *
 * Which is why half of this file is about what a rating may NOT do. A rating
 * that could push a lead to 'converted' would put fictional deals in the
 * funnel — the failure this codebase spends most of its guards preventing,
 * arriving through a helpful automation instead of a model. These are the
 * bounds, asserted by running the rule rather than by reading it.
 *
 * Pure — no I/O. Runs in `pnpm guards`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  statusForRating, needsRating, rankOf, FUNNEL_ORDER, TERMINAL_STATUSES,
  RATING_STATUS_CEILING, STATUSES_ACCOUNTED_FOR,
} from '../lib/freehold/rating-status'
import {
  VALUABLE_RATING, AVOID_RATING, DEAL_RATING, LEAD_STATUSES, writeBackFor,
} from '../lib/freehold/lead-stages'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

console.log('\n── the rating advances the lead ──')
{
  check('a good rating on a new lead qualifies it',
    statusForRating(VALUABLE_RATING, 'new') === 'qualified',
    String(statusForRating(VALUABLE_RATING, 'new')))
  check('…and on a contacted one',
    statusForRating(8, 'contacted') === 'qualified')
  check('…and a perfect rating does the same, not more',
    statusForRating(DEAL_RATING, 'new') === 'qualified',
    String(statusForRating(DEAL_RATING, 'new')))

  // The CRM now agrees with what the write-back has always told Meta.
  check('the threshold is the one already reported to Meta',
    writeBackFor({ status: 'new', valueRating: VALUABLE_RATING }).stage === 'qualified'
    && statusForRating(VALUABLE_RATING, 'new') === 'qualified')
  check('…and one point below it moves nothing, on both sides',
    writeBackFor({ status: 'new', valueRating: VALUABLE_RATING - 1 }).stage === null
    && statusForRating(VALUABLE_RATING - 1, 'new') === null)
}

console.log('\n── and it may not invent a business ──')
{
  // THE ONE THAT MATTERS MOST. A rating says the lead is worth pursuing. It
  // does not say anyone went to a viewing, opened a negotiation or closed.
  for (const beyond of ['viewing', 'negotiation', 'converted', 'closed']) {
    check(`a rating never pushes past qualified (${beyond} stays)`,
      statusForRating(DEAL_RATING, beyond) === null,
      String(statusForRating(DEAL_RATING, beyond)))
  }
  check('the ceiling is qualified, stated once',
    RATING_STATUS_CEILING === 'qualified')

  // FORWARD ONLY. Status records work that was done; a rating cannot undo it,
  // and a system that could would lose a viewing to a re-rating.
  check('a re-rating never drags a lead backwards',
    statusForRating(6, 'negotiation') === null && statusForRating(10, 'viewing') === null)
  check('…including at the ceiling itself, which is not rewritten',
    statusForRating(9, 'qualified') === null)

  // A lead somebody marked lost is not quietly reopened by a rating.
  for (const t of TERMINAL_STATUSES) {
    check(`a ${t} lead is not reopened by a rating`, statusForRating(10, t) === null)
  }

  // 0–2 is AVOID_RATING and lead-stages is explicit that it means "stop buying
  // this" — a verdict on the AUDIENCE for the exclusion list, not "this person
  // will never buy". Closing a lead is a decision about a human being.
  check('a bad rating closes nothing', statusForRating(AVOID_RATING, 'new') === null)
  check('…not even a zero', statusForRating(0, 'new') === null)
  // 3–5 forecasts nothing (it earns nothing in points.ts for the same reason).
  check('the middle band says nothing, so it moves nothing',
    [3, 4, 5].every((r) => statusForRating(r, 'new') === null))

  check('junk input moves nothing',
    statusForRating(null, 'new') === null
    && statusForRating(undefined, 'new') === null
    && statusForRating(NaN, 'new') === null)
  // An unrecognised status is left alone rather than guessed at.
  check('an unknown status is left where it is',
    statusForRating(10, 'something_else') === null)
}

console.log('\n── the ladder is complete and lost is not the top of it ──')
{
  check('every lead status is on the ladder or explicitly terminal',
    STATUSES_ACCOUNTED_FOR, LEAD_STATUSES.join(','))
  // Ranking 'lost' by LEAD_STATUSES order would make it the furthest along —
  // immune to every forward move and reading as better than a closed deal.
  check('lost is not on the progress ladder', rankOf('lost') === -1)
  check('…and closed is the far end of it',
    rankOf('closed') === FUNNEL_ORDER.length - 1)
  check('the ladder runs in funnel order',
    rankOf('new') < rankOf('contacted')
    && rankOf('contacted') < rankOf('qualified')
    && rankOf('qualified') < rankOf('viewing'))
}

console.log('\n── moving a lead does NOT invent a rating ──')
{
  // A status is what was done; a rating is what somebody thinks. Deriving one
  // from the other would manufacture a broker's opinion and feed it to the ad
  // machine as though a person had given it.
  check('an advanced lead with no rating is flagged, not scored',
    needsRating('qualified', null) && needsRating('negotiation', undefined))
  check('…and one that has been rated is not chased again',
    !needsRating('qualified', 3) && !needsRating('closed', 10))
  // Only where the answer is worth the most: somebody moved it on purpose.
  check('an untouched lead is not chased for a rating',
    !needsRating('new', null) && !needsRating('contacted', null))
  check('…nor a lost one', !needsRating('lost', null))
  // Zero is a real rating, not a missing one — the whole point of the bottom
  // of the scale is that it teaches the machine what to stop buying.
  check('a rating of 0 counts as rated', !needsRating('qualified', 0))
}

console.log('\n── it happens on the one write path, and leaves a history ──')
{
  const write = readFileSync(join(process.cwd(), 'lib/freehold/crm-write.ts'), 'utf8')
  check('the shared lead write applies it',
    /statusForRating\(Number\(body\.value_rating\), cur\?\.status \?\? null\)/.test(write))
  // Through `body`, so logPatchActivity writes the stage entry and the
  // movement email fires exactly as a manual move does — an automatic move
  // nobody can see in the timeline is a lead that changed by itself.
  check('…by setting the status on the patch, so the timeline records it',
    /if \(moved\) body\.status = moved/.test(write))
  // A caller's object must not change under it.
  check('…on a copy, never the caller\'s object',
    /const body: Record<string, unknown> = \{ \.\.\.patch \}/.test(write))
  // An explicit status in the same request is the person's own decision.
  check('an explicit status in the same request wins',
    /'value_rating' in body && !\('status' in body\)/.test(write))
  // The rating is the signal; a status it could not derive is not worth
  // losing the rating over.
  check('a failed status read still lets the rating land',
    /catch \{[\s\S]{0,220}\}/.test(write.slice(write.indexOf('statusForRating'))))

  const tools = readFileSync(join(process.cwd(), 'lib/freehold/coordinator-tools.ts'), 'utf8')
  check('the chat is told the rating also advances the lead',
    /ALSO moves the lead to qualified/.test(tools))
  check('…and can list who was advanced without being rated',
    /name: 'crm_unrated_leads'/.test(tools))
  check('…and is told to ask rather than guess the rating',
    /never guess a rating yourself/.test(tools))
}

console.log(failures === 0
  ? '\n✅ a rating advances the lead, and cannot invent a business.'
  : `\n❌ ${failures} rating-status guard(s) failed`)
process.exit(failures === 0 ? 0 : 1)
