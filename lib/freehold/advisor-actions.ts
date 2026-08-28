/**
 * WHAT THE ADVISOR IS ALLOWED TO DO, AND HOW EACH ONE IS PROVEN SAFE.
 *
 * The advisor shipped able to propose three things: pause the campaign, resume
 * it, set an ad set's budget. Its prompt then told the model `"action": null
 * for most suggestions`. The result was a page of advice nobody could act on —
 * every finding arriving with a Discuss button and nothing else, which is a
 * report, not an operator's console. The operator's verdict was exact: "so
 * many boxes of AI and none of them affective".
 *
 * Meanwhile the campaign page itself could already pause an individual ad,
 * pause an ad set, move budget and drop a placement — each with its own safety
 * checks, each written and tested. The advisor could reach none of them. The
 * gap was not caution; it was vocabulary.
 *
 * ── THE RULE THAT DECIDES WHAT GOES IN THIS FILE ─────────────────────────
 *
 * An action belongs here when all three hold:
 *
 *   1. THE SYSTEM ALREADY DOES IT, through a path a person can trigger by hand
 *      today. Nothing new is being trusted to a model — the model chooses
 *      among moves the operator already had.
 *   2. IT IS REVERSIBLE. Pausing un-pauses; a budget goes back; a placement
 *      can be re-added. Nothing here deletes, launches or spends beyond a
 *      bounded step.
 *   3. IT CAN BE VALIDATED AGAINST FETCHED STATE. Every action is re-checked
 *      server-side against what Meta actually returned — an unknown id, an ad
 *      already paused, a placement the ad set does not run, all reject. The
 *      model proposes; the fetched state disposes.
 *
 * What is deliberately NOT here: creating anything, changing an audience,
 * editing creative, raising budget past the learning step. Those are real
 * decisions with no cheap undo, and they belong in a screen where a person is
 * looking at the thing they are changing.
 *
 * ── THE MODEL NEVER SUPPLIES THE EVIDENCE ────────────────────────────────
 *
 * This is the half that keeps a wider vocabulary from becoming a wider blast
 * radius. The two destructive actions are gated on arithmetic done HERE, from
 * fetched numbers, and the model's own reasoning is not part of the test:
 *
 *   · pause_ad fires only when the ad's cost-per-lead LOWER bound is above the
 *     rest of the campaign's UPPER bound — proven worse, not merely behind.
 *     The same one-sided bound the rest of this product decides on
 *     (min-evidence.ts). An ad that is cheap and unlucky survives; an ad that
 *     has burned three times the campaign's cost per lead does not.
 *   · drop_placement fires only for a placement the DETERMINISTIC placement
 *     audit already condemned. That audit compares conversion rates with a
 *     significance test and refuses to condemn a young placement; letting a
 *     language model nominate one instead would be a strict downgrade in
 *     evidence for the same write.
 *
 * So a model that hallucinates a losing ad gets nothing: the numbers refuse
 * it. A model that spots a real one gets a button, because the numbers agree.
 *
 * Pure — no network. Runs in `pnpm guards`.
 */
import { costRange } from '@/lib/freehold/min-evidence'

/** Walkable — every action the advisor may propose. */
export const ADVISOR_ACTION_TYPES = [
  'set_budget', 'pause_campaign', 'resume_campaign', 'pause_ad', 'pause_adset', 'drop_placement',
] as const
export type AdvisorActionType = (typeof ADVISOR_ACTION_TYPES)[number]

export type AdvisorAction =
  | { type: 'set_budget'; adSetId: string; dailyBudgetAED: number }
  | { type: 'pause_campaign' }
  | { type: 'resume_campaign' }
  /** Stop one ad. The ad set keeps learning; only the losing creative stops. */
  | { type: 'pause_ad'; adSetId: string; adId: string }
  /** Stop one ad set. Its siblings keep running. */
  | { type: 'pause_adset'; adSetId: string }
  /** Remove one placement from an ad set that currently runs it. */
  | { type: 'drop_placement'; adSetId: string; placement: string }

/** One ad, with the money and the results it actually has. */
export interface AdvisorAd {
  id: string
  name: string
  status: string | null
  /** AED, lifetime — the same window the designs report judges on. */
  spend: number
  leads: number
}

