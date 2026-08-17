/**
 * Authority — who may do what, and the events that unlock it.
 *
 * The rules this encodes, as stated:
 *
 *   · "team leader can see all the campaigns and work with them on it but
 *      doesnt own camapigns"
 *   · "always the only one can even delete them and the lead and the system is
 *      the one who paying — anyone else is account with limitations"
 *   · "the system must be fair by defult — any authorised actions by leader
 *      must meet events to get activated — they caant reassign a new lead
 *      within a time frame, they cant reassign a lead has anytype of follow up"
 *
 * The design consequence is that a leader's authority is not a flag. It is a
 * FUNCTION OF THE LEAD'S STATE: the same leader may reassign one lead and not
 * another, and the difference is whether the assigned broker has been given a
 * fair chance yet. So the decision has to be computed per lead, per moment, and
 * it has to be able to explain itself — a denial that cannot say why is
 * indistinguishable from a bug.
 *
 * `decideReassign` is PURE. It takes facts and returns a decision, so the UI
 * can show "unlocks in 6h" using the exact logic the server enforces, with no
 * second implementation to drift. `lib/freehold/authority-db.ts` gathers the
 * facts and writes the log.
 */

import type { Role } from './session-types'
import { OWNER_ROLES, MANAGEMENT_ROLES, LEADERSHIP_ROLES } from './session-types'

// ── The fairness defaults ─────────────────────────────────────────────────────
// "fair by default". A broker who has just been handed a lead gets a protected
// window to work it before anyone can take it away. Changing the policy is one
// edit here, not a hunt.
//
// There is ONE number, not two. An earlier version carried a second
// `neglectMs: 72h` described as letting a leader move a lead that had gone
// untouched — but it could never change an outcome: any lead old enough to be
// "neglected" was already past the 24h grace, so the ordinary path allowed the
// move anyway. A policy constant that decides nothing is worse than none: it
// reads like a protection that exists. Removed rather than left as decoration.
//
// The deliberate consequence is that the two rules are exactly the two that
// were asked for, and nothing else: a protected window, and untouchable
// follow-up. A lead that HAS been worked is never reassignable by a leader, no
// matter how stale — that needs authority this role does not have.
export const FAIRNESS = {
  /** A newly assigned lead cannot be taken from its broker for this long. */
  graceMs: 24 * 60 * 60 * 1000,
} as const

/** Activity types that count as a human actually working the lead. */
export const CONTACT_ACTIVITY = [
  'call', 'meeting', 'viewing', 'whatsapp', 'email', 'sms', 'message',
] as const

export type AuthorityAction =
  | 'lead.reassign'
  | 'lead.delete'
  | 'campaign.delete'
  | 'campaign.edit'
  | 'member.role'
  | 'member.suspend'
  // Content acts. Added when projects and developers first became editable and
  // deletable at all — before that the only way to remove a listing was to
  // open the production database, which left no record of who did it or why.
  | 'project.edit'
  | 'project.archive'
  | 'project.restore'
  | 'project.delete'
  | 'developer.edit'
  | 'developer.delete'

/** Reason codes. The UI translates these; they are never shown raw. */
export type AuthorityReason =
  | 'owner_only'          // deletion — the paying account and nobody else
  | 'management'          // allowed by company-wide authority
  | 'leader_unlocked'     // allowed: the fairness conditions are met
  | 'own_lead'            // allowed: the actor is the assigned broker
  | 'grace_period'        // denied: still inside the new-lead window
  | 'has_follow_up'       // denied: the broker has worked this lead
  | 'not_your_team'       // denied: the lead's broker does not report to you
  | 'insufficient_role'   // denied: this role never has this power
  | 'unassigned'          // allowed: nobody holds it, so nobody is being harmed

export interface AuthorityDecision {
  allowed: boolean
  reason: AuthorityReason
  /** ISO timestamp when a time-based denial turns into an allow. */
  unlocksAt?: string
}

/** Facts about the lead a reassignment decision depends on. */
export interface ReassignFacts {
  /** Who currently holds it. Null/empty = unassigned. */
  assignedTo: string | null
  /** When it was assigned to them. Null = unknown; treated as "long ago". */
  assignedAt: string | null
  /** Any human contact logged (call, meeting, whatsapp, …). */
  contactCount: number
  /** `last_contact_at` on the lead, if set. */
  lastContactAt: string | null
  /** Lead status — anything past 'new' is evidence of work. */
  status: string | null
  /** Does the current holder report to this leader? Irrelevant for management. */
  inActorsTeam: boolean
  /** Evaluation clock. Passed in so the decision is deterministic and testable. */
  now: number
}

