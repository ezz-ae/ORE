/**
 * RECOMMENDED — what to do next, ranked, each with the thing that does it.
 *
 * The advisor produced paragraphs. A paragraph that says "investigate
 * potential issues like audience saturation, bid strategy, or ad relevance"
 * is not a recommendation; it is a list of things the reader might think
 * about, written by something that did not do the thinking. And every card
 * offered the same button — "Discuss with Expert" — which is a conversation,
 * not an implementation.
 *
 * This module is the other kind. Deterministic, from the campaign's own
 * numbers, and every recommendation carries an ACTION: a thing the product
 * can do, or a form it can open to collect the one input it needs.
 *
 * THREE RULES, all learned the expensive way in this codebase:
 *
 *  1. EVIDENCE OR SILENCE. Each recommendation states the numbers it stands
 *     on, and nothing appears before those numbers can carry it. A ranked
 *     list of guesses is worse than an empty panel: it trains the operator
 *     to scroll past the one that mattered.
 *
 *  2. PRIORITY IS ABOUT MONEY, NOT NOVELTY. 'critical' means money is being
 *     wasted or delivery is stopped RIGHT NOW. Everything else is
 *     'recommended'. Two criticals is a bad day; five would mean the word
 *     stopped meaning anything.
 *
 *  3. AN ACTION THAT CANNOT BE PERFORMED IS NOT OFFERED. A cost cap cannot
 *     be edited after launch (updateAdSet carries no bid fields, by Meta's
 *     design), so the action for a strangling cap is RELAUNCH — not an
 *     "adjust the cap" button that would fail at the far end.
 *
 * Pure — no I/O, no model. Runs in `pnpm guards`.
 */
import { MIN_ADS_FOR_ROTATION } from '@/lib/freehold/creative-pool'

export type RecPriority = 'critical' | 'recommended'

/** What pressing the button does. `form` means the UI opens a popup for the
 *  one input the action needs before it can run. */
export type RecActionKind =
  | 'set_budget'        // apply a specific daily budget (through safeBudgetStep)
  | 'relaunch_no_cap'   // open the launcher prefilled; the cap cannot be edited
  | 'add_creative'      // open the creative pool for the campaign (no ad set picked)
  | 'add_from_pool'     // open the creative pool AIMED at one ad set (targetId)
  | 'ab_audience'       // form: duplicate this campaign against a second audience
  | 'open_audiences'    // build/attach a better audience
  | 'rate_leads'        // the CRM half of lead quality
  | 'open_campaign'     // read Meta's own error, stated where it lives
  | 'pause_adset'       // stop the ad set paying a multiple for nothing

export interface RecAction {
  kind: RecActionKind
  /** i18n key suffix under `lm.rec.act.` */
  labelKey: string
  /** True when the UI must collect input before it can run. */
  form?: boolean
  /** Numeric payload where the action carries one (a budget). */
  value?: number
  /** The Meta object this acts on, when the action is about one of many. */
  targetId?: string
}

export interface Recommendation {
  id: string
  priority: RecPriority
  /** i18n key suffix under `lm.rec.` for title and body. */
  key: string
  vars?: Record<string, string | number>
  action: RecAction
}

