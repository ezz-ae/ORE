import { BRAND } from '@/lib/freehold/brand'
/**
 * Ads Machine — engine (stage 1: engine, no UI).
 *
 * runMachineCycle is the machine's heartbeat (cron + manual run_cycle):
 *   LAUNCH   — planned-but-unlaunched trials go live, but only after a FRESH
 *              combined cap check (activeSpendAed + new budget ≤ cap); a trial
 *              that doesn't fit is logged 'cap_enforced' and skipped, and a
 *              platform failure is logged 'error' without sinking the cycle.
 *              Google is a LIVE channel: its trials launch for real (created
 *              PAUSED atomically, then ENABLED) under the same cap as Meta.
 *              When Google isn't connected (GoogleConfigError) the trial
 *              degrades honestly to a local PAUSED draft + a
 *              'google_draft_prepared' activity — the machine still runs Meta.
 *   EVALUATE — per campaign: real platform metrics (Meta insights this_month;
 *              Google campaign metrics), CRM quality, verdict stats; creates
 *              per-lead feedback questions for brokers; ONE aggregated
 *              'observation' activity per machine per cycle.
 *   ROTATE   — deterministic, per project, ≤1 pause per project per CYCLE
 *              (the machine cycles twice a day, so a bad trial is caught in
 *              hours rather than burning a full day of the cap — the spend,
 *              quality and verdict gates are unchanged, only the reaction
 *              time is);
 *              only HUMAN-answered decisive verdicts (yes/no) count; freed
 *              budget is reallocated under the cap. Meta and Google trials
 *              share one per-project pool, so cross-channel reallocation is
 *              allowed — each mutation goes through its own channel's client.
 *
 * Spend authority: autonomous WITHIN the hard daily cap — for BOTH channels.
 * The cap is ONE combined figure and is checked server-side at every mutation
 * that can add spend — launch, resume, budget raise, cap decrease — always
 * against a fresh activeSpendAed read.
 */
import { query } from '@/lib/db'
import { metaLeadCount } from '@/lib/meta/lead-count'
import {
  launchFullCampaign,
  getCampaignInsights,
  listAdSets,
  updateAdSet,
  updateCampaignStatus as metaUpdateCampaignStatus,
  createLeadForm,
} from '@/lib/meta/client'
import {
  FORM_TEMPLATES,
  materializeTemplate,
  customToMetaQuestion,
  type ListingFacts,
  type TFn,
} from '@/lib/meta/form-templates'
import { p_forms } from '@/lib/i18n/dictionaries/p_forms'
import { withIntent } from '@/lib/meta/intent'
import {
  launchSearchCampaign,
  listCampaigns as listGoogleCampaigns,
  updateCampaignStatus as googleUpdateCampaignStatus,
  updateCampaignBudget as googleUpdateCampaignBudget,
} from '@/lib/google/client'
import { GoogleConfigError, type GoogleCampaign } from '@/lib/google/types'
import { getCampaignQuality, badPhone, QUALIFIED_STATUSES } from '@/lib/freehold/campaign-quality'
import { getUntrustedLeadIds } from '@/lib/freehold/training-integrity'
import { createLocalCampaign } from '@/lib/google/local-store'
import {
  getMachine,
  setMachineStatus,
  setMachineCap,
  setMachinePlan,
  logActivity,
  listMachineCampaigns,
  addMachineCampaign,
  updateMachineCampaign,
  activeSpendAed,
  insertLeadVerdictRequests,
  getVerdictStats,
  type AdsMachine,
  type MachineCampaign,
  type MachineChannel,
  type TrialVerdictStats,
  type VerdictRequestInput,
  type QuestionKind,
} from '@/lib/freehold/ads-machine'
import { META_MIN_TRIAL_BUDGET_AED, type MachinePlan, type MachineProjectPlan, type MachineTrialPlan } from '@/lib/freehold/ads-machine-planner'
import { getMachineDeliveryMap, type CampaignDelivery } from '@/lib/freehold/campaign-delivery'
import {
  appendPermitToText,
  normalizePermitExpiry,
  permitDaysLeft,
  permitState,
  usablePermit,
} from '@/lib/freehold/trakheesi'

/**
 * How many days an attributed lead may sit unmoved in new/contacted before the
 * machine asks its owner the softer 0–10 "how likely would <name> buy" score
 * question instead of waiting forever for a status change. Younger unmoved
 * leads get no question yet — asking on day 0 would just harvest noise.
 */
export const SCORE_ASK_AFTER_DAYS = 3

// Rotation policy constants — named so the activity log can cite them.
const MIN_DECISIVE_VERDICTS = 3          // human answers needed before verdicts can condemn or protect
const CONDEMN_YES_RATIO = 0.4            // below this, a verdict-condemned trial pauses (no spend gate)
const PROTECT_YES_RATIO = 0.7            // at/above this, a trial is protected from the metric branches
const SPEND_GATE_MULTIPLIER = 3          // metric branches need spend ≥ 3× the trial's daily budget
const CPL_CONDEMN_MULTIPLIER = 1.5       // CPL branch: trial CPL > 1.5× best sibling CPL (both ≥3 leads)
const MIN_LEADS_FOR_CPL = 3
const QUALITY_CONDEMN_BELOW = 40         // quality branch: trial CRM quality < 40 …
const QUALITY_SIBLING_AT_LEAST = 60      // … while a sibling holds ≥ 60
// Re-plan policy: once every planned trial is launched, the machine may MINT a
// new Meta arm around a proven winner (its targeting broadened one age step)
// instead of only concentrating budget — bounded hard so arms can't multiply.
const EXPLORE_PREFIX = 'Explore'         // trial-label prefix for minted arms
const MAX_EXPLORE_ARMS_PER_PROJECT = 2   // lifetime cap on minted arms per project
// Delivery policy. A brand-new campaign legitimately reads as not-delivering
// for a while (review, processing, ramp), so acting on that state instantly
// would kill healthy trials at birth. Rejection is different — it is terminal
// until the ad itself changes — so it needs no grace at all.
const DELIVERY_GRACE_HOURS = 24          // not_delivering must persist this long before we stop it
const REVIEW_ALARM_HOURS = 48            // in-review beyond this is called out (never auto-paused)
// Machine-wide zero-lead alarm: spending this many times the DAILY cap with
// not one lead anywhere means the problem is upstream of ad rotation.
const ZERO_LEAD_ALARM_CAP_MULTIPLE = 3
/** Delivery states in which the platform IS serving (and therefore spending). */
const SERVING_STATES: ReadonlySet<CampaignDelivery['state']> =
  new Set<CampaignDelivery['state']>(['delivering', 'learning', 'learning_limited', 'limited'])

export interface CycleResult {
  machineId: string
  status: AdsMachine['status']
  ran: boolean
  launched: string[]
  capSkipped: string[]
  /** Trials not launched because their project's Trakheesi permit is missing
   *  or has lapsed. */
  permitBlocked: string[]
  /** LIVE campaigns stopped because their project's permit expired while they
   *  were running — compliance, not performance. */
  permitStopped: string[]
  /** Campaigns stopped because the PLATFORM is not serving them (rejected,
   *  ended, externally paused, or persistently not delivering). Nothing to do
   *  with performance — these were holding budget without running. */
  deliveryStopped: string[]
  googleDraftsPrepared: string[]
  observed: number
  verdictRequestsCreated: number
  paused: string[]
  budgetShifts: string[]
  errors: string[]
}

/**
 * Per-channel CPL basis (leadBasis): each channel's lead count is its own
 * honest source-of-truth. Meta reports actual lead events ('lead' actions), so
 * Meta trials keep using Meta-reported leads. Google 'conversions' are NOT
 * leads (they can be any conversion action configured on the account), so
 * Google trials use ATTRIBUTED CRM LEADS — real leads that arrived with
 * utm_id = the Google campaign id (stamped by the campaign tracking template).
 * The basis is recorded on every observation so no number pretends to be what
 * it isn't.
 *
 * COMPARABILITY. Those two bases are NOT interchangeable. Meta-reported counts
 * every lead event the platform saw; CRM-attributed counts only the leads that
 * reached our CRM carrying the campaign's utm. The second is systematically
 * smaller, so a Google trial's CPL looks worse than a Meta trial's for purely
 * measurement reasons — and the rotation would pause Google trials that are
 * actually performing. Cross-channel comparisons therefore use
 * attributedCplAed, the CPL on the basis BOTH channels share; same-channel
 * comparisons keep the native basis, which is identical on both sides and
 * more timely.
 */
interface TrialState {
  row: MachineCampaign
  planTrial: MachineTrialPlan | null
  campaignName: string
  spendAed: number
  /** Lead count the CPL divides by — see leadBasis for what it honestly is. */
  leads: number
  leadBasis: 'meta-reported' | 'crm-attributed'
  cplAed: number | null
  /** CPL on the ONE basis every channel shares: real CRM-attributed leads.
   *  Cross-channel comparisons must use this — see cplCondemned. */
  attributedCplAed: number | null
  qualityScore: number | null
  attributed: number
  verdicts: TrialVerdictStats | null
  /** What the PLATFORM says about this trial's delivery. Recorded on every
   *  observation so a zero-lead trial can be read correctly: "nobody converted"
   *  and "the ad never ran" look identical in the numbers alone. */
  delivery: CampaignDelivery | null
}

const trialChannel = (t: MachineTrialPlan): MachineChannel => t.channel ?? 'meta'