export interface AdvisorAdSet {
  id: string
  status: string | null
  /** AED per day, already converted from Meta's minor units. */
  dailyBudgetAED: number
  /** The placements this ad set actually runs, as `placementKeys` reads them. */
  placements: string[]
  /**
   * The subset of `placements` the placement audit condemned — its `cut` list,
   * intersected with what this ad set runs. Computed before the model is
   * called and never taken from it.
   */
  condemnedPlacements: string[]
  ads: AdvisorAd[]
}

/** The fetched state an action is checked against. Only what Meta returned. */
export interface AdvisorState {
  campaignStatus: string | null
  adSets: AdvisorAdSet[]
}

/**
 * How far one budget step may move.
 *
 * Injected rather than imported so this module stays free of the Meta client —
 * the caller passes the same `safeBudgetStep` the manual control uses, which
 * is what keeps a model's ask and a person's ask on identical rails.
 */
export type BudgetStep = (current: number, proposed: number) => number

/** Meta's floor. Below this an ad set cannot deliver at all. */
export const MIN_DAILY_AED = 50

/**
 * Spend an ad must have taken before it can be judged at all.
 *
 * Below this the cost bound is so wide that every ad "could" be terrible, and
 * the arithmetic below would happily condemn a creative that has been live for
 * four hours. It is a floor on ATTENTION, not on statistics — the bound test
 * does the deciding, this only stops it being asked a question it cannot
 * usefully answer.
 */
export const MIN_AD_SPEND_TO_JUDGE = 200

/**
 * A LAST AD OR A LAST AD SET IS NEVER PAUSED BY A SUGGESTION.
 *
 * Pausing the only live ad stops the campaign without saying so — the campaign
 * still reads ACTIVE while delivering nothing, which is precisely the state
 * this product spent a week making legible. Stopping everything is a decision
 * with its own button and its own confirmation; it is not something to arrive
 * at by accepting a tip about one creative.
 */
export const liveAds = (s: AdvisorState, adSetId: string): number =>
  (s.adSets.find((a) => a.id === adSetId)?.ads ?? []).filter((a) => a.status === 'ACTIVE').length

export const liveAdSets = (s: AdvisorState): number =>
  s.adSets.filter((a) => a.status === 'ACTIVE').length

/**
 * IS THIS AD PROVEN WORSE THAN THE REST OF ITS CAMPAIGN?
 *
 * The one-sided comparison this product uses everywhere: the ad's cheapest
 * credible cost per lead against the rest of the campaign's dearest credible
 * one. Only when the ad's FLOOR is above the field's CEILING have the two
 * genuinely separated — anything less is a ranking, and pausing on a ranking
 * retires whichever creative happened to be unlucky this week.
 *
 * Zero leads is not excluded. `costRange` turns "AED 900 and nothing to show
 * for it" into a real lower bound, which is the case an operator most wants
 * caught and the one a point estimate cannot express at all.
 *
 * Returns the two bounds as well as the verdict so the caller can put the
 * actual numbers in front of the person pressing the button.
 */
export function adIsProvenWorse(ad: AdvisorAd, siblings: readonly AdvisorAd[]): {
  proven: boolean
  adCplLo: number
  restCplHi: number
} {
  const rest = siblings.filter((s) => s.id !== ad.id)
  const restSpend = rest.reduce((n, s) => n + s.spend, 0)
  const restLeads = rest.reduce((n, s) => n + s.leads, 0)

  const mine = costRange(ad.spend, ad.leads)
  const field = costRange(restSpend, restLeads)

  // Nothing to compare against — one ad in the campaign, or the rest has spent
  // nothing. A comparison with no field is not a finding.
  if (rest.length === 0 || restSpend <= 0) {
    return { proven: false, adCplLo: mine.lo, restCplHi: field.hi }
  }
  if (ad.spend < MIN_AD_SPEND_TO_JUDGE) {
    return { proven: false, adCplLo: mine.lo, restCplHi: field.hi }
  }
  return { proven: mine.lo > field.hi, adCplLo: mine.lo, restCplHi: field.hi }
}

/**
 * Validate one model-proposed action against real fetched state.
 *
 * Returns null for anything that does not check out. A suggestion whose action
 * fails keeps its ADVICE and loses only the button — the reasoning may still be
 * worth reading, and silently dropping the whole suggestion would hide a real
 * finding because one field was wrong.
 */