export interface CampaignFacts {
  dailyBudgetAed: number
  /** Spend over the window being read. */
  spendAed: number
  /** Days the campaign has been able to spend. */
  days: number
  impressions: number
  clicks: number
  leads: number
  /** Leads the CRM has actually rated or progressed. */
  attributedLeads: number
  /** Distinct live ads in the campaign. */
  creativeCount: number
  /** Distinct ad sets — the audience count. */
  adSetCount: number
  /** A per-result cost cap in AED, when one was set at launch. */
  costCapAed: number | null
  /**
   * META IS REFUSING TO DELIVER — a delivery error, a rejection, an ad set
   * that cannot serve. Not "it is quiet": Meta's own verdict that this will
   * not run.
   *
   * This outranks every other reading, and suppresses the ones that assume
   * delivery. A live account showed "Not delivering · Delivery error" in Ads
   * Manager while this panel advised RAISING THE BUDGET — advice about
   * spending, on an ad nobody can see. Money advice on a dead ad is worse
   * than silence: it sends the operator to do something expensive and
   * useless while the real fault sits untouched.
   */
  deliveryBlocked?: boolean
  /**
   * THE AD SETS, SEPARATELY — because a campaign total is an average, and an
   * average of two audiences is a description of neither.
   *
   * A live campaign: ad set 1 bought impressions at AED 15 CPM and produced
   * 2 leads at AED 204; ad set 2 paid AED 89-163 CPM and produced none.
   * Blended, the campaign reads "AED 250.70 per lead" — a number describing
   * no ad set that exists, and one that sends an operator to fix the wrong
   * thing. Meta's own advisor reported exactly that figure and asked whether
   * to investigate it.
   *
   * Comparison is the only way that finding is visible, so the facts arrive
   * per ad set rather than summed.
   */
  adSets?: Array<{
    id: string
    name: string
    spendAed: number
    impressions: number
    leads: number
    /**
     * ADS THAT CAN ACTUALLY BE SHOWN in this ad set — not every ad that exists
     * under it. The campaign-level `creativeCount` counts paused ads and ads
     * in switched-off ad sets, so a campaign whose losing ad set was just
     * turned off still reads "2 designs" while the ad set carrying the entire
     * budget has one. That miscount is the whole reason the rotation rule
     * reads per ad set rather than per campaign.
     */
    liveAds?: number
    /** False when the ad set itself is paused — a paused ad set is not where
     *  new ads belong, however short of a rotation it is. */
    active?: boolean
  }>
}

/**
 * A campaign spending far under its budget is throttled, not merely quiet.
 * Below this share of budget the cause is mechanical — a cap, a rejection, an
 * audience too small — never "it needs more time".
 */
export const THROTTLED_PACE = 0.25

/** Nothing about creative or targeting is judged under this. Beneath it the
 *  honest answer is that the campaign has not delivered enough to read. */
export const MIN_IMPRESSIONS_TO_JUDGE = 2000

/** Meta's own floor for a stable ad set, per week. */
const LEARNING_EVENTS_WEEKLY = 50

