// lib/meta/campaign-router.ts
//
// The intent router. Brokers don't think in Meta's tree — they think "I want
// leads for this project, here's my creative/budget." Multiple brokers push
// requests at the same project at the same time. If we honoured each literally
// we'd spawn competing same-objective campaigns that fight in the same auction
// and burn everyone's credits (we'd bid against ourselves). This engine reads a
// request as INTENT and returns the ONE healthy structural action, given what's
// already running — so credits compound instead of cannibalize.
//
// The rules follow Meta's real hierarchy:
//   Campaign = OBJECTIVE   (its own delivery gate — a new objective is healthy)
//   Ad set   = AUDIENCE / LANGUAGE
//   Ad       = CREATIVE
//
// There is no single "correct" action — the trade-offs are real (a new ad tests
// a creative cleanly; a new ad set opens a fresh audience; a budget bump protects
// a campaign still in its learning phase). The engine picks the healthiest
// default, lists the alternatives with their rationale for the admin, and NEVER
// exposes ad-set mechanics to the broker.

export type RouterAction =
  | 'new_campaign'      // objective not yet running → create it (folds into the group)
  | 'new_adset'         // new language or a fresh audience → new ad set on the running campaign
  | 'new_ad'            // new creative on a running audience → new ad in the ad set (A/B the creative)
  | 'increase_budget'   // same intent already running → add fuel, don't disturb delivery
  | 'hold'              // duplicate spam during learning → change nothing, protect the learning phase

export type BrokerExperience = 'junior' | 'mid' | 'senior'

export interface CampaignIntent {
  projectSlug: string
  /** The objective the broker wants — Meta objective or the wizard product key. */
  objectiveKey: string
  /** Locale of the requested creative/copy, e.g. 'en' | 'ar' | 'ru'. */
  language: string
  /** Fingerprint of the requested targeting; '' means "default/broad". */
  audienceKey: string
  /** True when the broker brings a distinct creative (not a copy of a running ad). */
  hasNewCreative: boolean
  dailyBudgetAED: number
  brokerId: string
  brokerExperience?: BrokerExperience
}

export interface ExistingAd {
  id: string
  /** Fingerprint of the ad's creative (image/copy hash) — to detect duplicates. */
  creativeKey: string
  brokerId?: string
}
export interface ExistingAdSet {
  id: string
  language: string
  audienceKey: string
  ads: ExistingAd[]
}
export interface ExistingCampaign {
  id: string
  objectiveKey: string
  status: string            // 'ACTIVE' | 'PAUSED' | ...
  ageDays: number
  leads: number
  /** True while the campaign/ad set is still in Meta's learning phase. */
  learning: boolean
  dailyBudgetAED: number
  adSets: ExistingAdSet[]
}
export interface ProjectAdStructure {
  projectSlug: string
  campaigns: ExistingCampaign[]
}

export interface RouterAlternative { action: RouterAction; reason: string }
export interface RouterDecision {
  action: RouterAction
  level: 'campaign' | 'adset' | 'ad' | 'none'
  targetCampaignId?: string
  targetAdSetId?: string
  /** Why this action — plain language, for the admin decision log. */
  reason: string
  /** What the admin should know about the broker/context. */
  adminNote: string
  /** What the broker sees — outcome-framed, never Meta mechanics. */
  brokerMessage: string
  /** The other viable actions and their trade-offs (admin can override). */
  alternatives: RouterAlternative[]
}

// A campaign in learning shouldn't be disrupted, and a duplicate request must
// not fork a competitor. Meta needs ~50 objective events/week to exit learning;
// under a week with few leads is normal, not failure.
const LEARNING_DAYS = 7
const norm = (s: string) => (s || '').trim().toLowerCase()
const sameObjective = (a: string, b: string) => norm(a) === norm(b)

const brokerLine = (objectiveKey: string): string => {
  const o = norm(objectiveKey)
  if (o.includes('lead') || o.includes('form')) return 'Your lead campaign is live and optimizing — leads will appear here as they come in.'
  if (o.includes('landing') || o.includes('traffic') || o.includes('link')) return 'Your landing campaign is live and driving qualified visits.'
  if (o.includes('call')) return 'Your call campaign is live.'
  return 'Your campaign is live and optimizing.'
}

/**
 * Decide the healthiest structural action for a broker's request, given what is
 * already running for the project. Pure and deterministic — no Meta calls.
 */