const has = (roles: Role[], r: Role) => roles.includes(r)

/**
 * Is there evidence the assigned broker has actually worked this lead?
 * Deliberately broad — the rule says "any type of follow up", so a logged call,
 * a recorded contact time, or a status moved off 'new' all count.
 */
export function hasFollowUp(f: Pick<ReassignFacts, 'contactCount' | 'lastContactAt' | 'status'>): boolean {
  if (f.contactCount > 0) return true
  if (f.lastContactAt) return true
  const s = (f.status ?? '').trim().toLowerCase()
  return s !== '' && s !== 'new'
}

/**
 * THE decision. Pure, so the badge in the UI and the 403 on the server are the
 * same sentence computed the same way.
 */
export function decideReassign(actorRole: Role, f: ReassignFacts): AuthorityDecision {
  // Nobody holds it — moving it takes nothing from anyone.
  if (!f.assignedTo) {
    return has(LEADERSHIP_ROLES, actorRole)
      ? { allowed: true, reason: 'unassigned' }
      : { allowed: false, reason: 'insufficient_role' }
  }

  // Company-wide authority is not fairness-gated. The owner and management
  // answer for the whole pipeline, so they can always move a lead — but the log
  // records that they did, which is the real accountability here.
  if (has(MANAGEMENT_ROLES, actorRole) || has(OWNER_ROLES, actorRole)) {
    return { allowed: true, reason: 'management' }
  }

  if (actorRole !== 'team_leader') return { allowed: false, reason: 'insufficient_role' }

  // A leader's reach stops at their own team.
  if (!f.inActorsTeam) return { allowed: false, reason: 'not_your_team' }

  const assignedAt = f.assignedAt ? Date.parse(f.assignedAt) : NaN
  const heldFor = Number.isNaN(assignedAt) ? Infinity : f.now - assignedAt
  const worked = hasFollowUp(f)

  // Inside the protected window: the broker gets their fair chance first.
  if (heldFor < FAIRNESS.graceMs) {
    return {
      allowed: false,
      reason: 'grace_period',
      unlocksAt: new Date(assignedAt + FAIRNESS.graceMs).toISOString(),
    }
  }

  // Worked leads are not up for grabs, however long ago that work was. Taking a
  // lead off the broker who built the relationship is the single most corrosive
  // thing a leader can do, so it needs authority this role does not have.
  if (worked) return { allowed: false, reason: 'has_follow_up' }

  // Past grace, never touched — the broker had their window and did nothing
  // with it. This is the event that activates the leader's authority.
  return { allowed: true, reason: 'leader_unlocked' }
}

/**
 * Deletion. One rule, no exceptions, for both campaigns and leads: the paying
 * account and nobody else. A team leader who can pause, edit and re-target a
 * campaign still cannot destroy it — that is what "works with them but doesn't
 * own them" means in practice.
 */
export function decideDelete(actorRole: Role): AuthorityDecision {
  return has(OWNER_ROLES, actorRole)
    ? { allowed: true, reason: 'owner_only' }
    : { allowed: false, reason: 'owner_only' }
}

/**
 * Working ON a campaign — editing, pausing, re-targeting, changing budget.
 * Open to leadership and marketing. Explicitly NOT deletion.
 */
export function decideCampaignEdit(actorRole: Role): AuthorityDecision {
  if (has(LEADERSHIP_ROLES, actorRole) || actorRole === 'marketing') {
    return { allowed: true, reason: has(MANAGEMENT_ROLES, actorRole) ? 'management' : 'leader_unlocked' }
  }
  return { allowed: false, reason: 'insufficient_role' }
}

/**
 * Changing someone's role or suspending them is access administration, not
 * team leadership. A leader runs the work; they do not control who has an
 * account — "anyone else is account with limitations" cuts both ways.
 */
export function decideMemberAdmin(actorRole: Role): AuthorityDecision {
  return has(MANAGEMENT_ROLES, actorRole)
    ? { allowed: true, reason: 'management' }
    : { allowed: false, reason: 'insufficient_role' }
}

/** HTTP status that matches a denial — 403 for role, 409 for "not yet". */
export function statusForDenial(d: AuthorityDecision): number {
  return d.reason === 'grace_period' || d.reason === 'has_follow_up' ? 409 : 403
}