/** Pause/resume a trial's campaign on its own platform. */
async function setPlatformStatus(row: MachineCampaign, running: boolean): Promise<void> {
  if (row.channel === 'google') {
    await googleUpdateCampaignStatus(row.campaignId, running ? 'ENABLED' : 'PAUSED')
  } else {
    await metaUpdateCampaignStatus(row.campaignId, running ? 'ACTIVE' : 'PAUSED')
  }
}

const emptyResult = (machineId: string, status: AdsMachine['status'], ran: boolean): CycleResult => ({
  machineId, status, ran,
  launched: [], capSkipped: [], permitBlocked: [], permitStopped: [], deliveryStopped: [], googleDraftsPrepared: [],
  observed: 0, verdictRequestsCreated: 0,
  paused: [], budgetShifts: [], errors: [],
})

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e))

/**
 * The permit gate applied OUTSIDE a cycle. The compliance stop is worthless if
 * the very next click puts the campaign back on air, so every path that turns a
 * trial ON — machine resume, the dashboard's per-trial switch — has to consult
 * it too. Returns the expiry date when this project's permit has lapsed (i.e.
 * "refuse, and here's why"), or null when there is nothing to object to.
 */
function expiredPermitFor(machine: AdsMachine, projectSlug: string, now: Date = new Date()): string | null {
  const plan = machine.plan
  if (!plan?.viable) return null
  const p = plan.projects.find((x) => x.slug === projectSlug)
  if (!p) return null
  return permitState(p.permitNumber, p.permitExpiry, now) === 'expired'
    ? (normalizePermitExpiry(p.permitExpiry) ?? '')
    : null
}

function planTrials(plan: MachinePlan): MachineTrialPlan[] {
  return plan.viable ? plan.projects.flatMap((p) => p.trials) : []
}

function findPlanTrial(plan: MachinePlan, row: MachineCampaign): MachineTrialPlan | null {
  return planTrials(plan).find((t) => t.projectSlug === row.projectSlug && t.label === row.trialLabel) ?? null
}

// Canonical Meta lead extraction — shared with every surface that counts
// leads, so no page can drift back into summing overlapping action types.
const leadsFromInsights = (actions: Array<{ action_type: string; value: string }> | undefined) =>
  metaLeadCount(actions)

function verdictEvidence(v: TrialVerdictStats | null): string {
  if (!v || v.decisive === 0) return 'no decisive human verdicts yet'
  return `${v.no} of ${v.decisive} decisively-rated leads marked NO (${v.yes} YES, ${v.answered - v.decisive} neutral, ${v.pending} pending)`
}

// ─── Verdict creation (EVALUATE) ─────────────────────────────────────────────

interface AttributedLead {
  id: string
  name: string | null
  phone: string | null
  status: string | null
  blocked: boolean | null
  assigned_broker_id: string | null
  created_at: string
  /** Most recent 'stage' activity — null when the lead was never moved. */
  last_stage_at: string | null
}

/** Resolve a lead's assigned broker to an email via freehold_site_users —
 * same id-or-email semantics notifyBrokerOfAssignedLead uses. Unresolved →
 * null (the row lands in the management/admin queue). */
async function resolveOwnerEmail(
  brokerId: string | null,
  cache: Map<string, string | null>,
): Promise<string | null> {
  if (!brokerId) return null
  if (cache.has(brokerId)) return cache.get(brokerId) ?? null
  let email: string | null = null
  try {
    const rows = await query<{ email: string | null }>(
      `SELECT email FROM freehold_site_users WHERE id::text = $1 OR lower(email) = lower($1) LIMIT 1`,
      [brokerId],
    )
    email = rows[0]?.email ? String(rows[0].email).toLowerCase() : null
  } catch { email = null }
  cache.set(brokerId, email)
  return email
}

/**
 * Build verdict requests for one campaign's newly-attributed CRM leads.
 * Attribution matching is EXACTLY getCampaignQuality's: utm_id = campaign id
 * OR lower(utm_campaign) = lower(campaign name). Leads flagged by the
 * training-integrity burst filter are skipped entirely — the machine never
 * asks a human to confirm a quarantined outcome.
 */
async function buildVerdictRequests(
  machineId: string,
  campaignId: string,
  campaignName: string,
  untrusted: Set<string>,
  ownerCache: Map<string, string | null>,
): Promise<VerdictRequestInput[]> {
  let leads: AttributedLead[] = []
  try {
    // last_stage_at: the most recent REAL stage change from the CRM activity
    // log — "unmoved for N days" is measured from the last time a human moved
    // the lead, not from when it arrived. A lead someone advanced yesterday
    // is not stale, however old it is.
    leads = await query<AttributedLead>(
      `SELECT l.id, l.name, l.phone, l.status, l.blocked, l.assigned_broker_id, l.created_at,
              (SELECT MAX(a.created_at) FROM freehold_site_lead_activity a
                WHERE a.lead_id = l.id AND a.activity_type = 'stage') AS last_stage_at
       FROM freehold_site_leads l
       WHERE l.archived IS NOT TRUE
         AND ( ($1 <> '' AND l.utm_id = $1) OR ($2 <> '' AND lower(l.utm_campaign) = lower($2)) )`,
      [campaignId || '', campaignName || ''],
    )
  } catch { return [] }

  const out: VerdictRequestInput[] = []
  const now = Date.now()
  for (const lead of leads) {
    if (untrusted.has(lead.id)) continue

    const status = lead.status ?? 'new'
    const movedPast = lead.blocked === true || (status !== 'new' && status !== 'contacted')

    let questionKind: QuestionKind
    let suggested: 'yes' | 'no' | null = null
    if (movedPast) {
      // The CRM already carries a real judgment signal — ask the owner to
      // CONFIRM it, pre-filling the honest suggestion (pre-fill only, never
      // counted as an answer).
      questionKind = 'confirm'
      if (QUALIFIED_STATUSES.has(status)) suggested = 'yes'
      else if (lead.blocked === true || (status === 'lost' && badPhone(lead.phone))) suggested = 'no'
    } else {
      // Still sitting in new/contacted: after SCORE_ASK_AFTER_DAYS *since the
      // last stage change* (falling back to arrival when it was never moved)
      // we ask the softer 0–10 buying-likelihood score; recently-touched
      // leads wait — the clock restarts every time a human moves the stage.
      const sinceIso = lead.last_stage_at ?? lead.created_at
      const ageDays = (now - new Date(sinceIso).getTime()) / 86_400_000
      if (!(ageDays >= SCORE_ASK_AFTER_DAYS)) continue
      questionKind = 'score'
    }

    out.push({
      machineId,
      leadId: lead.id,
      campaignId,
      questionKind,
      ownerEmail: await resolveOwnerEmail(lead.assigned_broker_id, ownerCache),
      suggestedVerdict: suggested,
    })
  }
  return out
}

// ─── Meta instant lead form (one per project per machine) ────────────────────

// The machine's forms are created server-side, so template strings resolve
// from the English dictionary directly (Meta form locale is en_US here; the
// operator can build localized forms in the full builder).
const tEn: TFn = (key, vars) => {
  let s = (p_forms.en as Record<string, string>)[key] ?? key
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v))
  return s
}

/**
 * Every Meta trial captures through a REAL Meta instant form — the same
 * "Investor qualification" template the wizard offers (name/email/phone +
 * budget bands around the listing's real price + timeline + purpose). The
 * form is created ONCE per project on first launch, written back into the
 * plan (setMachinePlan) so every later trial — including reallocation
 * launches — reuses it. Failure degrades honestly to the landing page and
 * is logged; the machine never launches nothing because a form failed.
 */
async function ensureProjectLeadForm(
  machineId: string,
  plan: MachinePlan & { viable: true },
  project: MachineProjectPlan,
): Promise<string | null> {
  if (project.leadFormId) return project.leadFormId
  const tpl = FORM_TEMPLATES.find((x) => x.key === 'investor')
  if (!tpl) return null
  const facts: ListingFacts = project.facts ?? {
    name: project.listingName,
    area: project.area,
    landingUrl: project.landingUrl,
  }
  try {
    const m = materializeTemplate(tpl, facts, tEn)
    const { id } = await createLeadForm({
      name: `Machine — ${project.listingName} — Qualification`,
      listingId: project.slug,
      listingName: project.listingName,
      // The form's follow-up button sends the qualified lead to the landing
      // page — carry the investor intent the qualification form implies, so
      // the page they land on leads with ROI and payment plan.
      landingUrl: withIntent(project.landingUrl, 'investor'),
      questions: [
        ...m.contact.map((type) => ({ type })),
        ...m.customs.map((q, i) => customToMetaQuestion(q, i)),
      ],
      privacyPolicyUrl: BRAND.privacyUrl,
      isOptimizedForQuality: m.higherIntent,
      ...(m.intro.enabled && m.intro.title && m.intro.bullets.length > 0
        ? { contextCard: { title: m.intro.title, style: 'LIST_STYLE', content: m.intro.bullets } }
        : {}),
      thankYouTitle: tEn('pforms.default.thankYouTitle'),
      thankYouBody: tEn('pforms.default.thankYouBody'),
      // The machine collects no business phone — a call button can't be sent.
      thankYouButtonType: m.thankYouButton === 'CALL_BUSINESS' ? 'VIEW_WEBSITE' : m.thankYouButton,
      ...(m.thankYouWebsiteUrl ? { thankYouWebsiteUrl: m.thankYouWebsiteUrl } : {}),
    })
    project.leadFormId = id
    await setMachinePlan(machineId, plan)
    await logActivity({
      machineId,
      kind: 'observation',
      detail: `Created Meta instant form "Machine — ${project.listingName} — Qualification" (${id}) — this project's lead trials capture in-ad with budget/timeline/purpose qualification.`,
      data: { projectSlug: project.slug, leadFormId: id },
    })
    return id
  } catch (e) {
    await logActivity({
      machineId,
      kind: 'error',
      detail: `Instant-form creation for ${project.listingName} failed: ${errMsg(e)} — launching with the landing page instead.`,
      data: { projectSlug: project.slug },
    })
    return null
  }
}

