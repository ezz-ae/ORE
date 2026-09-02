/**
 * THE DISTRIBUTION IS THE FINDING, AND AN UNREPORTED RATE IS NOT ZERO — locked.
 *
 * Two asks, one screen.
 *
 * "above the form create lead rate table… 1 2 3 4 5 6 7 8 9 10 this is your
 *  rows and you tell in every rate how many — and connect them in audiences
 *  building."
 *
 * The forms page reported one number for the whole account: an average. An
 * average of ratings is close to meaningless, because two accounts both
 * averaging 5 — one where every lead is a 5, one that is half 10s and half 0s
 * — are opposite businesses, and only the second has anything worth buying
 * more of.
 *
 * "analysis open rate vs registration which will get you lead form conversion
 *  rate."
 *
 * The page counted submissions and nothing else, so a form quietly losing four
 * of every five people who opened it read exactly like one that converted
 * everybody. Those two need opposite decisions and looked identical.
 *
 * Pure — no network, no clock. Runs in `pnpm guards`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  RATING_STEPS, RATING_BAND_IDS, bandOfRating, buildLadder,
  BAND_AUDIENCE, isSeedBand,
} from '../lib/freehold/rating-ladder'
import {
  formOpens, readFunnel, adviseForm, FORM_OPEN_ACTIONS, FUNNEL_VERDICTS,
  MIN_OPENS_TO_JUDGE, LEAKING_BELOW,
} from '../lib/freehold/form-funnel'
import { VALUABLE_RATING, AVOID_RATING } from '../lib/freehold/lead-stages'
import { SEED_SIGNALS, AVOID_SIGNALS } from '../lib/freehold/seed-cohort'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

console.log('\n── every rating is a row, including the ones with nobody in them ──')
{
  const l = buildLadder({ 9: 3, 10: 2, 0: 5 })
  check('eleven rows, 0 to 10', l.rows.length === 11 && RATING_STEPS.length === 11)
  // A gap in the table is a fact about the business; dropping the row hides it.
  check('a rating nobody gave is a zero row, not a missing one',
    l.rows.filter((r) => r.leads === 0).length === 8, String(l.rows.length))
  // Zero is a row. The bottom of the scale is what teaches the machine what to
  // stop buying — "exactly as valuable as knowing what to buy more of".
  check('zero is a row', l.rows[0].rating === 0 && l.rows[0].leads === 5)
  check('the shares add up over rated leads only',
    l.rated === 10 && l.rows.find((r) => r.rating === 0)!.share === 50, String(l.rated))
  check('nothing rated means no mean at all, never a zero',
    buildLadder({}).mean === null && buildLadder({}).rated === 0)
}

console.log('\n── THE FINDING THE AVERAGE HIDES ──')
{
  // Two accounts, same mean, opposite businesses.
  const flat = buildLadder({ 5: 100 })
  const split = buildLadder({ 0: 50, 10: 50 })
  check('both average 5', flat.mean === 5 && split.mean === 5, `${flat.mean} / ${split.mean}`)
  check('…and the ladder tells them apart',
    split.polarised > flat.polarised && split.polarised === 100 && flat.polarised === 0,
    `${flat.polarised} vs ${split.polarised}`)
  // Only the split account has anything to build an audience from.
  check('…because only one of them has leads worth seeding',
    split.byBand.deal === 50 && flat.byBand.deal === 0)
}

console.log('\n── the bands use the thresholds the product already decides by ──')
{
  check('0–2 is avoid', bandOfRating(0) === 'avoid' && bandOfRating(AVOID_RATING) === 'avoid')
  check('3–5 is unsure', bandOfRating(3) === 'unsure' && bandOfRating(5) === 'unsure')
  check('6–7 is good', bandOfRating(VALUABLE_RATING) === 'good' && bandOfRating(7) === 'good')
  check('8–10 is a deal', bandOfRating(8) === 'deal' && bandOfRating(10) === 'deal')
  check('every band is walkable', RATING_BAND_IDS.length === 4)
  check('a nonsense rating claims nothing', bandOfRating(NaN) === 'unsure')
}

console.log('\n── and each band knows which audience it feeds ──')
{
  // A table nobody can act on is a report.
  check('the top bands seed a lookalike',
    isSeedBand('deal') && isSeedBand('good')
    && (SEED_SIGNALS as readonly string[]).includes(BAND_AUDIENCE.deal as string)
    && (SEED_SIGNALS as readonly string[]).includes(BAND_AUDIENCE.good as string))
  check('the bottom band feeds the exclusion list',
    !isSeedBand('avoid')
    && (AVOID_SIGNALS as readonly string[]).includes(BAND_AUDIENCE.avoid as string))
  // A lead nobody could call is not evidence in either direction, and seeding
  // from "we could not tell" hands Meta a cohort defined by our uncertainty.
  check('the middle feeds nothing at all', BAND_AUDIENCE.unsure === null)
}

console.log('\n── an unreported open rate is NOT zero ──')
{
  // Meta has spelled this several ways. Hard-coding one and reporting 0% for
  // every account whose API version differs is how an integration confidently
  // lies — the same reason metaLeadCount keeps a list.
  check('several spellings of "form opened" are accepted', FORM_OPEN_ACTIONS.length >= 3)
  check('…and any of them is read',
    FORM_OPEN_ACTIONS.every((t) => formOpens([{ action_type: t, value: '40' }]) === 40))
  // THE ONE THAT MATTERS. 0% printed over a form that works gets it rewritten
  // for nothing.
  check('opens Meta did not report read as unknown, not none',
    formOpens([{ action_type: 'lead', value: '10' }]) === null
    && formOpens([]) === null && formOpens(undefined) === null)
  check('…and the funnel says so rather than showing a rate',
    readFunnel(null, 12).verdict === 'notReported'
    && readFunnel(null, 12).completion === null)
  // Submissions with no opens means two different windows, not a 0% form.
  check('submissions without opens is not a rate either',
    readFunnel(0, 12).verdict === 'notReported')
}

console.log('\n── a leaking form is named, a young one is not ──')
{
  const leak = readFunnel(200, 40)
  check('a form losing four in five is leaking', leak.verdict === 'leaking', leak.verdict)
  check('…and says roughly how many people it cost', leak.lostToLeak === 160, String(leak.lostToLeak))
  check('a form most people finish is healthy', readFunnel(200, 180).verdict === 'healthy')

  // Below the floor one person changing their mind moves the rate five points
  // and the recommendation would flip week to week.
  check('a form with a handful of opens is too early to judge',
    readFunnel(MIN_OPENS_TO_JUDGE - 1, 1).verdict === 'tooEarly')
  check('…and claims no cost for a leak it has not proven',
    readFunnel(MIN_OPENS_TO_JUDGE - 1, 1).lostToLeak === null)
  check('the leak threshold is stated, not magic',
    LEAKING_BELOW > 0 && LEAKING_BELOW < 1)
  check('every verdict is walkable', FUNNEL_VERDICTS.length === 4)
}

console.log('\n── advice only for a form that is measurably losing people ──')
{
  const healthy = readFunnel(200, 180)
  // Rewriting a working form is a way to break it.
  check('a healthy form is left alone',
    adviseForm(healthy, [0.9, 0.4]).advice === 'none')
  check('…and so is one too young to judge',
    adviseForm(readFunnel(5, 1), [0.9, 0.2]).advice === 'none')

  const leak = readFunnel(200, 40)
  // A long form is a long form; the fix is fewer questions, not a better order.
  check('a long leaking form is told to shorten',
    adviseForm(leak, [0.9, 0.8, 0.7, 0.6, 0.5]).advice === 'shorten')
  // A weak question buried in the middle can be moved.
  check('a weak question later in the form is a reorder',
    (() => { const a = adviseForm(leak, [0.9, 0.2]); return a.advice === 'reorder' && a.questionIndex === 1 })())
  // A weak question that is already first cannot be moved out of the way.
  check('a weak FIRST question can only be dropped',
    adviseForm(leak, [0.2, 0.9]).advice === 'dropQuestion')
  // No question is clearly behind the others → the length is the problem.
  check('evenly answered questions point at length, not one question',
    adviseForm(leak, [0.85, 0.9]).advice === 'shorten')
}

console.log('\n── and the page is laid out the way it was asked for ──')
{
  const page = readFileSync(join(process.cwd(), 'app/freehold-intelligence/lead-machine/forms/page.tsx'), 'utf8')

  // "the table about the question answers is huge and taking space, this must
  // be smaller and not on the top, make it after the forms as a forms
  // analysis." A per-answer breakdown is reference, not headline — you read it
  // once you have found the form you care about.
  const answersAt = page.indexOf("lm.forms.answers.title")
  const formsAt = page.indexOf("lm.forms.allForms")
  const ladderAt = page.indexOf("lm.forms.ladder.title")
  check('the answer analysis sits BELOW the forms list',
    answersAt > formsAt, `answers ${answersAt} vs forms ${formsAt}`)
  check('…and the rate ladder sits ABOVE them',
    ladderAt < formsAt && ladderAt > 0, `ladder ${ladderAt} vs forms ${formsAt}`)

  // Eleven zero rows would be a table that teaches nothing and takes the space
  // the forms need.
  check('the ladder is absent until something is rated',
    /ladder\.rated > 0 &&/.test(page))
  // A gap in the table is a fact about the business.
  check('a rating nobody gave still gets its row',
    /ladder\.rows\.map/.test(page) && !/filter\(\(row\) => row\.leads/.test(page))
  check('it is a real table, not a list of notes',
    /<table/.test(page) && /<thead>/.test(page) && /<tbody>/.test(page))

  // "connect them in audiences building."
  check('each band links into audience building',
    /BAND_AUDIENCE\[b\] !== null/.test(page) && /audiences\?seed=/.test(page))
  check('…and the middle band offers no button',
    /BAND_AUDIENCE\[b\] !== null/.test(page))
  check('…nor does a band with nobody in it', /ladder\.byBand\[b\] > 0/.test(page))

  // The counts come from the whole table, not from one page of forms.
  check('the ladder counts every rated lead in the account',
    /GROUP BY value_rating/.test(page) && /value_rating IS NOT NULL/.test(page))
  check('…and fails soft rather than failing the page',
    /catch \{ return \{\} \}/.test(page))
}

console.log('\n── and the funnel is fed real numbers, from data we own ──')
{
  const page = readFileSync(join(process.cwd(), 'app/freehold-intelligence/lead-machine/forms/page.tsx'), 'utf8')
  const client = readFileSync(join(process.cwd(), 'lib/meta/client.ts'), 'utf8')

  // The actions array was ALREADY being fetched account-wide and everything
  // but the lead count thrown away, so opens cost no extra Meta request.
  check('opens come from the existing account-wide call',
    /formOpens: formOpens\(row\?\.actions/.test(client))
  check('…and the page reads them', /getAccountAdInsights\(\)/.test(page))

  // Meta reports opens per AD. Mapping ads to forms through the Graph is a
  // request per ad; the mapping is already in our own rows.
  check('ads are mapped to forms from our own leads, not another Graph call',
    /SELECT DISTINCT meta_form_id AS form, meta_ad_id AS ad/.test(page))
  check('…and a form whose opens were never reported shows no rate',
    /if \(funnel\.completion === null\) return null/.test(page))

  // Knowing a form leaks says fix it; knowing WHICH question people stop at
  // says how. Without it the only honest advice is "ask less", which is true
  // of every long form and useful about none of them.
  check('the advice is fed real per-question answer rates',
    /adviseForm\(funnel, answeredRates\.get\(form\.id\) \?\? \[\]\)/.test(page))
  check('…computed from the answers already stored on each lead',
    /jsonb_array_elements\(l\.meta_answers\) WITH ORDINALITY/.test(page))
  // A question's ORDER is the whole point: one buried mid-form can be moved,
  // one that is already first can only be dropped.
  check('…preserving the question order', /WITH ORDINALITY AS a\(item, ord\)/.test(page))
  // A question nobody answered is the strongest possible signal about it.
  check('a question nobody answered reads as 0, not as missing',
    /Number\.isFinite\(n\) \? n : 0/.test(page))

  // Only a form measurably losing people is told to change.
  check('advice is shown only on a leaking form',
    /funnel\.verdict === 'leaking' && advice !== 'none'/.test(page))

  // A dictionary entry that exists only to satisfy a checker is not a word.
  const dict = readFileSync(join(process.cwd(), 'lib/i18n/dictionaries/lm_core.ts'), 'utf8')
  check('the advice value that is never rendered has no empty string entry',
    !/'lm\.forms\.funnel\.none'/.test(dict))
}

console.log(failures === 0
  ? '\n✅ the distribution is shown, the audiences are reachable, and an unknown rate stays unknown.'
  : `\n❌ ${failures} forms-analysis guard(s) failed`)
process.exit(failures === 0 ? 0 : 1)
