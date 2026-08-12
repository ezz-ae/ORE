/**
 * WHAT THE MACHINE DID, AS OPPOSED TO WHAT IT MEANT TO DO.
 *
 * The ads home leads with a panel headed "What the machine decided". It was
 * showing this, for ten days:
 *
 *   Planned 3 Meta trial(s) + 0 Google Search trial(s) across 3 project(s)
 *   under ONE combined hard cap of AED 200/day. Nothing launches until the
 *   machine is started.                                    test one · 5d ago
 *
 *   Planned 2 Meta trial(s) … Nothing launches until the machine is started.
 *                                                                X · 10d ago
 *
 * A PLAN IS NOT A DECISION. That entry says, in its own last sentence, that
 * nothing happened. It is an intention, and if nobody started the machine it
 * is an intention that expired — yet it sat at the top of the busiest screen
 * in the product for a week and a half looking like work.
 *
 * The damage is not the wasted space. It is that a panel which shows intent as
 * achievement cannot be trusted about achievement either, so the entries that
 * ARE real — a budget moved, a trial paused on evidence — stop being read.
 *
 * So the kinds are split. ACTIONS changed something on a live account. INTENTS
 * are what the machine would do if it were started, and they belong wherever
 * "start it" is offered, not in a record of what it has done.
 *
 * Pure — no I/O, no clock (now is passed in). Runs in `pnpm guards`.
 */
import type { ActivityKind } from '@/lib/freehold/ads-machine'

/**
 * The machine touched a live account. Every one of these cost or saved real
 * money, or stopped something that was spending.
 */
export const ACTION_KINDS: readonly ActivityKind[] = [
  'launched', 'budget_shift', 'trial_paused', 'trial_resumed',
  'cap_enforced', 'permit_blocked', 'permit_warning',
  'delivery_blocked', 'placement_drain', 'search_harvest',
]

/**
 * The machine wrote down what it WOULD do. Nothing on any platform changed.
 *
 * 'planned' literally ends its own sentence with "nothing launches until the
 * machine is started", and a Google draft is a campaign prepared locally
 * because Google was not connected — a note to self, not an act.
 */
export const INTENT_KINDS: readonly ActivityKind[] = ['planned', 'google_draft_prepared']

const ACTIONS = new Set<ActivityKind>(ACTION_KINDS)
export const isAction = (k: ActivityKind): boolean => ACTIONS.has(k)

/**
 * How long a stated intention is still worth showing.
 *
 * A plan made this morning is a live to-do — "start the machine and this
 * happens". The same plan ten days later is a fact about a decision nobody
 * took, and repeating it every day does not make it more likely to be taken.
 */
export const INTENT_FRESH_DAYS = 3

export const intentIsFresh = (at: string, now: Date = new Date()): boolean => {
  const t = Date.parse(at)
  if (!Number.isFinite(t)) return false
  return (now.getTime() - t) / 86_400_000 <= INTENT_FRESH_DAYS
}

/** Walkable — the honest one-word state of the whole machine layer. */
export const PULSE_STATES = ['working', 'onButIdle', 'stopped', 'none'] as const
export type PulseState = (typeof PULSE_STATES)[number]

export interface PulseFacts {
  /** Machines that exist at all. */
  total: number
  /** Machines whose switch is on. */
  running: number
  /** Campaigns actually live on a platform right now. */
  liveCampaigns: number
  /** Daily budget actually committed, in AED. */
  committedAed: number
}

/**
 * The state the badge should report.
 *
 * THE FAILURE THIS CLOSES: the hub read "1 running · 0 live campaigns · AED 0
 * committed" — three facts on one line, the first of which contradicts the
 * other two. "Running" was the switch, exactly as "Active" was the switch on
 * the Meta and Google campaign badges this product has already had to fix
 * twice.
 *
 * A machine with its switch on that has launched nothing and committed nothing
 * is not running. It is on and idle, which is a real and common state — the
 * plan is made, nobody pressed start, or everything it launched has since been
 * paused — and it has a different answer from either "working" or "stopped".
 */
export function pulseState(f: PulseFacts): PulseState {
  if (f.total === 0) return 'none'
  if (f.running === 0) return 'stopped'
  // Either signal counts as working: a machine can be mid-launch with budget
  // committed and no campaign live yet, and it can be live on a campaign
  // somebody else is paying for.
  return f.liveCampaigns > 0 || f.committedAed > 0 ? 'working' : 'onButIdle'
}