// ─── The cycle ───────────────────────────────────────────────────────────────

export async function runMachineCycle(machineId: string): Promise<CycleResult> {
  const machine = await getMachine(machineId)
  if (!machine) throw new Error(`Ads machine not found: ${machineId}`)

  // Only a running machine launches/rotates; a paused machine still gets
  // EVALUATE (observe + verdict requests) so the feedback loop keeps filling.
  if (machine.status !== 'running' && machine.status !== 'paused') {
    return emptyResult(machineId, machine.status, false)
  }
  const plan = machine.plan
  if (!plan || !plan.viable) {
    return emptyResult(machineId, machine.status, false)
  }

  // Serialize cycles per machine. The combined hard cap is checked fresh
  // before every launch, but two cycles running at once (cron firing while an
  // operator clicks Run/Start, or a double-click) would each read the spend
  // BEFORE either inserts its campaigns — both pass the cap and both launch,
  // so live spend could exceed the "hard" cap and a trial could launch twice.
  // A session advisory lock lets only one cycle per machine proceed; a
  // concurrent caller gets an honest no-op (ran:false) instead.
  const lockKey = advisoryKey(machineId)
  const gotLock = await tryAdvisoryLock(lockKey)
  if (!gotLock) return emptyResult(machineId, machine.status, false)

  try {
  const result = emptyResult(machineId, machine.status, true)
  let campaigns = await listMachineCampaigns(machineId)

  // ── Trakheesi permit per project ──────────────────────────────────────────
  // A permit is not a one-time checkbox: DET issues it for a fixed window, and
  // an ad still running past that window is exactly as non-compliant as one
  // that never had a permit. `permitBySlug` therefore holds the permit only
  // while it is USABLE TODAY — a lapsed permit reads as null, so every gate
  // built on this map (launch, reallocation, explore arms) closes on expiry
  // without needing to learn about dates. The raw values are kept alongside so
  // the machine can say *why* in its own log instead of just refusing.
  const now = new Date()
  const permitBySlug = new Map(plan.projects.map((p) => [p.slug, usablePermit(p.permitNumber, p.permitExpiry, now)]))
  const permitStateBySlug = new Map(plan.projects.map((p) => [p.slug, permitState(p.permitNumber, p.permitExpiry, now)]))
  const permitExpiryBySlug = new Map(plan.projects.map((p) => [p.slug, normalizePermitExpiry(p.permitExpiry)]))
  const permitProblem = (slug: string): string => {
    const state = permitStateBySlug.get(slug)
    if (state === 'expired') {
      return `its Trakheesi advertising permit expired on ${permitExpiryBySlug.get(slug)}`
    }
    return 'it has no Trakheesi advertising permit on file'
  }

  // ── COMPLIANCE STOP (running only) ────────────────────────────────────────
  // The gap this closes: the permit was only ever checked at LAUNCH, so a
  // campaign that started legally kept spending forever after its permit
  // lapsed. Money is not the reason here and performance is irrelevant — this
  // runs before everything else, stops EVERY affected trial (not the rotation's
  // one-per-project), and ignores protection, spend gates and verdicts. Freed
  // budget is deliberately NOT reallocated: not spending is always compliant.
  if (machine.status === 'running') {
    for (const row of campaigns) {
      if (row.status !== 'active') continue
      // Only act on a permit we can positively judge. A campaign whose project
      // is no longer in the plan (re-planning drops projects) is left alone —
      // absence of data is not evidence of a lapse, and pausing live spend on
      // a guess would be its own kind of wrong.
      if (permitStateBySlug.get(row.projectSlug) !== 'expired') continue
      const expiredOn = permitExpiryBySlug.get(row.projectSlug)
      try {
        await setPlatformStatus(row, false)
      } catch (e) {
        await logActivity({
          machineId, kind: 'error',
          detail: `URGENT — "${row.trialLabel}" (${row.projectSlug}) is still running on a Trakheesi permit that expired on ${expiredOn}, and the ${row.channel === 'google' ? 'Google' : 'Meta'} pause failed: ${errMsg(e)}. Stop this campaign by hand.`,
          campaignId: row.campaignId,
        })
        result.errors.push(`permit_stop:${row.campaignId}`)
        continue
      }
      await updateMachineCampaign(row.id, { status: 'paused' })
      await logActivity({
        machineId,
        kind: 'permit_blocked',
        detail: `Stopped "${row.trialLabel}" (${row.projectSlug}): its Trakheesi advertising permit expired on ${expiredOn}, and a Dubai property ad may not run without a valid one. Renew the permit and update its expiry in the plan, then run a cycle to restart it. AED ${row.dailyBudgetAed}/day is no longer committed.`,
        campaignId: row.campaignId,
        data: { projectSlug: row.projectSlug, permitExpiry: expiredOn, freedAed: row.dailyBudgetAed },
      })
      result.permitStopped.push(row.campaignId)
    }
    if (result.permitStopped.length > 0) campaigns = await listMachineCampaigns(machineId)
  }

  // Renewal warning — loud BEFORE the ads have to stop, so a permit can be
  // renewed instead of a campaign being interrupted. Also names the projects
  // running with no expiry on file at all: the machine cannot vouch for those,
  // and saying so beats silently treating them as valid forever.
  if (machine.status === 'running') {
    const liveSlugs = new Set(campaigns.filter((c) => c.status === 'active').map((c) => c.projectSlug))
    const expiring = [...liveSlugs].filter((s) => permitStateBySlug.get(s) === 'expiring')
    const undated = [...liveSlugs].filter((s) => permitStateBySlug.get(s) === 'no_expiry')
    if (expiring.length > 0 || undated.length > 0) {
      const parts: string[] = []
      for (const s of expiring) {
        parts.push(`${s} — permit expires ${permitExpiryBySlug.get(s)} (${permitDaysLeft(permitExpiryBySlug.get(s), now)} day(s) left)`)
      }
      if (undated.length > 0) {
        parts.push(`no expiry date on file for ${undated.join(', ')} — the machine cannot confirm those permits are still valid`)
      }
      await logActivity({
        machineId,
        kind: 'permit_warning',
        detail: `Trakheesi check: ${parts.join('; ')}.`,
        data: { expiring, undated },
      })
    }
  }

  // ── LAUNCH (running only) ──────────────────────────────────────────────────
  // Google is a LIVE channel: its planned trials launch for real, under the
  // same fresh COMBINED cap check as Meta launches. One cap governs both.
  if (machine.status === 'running') {
    for (const trial of planTrials(plan)) {
      const channel = trialChannel(trial)
      const already = campaigns.some(
        (c) => c.channel === channel && c.projectSlug === trial.projectSlug && c.trialLabel === trial.label,
      )
      if (already) continue

      // ── Trakheesi compliance gate — no VALID permit, no ad (Dubai law).
      // `permitBySlug` is already expiry-aware, so a lapsed permit fails here
      // exactly like a missing one; only the wording differs. ──
      const permit = permitBySlug.get(trial.projectSlug) ?? null
      if (!permit) {
        await logActivity({
          machineId,
          kind: 'permit_blocked',
          detail: `Not launched — ${permitProblem(trial.projectSlug)} for "${trial.listingName}", so "${trial.label}" cannot run in Dubai. Add or renew the DLD permit (and its expiry date) in the launch review, then run a cycle.`,
          data: { trialId: trial.id, projectSlug: trial.projectSlug, permitState: permitStateBySlug.get(trial.projectSlug) ?? null },
        })
        result.permitBlocked.push(trial.id)
        continue
      }

      // FRESH cap check immediately before every launch — the cap is the sum
      // of ACTIVE daily budgets across BOTH channels and must never be exceeded.
      const committed = await activeSpendAed(machineId)
      if (committed + trial.dailyBudgetAed > machine.dailyCapAed) {
        await logActivity({
          machineId,
          kind: 'cap_enforced',
          detail: `Skipped launching "${trial.label}" for ${trial.listingName}: AED ${committed} already committed + AED ${trial.dailyBudgetAed} would exceed the AED ${machine.dailyCapAed}/day cap.`,
          data: { trialId: trial.id, channel, committed, requested: trial.dailyBudgetAed, cap: machine.dailyCapAed },
        })
        result.capSkipped.push(trial.id)
        continue
      }

      if (channel === 'google') {
        if (!trial.google) {
          await logActivity({ machineId, kind: 'error', detail: `Google trial "${trial.label}" for ${trial.listingName} has no launch payload in the plan — skipped.`, data: { trialId: trial.id } })
          result.errors.push(`launch:${trial.id}`)
          continue
        }
        // Compliance: the permit must be visible in the ad. Add a dedicated RSA
        // description carrying it (within Google's 4-description / 90-char cap).
        const permitDesc = `DLD Permit ${permit}`.slice(0, 90)
        const gDescriptions = trial.google.descriptions.includes(permitDesc)
          ? trial.google.descriptions
          : [...trial.google.descriptions, permitDesc].slice(0, 4)
        const payload = { ...trial.google, descriptions: gDescriptions, dailyBudgetAED: trial.dailyBudgetAed }
        try {
          // Atomic real create (budget → campaign PAUSED → ad group → RSA →
          // keywords), then ENABLED immediately — Google spend authority is
          // the same autonomous-within-cap model as Meta.
          const { campaignId } = await launchSearchCampaign(payload)
          let enabled = true
          try {
            await googleUpdateCampaignStatus(campaignId, 'ENABLED')
          } catch (e) {
            enabled = false
            await logActivity({
              machineId, kind: 'error',
              detail: `Google campaign for "${trial.label}" (${trial.listingName}) was created PAUSED but enabling it failed: ${errMsg(e)}. It is recorded paused and will not spend until resumed.`,
              campaignId,
              data: { trialId: trial.id },
            })
            result.errors.push(`enable:${trial.id}`)
          }
          await addMachineCampaign({
            machineId,
            channel: 'google',
            campaignId,
            projectSlug: trial.projectSlug,
            trialLabel: trial.label,
            dailyBudgetAed: trial.dailyBudgetAed,
            status: enabled ? 'active' : 'paused',
          })
          if (enabled) {
            await logActivity({
              machineId,
              kind: 'launched',
              detail: `Launched "${trial.label}" (${trial.source}) for ${trial.listingName} ENABLED at AED ${trial.dailyBudgetAed}/day. ${trial.rationale}`,
              campaignId,
              data: { trialId: trial.id, channel: 'google', copySource: trial.copySource },
            })
            result.launched.push(campaignId)
          }
        } catch (e) {
          if (e instanceof GoogleConfigError) {
            // Honest degradation: Google isn't connected, so this trial stays
            // a local PAUSED draft that never spends — the machine keeps
            // running its Meta trials.
            try {
              const draft = await createLocalCampaign(payload, `ads-machine:${machineId}`)
              await addMachineCampaign({
                machineId,
                channel: 'google',
                campaignId: draft.id,
                projectSlug: trial.projectSlug,
                trialLabel: trial.label,
                dailyBudgetAed: trial.dailyBudgetAed,
                status: 'draft',
              })
              await logActivity({
                machineId,
                kind: 'google_draft_prepared',
                detail: `Google Ads is not connected — prepared "${trial.label}" for ${trial.listingName} as a local PAUSED draft (planned AED ${trial.dailyBudgetAed}/day; it spends nothing until Google is connected and it is launched).`,
                campaignId: draft.id,
                data: { trialId: trial.id, projectSlug: trial.projectSlug },
              })
              result.googleDraftsPrepared.push(draft.id)
            } catch (e2) {
              await logActivity({ machineId, kind: 'error', detail: `Google draft fallback for "${trial.label}" (${trial.projectSlug}) failed: ${errMsg(e2)}`, data: { trialId: trial.id } })
              result.errors.push(`launch:${trial.id}`)
            }
          } else {
            await logActivity({
              machineId,
              kind: 'error',
              detail: `Google launch of "${trial.label}" for ${trial.listingName} failed: ${errMsg(e)}`,
              data: { trialId: trial.id },
            })
            result.errors.push(`launch:${trial.id}`)
          }
        }
        continue
      }

      // Meta trial.
      if (!trial.targeting || !trial.creative) {
        await logActivity({ machineId, kind: 'error', detail: `Meta trial "${trial.label}" for ${trial.listingName} has no targeting/creative in the plan — skipped.`, data: { trialId: trial.id } })
        result.errors.push(`launch:${trial.id}`)
        continue
      }
      try {
        // In-ad instant form when the project has (or can get) one; the
        // landing page is the honest fallback, never a silent no-op.
        const project = plan.projects.find((p) => p.slug === trial.projectSlug)
        const leadFormId = project ? await ensureProjectLeadForm(machineId, plan, project) : null
        // Compliance: surface the Trakheesi permit in the ad's own body copy.
        const creativeWithPermit = {
          ...trial.creative,
          primaryText: appendPermitToText(trial.creative.primaryText, permit),
        }
        const launch = await launchFullCampaign({
          campaignName: trial.campaignName,
          objective: 'LEAD_GENERATION',
          listingName: trial.listingName,
          dailyBudgetAED: trial.dailyBudgetAed,
          targeting: trial.targeting,
          creative: creativeWithPermit,
          launchStatus: 'ACTIVE',
          destination: leadFormId ? 'form' : 'landing',
          ...(leadFormId ? { leadFormId } : {}),
        })
        await addMachineCampaign({
          machineId,
          channel: 'meta',
          campaignId: launch.campaignId,
          projectSlug: trial.projectSlug,
          trialLabel: trial.label,
          dailyBudgetAed: trial.dailyBudgetAed,
          status: 'active',
        })
        await logActivity({
          machineId,
          kind: 'launched',
          detail: `Launched "${trial.label}" (${trial.source}) for ${trial.listingName} ACTIVE at AED ${trial.dailyBudgetAed}/day. ${trial.rationale}`,
          campaignId: launch.campaignId,
          data: { trialId: trial.id, channel: 'meta', adSetId: launch.adSetId, adId: launch.adId, copySource: trial.copySource },
        })
        result.launched.push(launch.campaignId)
      } catch (e) {
        await logActivity({
          machineId,
          kind: 'error',
          detail: `Meta launch of "${trial.label}" for ${trial.listingName} failed: ${errMsg(e)}`,
          data: { trialId: trial.id },
        })
        result.errors.push(`launch:${trial.id}`)
      }
    }
    campaigns = await listMachineCampaigns(machineId)
  }

  // ── DELIVERY (running only) ───────────────────────────────────────────────
  //
  // The machine could not see whether its ads were actually RUNNING. "Active"
  // is our own control flag; it says nothing about whether the platform is
  // serving the ad. A campaign the platform rejected — or one that quietly
  // ended, or that we paused outside the app — spends nothing and produces no
  // leads, and every rotation branch is built on spend and leads:
  //
  //   · the spend gate needs spend ≥ 3× daily budget → never true at 0 spend
  //   · the CPL branch needs ≥3 leads on both sides → never true
  //   · the quality branch needs a CRM score, which needs attributed leads
  //   · the verdict branch needs leads to ask humans about
  //
  // So a rejected trial was never condemned, never paused, and kept its daily
  // budget COMMITTED against the hard cap indefinitely — starving trials that
  // could actually run of headroom. The delivery state was already computed,
  // honestly and per-platform, for the dashboard; the decision-maker simply
  // never read it. It does now.
  const deliveryByCampaign: Record<string, CampaignDelivery> = machine.status === 'running'
    ? await getMachineDeliveryMap(campaigns.filter((c) => c.status === 'active' || c.status === 'paused')).catch(() => ({}))
    : {}

  if (machine.status === 'running') {
    for (const row of campaigns) {
      if (row.status !== 'active') continue
      const d = deliveryByCampaign[row.campaignId]
      if (!d) continue
      const ageHours = (now.getTime() - Date.parse(row.createdAt)) / 3_600_000
      const detail = d.detail ? ` (${d.detail})` : ''

      // Terminal on the platform → stop paying attention to it and, more to
      // the point, stop reserving its budget. `needsPlatformPause` is false
      // for states that are ALREADY not running: calling pause on those would
      // be a pointless API round-trip that can fail and block the bookkeeping.
      let reason: string | null = null
      let needsPlatformPause = true
      if (d.state === 'rejected') {
        reason = `the platform rejected it${detail}. It cannot serve until the ad is changed and resubmitted`
      } else if (d.state === 'ended') {
        reason = 'the platform reports it as ended/archived'
        needsPlatformPause = false
      } else if (d.state === 'paused') {
        // Drift: paused on the platform, active in our records. The machine
        // was counting budget for something that has not been running.
        reason = 'the platform reports it as paused, but this machine still had it running — reconciled'
        needsPlatformPause = false
      } else if (d.state === 'not_delivering' && ageHours >= DELIVERY_GRACE_HOURS) {
        reason = `it is not delivering${detail} — ${Math.round(ageHours)}h after launch`
      }

      if (!reason) {
        // Not terminal, but worth saying out loud while there is time to act.
        if (d.state === 'in_review' && ageHours >= REVIEW_ALARM_HOURS) {
          await logActivity({
            machineId, kind: 'delivery_blocked',
            detail: `"${row.trialLabel}" (${row.projectSlug}) has been awaiting platform review for ${Math.round(ageHours)}h${detail}. It is holding AED ${row.dailyBudgetAed}/day of the cap without serving. Not paused — review can still clear.`,
            campaignId: row.campaignId,
            data: { projectSlug: row.projectSlug, state: d.state, ageHours: Math.round(ageHours) },
          })
        }
        continue
      }

      if (needsPlatformPause) {
        try {
          await setPlatformStatus(row, false)
        } catch (e) {
          await logActivity({
            machineId, kind: 'error',
            detail: `Wanted to stop "${row.trialLabel}" (${row.projectSlug}) because ${reason}, but the ${row.channel === 'google' ? 'Google' : 'Meta'} pause failed: ${errMsg(e)}. Its budget is still committed.`,
            campaignId: row.campaignId,
          })
          result.errors.push(`delivery:${row.campaignId}`)
          continue
        }
      }
      await updateMachineCampaign(row.id, { status: 'paused' })
      await logActivity({
        machineId,
        kind: 'delivery_blocked',
        detail: `Stopped "${row.trialLabel}" (${row.projectSlug}): ${reason}. AED ${row.dailyBudgetAed}/day is no longer committed and can fund a trial that runs.`,
        campaignId: row.campaignId,
        data: { projectSlug: row.projectSlug, state: d.state, detail: d.detail ?? null, freedAed: row.dailyBudgetAed },
      })
      result.deliveryStopped.push(row.campaignId)
    }
    if (result.deliveryStopped.length > 0) campaigns = await listMachineCampaigns(machineId)

    // The SAME drift in the opposite direction, which is the dangerous one.
    // A trial this machine stopped but the platform is still serving spends
    // real money that `activeSpendAed` does not count — so the hard daily cap,
    // the one guarantee this whole engine is built to keep, silently stops
    // being true. Reported, never auto-corrected: re-pausing would override an
    // operator who deliberately re-enabled it on the platform, and marking it
    // active here would quietly reverse a condemnation the machine made on
    // evidence. Both are the operator's call; being told is not.
    for (const row of campaigns) {
      if (row.status !== 'paused') continue
      const d = deliveryByCampaign[row.campaignId]
      if (!d || !SERVING_STATES.has(d.state)) continue
      await logActivity({
        machineId,
        kind: 'delivery_blocked',
        detail: `"${row.trialLabel}" (${row.projectSlug}) is stopped in this machine but the platform reports it as ${d.state}${d.spendTodayAed ? `, having spent AED ${d.spendTodayAed} today` : ''}. That spend is NOT counted against the AED ${machine.dailyCapAed}/day cap. Either pause it on the platform or turn the trial back on here so the cap covers it.`,
        campaignId: row.campaignId,
        data: { projectSlug: row.projectSlug, state: d.state, spendTodayAed: d.spendTodayAed ?? null, drift: 'serving_while_stopped' },
      })
    }
  }

  // ── EVALUATE (running or paused) ──────────────────────────────────────────
  // Both channels: local Google drafts (status 'draft') are excluded — they
  // have no live campaign to read and never spend.
  const evalCampaigns = campaigns.filter((c) => c.status === 'active' || c.status === 'paused')
  const untrusted = await getUntrustedLeadIds().catch(() => new Set<string>())
  const verdictStats = await getVerdictStats(machineId).catch(() => new Map<string, TrialVerdictStats>())
  const ownerCache = new Map<string, string | null>()

  // Google metrics come from ONE listCampaigns read (it already carries
  // cost_micros/clicks/conversions per campaign), indexed by id. Scoped to
  // THIS_MONTH so Google spend is like-for-like with the Meta side (which
  // reads this_month) — otherwise a Google trial's LIFETIME cost would be
  // compared against a Meta this-month cost in the rotation's spend gate.
  let googleMetricsById: Map<string, GoogleCampaign> | null = null
  if (evalCampaigns.some((c) => c.channel === 'google')) {
    try {
      googleMetricsById = new Map((await listGoogleCampaigns('THIS_MONTH')).map((c) => [c.id, c]))
    } catch (e) {
      await logActivity({ machineId, kind: 'error', detail: `Google metrics read failed: ${errMsg(e)}` })
      result.errors.push('google:metrics')
    }
  }

  const states: TrialState[] = []
  const verdictRequests: VerdictRequestInput[] = []
  for (const row of evalCampaigns) {
    const planTrial = findPlanTrial(plan, row)
    const campaignName = planTrial?.campaignName ?? ''

    let spendAed = 0
    let metaLeads = 0
    if (row.channel === 'meta') {
      try {
        const insights = await getCampaignInsights(row.campaignId)
        spendAed = Number(insights?.spend) || 0
        metaLeads = leadsFromInsights(insights?.actions)
      } catch (e) {
        await logActivity({ machineId, kind: 'error', detail: `Insights read failed for ${row.trialLabel}: ${errMsg(e)}`, campaignId: row.campaignId })
        result.errors.push(`insights:${row.campaignId}`)
      }
    } else {
      // Real Google spend: cost_micros → AED (account currency is AED,
      // 1 AED = 1e6 micros). A missing read leaves spend at 0 — honest "no
      // signal", which also keeps the rotation spend gate from firing.
      const m = googleMetricsById?.get(row.campaignId)
      if (m?.metrics) spendAed = m.metrics.costMicros / 1_000_000
    }

    let qualityScore: number | null = null
    let attributed = 0
    try {
      const quality = await getCampaignQuality(row.campaignId, campaignName)
      qualityScore = quality.score
      attributed = quality.attributed
    } catch (e) {
      // Fail-soft (quality stays null — honest "no signal", never invented),
      // but observable: symmetric with the insights-read failure above.
      await logActivity({ machineId, kind: 'error', detail: `CRM quality read failed for ${row.trialLabel}: ${errMsg(e)}`, campaignId: row.campaignId })
      result.errors.push(`quality:${row.campaignId}`)
    }

    verdictRequests.push(...await buildVerdictRequests(machineId, row.campaignId, campaignName, untrusted, ownerCache))

    // CPL basis per channel: Meta = Meta-reported lead actions; Google =
    // attributed CRM leads (Google conversions are NOT leads). See TrialState.
    const leadBasis: TrialState['leadBasis'] = row.channel === 'meta' ? 'meta-reported' : 'crm-attributed'
    const leads = row.channel === 'meta' ? metaLeads : attributed

    states.push({
      row,
      planTrial,
      campaignName,
      spendAed,
      leads,
      leadBasis,
      cplAed: leads > 0 ? spendAed / leads : null,
      attributedCplAed: attributed > 0 ? spendAed / attributed : null,
      qualityScore,
      attributed,
      verdicts: verdictStats.get(row.campaignId) ?? null,
      delivery: deliveryByCampaign[row.campaignId] ?? null,
    })
  }

  const created = await insertLeadVerdictRequests(verdictRequests)
  result.verdictRequestsCreated = created
  if (created > 0) {
    const trialCount = new Set(verdictRequests.map((r) => r.campaignId)).size
    await logActivity({
      machineId,
      kind: 'feedback_request',
      detail: `Asked for broker feedback on ${created} new lead(s) across ${trialCount} trial(s).`,
      data: { created, trials: trialCount },
    })
  }

  if (states.length > 0) {
    result.observed = states.length
    const committed = await activeSpendAed(machineId)
    await logActivity({
      machineId,
      kind: 'observation',
      detail: `Observed ${states.length} trial(s): AED ${committed}/${machine.dailyCapAed} combined daily budget committed (Meta + Google); ` +
        states.map((s) =>
          `${s.row.trialLabel}[${s.row.channel}/${s.row.status}] spend AED ${Math.round(s.spendAed)}, ` +
          `${s.leads} ${s.leadBasis === 'meta-reported' ? 'Meta-reported leads' : 'CRM-attributed leads'}` +
          `${s.cplAed != null ? `, CPL AED ${s.cplAed.toFixed(0)}` : ''}` +
          `${s.qualityScore != null ? `, quality ${s.qualityScore}` : ', quality n/a'}` +
          `${s.verdicts && s.verdicts.decisive > 0 ? `, verdicts ${s.verdicts.yes}Y/${s.verdicts.no}N` : ''}`,
        ).join('; '),
      data: {
        committedAed: committed,
        capAed: machine.dailyCapAed,
        trials: states.map((s) => ({
          campaignId: s.row.campaignId,
          trialLabel: s.row.trialLabel,
          projectSlug: s.row.projectSlug,
          channel: s.row.channel,
          status: s.row.status,
          dailyBudgetAed: s.row.dailyBudgetAed,
          spendAed: s.spendAed,
          leads: s.leads,
          // Per-channel CPL basis, recorded so the numbers never lie:
          // 'meta-reported' = Meta lead actions (this_month insights window);
          // 'crm-attributed' = real CRM leads matched by utm (Google spend is
          // the campaign's lifetime cost from the Google Ads API).
          leadBasis: s.leadBasis,
          cplAed: s.cplAed,
          attributedCplAed: s.attributedCplAed,
          qualityScore: s.qualityScore,
          attributed: s.attributed,
          verdicts: s.verdicts,
          deliveryState: s.delivery?.state ?? null,
          deliveryDetail: s.delivery?.detail ?? null,
          spendTodayAed: s.delivery?.spendTodayAed ?? null,
        })),
      },
    })
  }

  // ── ROTATE (running only; deterministic; ≤1 pause per project per cycle) ──
  if (machine.status === 'running') {
    const activeStates = states.filter((s) => s.row.status === 'active')
    const byProject = new Map<string, TrialState[]>()
    for (const s of activeStates) {
      const list = byProject.get(s.row.projectSlug)
      if (list) list.push(s)
      else byProject.set(s.row.projectSlug, [s])
    }

    for (const [projectSlug, group] of byProject) {
      const decisive = (s: TrialState) => s.verdicts?.decisive ?? 0
      const yesRatio = (s: TrialState) => s.verdicts?.yesRatio ?? null

      // Protection: strong human endorsement blocks the METRIC branches only
      // (the verdict branch can't fire on a protected trial by construction).
      const isProtected = (s: TrialState) => {
        const r = yesRatio(s)
        return decisive(s) >= MIN_DECISIVE_VERDICTS && r !== null && r >= PROTECT_YES_RATIO
      }

      // (V) Verdict-condemned — humans said NO. Fires regardless of CPL:
      // cheap junk leads are still junk.
      const verdictCondemned = (s: TrialState) => {
        const r = yesRatio(s)
        return decisive(s) >= MIN_DECISIVE_VERDICTS && r !== null && r < CONDEMN_YES_RATIO
      }

      const spendGated = (s: TrialState) => s.spendAed >= SPEND_GATE_MULTIPLIER * s.row.dailyBudgetAed

      // (C) CPL-condemned vs best sibling — both sides need ≥3 leads for the
      // ratio to mean anything, and both must be measured the SAME way.
      //   · same channel  → native basis (identical on both sides, timelier)
      //   · cross channel → CRM-attributed, the only shared basis
      // Comparing Meta-reported against CRM-attributed condemned Google trials
      // for being measured more conservatively, not for performing worse.
      const cplCondemnedBy = (s: TrialState): 'native' | 'attributed' | null => {
        if (!spendGated(s) || isProtected(s)) return null
        if (s.cplAed !== null && s.leads >= MIN_LEADS_FOR_CPL) {
          const same = group
            .filter((o) => o !== s && o.row.channel === s.row.channel && o.cplAed !== null && o.leads >= MIN_LEADS_FOR_CPL)
            .map((o) => o.cplAed as number)
          if (same.length && s.cplAed > CPL_CONDEMN_MULTIPLIER * Math.min(...same)) return 'native'
        }
        if (s.attributedCplAed !== null && s.attributed >= MIN_LEADS_FOR_CPL) {
          const cross = group
            .filter((o) => o !== s && o.row.channel !== s.row.channel && o.attributedCplAed !== null && o.attributed >= MIN_LEADS_FOR_CPL)
            .map((o) => o.attributedCplAed as number)
          if (cross.length && s.attributedCplAed > CPL_CONDEMN_MULTIPLIER * Math.min(...cross)) return 'attributed'
        }
        return null
      }
      const cplCondemned = (s: TrialState) => cplCondemnedBy(s) !== null

      // (Q) Quality-condemned — this trial's CRM quality is bad while a
      // sibling proves the project itself converts.
      const qualityCondemned = (s: TrialState) => {
        if (!spendGated(s) || isProtected(s)) return false
        if (s.qualityScore === null || s.qualityScore >= QUALITY_CONDEMN_BELOW) return false
        return group.some((o) => o !== s && o.qualityScore !== null && o.qualityScore >= QUALITY_SIBLING_AT_LEAST)
      }

      const candidates = group
        .filter((s) => verdictCondemned(s) || cplCondemned(s) || qualityCondemned(s))
        .sort((a, b) => {
          const av = verdictCondemned(a) ? 0 : 1
          const bv = verdictCondemned(b) ? 0 : 1
          if (av !== bv) return av - bv                       // verdict-condemned first
          return (b.cplAed ?? -1) - (a.cplAed ?? -1)          // then highest CPL
        })

      const target = candidates[0]
      if (!target) continue

      const reasons: string[] = []
      if (verdictCondemned(target)) reasons.push(`human verdicts condemned it (yes-ratio ${(100 * (yesRatio(target) ?? 0)).toFixed(0)}% < ${CONDEMN_YES_RATIO * 100}%)`)
      const cplBasis = cplCondemnedBy(target)
      if (cplBasis === 'native') {
        reasons.push(`CPL AED ${target.cplAed!.toFixed(0)} (${target.leadBasis}) > ${CPL_CONDEMN_MULTIPLIER}× the best same-channel sibling`)
      } else if (cplBasis === 'attributed') {
        reasons.push(`CPL AED ${target.attributedCplAed!.toFixed(0)} on CRM-attributed leads > ${CPL_CONDEMN_MULTIPLIER}× the best sibling on the same basis`)
      }
      if (qualityCondemned(target)) reasons.push(`CRM quality ${target.qualityScore} < ${QUALITY_CONDEMN_BELOW} while a sibling holds ≥ ${QUALITY_SIBLING_AT_LEAST}`)
      const evidence = `Evidence: ${verdictEvidence(target.verdicts)}; spend AED ${Math.round(target.spendAed)} on AED ${target.row.dailyBudgetAed}/day.`

      // Pause on the trial's OWN platform FIRST — a failed pause means the
      // budget is NOT freed, so no reallocation happens.
      try {
        await setPlatformStatus(target.row, false)
      } catch (e) {
        await logActivity({
          machineId, kind: 'error',
          detail: `Wanted to pause "${target.row.trialLabel}" (${projectSlug}) — ${reasons.join('; ')} — but the ${target.row.channel === 'google' ? 'Google' : 'Meta'} pause failed: ${errMsg(e)}. No budget was reallocated.`,
          campaignId: target.row.campaignId,
        })
        result.errors.push(`pause:${target.row.campaignId}`)
        continue
      }

      await updateMachineCampaign(target.row.id, { status: 'paused' })
      await logActivity({
        machineId,
        kind: 'trial_paused',
        detail: `Paused "${target.row.trialLabel}" (${projectSlug}): ${reasons.join('; ')}. ${evidence}`,
        campaignId: target.row.campaignId,
        data: {
          projectSlug,
          reasons,
          cplAed: target.cplAed,
          qualityScore: target.qualityScore,
          verdicts: target.verdicts,
          freedAed: target.row.dailyBudgetAed,
        },
      })
      result.paused.push(target.row.campaignId)

      // ── Reallocate the freed budget, always under the combined cap.
      // Cross-channel is allowed: budget freed on one channel may fund the
      // other — each mutation goes through its own channel's client. ──
      const freed = target.row.dailyBudgetAed
      const campaignsNow = await listMachineCampaigns(machineId)
      const headroomAfterPause = machine.dailyCapAed - await activeSpendAed(machineId)

      // First choice: a planned trial (either channel) that was previously
      // cap-skipped (never launched) — the machine keeps trying new audiences
      // before piling more onto an old one. Google-not-connected plans leave a
      // 'draft' row for the google trial, which counts as launched here so the
      // machine doesn't retry it every rotation.
      // Only reallocate into a trial whose project has a Trakheesi permit —
      // a permit-less project is never launched, including via reallocation.
      const unlaunched = planTrials(plan).find((t) =>
        (permitBySlug.get(t.projectSlug) ?? null) !== null &&
        !campaignsNow.some((c) => c.channel === trialChannel(t) && c.projectSlug === t.projectSlug && c.trialLabel === t.label),
      )
      const reallocPermit = unlaunched ? (permitBySlug.get(unlaunched.projectSlug) ?? '') : ''
      const launchBudget = unlaunched
        ? Math.min(unlaunched.dailyBudgetAed, freed, headroomAfterPause)
        : 0

      if (unlaunched && launchBudget >= META_MIN_TRIAL_BUDGET_AED) {
        try {
          let newCampaignId: string
          if (trialChannel(unlaunched) === 'google') {
            if (!unlaunched.google) throw new Error('google trial has no launch payload in the plan')
            const permitDesc = `DLD Permit ${reallocPermit}`.slice(0, 90)
            const descriptions = unlaunched.google.descriptions.includes(permitDesc)
              ? unlaunched.google.descriptions
              : [...unlaunched.google.descriptions, permitDesc].slice(0, 4)
            const { campaignId } = await launchSearchCampaign({ ...unlaunched.google, descriptions, dailyBudgetAED: launchBudget })
            await googleUpdateCampaignStatus(campaignId, 'ENABLED')
            newCampaignId = campaignId
          } else {
            if (!unlaunched.targeting || !unlaunched.creative) throw new Error('meta trial has no targeting/creative in the plan')
            const project = plan.projects.find((p) => p.slug === unlaunched.projectSlug)
            const leadFormId = project ? await ensureProjectLeadForm(machineId, plan, project) : null
            const launch = await launchFullCampaign({
              campaignName: unlaunched.campaignName,
              objective: 'LEAD_GENERATION',
              listingName: unlaunched.listingName,
              dailyBudgetAED: launchBudget,
              targeting: unlaunched.targeting,
              creative: { ...unlaunched.creative, primaryText: appendPermitToText(unlaunched.creative.primaryText, reallocPermit) },
              launchStatus: 'ACTIVE',
              destination: leadFormId ? 'form' : 'landing',
              ...(leadFormId ? { leadFormId } : {}),
            })
            newCampaignId = launch.campaignId
          }
          await addMachineCampaign({
            machineId, channel: trialChannel(unlaunched), campaignId: newCampaignId,
            projectSlug: unlaunched.projectSlug, trialLabel: unlaunched.label,
            dailyBudgetAed: launchBudget, status: 'active',
          })
          await logActivity({
            machineId,
            kind: 'budget_shift',
            detail: `Shifted AED ${launchBudget}/day freed by pausing "${target.row.trialLabel}" into launching planned ${trialChannel(unlaunched)} trial "${unlaunched.label}" for ${unlaunched.listingName}. ${evidence}`,
            campaignId: newCampaignId,
            data: { fromCampaignId: target.row.campaignId, toTrialId: unlaunched.id, toChannel: trialChannel(unlaunched), amountAed: launchBudget, verdicts: target.verdicts },
          })
          result.budgetShifts.push(newCampaignId)
          result.launched.push(newCampaignId)
          continue
        } catch (e) {
          await logActivity({
            machineId, kind: 'error',
            detail: `Reallocation launch of "${unlaunched.label}" failed: ${errMsg(e)}`,
            data: { trialId: unlaunched.id },
          })
          result.errors.push(`realloc-launch:${unlaunched.id}`)
          // fall through to raising a survivor
        }
      }

      // Rank the surviving siblings — protected first, then lowest CPL with
      // ≥3 leads, then highest CRM quality. Used by BOTH the re-plan step
      // (pick the proven winner to explore around) and the budget raise.
      const survivors = group
        .filter((s) => s !== target)
        .sort((a, b) => {
          const ap = isProtected(a) ? 0 : 1
          const bp = isProtected(b) ? 0 : 1
          if (ap !== bp) return ap - bp
          const aCpl = a.leads >= MIN_LEADS_FOR_CPL && a.cplAed !== null ? a.cplAed : Infinity
          const bCpl = b.leads >= MIN_LEADS_FOR_CPL && b.cplAed !== null ? b.cplAed : Infinity
          if (aCpl !== bCpl) return aCpl - bCpl
          return (b.qualityScore ?? -1) - (a.qualityScore ?? -1)
        })

      // ── RE-PLAN (learning CREATES, not just prunes): every planned trial is
      // already launched, so mint ONE new Meta arm derived from the strongest
      // proven survivor — its targeting broadened one age step, so the machine
      // explores the audience space adjacent to what the evidence says works
      // instead of only piling budget onto what it already knows.
      // Hard bounds: Meta winners only (Google needs RSA synthesis — not
      // minted), at most MAX_EXPLORE_ARMS_PER_PROJECT ever per project, permit
      // required, budget = freed ∩ cap headroom at the AED floor. A failed
      // mint logs and falls through to the plain budget raise.
      if (!unlaunched) {
        const permit = permitBySlug.get(projectSlug) ?? null
        const exploreCount = campaignsNow.filter(
          (c) => c.projectSlug === projectSlug && c.trialLabel.startsWith(EXPLORE_PREFIX),
        ).length
        const proven = survivors.find((s) =>
          s.row.channel === 'meta' && !s.row.trialLabel.startsWith(EXPLORE_PREFIX) && (
            isProtected(s) ||
            (s.leads >= MIN_LEADS_FOR_CPL && s.cplAed !== null) ||
            (s.qualityScore !== null && s.qualityScore >= QUALITY_SIBLING_AT_LEAST)
          ),
        )
        const winnerTrial = proven ? findPlanTrial(plan, proven.row) : null
        const exploreBudget = Math.floor(Math.min(freed, headroomAfterPause))
        const tgt = winnerTrial?.targeting
        const newTargeting = tgt ? {
          ...tgt,
          ageMin: Math.max(18, (tgt.ageMin ?? 25) - 5),
          ageMax: Math.min(65, (tgt.ageMax ?? 55) + 5),
        } : null
        // A mint must actually EXPLORE: if the winner already spans the full
        // band, "broadened" would be a byte-identical clone competing with
        // its own parent in the same auction. Skip and fall through to the
        // plain raise instead.
        const broadens = !!(tgt && newTargeting && (newTargeting.ageMin !== tgt.ageMin || newTargeting.ageMax !== tgt.ageMax))
        if (permit && exploreCount < MAX_EXPLORE_ARMS_PER_PROJECT && proven && winnerTrial?.targeting && winnerTrial.creative && newTargeting && broadens && exploreBudget >= META_MIN_TRIAL_BUDGET_AED) {
          const label = `${EXPLORE_PREFIX} ${exploreCount + 1}: around ${winnerTrial.label}`
          // Once the platform launch succeeds, real money is moving on the new
          // campaign — a later bookkeeping failure must NOT fall through to the
          // survivor raise (that would double-allocate the freed budget and,
          // with no campaign row, leave the spend invisible to the cap).
          let platformLaunched = false
          try {
            const project = plan.projects.find((p) => p.slug === projectSlug)
            const leadFormId = project ? await ensureProjectLeadForm(machineId, plan, project) : null
            const launch = await launchFullCampaign({
              campaignName: `${winnerTrial.campaignName} — ${label}`.slice(0, 90),
              objective: 'LEAD_GENERATION',
              listingName: winnerTrial.listingName,
              dailyBudgetAED: exploreBudget,
              targeting: newTargeting,
              creative: { ...winnerTrial.creative, primaryText: appendPermitToText(winnerTrial.creative.primaryText, permit) },
              launchStatus: 'ACTIVE',
              destination: leadFormId ? 'form' : 'landing',
              ...(leadFormId ? { leadFormId } : {}),
            })
            platformLaunched = true
            await addMachineCampaign({
              machineId, channel: 'meta', campaignId: launch.campaignId,
              projectSlug, trialLabel: label, dailyBudgetAed: exploreBudget, status: 'active',
            })
            await logActivity({
              machineId,
              kind: 'launched',
              detail: `Re-plan: minted new arm "${label}" for ${winnerTrial.listingName} at AED ${exploreBudget}/day — ages ${newTargeting.ageMin}–${newTargeting.ageMax}, winner "${winnerTrial.label}" broadened on its evidence (CPL ${proven.cplAed !== null ? `AED ${proven.cplAed.toFixed(0)}` : 'n/a'}, quality ${proven.qualityScore ?? 'n/a'}${proven.verdicts && proven.verdicts.decisive > 0 ? `, verdicts ${proven.verdicts.yes}Y/${proven.verdicts.no}N` : ''}). Funded by pausing "${target.row.trialLabel}". ${evidence}`,
              campaignId: launch.campaignId,
              data: {
                fromCampaignId: target.row.campaignId, basedOnTrialId: winnerTrial.id,
                amountAed: exploreBudget, ageMin: newTargeting.ageMin, ageMax: newTargeting.ageMax,
              },
            }).catch(() => {})
            result.budgetShifts.push(launch.campaignId)
            result.launched.push(launch.campaignId)
            continue
          } catch (e) {
            await logActivity({
              machineId, kind: 'error',
              detail: platformLaunched
                ? `Re-plan arm "${label}" (${projectSlug}) IS LIVE on Meta but its machine bookkeeping failed: ${errMsg(e)}. The freed budget stays with it — NOT reallocated again. Reconcile the campaign row manually.`
                : `Re-plan launch of "${label}" (${projectSlug}) failed: ${errMsg(e)} — falling back to raising a survivor.`,
              data: { projectSlug },
            }).catch(() => {})
            result.errors.push(`replan-launch:${projectSlug}`)
            if (platformLaunched) continue // budget is spent on the live arm — never double-allocate
            // fall through to raising a survivor
          }
        }
      }

      // Otherwise: raise the best surviving sibling. The survivor may be on
      // the OTHER channel (freed Meta budget can raise a Google trial and
      // vice versa) — the raise uses the survivor's own channel mutation.
      const survivor = survivors[0]
      if (!survivor) continue

      const increase = Math.floor(Math.min(freed, survivor.row.dailyBudgetAed * 0.5, headroomAfterPause))
      if (increase < 1) continue

      try {
        const newBudget = survivor.row.dailyBudgetAed + increase
        if (survivor.row.channel === 'google') {
          // Google budgets live on the campaign's budget resource.
          await googleUpdateCampaignBudget(survivor.row.campaignId, newBudget)
        } else {
          // Meta budgets live on the ad set.
          const adSets = await listAdSets(survivor.row.campaignId)
          const adSet = adSets[0]
          if (!adSet) throw new Error('campaign has no ad set to raise')
          await updateAdSet(adSet.id, { dailyBudgetAED: newBudget })
        }
        await updateMachineCampaign(survivor.row.id, { dailyBudgetAed: newBudget })
        await logActivity({
          machineId,
          kind: 'budget_shift',
          detail: `Raised "${survivor.row.trialLabel}" (${projectSlug}, ${survivor.row.channel}) from AED ${survivor.row.dailyBudgetAed} to AED ${newBudget}/day with budget freed by pausing "${target.row.trialLabel}" (${target.row.channel}). ${evidence}`,
          campaignId: survivor.row.campaignId,
          data: { fromCampaignId: target.row.campaignId, fromChannel: target.row.channel, toCampaignId: survivor.row.campaignId, toChannel: survivor.row.channel, amountAed: increase, verdicts: target.verdicts },
        })
        result.budgetShifts.push(survivor.row.campaignId)
      } catch (e) {
        await logActivity({
          machineId, kind: 'error',
          detail: `Budget raise on "${survivor.row.trialLabel}" (${survivor.row.channel}) failed: ${errMsg(e)}`,
          campaignId: survivor.row.campaignId,
        })
        result.errors.push(`realloc-raise:${survivor.row.campaignId}`)
      }
    }
  }

  // ── HEALTH (running only) ─────────────────────────────────────────────────
  //
  // The machine had no way to say "I am running but nothing is happening".
  // Every branch above acts on ONE trial; none of them ever stood back and
  // asked whether the machine as a whole is still making progress. Two ways it
  // can be alive and useless, both of which look completely normal on the
  // dashboard — a green "running" pill either way:
  //
  //   · every trial has been stopped (condemned, permit, or not delivering),
  //     so there is nothing live and no spend, and the machine will sit there
  //     indefinitely because launching more needs a plan it has exhausted;
  //   · trials ARE live and spending real money, but the whole machine has
  //     produced zero leads. No rotation branch can fire on this: the CPL and
  //     quality branches both compare against a sibling that has leads, and if
  //     nobody has any there is no comparison to make. It would spend to the
  //     cap forever.
  //
  // Neither is something the machine can fix by itself — that is exactly why
  // it has to escalate rather than keep quiet.
  if (machine.status === 'running' && states.length > 0) {
    const liveNow = campaigns.filter((c) => c.status === 'active').length
    const totalSpend = states.reduce((s, x) => s + x.spendAed, 0)
    const totalLeads = states.reduce((s, x) => s + x.leads + x.attributed, 0)

    if (liveNow === 0) {
      await logActivity({
        machineId,
        kind: 'machine_stalled',
        detail: `Nothing is running. All ${states.length} trial(s) are stopped, so this machine is spending nothing and cannot learn anything more on its own. Review the stopped trials above, then either re-plan, add a project, or stop the machine.`,
        data: { reason: 'no_active_trials', trials: states.length },
      })
    } else if (totalLeads === 0 && totalSpend >= ZERO_LEAD_ALARM_CAP_MULTIPLE * machine.dailyCapAed) {
      await logActivity({
        machineId,
        kind: 'machine_stalled',
        detail: `AED ${Math.round(totalSpend)} spent across ${liveNow} live trial(s) and not one lead has arrived. The rotation cannot resolve this by itself — its CPL and quality tests both compare a trial against a sibling that HAS leads, and none do. Check that the landing pages and instant forms actually submit, that lead sync is running, then re-plan or stop the machine.`,
        data: { reason: 'zero_leads', spendAed: Math.round(totalSpend), liveTrials: liveNow },
      })
    }
  }

  return result
  } finally {
    await releaseAdvisoryLock(lockKey)
  }
}