export function recommendationsFor(f: CampaignFacts): Recommendation[] {
  const out: Recommendation[] = []
  const days = Math.max(1, f.days)
  const perDay = f.spendAed / days
  const pace = f.dailyBudgetAed > 0 ? perDay / f.dailyBudgetAed : 1
  const ctr = f.impressions > 0 ? f.clicks / f.impressions : 0

  // ── 0. META WILL NOT DELIVER THIS ────────────────────────────────────────
  // Everything below assumes an ad that can be seen. When Meta says it
  // cannot, the only honest recommendation is the error itself — and the
  // rest are actively harmful, because they send the operator to spend more
  // on something nobody is being shown. Returns immediately: this is not the
  // first item in a list, it is the whole list.
  if (f.deliveryBlocked) {
    return [{
      id: 'delivery_blocked',
      priority: 'critical',
      key: 'deliveryBlocked',
      action: { kind: 'open_campaign', labelKey: 'seeError' },
    }]
  }

  // ── 1. THROTTLED DELIVERY — the money is not moving ──────────────────────
  // Ranked first because everything else is unreadable while it is true: a
  // campaign spending 1% of its budget has not tested its creative, its
  // audience or its offer. It has tested nothing.
  if (f.dailyBudgetAed > 0 && pace < THROTTLED_PACE && f.spendAed > 0) {
    if (f.costCapAed !== null && f.costCapAed > 0) {
      // The cap is the mechanical cause and it CANNOT be edited — Meta fixes
      // bid fields at creation. So the action is a relaunch, not a slider.
      out.push({
        id: 'throttled_by_cap',
        priority: 'critical',
        key: 'throttledByCap',
        vars: { pace: Math.round(pace * 100), perDay: Math.round(perDay), budget: f.dailyBudgetAed, cap: f.costCapAed },
        action: { kind: 'relaunch_no_cap', labelKey: 'relaunch' },
      })
    } else {
      out.push({
        id: 'throttled',
        priority: 'critical',
        key: 'throttled',
        vars: { pace: Math.round(pace * 100), perDay: Math.round(perDay), budget: f.dailyBudgetAed },
        action: { kind: 'open_audiences', labelKey: 'audiences' },
      })
    }
  }

  // ── 2. LEADS ARRIVING, NOBODY RATING THEM ────────────────────────────────
  // The strongest lever in the system is the one that costs nothing: a rated
  // lead teaches Meta which kind of person to find more of. Unrated leads
  // teach it nothing, so the optimiser keeps buying whatever it first found.
  if (f.leads > 0 && f.attributedLeads === 0) {
    out.push({
      id: 'rate_leads',
      priority: 'critical',
      key: 'rateLeads',
      vars: { leads: f.leads },
      action: { kind: 'rate_leads', labelKey: 'openCrm' },
    })
  }

  // ── 2b. THE WORKING AD SET IS SHORT OF A ROTATION ────────────────────────
  //
  // The live case this rule was written from. An operator switched off the ad
  // set that was paying six times the price for nothing and moved its budget
  // to the one that converts. That left the whole spend on ONE design, which
  // is where a campaign stops finding new people: with nothing to choose
  // between, Meta shows the same picture to the same audience until frequency
  // climbs and the ad set stalls short of the fifty weekly events that end
  // the learning phase.
  //
  // More budget does not fix that — the price was already good. More ads
  // does: each one is another entry in the auction and another chance for
  // someone to stop scrolling, at the same cost per thousand.
  //
  // READ PER AD SET, NEVER PER CAMPAIGN. Meta's learning phase is an ad-set
  // property, and the campaign-level ad count includes the ads under the ad
  // set that was just switched off. The rule aims at the ad set carrying the
  // spend, and names it, because "add more designs" without saying where is
  // how a new ad lands in the one that was stopped for good reason.
  //
  // Ranked above the two creative cards below and suppressing them, because
  // it is the same advice with the ad set attached — and three cards saying
  // "add a design" is how a panel stops being read.
  const workers = (f.adSets ?? []).filter(
    (a) => a.active !== false && typeof a.liveAds === 'number' && a.spendAed > 0,
  )
  const worker = workers.length > 0
    ? workers.reduce((a, b) => (a.spendAed >= b.spendAed ? a : b))
    : null
  const workerWeeklyLeads = worker ? (worker.leads / days) * 7 : 0
  const shortOfRotation = !!worker
    && pace >= THROTTLED_PACE
    && worker.impressions >= MIN_IMPRESSIONS_TO_JUDGE
    && workerWeeklyLeads < LEARNING_EVENTS_WEEKLY
    && (worker.liveAds ?? 0) < MIN_ADS_FOR_ROTATION

  if (shortOfRotation && worker) {
    const have = worker.liveAds ?? 0
    out.push({
      id: 'learning_needs_ads',
      priority: 'recommended',
      key: 'learningNeedsAds',
      vars: {
        adSet: worker.name,
        ads: have,
        add: MIN_ADS_FOR_ROTATION - have,
        target: MIN_ADS_FOR_ROTATION,
        perWeek: Math.round(workerWeeklyLeads),
        need: LEARNING_EVENTS_WEEKLY,
      },
      action: {
        kind: 'add_from_pool',
        labelKey: 'openPool',
        targetId: worker.id,
        value: MIN_ADS_FOR_ROTATION - have,
      },
    })
  }

  // ── 3. ONE CREATIVE CARRYING A NARROW AUDIENCE ───────────────────────────
  // Narrow targeting plus a single design is how CPM climbs and frequency
  // burns: Meta has one thing to show and no way to find a better fit. Only
  // said once there is enough delivery for the claim to be about this
  // campaign rather than about advertising in general.
  if (!shortOfRotation && f.creativeCount <= 1 && f.impressions >= MIN_IMPRESSIONS_TO_JUDGE) {
    out.push({
      id: 'creative_depth',
      priority: 'recommended',
      key: 'creativeDepth',
      vars: { impressions: f.impressions },
      action: { kind: 'add_creative', labelKey: 'addDesign', form: true },
    })
  }

  // ── 4. NOBODY IS CLICKING ────────────────────────────────────────────────
  // Under 0.5% on a property ad, with real delivery behind it, the creative
  // is the variable — not the audience, which is being reached and ignoring
  // it. Same action as depth, different reason, so it is stated separately
  // and only when the depth card is not already saying it.
  if (!shortOfRotation && ctr > 0 && ctr < 0.005 && f.impressions >= MIN_IMPRESSIONS_TO_JUDGE && f.creativeCount > 1) {
    out.push({
      id: 'weak_ctr',
      priority: 'recommended',
      key: 'weakCtr',
      vars: { ctr: (ctr * 100).toFixed(2), clicks: f.clicks, impressions: f.impressions },
      action: { kind: 'add_creative', labelKey: 'addDesign', form: true },
    })
  }

  // ── 5. BUDGET THAT CANNOT CLEAR THE LEARNING PHASE ───────────────────────
  // Meta needs ~50 events per ad set per week. Below that the ad set is not a
  // slow experiment; it is an unstable one whose numbers cannot be trusted.
  // Only raised when the campaign is ACTUALLY SPENDING — a throttled campaign
  // has a different problem and raising its budget changes nothing.
  if (f.leads > 0 && pace >= THROTTLED_PACE) {
    const cpl = f.spendAed / f.leads
    const needed = Math.round((LEARNING_EVENTS_WEEKLY * cpl) / 7)
    if (needed > f.dailyBudgetAed * 1.2) {
      out.push({
        id: 'budget_for_learning',
        priority: 'recommended',
        key: 'budgetForLearning',
        vars: { cpl: Math.round(cpl), needed, budget: f.dailyBudgetAed },
        action: { kind: 'set_budget', labelKey: 'raiseBudget', value: needed },
      })
    }
  }

  // ── 5b. ONE AD SET IS BUYING THE SAME THING AT A MULTIPLE OF THE PRICE ───
  //
  // The finding a campaign total cannot contain. CPM is the honest basis for
  // the comparison: it is what Meta charges to REACH people, so a large gap
  // between two ad sets in the same country and week is a statement about
  // the AUDIENCE — too small, too contested — and not about the creative,
  // which has usually had too few impressions to have been tested at all.
  //
  // Both floors matter. The expensive ad set must have spent enough to be
  // more than noise, and it must have produced NOTHING: an ad set at 3x the
  // CPM that still converts is buying scarce people who are worth it, and
  // stopping it would be the expensive mistake in the other direction.
  if ((f.adSets?.length ?? 0) >= 2) {
    const withCpm = f.adSets!
      .filter((a) => a.impressions >= 100 && a.spendAed > 0)
      .map((a) => ({ ...a, cpm: (a.spendAed / a.impressions) * 1000 }))
    if (withCpm.length >= 2) {
      const cheapest = withCpm.reduce((a, b) => (a.cpm <= b.cpm ? a : b))
      const dearest = withCpm.reduce((a, b) => (a.cpm >= b.cpm ? a : b))
      const ratio = cheapest.cpm > 0 ? dearest.cpm / cheapest.cpm : 1
      if (dearest.id !== cheapest.id && ratio >= 3 && dearest.leads === 0 && dearest.spendAed >= 50) {
        out.push({
          id: 'expensive_adset',
          priority: 'critical',
          key: 'expensiveAdSet',
          vars: {
            dear: dearest.name,
            dearCpm: Math.round(dearest.cpm),
            cheap: cheapest.name,
            cheapCpm: Math.round(cheapest.cpm),
            times: Math.round(ratio),
            wasted: Math.round(dearest.spendAed),
          },
          action: { kind: 'pause_adset', labelKey: 'pauseAdSet', value: 0, targetId: dearest.id },
        })
      }
    }
  }

  // ── 6. A PROVEN CAMPAIGN WITH ONE AUDIENCE ───────────────────────────────
  // The honest moment for a second audience: the first has produced real
  // leads at a readable cost. Before that, a second ad set splits a budget
  // that was not clearing learning on its own.
  if (f.leads >= 3 && f.adSetCount === 1 && pace >= THROTTLED_PACE) {
    out.push({
      id: 'ab_audience',
      priority: 'recommended',
      key: 'abAudience',
      vars: { leads: f.leads },
      action: { kind: 'ab_audience', labelKey: 'testAudience', form: true },
    })
  }

  // Critical first, and never more than a screenful: a ranked list nobody
  // finishes reading has the same value as no list.
  return out
    .sort((a, b) => (a.priority === b.priority ? 0 : a.priority === 'critical' ? -1 : 1))
    .slice(0, 5)
}

/** Every action kind, walkable — the labels are rendered through a computed
 *  key, which `pnpm i18n` cannot see. */
export const REC_ACTION_LABELS = [
  'relaunch', 'audiences', 'openCrm', 'addDesign', 'raiseBudget', 'testAudience', 'seeError',
  'pauseAdSet', 'openPool',
] as const

/** Every recommendation key, walkable, for the same reason. */
export const REC_KEYS = [
  'deliveryBlocked', 'expensiveAdSet',
  'throttledByCap', 'throttled', 'rateLeads', 'learningNeedsAds', 'creativeDepth',
  'weakCtr', 'budgetForLearning', 'abAudience',
] as const
