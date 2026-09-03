/**
 * THE LOOP CLOSES, OR THE SYSTEM IS A SPREADSHEET — locked.
 *
 * "the intent level is decoration and means nothing, now its 50 for everyone
 *  and never calculated… the rate seems like kpi not effecting the spend or
 *  the target… no quality analysis for lead on arrival. a good system will
 *  analyse from which interest or behaviour we got this lead and give an
 *  expected quality level, then compare the expectation with the team rate and
 *  feed the ads. this is the loop that makes this system smarter."
 *
 * Both halves were missing and each made the other pointless. `intentScore`
 * was a four-way lookup off `temperature` (90/75/55/30), so nothing predicted
 * anything; and with no prediction, a broker's rating had nothing to be
 * checked against, so it could only ever be a number on a card.
 *
 * A forecast nobody checks is astrology. A rating nobody forecast against is
 * bookkeeping. These assertions pin the two together — and pin the three ways
 * the pairing could quietly go wrong: predicting when it knows nothing,
 * calling "less bad than feared" a reason to spend more, and moving money on
 * a sample too small to mean anything.
 *
 * Pure — no clock, no I/O. Runs in `pnpm guards`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { dbLeadToCRM } from '../lib/freehold/crm-row'
import {
  forecastLead, calibrate, forecastAccuracy,
  FORECAST_REASONS, CALIBRATION_VERDICTS,
  MIN_RATED_FOR_HISTORY, MIN_RATED_FOR_CALIBRATION, CALIBRATION_TOLERANCE,
  undialable, suspectEmail,
  type ArrivalFacts, type RatedLead,
} from '../lib/freehold/lead-forecast'
import { VALUABLE_RATING } from '../lib/freehold/lead-stages'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const f = (o: ArrivalFacts = {}): ArrivalFacts => ({ phone: '+971501234567', ...o })

console.log('\n── it says "I do not know", which the old number never did ──')
{
  // THE CORRECTION. The value this replaces was always present and always
  // meaningless — 50 for everyone, computed from nothing.
  const blank = forecastLead(f())
  check('a lead with nothing known is withheld, not scored',
    blank.expected === null, String(blank.expected))
  check('…and says its confidence is none', blank.confidence === 'none')
  check('…and cites no reasons it does not have', blank.because.length === 0)

  // Not 5 either: the middle of the scale is a claim that the lead is average.
  check('withheld is null, never a neutral 5', forecastLead(f()).expected !== 5)
}

console.log('\n── the dominant term is what this source ALREADY produced ──')
{
  // This is the carry from campaign N into N+1, and it is empirical: nobody
  // tunes it, the brokers' own ratings move it.
  const good = forecastLead(f({ sourceHistory: { rated: 20, meanRating: 8 } }))
  check('a source that has produced good leads forecasts good ones',
    good.expected !== null && good.expected >= 7.5, String(good.expected))
  check('…and cites the history', good.because.includes('sourceHistory'))
  check('…with confidence from the SAMPLE, not the strength of the opinion',
    good.confidence === 'high', good.confidence)

  const bad = forecastLead(f({ sourceHistory: { rated: 20, meanRating: 2 } }))
  check('a source that has produced junk forecasts junk',
    bad.expected !== null && bad.expected <= 3, String(bad.expected))

  // One broker's Tuesday must not decide what the machine believes about an ad.
  const thin = forecastLead(f({ sourceHistory: { rated: MIN_RATED_FOR_HISTORY - 1, meanRating: 10 } }))
  check('a source with one or two ratings does not get an opinion',
    thin.expected === null, String(thin.expected))
}

console.log('\n── behaviour and effort adjust, contactability dominates ──')
{
  const read = forecastLead(f({ behaviourScore: 90 }))
  check('somebody who read the page deeply forecasts above the middle',
    read.expected !== null && read.expected > 5 && read.because.includes('readDeeply'),
    String(read.expected))
  const skim = forecastLead(f({ behaviourScore: 10 }))
  check('somebody who bounced forecasts below it',
    skim.expected !== null && skim.expected < 5 && skim.because.includes('skimmed'),
    String(skim.expected))

  // History leads, behaviour adjusts — a single session must not overturn
  // twenty ratings.
  const both = forecastLead(f({ sourceHistory: { rated: 20, meanRating: 8 }, behaviourScore: 20 }))
  check('one bad session does not overturn a strong history',
    both.expected !== null && both.expected > 5, String(both.expected))

  // A lead nobody can reach is worth nothing whatever the ad said.
  const dead = forecastLead(f({ phone: '123', sourceHistory: { rated: 50, meanRating: 9 } }))
  check('an undialable number overrides even an excellent source',
    dead.expected !== null && dead.expected <= 2 && dead.because.includes('undialable'),
    String(dead.expected))
  check('undialable is the same rule the quality read uses',
    undialable('12') && !undialable('+971501234567'))
  check('a throwaway email is a negative, not a veto',
    suspectEmail('a@mailinator.com') && suspectEmail('not-an-email')
    && !suspectEmail('buyer@gmail.com'))

  check('every reason is walkable', FORECAST_REASONS.length === 7)
}

console.log('\n── AND THE COMPARISON THAT CLOSES IT ──')
{
  const rows = (n: number, forecast: number, actual: number, source = 'ad1'): RatedLead[] =>
    Array.from({ length: n }, () => ({ source, forecast, actual }))

  // Rated better than predicted, and genuinely good → buy more of it. This is
  // the instruction the next campaign reads.
  const under = calibrate(rows(10, 5, 8))[0]
  check('a source rated better than forecast is under-bought',
    under.verdict === 'underBought', under.verdict)
  check('…and reports the gap it acted on', under.gap === 3, String(under.gap))

  const over = calibrate(rows(10, 8, 4))[0]
  check('a source rated worse than forecast is over-bought', over.verdict === 'overBought', over.verdict)

  // THE SAFEGUARD. A source can beat a dismal forecast and still produce
  // leads nobody wants. "Less bad than expected" must never read as
  // "buy more" — that is how a system talks itself into funding junk.
  const lessBad = calibrate(rows(10, 1, 4))[0]
  check('beating a terrible forecast is NOT a reason to spend more',
    lessBad.verdict !== 'underBought', `${lessBad.verdict} gap ${lessBad.gap}`)
  check('…because the actual rating never cleared the valuable line',
    lessBad.worthMore === false && VALUABLE_RATING > 4)

  // Two brokers disagreeing about the same lead is not a fact about the ad.
  const noise = calibrate(rows(10, 6, 6 + CALIBRATION_TOLERANCE - 0.5))[0]
  check('a difference inside tolerance is on target', noise.verdict === 'onTarget', noise.verdict)

  // Believing a source is under-bought and spending more is a decision with a
  // cost, so it waits for a sample.
  const thin = calibrate(rows(MIN_RATED_FOR_CALIBRATION - 1, 4, 9))[0]
  check('a strong signal on a thin sample is too early, not acted on',
    thin.verdict === 'tooEarly', thin.verdict)

  check('every verdict is walkable', CALIBRATION_VERDICTS.length === 4)

  // Loudest first: the biggest miss is the thing to act on.
  const mixed = calibrate([...rows(10, 5, 5.2, 'quiet'), ...rows(10, 3, 9, 'loud')])
  check('the biggest miss is reported first', mixed[0].source === 'loud', mixed[0].source)

  // A lead with no forecast cannot be compared — excluded rather than counted
  // as a zero, which would drag every source it touched.
  check('unforecast leads are excluded, not treated as zero',
    calibrate([{ source: 'x', forecast: null, actual: 10 }]).length === 0)
}

console.log('\n── and the forecast is held to account too ──')
{
  // If the forecast is not measuring the world, nothing built on it should
  // move money — so the error is computed and shown, never assumed.
  const acc = forecastAccuracy([
    { source: 'a', forecast: 8, actual: 8 },
    { source: 'a', forecast: 6, actual: 7 },
  ])
  check('the mean absolute error is reported', acc.meanAbsoluteError === 0.5, String(acc.meanAbsoluteError))
  check('…with the sample it rests on', acc.rated === 2)
  // A bound, not a bare count — the rule the rest of this product decides by.
  check('…and a bound on that sample', acc.atLeast >= 0 && acc.atLeast <= acc.rated)
  check('no rated leads means no accuracy claim',
    forecastAccuracy([]).meanAbsoluteError === null)
}

console.log('\n── nothing here reads nationality or origin ──')
{
  // The line this product does not cross, asserted rather than remembered.
  // See lib/freehold/audience-pattern.ts.
  const src = readFileSync(join(process.cwd(), 'lib/freehold/lead-forecast.ts'), 'utf8')
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  check('the forecast reads no nationality, origin or expat signal',
    !/nationalit|expat|origin|home_?country|ethnic/i.test(code))
  check('…and its inputs are behaviour, contactability and measured results',
    /behaviourScore/.test(code) && /sourceHistory/.test(code) && /undialable/.test(code))
}

console.log('\n── and it is WIRED, not another module nobody calls ──')
{
  const route = readFileSync(join(process.cwd(), 'app/api/freehold/crm/leads/route.ts'), 'utf8')
  const code = route.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

  // THE FOUR-WAY LOOKUP IS GONE. It read the row's own temperature and
  // returned 90/75/55/30, so every screen showed a number computed from
  // nothing.
  // ASSERTED BY RUNNING THE MAPPER. These three were regexes over the route
  // file and broke the day the mapper moved to lib/freehold/crm-row.ts, with
  // the wiring perfectly intact — a guard that fails on a move and would pass
  // on a rewrite is pinned to the wrong thing. The question is not "does the
  // file contain a call"; it is "does the number on the row respond to the
  // evidence", and only running it can answer that.
  const lead = (over: Partial<Parameters<typeof dbLeadToCRM>[0]> = {}, history?: Map<string, { rated: number; meanRating: number }>) =>
    dbLeadToCRM({
      id: 'l1', name: 'A', phone: '+971500000001', email: null, source: 'meta',
      project_slug: null, assigned_broker_id: null, status: 'new', priority: 'warm',
      created_at: new Date().toISOString(), last_contact_at: null, country: null,
      budget_aed: null, interest: null, message: null, landing_slug: null,
      updated_at: null, snooze_until: null, lead_code: null,
      duplicate_dismissed_at: null, utm_id: null, utm_campaign: null,
      value_rating: null, behaviour_score: null, meta_ad_id: 'ad1',
      meta_form_name: null, meta_ad_name: null, archived: false, blocked: false,
      ...over,
    }, undefined, new Map(), new Map(), new Map(), history)

  // THE FOUR-WAY LOOKUP IS GONE. It read the row's own temperature and
  // returned 90/75/55/30, so every screen showed a number computed from
  // nothing — and the row's temperature is derived from the same row.
  check('the temperature lookup no longer sets intent',
    lead({ priority: 'hot' }).intentScore === lead({ priority: 'cold' }).intentScore,
    `hot=${lead({ priority: 'hot' }).intentScore} cold=${lead({ priority: 'cold' }).intentScore}`)

  const strong = new Map([['ad1', { rated: 12, meanRating: 9 }]])
  const weak = new Map([['ad1', { rated: 12, meanRating: 2 }]])
  check('the CRM scores leads with the forecast',
    lead({}, strong).intentScore > lead({}, weak).intentScore,
    `strong=${lead({}, strong).intentScore} weak=${lead({}, weak).intentScore}`)

  check('…reading behaviour, contactability and the ad history',
    lead({ behaviour_score: 90 }, strong).intentScore > lead({ behaviour_score: 5 }, strong).intentScore
    && lead({ phone: '123' }, strong).intentScore < lead({}, strong).intentScore,
    `behaviour ${lead({ behaviour_score: 90 }, strong).intentScore}/${lead({ behaviour_score: 5 }, strong).intentScore}`
    + ` · undialable ${lead({ phone: '123' }, strong).intentScore}/${lead({}, strong).intentScore}`)

  // The carry from campaign N into N+1 lives in ONE reader now — the CRM
  // forecast and the campaign advisor must not be able to disagree about the
  // same ad on the same day. A number that means one thing on the leads screen
  // and another on the campaign screen is worse than no number, because both
  // look authoritative.
  const reader = readFileSync(join(process.cwd(), 'lib/freehold/ad-ratings.ts'), 'utf8')
  const readerCode = reader.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  check('the ad history is measured from real ratings',
    /AVG\(value_rating\)/.test(readerCode) && /GROUP BY meta_ad_id/.test(readerCode))
  check('…across every rated lead, not one page or one campaign',
    /value_rating IS NOT NULL/.test(readerCode) && !/utm_id|campaign_id/.test(readerCode))
  check('…and resolved once per request, not per row',
    (code.match(/await sourceHistoryByAd\(\)/g) ?? []).length === 1)
  check('both readers of an ad\'s record share it',
    /from '@\/lib\/freehold\/ad-ratings'/.test(route)
    && /from '@\/lib\/freehold\/ad-ratings'/.test(
      readFileSync(join(process.cwd(), 'app/api/freehold/ads/advisor/route.ts'), 'utf8')))

  // A missing history is a weaker forecast, never a failed CRM.
  check('no history fails soft', /catch \{[\s\S]{0,200}\}\s*\n\s*return out/.test(reader))
  // The forecast reads it, so a workspace that never scored a session must
  // not 500 the whole list.
  check('the column it reads is ensured before the read',
    /ADD COLUMN IF NOT EXISTS behaviour_score int/.test(code))
}

console.log('\n── AND THE PREDICTION IS REMEMBERED, OR NOTHING CAN BE GRADED ──')
{
  // The link that was missing. forecastLead predicted, calibrate compared —
  // and nothing ever wrote a forecast down, so no (predicted, actual) pair had
  // ever existed and calibrate was called by nothing but this file.
  const db = readFileSync(join(process.cwd(), 'lib/freehold/forecast-db.ts'), 'utf8')
  const dbCode = db.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

  check('a forecast is written to its own row', /INSERT INTO freehold_lead_forecasts/.test(dbCode))
  // THE INTEGRITY OF THE WHOLE THING. Recomputing later would read the ad's
  // history as it is NOW — which by then contains this lead's own rating — so
  // the forecast would drift toward the answer it is judged against, the
  // measured error would shrink on its own, and the system would report itself
  // getting cleverer while learning nothing.
  check('…once, and never overwritten',
    /ON CONFLICT \(lead_id\) DO NOTHING/.test(dbCode), 'a later write could rewrite the call')
  check('…keyed one row per lead', /lead_id\s+text PRIMARY KEY/.test(dbCode))

  // "We could not say" is honest and is also not a prediction. Storing it
  // would let a system that knows nothing about most of its leads report a
  // flattering accuracy on the few it does.
  check('a withheld forecast is not stored as one',
    /if \(f\.expected === null\) return/.test(dbCode))

  // The pairs, and the honesty check on them.
  check('the pairs are read by joining forecasts to ratings',
    /JOIN freehold_site_leads/.test(dbCode) && /value_rating IS NOT NULL/.test(dbCode))
  check('the loop reports its own accuracy, not just its verdicts',
    /forecastAccuracy\(pairs\)/.test(dbCode) && /calibrate\(pairs\)/.test(dbCode))
  // A lead must never fail to arrive because its forecast could not be stored.
  check('storing a forecast can never cost a lead', /catch \{/.test(db))

  const sync = readFileSync(join(process.cwd(), 'lib/freehold/meta-lead-sync.ts'), 'utf8')
  check('the forecast is recorded when the lead ARRIVES',
    /rememberForecast\(inserted\[0\]\.id/.test(sync))
  check('…with what that ad had produced BEFORE this lead',
    /sourceHistory: adKey \? \(adHistory\.get\(adKey\)/.test(sync))
  // Per sweep, not per lead — the number cannot change mid-sweep.
  check('…and the history is read once per sweep',
    (sync.match(/await adRatings\(\)/g) ?? []).length === 1)
  check('…fire-and-forget, so the sync cannot fail on it',
    /void rememberForecast\(/.test(sync))

  // calibrate() had no caller outside its own test. Now it has one.
  const advisor = readFileSync(join(process.cwd(), 'app/api/freehold/ads/advisor/route.ts'), 'utf8')
  check('the advisor reads the loop status', /loopStatus\(\)/.test(advisor))
  check('…and is given the accuracy beside the verdicts',
    /forecastAccuracy: loop\.accuracy/.test(advisor))
  // A forecast that is not measuring the world must not move money.
  check('…and told not to act on calibration when the forecast is inaccurate',
    /the calibration is not a reason to move money/.test(advisor))
}

console.log(failures === 0
  ? '\n✅ the forecast is checked against the rating, and the gap is the instruction.'
  : `\n❌ ${failures} lead-forecast guard(s) failed`)
process.exit(failures === 0 ? 0 : 1)