export function validateAdvisorAction(
  raw: unknown,
  state: AdvisorState,
  budgetStep: BudgetStep,
): AdvisorAction | null {
  if (!raw || typeof raw !== 'object') return null
  const a = raw as Record<string, unknown>
  const type = String(a.type ?? '')
  const setOf = (id: unknown) => state.adSets.find((s) => s.id === String(id ?? ''))

  switch (type) {
    case 'pause_campaign':
      return state.campaignStatus === 'ACTIVE' ? { type: 'pause_campaign' } : null

    case 'resume_campaign':
      return state.campaignStatus === 'PAUSED' ? { type: 'resume_campaign' } : null

    case 'set_budget': {
      const s = setOf(a.adSetId)
      if (!s || s.dailyBudgetAED <= 0) return null
      const proposed = Math.round(Number(a.dailyBudgetAED))
      if (!Number.isFinite(proposed) || proposed <= 0) return null
      // Through the learning guard, never a raw percentage: a step past Meta's
      // reset line restarts learning, which costs more than the change saves.
      const clamped = Math.max(MIN_DAILY_AED, budgetStep(s.dailyBudgetAED, proposed))
      // A step that lands where it started is not a change worth a button.
      return clamped === s.dailyBudgetAED ? null : { type: 'set_budget', adSetId: s.id, dailyBudgetAED: clamped }
    }

    case 'pause_ad': {
      const s = setOf(a.adSetId)
      if (!s) return null
      const adId = String(a.adId ?? '')
      const ad = s.ads.find((x) => x.id === adId)
      // Already paused is not an action, it is a no-op wearing a button.
      if (!ad || ad.status !== 'ACTIVE') return null
      // Never the last one — see liveAds.
      if (liveAds(state, s.id) <= 1) return null
      // THE EVIDENCE GATE. Compared against every ad in the campaign, not only
      // this ad set's: a two-ad ad set would otherwise compare a creative
      // against a single sibling and call the loser proven.
      const everyAd = state.adSets.flatMap((x) => x.ads)
      if (!adIsProvenWorse(ad, everyAd).proven) return null
      return { type: 'pause_ad', adSetId: s.id, adId: ad.id }
    }

    case 'pause_adset': {
      const s = setOf(a.adSetId)
      if (!s || s.status !== 'ACTIVE') return null
      if (liveAdSets(state) <= 1) return null
      return { type: 'pause_adset', adSetId: s.id }
    }

    case 'drop_placement': {
      const s = setOf(a.adSetId)
      if (!s) return null
      const placement = String(a.placement ?? '').trim()
      // Only a placement this ad set ACTUALLY runs. Dropping one it never had
      // is a write that changes nothing and reports success.
      if (!placement || !s.placements.includes(placement)) return null
      // Never the last placement: an ad set with none delivers nowhere, and
      // Meta reads an empty list as "all of them" — the opposite of the intent.
      if (s.placements.length <= 1) return null
      // And only one the placement audit already condemned on its own numbers.
      if (!s.condemnedPlacements.includes(placement)) return null
      return { type: 'drop_placement', adSetId: s.id, placement }
    }

    default:
      return null
  }
}

/**
 * The line in the prompt that tells the model what it may attach.
 *
 * Built from the union rather than typed out beside it, so an action added
 * above cannot be one the model is never told about — which is the quiet way a
 * capability ships and then never fires.
 */
export const ACTION_SHAPES: Record<AdvisorActionType, string> = {
  set_budget: '{"type":"set_budget","adSetId":"<id from DATA.adSets>","dailyBudgetAED":<integer>} — a new daily budget for that ad set.',
  pause_campaign: '{"type":"pause_campaign"} — only when the campaign is ACTIVE and DATA shows real spend with clearly poor results.',
  resume_campaign: '{"type":"resume_campaign"} — only when the campaign is PAUSED and DATA justifies resuming it.',
  pause_ad: '{"type":"pause_ad","adSetId":"<id>","adId":"<id from DATA.adSets[].ads>"} — stop one losing creative. Attach it when that ad\'s own spend and leads in DATA are clearly worse than its siblings\'. It is rechecked against a cost-per-lead confidence bound and dropped if the gap is not proven.',
  pause_adset: '{"type":"pause_adset","adSetId":"<id>"} — stop one audience while its siblings keep running. Never the only live one.',
  drop_placement: '{"type":"drop_placement","adSetId":"<id>","placement":"<one of DATA.adSets[].condemnedPlacements>"} — remove a surface the placement audit has already condemned. Only ever a value from condemnedPlacements.',
}

export const actionShapeLines = (): string =>
  ADVISOR_ACTION_TYPES.map((t) => `  · ${ACTION_SHAPES[t]}`).join('\n')