// ─── Per-machine cycle serialization (Postgres session advisory locks) ───────
// A stable 31-bit key from the machine id — advisory locks take a bigint/int.
function advisoryKey(machineId: string): number {
  let h = 0
  for (let i = 0; i < machineId.length; i++) h = (Math.imul(31, h) + machineId.charCodeAt(i)) | 0
  return h & 0x7fffffff
}
async function tryAdvisoryLock(key: number): Promise<boolean> {
  try {
    const rows = await query<{ locked: boolean }>('SELECT pg_try_advisory_lock($1) AS locked', [key])
    return rows[0]?.locked === true
  } catch {
    // If the lock call itself fails, don't block the cycle — the fresh cap
    // check per launch remains the primary safety; the lock is belt-and-braces.
    return true
  }
}
async function releaseAdvisoryLock(key: number): Promise<void> {
  try { await query('SELECT pg_advisory_unlock($1)', [key]) } catch { /* best-effort */ }
}

// ─── Machine-level controls ──────────────────────────────────────────────────

/** One action pauses the whole machine: every active campaign — Meta AND
 * Google — is paused on its own platform, then the machine stops
 * launching/rotating. A platform pause failure is logged but does not block
 * pausing the rest. */
export async function pauseMachine(machineId: string): Promise<{ paused: number; failed: string[] }> {
  const campaigns = await listMachineCampaigns(machineId)
  let paused = 0
  const failed: string[] = []
  for (const c of campaigns) {
    if (c.status !== 'active') continue
    try {
      await setPlatformStatus(c, false)
      await updateMachineCampaign(c.id, { status: 'paused' })
      await logActivity({ machineId, kind: 'trial_paused', detail: `Machine pause: paused "${c.trialLabel}" (${c.projectSlug}, ${c.channel}).`, campaignId: c.campaignId })
      paused++
    } catch (e) {
      failed.push(c.campaignId)
      await logActivity({ machineId, kind: 'error', detail: `Machine pause: ${c.channel === 'google' ? 'Google' : 'Meta'} pause of "${c.trialLabel}" failed: ${errMsg(e)}`, campaignId: c.campaignId })
    }
  }
  await setMachineStatus(machineId, 'paused')
  return { paused, failed }
}

