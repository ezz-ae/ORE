/**
 * ONE ACTION PER CAMPAIGN, AND "STOP" MEANS STOP.
 *
 * The setup check already finds faults and the targeting check already finds
 * dead interests. Both produce lists, and a list is not an instruction — a
 * screen of amber rows gets skimmed, and the one row that meant "you are
 * paying Meta to show a property ad to the wrong country" reads exactly like
 * the one that meant "consider naming your placements".
 *
 * This module collapses everything known about a campaign into a single
 * imperative with a severity, so the answer to "what do I do about this one?"
 * is one sentence.
 *
 * ── WHAT MAKES SOMETHING A STOP ──────────────────────────────────────────
 *
 * Not how wrong it is. Whether money is moving to the wrong people WHILE YOU
 * READ IT.
 *
 * A campaign whose audience is not the audience that was chosen — Advantage
 * expanding past it, no property gate at all, or a qualifier Meta has retired
 * — is buying strangers at property-ad prices every hour it runs. That is a
 * stop. The same campaign paused is a `fix_today`: it is equally wrong and
 * costing nothing, and calling it an emergency is how "stop now" stops meaning
 * anything. A guard that cries wolf is worse than no guard, because the one
 * time it is right nobody looks — this product has already watched that happen
 * with a targeting panel that reported eight live interests as retired.
 *
 * So `stop_now` requires BOTH a fault that misdirects delivery AND a campaign
 * that is actually delivering.
 *
 * Pure — no database, no network, no session. Runs in `pnpm guards`.
 */

/** Ordered worst-first. The screen and the alert both read this order. */
export const ACTION_SEVERITIES = ['stop_now', 'fix_today', 'watch', 'ok'] as const
export type ActionSeverity = (typeof ACTION_SEVERITIES)[number]

/**
 * Every action this guard can demand. Walkable — the i18n audit enumerates it,
 * so a verdict cannot ship without the sentence a person acts on.
 */
export const ACTION_KEYS = [
  'stopExpanding',     // Meta is buying outside the chosen audience, live
  'stopNoProperty',    // live, and nothing in the spec says property
  'stopDeadSignal',    // live, and a targeting id Meta has retired is in the spec
  'stopOffPlatform',   // live, and buying third-party inventory
  'fixExpanding',      // same faults, paused — wrong, not urgent
  'fixNoProperty',
  'fixDeadSignal',
  'fixGoal',           // optimising for views on a lead campaign
  'fixLocation',       // deprecated location type: edits are being refused
  'watchUnverified',   // we could not read whether the audience is bounded
  'ok',
] as const
export type ActionKey = (typeof ACTION_KEYS)[number]

/** What the guard knows about one campaign at the moment it decides. */
export interface CampaignFacts {
  campaignId: string
  name: string
  /** Delivering right now. A paused campaign spends nothing, so it never stops. */
  live: boolean
  /** Spend in the window read. Zero on a live campaign still counts as live —
   *  a campaign that has not spent YET is one that is about to. */
  spendAed: number
  /** From checkCampaignSetup: Meta is expanding past the chosen audience. */
  expanding: boolean
  /** From checkCampaignSetup: expansion state could not be read at all. */
  expansionUnknown: boolean
  /** From checkCampaignSetup: no property signal anywhere in the spec. */
  noProperty: boolean
  /** Targeting ids in this campaign that Meta reports as retired. */
  deadSignals: string[]
  /** Buying outside Facebook and Instagram. */
  offPlatform: boolean
  /** Optimising for views rather than customers. */
  softGoal: boolean
  /** Using the location type Meta deprecated — every later edit is refused. */
  deprecatedLocation: boolean
}

export interface CampaignAction {
  campaignId: string
  name: string
  severity: ActionSeverity
  key: ActionKey
  /** Filled into the sentence. Never formatted here — this module has no words. */
  vars: Record<string, string | number>
}

/**
 * The single thing to do about this campaign.
 *
 * Checked worst-first and returns on the first hit: a campaign with four
 * faults still gets one instruction, because the one that stops the bleeding
 * is the only one that matters until it is done.
 */
export function decideAction(f: CampaignFacts): CampaignAction {
  const at = (severity: ActionSeverity, key: ActionKey, vars: Record<string, string | number> = {}): CampaignAction =>
    ({ campaignId: f.campaignId, name: f.name, severity, key, vars })

  // ── DELIVERING TO THE WRONG PEOPLE, RIGHT NOW ──────────────────────────
  if (f.live) {
    // Ordered by how completely the audience is lost. Expansion is first
    // because it silently overrides every other targeting decision on the ad
    // set: the interests are still displayed, they are simply not applied.
    if (f.expanding) return at('stop_now', 'stopExpanding', { spend: Math.round(f.spendAed) })
    if (f.noProperty) return at('stop_now', 'stopNoProperty', { spend: Math.round(f.spendAed) })
    if (f.deadSignals.length > 0) {
      return at('stop_now', 'stopDeadSignal', {
        signals: f.deadSignals.join(', '), n: f.deadSignals.length,
      })
    }
    if (f.offPlatform) return at('stop_now', 'stopOffPlatform', { spend: Math.round(f.spendAed) })
  }

  // ── THE SAME FAULTS, NOT SPENDING ──────────────────────────────────────
  // Equally wrong, costing nothing this minute. Fix before it runs again.
  if (f.expanding) return at('fix_today', 'fixExpanding')
  if (f.noProperty) return at('fix_today', 'fixNoProperty')
  if (f.deadSignals.length > 0) {
    return at('fix_today', 'fixDeadSignal', { signals: f.deadSignals.join(', '), n: f.deadSignals.length })
  }

  // ── WRONG, BUT NOT ABOUT WHO SEES IT ───────────────────────────────────
  // A soft goal wastes the budget on the wrong OUTCOME rather than the wrong
  // person, and the deprecated location type does not misdeliver at all — it
  // freezes the ad set so no later fix can be published, which is why it is
  // named rather than left silent.
  if (f.softGoal) return at('fix_today', 'fixGoal')
  if (f.deprecatedLocation) return at('fix_today', 'fixLocation')

  // ── COULD NOT TELL ─────────────────────────────────────────────────────
  // Never an `ok`. An unread expansion state is exactly the case that was
  // costing money while every gate showed green, and silence is what let it.
  if (f.expansionUnknown) return at('watch', 'watchUnverified')

  return at('ok', 'ok')
}

/** Worst first, then biggest spender — the order a person should read them. */
export function rankActions(actions: CampaignAction[], spendOf: (a: CampaignAction) => number): CampaignAction[] {
  const rank = (s: ActionSeverity) => ACTION_SEVERITIES.indexOf(s)
  return [...actions].sort((a, b) =>
    rank(a.severity) - rank(b.severity) || spendOf(b) - spendOf(a))
}

/** How many campaigns need stopping. The one number an alert leads with. */
export const stopCount = (actions: CampaignAction[]): number =>
  actions.filter((a) => a.severity === 'stop_now').length

/**
 * Should this run raise an alarm at all?
 *
 * Only a stop does. A `fix_today` that pages somebody at 6am trains them to
 * dismiss the alert, and then the stop arrives into a muted channel.
 */
export const shouldAlert = (actions: CampaignAction[]): boolean => stopCount(actions) > 0
