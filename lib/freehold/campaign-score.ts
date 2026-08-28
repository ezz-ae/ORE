/**
 * SCORING A CAMPAIGN'S LEADS — the arithmetic, with no database under it.
 *
 * This was the middle of `getCampaignQuality`, wrapped in three layers of SQL
 * and a fallback ladder, so the only way to assert any of it was to scan the
 * source for regexes. That is the weakest kind of guard: it proves a file
 * contains a string, not that a campaign with 176 leads and 75 good ratings
 * comes out the right way — and this repository's own rule is that a guard
 * restates the WHY as a runnable assertion.
 *
 * It matters here more than most places. The screenshot that produced this
 * module showed the account's best campaign reported as worthless:
 *
 *     "0 leads worth calling at about AED 8k+ each"
 *     "none has been worked yet, so there is nothing to score"
 *     advisor: "zero CRM quality leads — a severe issue"   [Pause campaign]
 *
 * with 75 of its 176 leads rated 8 or better by a broker. Every one of those
 * three sentences was arithmetic over the wrong count, and none of them could
 * be tested without a Postgres.
 *
 * ── THE TWO JUDGMENTS ────────────────────────────────────────────────────
 *
 * A lead is judged two ways in this product and only one was ever counted:
 *
 *   · THE STATUS COLUMN — somebody dragged the card through the funnel.
 *   · THE 0–10 VALUE RATING — a broker's direct verdict, one click.
 *
 * The product had already settled which counts, in the other direction:
 * `writeBackFor` in lead-stages.ts reports `qualified` to Meta on
 * `rating >= VALUABLE_RATING`. So the optimiser was told these leads were
 * qualified while the operator was told there were none. One rule, two
 * answers, and the wrong one went to the person paying for the ads.
 *
 * Pure — no I/O, no clock. Runs in `pnpm guards`.
 */
import {
  QUALIFIED_STATUSES, VIEWING_STATUSES, WON_STATUSES, VALUABLE_RATING, AVOID_RATING,
} from '@/lib/freehold/lead-stages'

/** One attributed lead, as the read hands it over. */
export interface ScorableLead {
  id: string
  status: string | null
  blocked: boolean | null
  phone: string | null
  behaviour_score: number | null
  value_rating: number | null
  deal_value_aed: string | number | null
}

/**
 * An unusable phone (missing or too short to dial) — the "junk" half of the
 * lost+badPhone signal. Exported for the Ads Machine's suggested verdicts.
 */
export const badPhone = (p: string | null) => !p || p.replace(/\D/g, '').length < 7

/** Everything the score and the funnel are built from. */
export interface QualityCounts {
  attributed: number
  reached: number
  qualified: number
  viewings: number
  won: number
  revenueAed: number
  junk: number
  duplicates: number
  worked: number
  worthCalling: number
  worthCallingByRating: number
  score: number | null
  scoreBasis: 'funnel' | 'ratings' | null
  avgBehaviour: number | null
  behaviourCount: number
  valueRated: number
  avgValue: number | null
  valueValuable: number
  valueAvoid: number
}