export function decideCampaignAction(intent: CampaignIntent, structure: ProjectAdStructure): RouterDecision {
  const broker = brokerLine(intent.objectiveKey)
  const running = structure.campaigns.filter((c) => c.status.toUpperCase() === 'ACTIVE')

  // 1 — No campaign for this objective yet → it's a new delivery gate. Healthy.
  const forObjective = running.filter((c) => sameObjective(c.objectiveKey, intent.objectiveKey))
  if (forObjective.length === 0) {
    return {
      action: 'new_campaign',
      level: 'campaign',
      reason: `No active campaign runs the "${intent.objectiveKey}" objective for ${intent.projectSlug}. A distinct objective has its own Meta delivery gate, so it does not compete with the others — safe to launch and fold into the group.`,
      adminNote: `New objective for ${intent.projectSlug} requested by ${intent.brokerId}. Added as a new arm.`,
      brokerMessage: broker,
      alternatives: [],
    }
  }

  // Pick the primary campaign for this objective: the one with the most leads
  // (most established delivery), else the oldest.
  const primary = [...forObjective].sort((a, b) => (b.leads - a.leads) || (b.ageDays - a.ageDays))[0]
  const matchingAdSet = primary.adSets.find(
    (s) => norm(s.language) === norm(intent.language) && norm(s.audienceKey) === norm(intent.audienceKey),
  )
  const languageAdSet = primary.adSets.find((s) => norm(s.language) === norm(intent.language))

  // 2 — New language → an ad set carries one locale. Fresh delivery, no clash.
  if (!languageAdSet) {
    return {
      action: 'new_adset',
      level: 'adset',
      targetCampaignId: primary.id,
      reason: `The "${intent.objectiveKey}" campaign runs but has no ad set for "${intent.language}". Language lives at the ad-set level, so this opens delivery for a new locale without disturbing the running one.`,
      adminNote: `${intent.brokerId} requested "${intent.language}" on ${intent.projectSlug}; added an ad set to the existing campaign instead of a new campaign.`,
      brokerMessage: broker,
      alternatives: [{ action: 'increase_budget', reason: 'If the locale overlaps an existing audience, adding budget could be enough — but a dedicated ad set gives cleaner locale data.' }],
    }
  }

  // 3 — Same objective + same language but a DIFFERENT audience → a fresh
  // audience to try belongs in its own ad set (learns independently).
  if (!matchingAdSet) {
    return {
      action: 'new_adset',
      level: 'adset',
      targetCampaignId: primary.id,
      reason: `Same objective and language are running, but the requested audience is new. A separate ad set lets the new audience learn on its own without cannibalizing the audience already delivering.`,
      adminNote: `${intent.brokerId} wants a fresh audience on ${intent.projectSlug}/${intent.objectiveKey}; added an ad set.`,
      brokerMessage: broker,
      alternatives: [{ action: 'new_ad', reason: 'If the audience is only slightly different, an extra creative in the existing ad set pools the learning faster.' }],
    }
  }

  // At this point the exact objective + language + audience is already running.
  const learningNow = primary.learning || primary.ageDays < LEARNING_DAYS
  const duplicateCreative = !intent.hasNewCreative

  // 4 — New creative on a running audience → an extra ad in the SAME ad set:
  // a clean creative A/B where the audience/learning is shared (no new auction
  // competing with ourselves).
  if (intent.hasNewCreative) {
    const seniorTest = intent.brokerExperience === 'senior'
    return {
      action: 'new_ad',
      level: 'ad',
      targetCampaignId: primary.id,
      targetAdSetId: matchingAdSet.id,
      reason: `The exact objective, language and audience already deliver. The broker's new creative is added as another ad in that ad set — a head-to-head creative test that shares the audience's learning and never splits budget against ourselves.`,
      adminNote: `${intent.brokerId}${seniorTest ? ' (senior)' : ''} added a creative to ${intent.projectSlug}/${intent.objectiveKey}. ${seniorTest ? 'Trusted as a direct A/B.' : 'Watch that it does not dilute the top performer — pause if CPL worsens.'}`,
      brokerMessage: broker,
      alternatives: [
        { action: 'new_adset', reason: 'Give the creative its own audience for an isolated read (slower to learn, more budget).' },
        { action: 'increase_budget', reason: 'Skip the new creative and just fuel the current winner.' },
      ],
    }
  }

  // 5 — No new creative, exact setup already running. This is the "broker panics
  // after an hour and re-requests" case. During learning, spawning anything new
  // resets progress and competes with the live ad — so HOLD in silence.
  if (learningNow && duplicateCreative) {
    return {
      action: 'hold',
      level: 'none',
      targetCampaignId: primary.id,
      reason: `An identical campaign (objective + language + audience, same creative) is already running and still in its learning phase (${primary.ageDays}d, ${primary.leads} leads). A duplicate would compete in the same auction and reset learning. Held — the running campaign is given time.`,
      adminNote: `${intent.brokerId} re-requested an identical setup on ${intent.projectSlug} during learning. Held to protect delivery; no credits spent on a competitor. Consider reassuring the broker.`,
      brokerMessage: broker,
      alternatives: [{ action: 'increase_budget', reason: 'If the broker wants more volume now, a budget bump accelerates learning without a competing campaign.' }],
    }
  }

  // 6 — Past learning, same setup, no new creative → the healthy move is fuel:
  // add budget to the proven campaign rather than a parallel one.
  return {
    action: 'increase_budget',
    level: 'campaign',
    targetCampaignId: primary.id,
    reason: `The exact setup is already running and out of learning. Adding budget to the proven campaign scales what works, instead of a parallel campaign that would bid against it.`,
    adminNote: `${intent.brokerId}'s request on ${intent.projectSlug}/${intent.objectiveKey} was applied as a budget increase to the established campaign.`,
    brokerMessage: broker,
    alternatives: [{ action: 'new_ad', reason: 'If the broker actually has a fresh creative, an added ad would test it head-to-head.' }],
  }
}

