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

export type RecPriority = 'critical' | 'recommended'

/** What pressing the button does. `form` means the UI opens a popup for the
 *  one input the action needs before it can run. */
export type RecActionKind =
  | 'set_budget'        // apply a specific daily budget (through safeBudgetStep)
  | 'relaunch_no_cap'   // open the launcher prefilled; the cap cannot be edited
  | 'add_creative'      // form: upload another design into this ad set
  | 'ab_audience'       // form: duplicate this campaign against a second audience
  | 'drop_placement'    // narrow to the surfaces that earn their money
  | 'open_audiences'    // build/attach a better audience
  | 'rate_leads'        // the CRM half of lead quality
  | 'open_campaign'     // read Meta's own error, stated where it lives

export interface RecAction {
  kind: RecActionKind
  /** i18n key suffix under `lm.rec.act.` */
  labelKey: string
  /** True when the UI must collect input before it can run. */
  form?: boolean
  /** Numeric payload where the action carries one (a budget). */
  value?: number
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

  // ── 3. ONE CREATIVE CARRYING A NARROW AUDIENCE ───────────────────────────
  // Narrow targeting plus a single design is how CPM climbs and frequency
  // burns: Meta has one thing to show and no way to find a better fit. Only
  // said once there is enough delivery for the claim to be about this
  // campaign rather than about advertising in general.
  if (f.creativeCount <= 1 && f.impressions >= MIN_IMPRESSIONS_TO_JUDGE) {
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
  if (ctr > 0 && ctr < 0.005 && f.impressions >= MIN_IMPRESSIONS_TO_JUDGE && f.creativeCount > 1) {
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
] as const

/** Every recommendation key, walkable, for the same reason. */
export const REC_KEYS = [
  'deliveryBlocked',
  'throttledByCap', 'throttled', 'rateLeads', 'creativeDepth',
  'weakCtr', 'budgetForLearning', 'abAudience',
] as const