export function scoreLeads(rows: readonly ScorableLead[]): QualityCounts {
  const attributed = rows.length
  let reached = 0, qualified = 0, viewings = 0, won = 0, revenueAed = 0
  // Junk is collected as a SET of lead ids, not a counter, because one lead can
  // trip several junk signals at once and must only be counted once.
  const junkIds = new Set<string>()
  for (const r of rows) {
    const s = r.status
    if (s && s !== 'new') reached++
    if (s && QUALIFIED_STATUSES.has(s)) qualified++
    if (s && VIEWING_STATUSES.has(s)) viewings++
    if (s && WON_STATUSES.has(s)) {
      won++
      // Only money against a WON lead counts. A value stamped on a lead that
      // later went cold is a hope, not a receipt.
      const v = Number(r.deal_value_aed ?? 0)
      if (Number.isFinite(v) && v > 0) revenueAed += v
    }
    if (r.blocked || (s === 'lost' && badPhone(r.phone))) junkIds.add(r.id)
  }

  // DUPLICATES. A campaign that delivers the same person twice charged you
  // twice, so it is genuinely worse than its raw lead count suggests — and
  // nothing was counting that. Same rule the CRM's duplicates view uses:
  // leads sharing a normalised phone of 7+ digits, highest-intent kept.
  //
  // One deliberate difference from that view: it hides LOST leads, because a
  // merged duplicate gets marked lost and would otherwise reappear. Scoring
  // must not hide them — the money was spent whether or not someone later
  // tidied the record — so every attributed row counts here.
  const byPhone = new Map<string, string[]>()
  for (const r of rows) {
    const key = (r.phone ?? '').replace(/\D/g, '')
    if (key.length < 7) continue
    byPhone.set(key, [...(byPhone.get(key) ?? []), r.id])
  }
  let duplicates = 0
  for (const ids of byPhone.values()) {
    if (ids.length < 2) continue
    for (const id of ids.slice(1)) { duplicates++; junkIds.add(id) }
  }
  const junk = junkIds.size

  const rate = (n: number) => (attributed > 0 ? n / attributed : 0)

  // Landing-session behaviour — the LEADING signal. CRM outcomes take weeks;
  // how thoroughly the visitors read the page is known within minutes. It gets
  // a bounded ±10-point adjustment (never the driver, outcomes stay dominant),
  // and only with ≥3 scored leads so one session can't swing a campaign.
  const scored = rows.filter((r) => typeof r.behaviour_score === 'number' && r.behaviour_score !== null)
  const behaviourCount = scored.length
  const avgBehaviour = behaviourCount > 0
    ? Math.round(scored.reduce((s, r) => s + (r.behaviour_score as number), 0) / behaviourCount)
    : null
  const behaviourAdj = behaviourCount >= 3 && avgBehaviour !== null
    ? ((avgBehaviour - 50) / 50) * 10
    : 0

  // THE HUMAN JUDGMENT — one-click 0–10 value ratings on the attributed leads.
  // Direct answer to "does this campaign generate good leads": funnel outcomes
  // take weeks, a broker's rating lands the same day. Bounded ±15 adjustment
  // with ≥3 ratings (stronger than behaviour because it IS a judgment, still
  // never the sole driver — outcomes stay dominant).
  const rated = rows.filter((r) => typeof r.value_rating === 'number' && r.value_rating !== null)
  const valueRated = rated.length
  const avgValue = valueRated > 0
    ? Math.round((rated.reduce((s, r) => s + (r.value_rating as number), 0) / valueRated) * 10) / 10
    : null
  const valueValuable = rated.filter((r) => (r.value_rating as number) >= VALUABLE_RATING).length
  const valueAvoid = rated.filter((r) => (r.value_rating as number) <= AVOID_RATING).length
  const valueAdj = valueRated >= 3 && avgValue !== null
    ? ((avgValue - 5) / 5) * 15
    : 0

  // NOBODY HAS TOUCHED THESE LEADS YET, so there is nothing to score.
  //
  // The formula below is built almost entirely out of FUNNEL PROGRESSION, and
  // when nothing has progressed every one of those terms is zero. What came
  // out was a small number — a 7 — printed in large red type next to "25
  // attributed leads", which reads as "this campaign is terrible".
  //
  // It is not. Twenty-five leads that nobody has moved past 'new' is a CRM
  // backlog, and scoring it blames the campaign for the team's queue. On the
  // same screen the advisor was already saying "only 31 of 576 leads have been
  // rated, indicating a significant backlog" — the page was contradicting
  // itself in two boxes an inch apart.
  //
  // So a funnel with no progression at all returns null, exactly as an empty
  // one does. Withheld, not zero: min-evidence.ts states the rule for every
  // other number in this product facing a threshold, and a score is the most
  // consequential number on this page.
  // ── WORTH CALLING: either judgment counts ──────────────────────────────
  // See the field's doc comment. Deduplicated by lead id, because a lead that
  // is both status-qualified and rated 8 is one lead.
  const worthCallingIds = new Set<string>()
  for (const r of rows) {
    const st = r.status
    const rating = typeof r.value_rating === 'number' ? r.value_rating : null
    if ((st && QUALIFIED_STATUSES.has(st)) || (rating !== null && rating >= VALUABLE_RATING)) {
      worthCallingIds.add(r.id)
    }
  }
  const worthCalling = worthCallingIds.size
  const worthCallingByRating = rows.filter((r) =>
    worthCallingIds.has(r.id)
    && !(r.status && QUALIFIED_STATUSES.has(r.status))).length

  // ── A RATING IS WORK ───────────────────────────────────────────────────
  //
  // `worked` decides whether the score is withheld, and it counted only status
  // movement. So a broker rating seventy-five leads moved this number not at
  // all, and the page said "none has been worked yet — there is nothing to
  // score" directly above seventy-five judgments. Looking at a lead and
  // deciding what it is worth is the most deliberate act in the CRM; it is not
  // an untouched queue.
  const workedIds = new Set<string>()
  for (const r of rows) {
    const st = r.status
    if ((st && st !== 'new') || junkIds.has(r.id) || typeof r.value_rating === 'number') {
      workedIds.add(r.id)
    }
  }
  const worked = workedIds.size

  /**
   * TWO SIGNALS, AND THE SCORE USES WHICHEVER EXIST.
   *
   * The old formula was built entirely out of funnel rates with the rating as a
   * ±15 nudge on top. That is right when the funnel has moved. When it has not,
   * every rate term is zero and the nudge is applied to nothing: a campaign
   * whose leads average 8/10 scored 9 out of 100. The adjustment could only
   * help in the case where it was least needed.
   *
   * So the two are scored independently and combined by what is actually
   * known. Outcomes outrank opinions where both exist — a closed deal is worth
   * more than a good feeling about a lead — but an opinion outranks silence.
   */
  const funnelScore = worked === 0 ? null : Math.max(0, Math.min(100,
    rate(reached) * 20 + rate(qualified) * 35 + rate(won) * 45 - rate(junk) * 20 + behaviourAdj))
  // The rating is already a 0–10 verdict on lead value; 8/10 is 80, not 9.
  const ratingScore = valueRated >= 3 && avgValue !== null
    ? Math.max(0, Math.min(100, avgValue * 10))
    : null
  // Did the funnel itself move, or is `worked` carried entirely by ratings?
  const funnelMoved = reached + qualified + won + junk > 0

  const scoreBasis: QualityCounts['scoreBasis'] =
    attributed === 0 ? null
      : funnelMoved && funnelScore !== null ? 'funnel'
        : ratingScore !== null ? 'ratings'
          : null
  const score = attributed === 0 ? null
    : funnelMoved && funnelScore !== null
      // Both: the funnel leads, the rating adjusts it as before.
      ? Math.round(Math.max(0, Math.min(100, funnelScore + valueAdj)))
      : ratingScore !== null
        // Ratings only: they ARE the answer, at full weight.
        ? Math.round(ratingScore)
        : null


  return {
    attributed, reached, qualified, viewings, won, revenueAed, junk, duplicates,
    worked, worthCalling, worthCallingByRating, score, scoreBasis,
    avgBehaviour, behaviourCount, valueRated, avgValue, valueValuable, valueAvoid,
  }
}