// ─── ACTING ON THE DECISION ──────────────────────────────────────────────────
//
// The router above computed the healthiest structural action from the moment it
// shipped, and NOTHING EVER ACTED ON IT.
//
//   · /api/freehold/ads/route-intent exists, says in its own header "the wizard
//     shows this before the broker commits", and has no caller anywhere;
//   · in the launch route the decision changed behaviour in exactly one branch,
//     `autonomy === 3 && action === 'hold'` — and getAutonomyLevel() defaults to
//     1 and FAILS CLOSED to 1, so on a real account it is never 3;
//   · every other action was written into the decision log as
//     "the intent router recommended <action> ... fold the arms via Campaign
//     Groups", which tells somebody, afterwards, what should have happened.
//
// Five actions, four of which could never do anything, and the fifth behind a
// switch that is off. The predicates below are what make it a decision.
//
// WHY A REFUSAL DOES NOT NEED AUTONOMY. The autonomy level governs the machine
// SPENDING ON ITS OWN. Declining to create a second campaign that would bid
// against the first is not the machine acting — it is the machine not acting,
// the same class as the Trakheesi gate and the landing-page 404 gate, both of
// which refuse at every autonomy level. Refusing to spend is not autonomy.
//
// AND IT IS ALWAYS OVERRIDABLE. There are real reasons to run two: a genuine
// campaign-level test of two creative concepts, or a second budget line somebody
// wants kept separate for reporting. A refusal with no way through would be
// worse than the log line it replaces, because people route around a wall.

/** Actions that mean an identical setup is ALREADY delivering. */
export const DUPLICATE_ACTIONS: readonly RouterAction[] = ['hold', 'increase_budget']

/**
 * Should this launch be refused?
 *
 * Only 'hold': the exact objective, language, audience AND creative are already
 * running, and still in the learning phase. A second one splits the budget,
 * bids against the first, and resets the learning on both — there is no reading
 * of that which is good for the person pressing the button.
 *
 * 'increase_budget' is NOT refused. The setup is running and past learning, so
 * a parallel campaign is worse than a budget raise but it is not self-harm — it
 * comes back as a warning on a successful launch.
 */
export const routerBlocks = (d: RouterDecision | null): boolean => d?.action === 'hold'

/** Should the launch go ahead and say something? */
export const routerWarns = (d: RouterDecision | null): boolean => d?.action === 'increase_budget'

/**
 * The refusal, in words the person pressing Run can act on.
 *
 * Names the campaign it would compete with and the two ways forward — because a
 * refusal that does not say what to do instead is a wall.
 */
export function duplicateRefusal(d: RouterDecision, runningName?: string | null): string {
  const who = runningName ? `“${runningName}”` : 'a campaign'
  return `${who} is already running this exact ad — same goal, same language, same audience, same creative — and it is still in its first week. ` +
    `A second one would bid against it in the same auction and restart the learning on both. ` +
    `Add budget to the one running, or change something about this one. ` +
    `Nothing was created and no credits were spent.`
}

/** The warning that rides with a launch we allowed but would not have chosen. */
export function duplicateWarning(d: RouterDecision, runningName?: string | null): string {
  const who = runningName ? `“${runningName}”` : 'another campaign'
  return `${who} already runs this same goal, language and audience. Two campaigns after the same people bid against each other — raising the budget on one usually buys more than splitting it across both.`
}