/** Resume: reactivate paused trials — Meta AND Google — in launch order, but
 * each one only while the fresh COMBINED cap sum stays under the cap; the
 * rest are logged 'cap_enforced'. */
export async function resumeMachine(machineId: string): Promise<{ resumed: number; capSkipped: number; permitSkipped: number }> {
  const machine = await getMachine(machineId)
  if (!machine) throw new Error(`Ads machine not found: ${machineId}`)
  await setMachineStatus(machineId, 'running')
  const campaigns = await listMachineCampaigns(machineId)
  let resumed = 0
  let capSkipped = 0
  let permitSkipped = 0
  for (const c of campaigns) {
    if (c.status !== 'paused') continue
    // Compliance outranks the cap: a lapsed permit is not a budget problem, and
    // "resume everything" must never be the way an unpermitted ad gets back on.
    const expiredOn = expiredPermitFor(machine, c.projectSlug)
    if (expiredOn) {
      permitSkipped++
      await logActivity({
        machineId, kind: 'permit_blocked',
        detail: `Resume skipped "${c.trialLabel}" (${c.projectSlug}): its Trakheesi advertising permit expired on ${expiredOn}. Renew it and update the expiry date in the plan before this trial can run again.`,
        campaignId: c.campaignId,
      })
      continue
    }
    const committed = await activeSpendAed(machineId)
    if (committed + c.dailyBudgetAed > machine.dailyCapAed) {
      capSkipped++
      await logActivity({
        machineId, kind: 'cap_enforced',
        detail: `Resume skipped "${c.trialLabel}" (${c.projectSlug}, ${c.channel}): AED ${committed} committed + AED ${c.dailyBudgetAed} would exceed the AED ${machine.dailyCapAed}/day cap.`,
        campaignId: c.campaignId,
      })
      continue
    }
    try {
      await setPlatformStatus(c, true)
      await updateMachineCampaign(c.id, { status: 'active' })
      await logActivity({ machineId, kind: 'trial_resumed', detail: `Resumed "${c.trialLabel}" (${c.projectSlug}, ${c.channel}) at AED ${c.dailyBudgetAed}/day.`, campaignId: c.campaignId })
      resumed++
    } catch (e) {
      await logActivity({ machineId, kind: 'error', detail: `Resume of "${c.trialLabel}" (${c.channel}) failed: ${errMsg(e)}`, campaignId: c.campaignId })
    }
  }
  return { resumed, capSkipped, permitSkipped }
}

/**
 * Turn a SINGLE trial campaign on or off — the per-campaign switch behind the
 * dashboard's on/off toggle. Pausing always works; resuming is refused when it
 * would push the combined daily budget over the machine's hard cap (the same
 * rule every launch obeys). Honest: the DB row only flips after the platform
 * call succeeds, and every toggle is logged.
 */
export async function setTrialRunning(
  machineId: string,
  campaignId: string,
  running: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const machine = await getMachine(machineId)
  if (!machine) return { ok: false, error: 'Ads machine not found' }
  const row = (await listMachineCampaigns(machineId)).find((c) => c.campaignId === campaignId)
  if (!row) return { ok: false, error: 'Trial not found on this machine' }

  if (running) {
    // Same compliance gate the cycle applies — otherwise the operator's own
    // switch would quietly restart a campaign the machine stopped for having
    // no valid permit, which is the one outcome this must never allow.
    const expiredOn = expiredPermitFor(machine, row.projectSlug)
    if (expiredOn) {
      return { ok: false, error: `"${row.trialLabel}" cannot run: its Trakheesi advertising permit expired on ${expiredOn}. Renew it with DET and update the expiry date in the plan, then turn this trial back on.` }
    }
    const committed = await activeSpendAed(machineId)
    // Only count this trial's budget as "new" if it isn't already active.
    const additional = row.status === 'active' ? 0 : row.dailyBudgetAed
    if (committed + additional > machine.dailyCapAed) {
      return { ok: false, error: `Resuming "${row.trialLabel}" would commit AED ${committed + additional}/day, above the AED ${machine.dailyCapAed}/day cap. Lower another trial or raise the cap.` }
    }
  }

  try {
    await setPlatformStatus(row, running)
  } catch (e) {
    return { ok: false, error: errMsg(e) }
  }
  await updateMachineCampaign(row.id, { status: running ? 'active' : 'paused' })
  await logActivity({
    machineId,
    kind: running ? 'trial_resumed' : 'trial_paused',
    detail: `${running ? 'Resumed' : 'Paused'} "${row.trialLabel}" (${row.projectSlug}, ${row.channel}) — turned ${running ? 'on' : 'off'} by an operator.`,
    campaignId: row.campaignId,
    data: { trialId: row.id },
  })
  return { ok: true }
}

/** Stop: pause everything on both platforms and mark the machine stopped. */
export async function stopMachine(machineId: string): Promise<{ paused: number; failed: string[] }> {
  const out = await pauseMachine(machineId)
  await setMachineStatus(machineId, 'stopped')
  return out
}

/**
 * Change the hard daily cap. A DECREASE is enforced immediately: the newest
 * active trials are paused (with 'cap_enforced' logs) until the committed sum
 * fits under the new cap — the cap is never allowed to sit violated.
 */
export async function changeMachineCap(machineId: string, newCapAed: number): Promise<{ capAed: number; pausedForCap: number }> {
  const cap = Math.max(0, Math.round(newCapAed))
  await setMachineCap(machineId, cap)
  let pausedForCap = 0
  let committed = await activeSpendAed(machineId)
  if (committed > cap) {
    const campaigns = await listMachineCampaigns(machineId)
    // Both channels count against the ONE combined cap, so both are eligible
    // for enforcement pausing — newest first.
    const active = campaigns
      .filter((c) => c.status === 'active')
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)) // newest first
    for (const c of active) {
      if (committed <= cap) break
      try {
        await setPlatformStatus(c, false)
        await updateMachineCampaign(c.id, { status: 'paused' })
        committed -= c.dailyBudgetAed
        pausedForCap++
        await logActivity({
          machineId, kind: 'cap_enforced',
          detail: `Cap lowered to AED ${cap}/day: paused "${c.trialLabel}" (${c.projectSlug}, ${c.channel}, AED ${c.dailyBudgetAed}/day) to get committed spend from AED ${committed + c.dailyBudgetAed} under the cap.`,
          campaignId: c.campaignId,
        })
      } catch (e) {
        await logActivity({ machineId, kind: 'error', detail: `Cap enforcement pause of "${c.trialLabel}" (${c.channel}) failed: ${errMsg(e)}`, campaignId: c.campaignId })
      }
    }
  }
  return { capAed: cap, pausedForCap }
}
