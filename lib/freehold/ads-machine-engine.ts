/**
 * Ads Machine — engine (stage 1: engine, no UI).
 *
 * runMachineCycle is the machine's heartbeat (cron + manual run_cycle):
 *   LAUNCH   — planned-but-unlaunched trials go live ACTIVE, but only after a
 *              FRESH cap check (activeMetaSpendAed + new budget ≤ cap); a trial
 *              that doesn't fit is logged 'cap_enforced' and skipped, and a
 *              Meta failure is logged 'error' without sinking the cycle.
 *   EVALUATE — per campaign: real insights (this_month — the only window the
 *              client exposes), CRM quality, verdict stats; creates per-lead
 *              feedback questions for brokers; ONE aggregated 'observation'
 *              activity per machine per cycle.
 *   ROTATE   — deterministic, per project, ≤1 pause per project per cycle;
 *              only HUMAN-answered decisive verdicts (yes/no) count; freed
 *              budget is reallocated under the cap.
 *
 * Spend authority: autonomous WITHIN the hard daily cap. The cap is checked
 * server-side at every mutation that can add spend — launch, resume, budget
 * raise, cap decrease — always against a fresh activeMetaSpendAed read.
 */
import { query } from '@/lib/db'
import {
  launchFullCampaign,
  getCampaignInsights,
  listAdSets,
  updateAdSet,
  updateCampaignStatus,
} from '@/lib/meta/client'
import { getCampaignQuality, badPhone, QUALIFIED_STATUSES } from '@/lib/freehold/campaign-quality'
import { getUntrustedLeadIds } from '@/lib/freehold/training-integrity'
import { createLocalCampaign } from '@/lib/google/local-store'
import {
  getMachine,
  setMachineStatus,
  setMachineCap,
  logActivity,
  listMachineCampaigns,
  addMachineCampaign,
  updateMachineCampaign,
  activeMetaSpendAed,
  insertLeadVerdictRequests,
  getVerdictStats,
  type AdsMachine,
  type MachineCampaign,
  type TrialVerdictStats,
  type VerdictRequestInput,
  type QuestionKind,
} from '@/lib/freehold/ads-machine'
import { META_MIN_TRIAL_BUDGET_AED, type MachinePlan, type MachineTrialPlan } from '@/lib/freehold/ads-machine-planner'

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

export interface CycleResult {
  machineId: string
  status: AdsMachine['status']
  ran: boolean
  launched: string[]
  capSkipped: string[]
  googleDraftsPrepared: string[]
  observed: number
  verdictRequestsCreated: number
  paused: string[]
  budgetShifts: string[]
  errors: string[]
}

interface TrialState {
  row: MachineCampaign
  planTrial: MachineTrialPlan | null
  campaignName: string
  spendAed: number
  metaLeads: number
  cplAed: number | null
  qualityScore: number | null
  attributed: number
  verdicts: TrialVerdictStats | null
}

const emptyResult = (machineId: string, status: AdsMachine['status'], ran: boolean): CycleResult => ({
  machineId, status, ran,
  launched: [], capSkipped: [], googleDraftsPrepared: [],
  observed: 0, verdictRequestsCreated: 0,
  paused: [], budgetShifts: [], errors: [],
})

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e))

function planTrials(plan: MachinePlan): MachineTrialPlan[] {
  return plan.viable ? plan.projects.flatMap((p) => p.trials) : []
}

function findPlanTrial(plan: MachinePlan, row: MachineCampaign): MachineTrialPlan | null {
  return planTrials(plan).find((t) => t.projectSlug === row.projectSlug && t.label === row.trialLabel) ?? null
}

/** Meta insights → lead count: exact 'lead' action first, otherwise the first
 * lead-flavored action type. Never invented — no actions means 0. */
function leadsFromInsights(actions: Array<{ action_type: string; value: string }> | undefined): number {
  if (!actions?.length) return 0
  const exact = actions.find((a) => a.action_type === 'lead')
  if (exact) return Number(exact.value) || 0
  const flavored = actions.find((a) => a.action_type.includes('lead'))
  return flavored ? Number(flavored.value) || 0 : 0
}

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
    leads = await query<AttributedLead>(
      `SELECT id, name, phone, status, blocked, assigned_broker_id, created_at
       FROM freehold_site_leads
       WHERE archived IS NOT TRUE
         AND ( ($1 <> '' AND utm_id = $1) OR ($2 <> '' AND lower(utm_campaign) = lower($2)) )`,
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
      // Still sitting in new/contacted: after SCORE_ASK_AFTER_DAYS we ask the
      // softer 0–10 buying-likelihood score; younger unmoved leads wait.
      const ageDays = (now - new Date(lead.created_at).getTime()) / 86_400_000
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

  const result = emptyResult(machineId, machine.status, true)
  let campaigns = await listMachineCampaigns(machineId)

  // ── LAUNCH (running only) ──────────────────────────────────────────────────
  if (machine.status === 'running') {
    // Google SEARCH drafts: one per project, prepared once, always PAUSED —
    // the machine has NO autonomous Google spend authority.
    for (const project of plan.projects) {
      const hasDraft = campaigns.some((c) => c.channel === 'google' && c.projectSlug === project.slug)
      if (hasDraft) continue
      try {
        const draft = await createLocalCampaign(project.googleDraft, `ads-machine:${machineId}`)
        await addMachineCampaign({
          machineId,
          channel: 'google',
          campaignId: draft.id,
          projectSlug: project.slug,
          trialLabel: 'Google Search (draft)',
          dailyBudgetAed: project.googleDraft.dailyBudgetAED,
          status: 'draft',
        })
        await logActivity({
          machineId,
          kind: 'google_draft_prepared',
          detail: `Prepared Google SEARCH draft for ${project.listingName} (PAUSED — suggested AED ${project.googleDraft.dailyBudgetAED}/day; launches only by operator action).`,
          campaignId: draft.id,
          data: { projectSlug: project.slug },
        })
        result.googleDraftsPrepared.push(draft.id)
      } catch (e) {
        await logActivity({ machineId, kind: 'error', detail: `Google draft for ${project.slug} failed: ${errMsg(e)}` })
        result.errors.push(`google:${project.slug}`)
      }
    }
    campaigns = await listMachineCampaigns(machineId)

    // Meta trials: planned but not yet launched.
    for (const trial of planTrials(plan)) {
      const already = campaigns.some(
        (c) => c.channel === 'meta' && c.projectSlug === trial.projectSlug && c.trialLabel === trial.label,
      )
      if (already) continue

      // FRESH cap check immediately before every launch — the cap is the sum
      // of ACTIVE Meta daily budgets and must never be exceeded.
      const committed = await activeMetaSpendAed(machineId)
      if (committed + trial.dailyBudgetAed > machine.dailyCapAed) {
        await logActivity({
          machineId,
          kind: 'cap_enforced',
          detail: `Skipped launching "${trial.label}" for ${trial.listingName}: AED ${committed} already committed + AED ${trial.dailyBudgetAed} would exceed the AED ${machine.dailyCapAed}/day cap.`,
          data: { trialId: trial.id, committed, requested: trial.dailyBudgetAed, cap: machine.dailyCapAed },
        })
        result.capSkipped.push(trial.id)
        continue
      }

      try {
        const launch = await launchFullCampaign({
          campaignName: trial.campaignName,
          objective: 'LEAD_GENERATION',
          listingName: trial.listingName,
          dailyBudgetAED: trial.dailyBudgetAed,
          targeting: trial.targeting,
          creative: trial.creative,
          launchStatus: 'ACTIVE',
          destination: 'landing',
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
          data: { trialId: trial.id, adSetId: launch.adSetId, adId: launch.adId, copySource: trial.copySource },
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

  // ── EVALUATE (running or paused) ──────────────────────────────────────────
  const metaCampaigns = campaigns.filter((c) => c.channel === 'meta' && (c.status === 'active' || c.status === 'paused'))
  const untrusted = await getUntrustedLeadIds().catch(() => new Set<string>())
  const verdictStats = await getVerdictStats(machineId).catch(() => new Map<string, TrialVerdictStats>())
  const ownerCache = new Map<string, string | null>()

  const states: TrialState[] = []
  const verdictRequests: VerdictRequestInput[] = []
  for (const row of metaCampaigns) {
    const planTrial = findPlanTrial(plan, row)
    const campaignName = planTrial?.campaignName ?? ''

    let spendAed = 0
    let metaLeads = 0
    try {
      const insights = await getCampaignInsights(row.campaignId)
      spendAed = Number(insights?.spend) || 0
      metaLeads = leadsFromInsights(insights?.actions)
    } catch (e) {
      await logActivity({ machineId, kind: 'error', detail: `Insights read failed for ${row.trialLabel}: ${errMsg(e)}`, campaignId: row.campaignId })
      result.errors.push(`insights:${row.campaignId}`)
    }

    let qualityScore: number | null = null
    let attributed = 0
    try {
      const quality = await getCampaignQuality(row.campaignId, campaignName)
      qualityScore = quality.score
      attributed = quality.attributed
    } catch { /* fail-soft: quality is null (honest "no signal"), never invented */ }

    verdictRequests.push(...await buildVerdictRequests(machineId, row.campaignId, campaignName, untrusted, ownerCache))

    states.push({
      row,
      planTrial,
      campaignName,
      spendAed,
      metaLeads,
      cplAed: metaLeads > 0 ? spendAed / metaLeads : null,
      qualityScore,
      attributed,
      verdicts: verdictStats.get(row.campaignId) ?? null,
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
    const committed = await activeMetaSpendAed(machineId)
    await logActivity({
      machineId,
      kind: 'observation',
      detail: `Observed ${states.length} trial(s): AED ${committed}/${machine.dailyCapAed} daily budget committed; ` +
        states.map((s) =>
          `${s.row.trialLabel}[${s.row.status}] spend AED ${Math.round(s.spendAed)}, ${s.metaLeads} Meta leads` +
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
          status: s.row.status,
          dailyBudgetAed: s.row.dailyBudgetAed,
          spendAed: s.spendAed,
          metaLeads: s.metaLeads,
          cplAed: s.cplAed,
          qualityScore: s.qualityScore,
          attributed: s.attributed,
          verdicts: s.verdicts,
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

      // (C) CPL-condemned vs best sibling — both need ≥3 leads for the ratio
      // to mean anything.
      const cplCondemned = (s: TrialState) => {
        if (!spendGated(s) || isProtected(s)) return false
        if (s.cplAed === null || s.metaLeads < MIN_LEADS_FOR_CPL) return false
        const siblingCpls = group
          .filter((o) => o !== s && o.cplAed !== null && o.metaLeads >= MIN_LEADS_FOR_CPL)
          .map((o) => o.cplAed as number)
        if (!siblingCpls.length) return false
        return s.cplAed > CPL_CONDEMN_MULTIPLIER * Math.min(...siblingCpls)
      }

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
      if (cplCondemned(target)) reasons.push(`CPL AED ${target.cplAed!.toFixed(0)} > ${CPL_CONDEMN_MULTIPLIER}× best sibling`)
      if (qualityCondemned(target)) reasons.push(`CRM quality ${target.qualityScore} < ${QUALITY_CONDEMN_BELOW} while a sibling holds ≥ ${QUALITY_SIBLING_AT_LEAST}`)
      const evidence = `Evidence: ${verdictEvidence(target.verdicts)}; spend AED ${Math.round(target.spendAed)} on AED ${target.row.dailyBudgetAed}/day.`

      // Pause on Meta FIRST — a failed pause means the budget is NOT freed,
      // so no reallocation happens.
      try {
        await updateCampaignStatus(target.row.campaignId, 'PAUSED')
      } catch (e) {
        await logActivity({
          machineId, kind: 'error',
          detail: `Wanted to pause "${target.row.trialLabel}" (${projectSlug}) — ${reasons.join('; ')} — but the Meta pause failed: ${errMsg(e)}. No budget was reallocated.`,
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

      // ── Reallocate the freed budget, always under the cap ──
      const freed = target.row.dailyBudgetAed
      const campaignsNow = await listMachineCampaigns(machineId)
      const headroomAfterPause = machine.dailyCapAed - await activeMetaSpendAed(machineId)

      // First choice: a planned trial that was previously cap-skipped (never
      // launched) — the machine keeps trying new audiences before piling more
      // onto an old one.
      const unlaunched = planTrials(plan).find((t) =>
        !campaignsNow.some((c) => c.channel === 'meta' && c.projectSlug === t.projectSlug && c.trialLabel === t.label),
      )
      const launchBudget = unlaunched
        ? Math.min(unlaunched.dailyBudgetAed, freed, headroomAfterPause)
        : 0

      if (unlaunched && launchBudget >= META_MIN_TRIAL_BUDGET_AED) {
        try {
          const launch = await launchFullCampaign({
            campaignName: unlaunched.campaignName,
            objective: 'LEAD_GENERATION',
            listingName: unlaunched.listingName,
            dailyBudgetAED: launchBudget,
            targeting: unlaunched.targeting,
            creative: unlaunched.creative,
            launchStatus: 'ACTIVE',
            destination: 'landing',
          })
          await addMachineCampaign({
            machineId, channel: 'meta', campaignId: launch.campaignId,
            projectSlug: unlaunched.projectSlug, trialLabel: unlaunched.label,
            dailyBudgetAed: launchBudget, status: 'active',
          })
          await logActivity({
            machineId,
            kind: 'budget_shift',
            detail: `Shifted AED ${launchBudget}/day freed by pausing "${target.row.trialLabel}" into launching planned trial "${unlaunched.label}" for ${unlaunched.listingName}. ${evidence}`,
            campaignId: launch.campaignId,
            data: { fromCampaignId: target.row.campaignId, toTrialId: unlaunched.id, amountAed: launchBudget, verdicts: target.verdicts },
          })
          result.budgetShifts.push(launch.campaignId)
          result.launched.push(launch.campaignId)
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

      // Otherwise: raise the best surviving sibling — protected first, then
      // lowest CPL with ≥3 leads, then highest CRM quality.
      const survivors = group
        .filter((s) => s !== target)
        .sort((a, b) => {
          const ap = isProtected(a) ? 0 : 1
          const bp = isProtected(b) ? 0 : 1
          if (ap !== bp) return ap - bp
          const aCpl = a.metaLeads >= MIN_LEADS_FOR_CPL && a.cplAed !== null ? a.cplAed : Infinity
          const bCpl = b.metaLeads >= MIN_LEADS_FOR_CPL && b.cplAed !== null ? b.cplAed : Infinity
          if (aCpl !== bCpl) return aCpl - bCpl
          return (b.qualityScore ?? -1) - (a.qualityScore ?? -1)
        })
      const survivor = survivors[0]
      if (!survivor) continue

      const increase = Math.floor(Math.min(freed, survivor.row.dailyBudgetAed * 0.5, headroomAfterPause))
      if (increase < 1) continue

      try {
        const adSets = await listAdSets(survivor.row.campaignId)
        const adSet = adSets[0]
        if (!adSet) throw new Error('campaign has no ad set to raise')
        const newBudget = survivor.row.dailyBudgetAed + increase
        await updateAdSet(adSet.id, { dailyBudgetAED: newBudget })
        await updateMachineCampaign(survivor.row.id, { dailyBudgetAed: newBudget })
        await logActivity({
          machineId,
          kind: 'budget_shift',
          detail: `Raised "${survivor.row.trialLabel}" (${projectSlug}) from AED ${survivor.row.dailyBudgetAed} to AED ${newBudget}/day with budget freed by pausing "${target.row.trialLabel}". ${evidence}`,
          campaignId: survivor.row.campaignId,
          data: { fromCampaignId: target.row.campaignId, toCampaignId: survivor.row.campaignId, amountAed: increase, verdicts: target.verdicts },
        })
        result.budgetShifts.push(survivor.row.campaignId)
      } catch (e) {
        await logActivity({
          machineId, kind: 'error',
          detail: `Budget raise on "${survivor.row.trialLabel}" failed: ${errMsg(e)}`,
          campaignId: survivor.row.campaignId,
        })
        result.errors.push(`realloc-raise:${survivor.row.campaignId}`)
      }
    }
  }

  return result
}

// ─── Machine-level controls ──────────────────────────────────────────────────

/** One action pauses the whole machine: every active Meta campaign is paused
 * on Meta, then the machine stops launching/rotating. A Meta pause failure is
 * logged but does not block pausing the rest. */
export async function pauseMachine(machineId: string): Promise<{ paused: number; failed: string[] }> {
  const campaigns = await listMachineCampaigns(machineId)
  let paused = 0
  const failed: string[] = []
  for (const c of campaigns) {
    if (c.channel !== 'meta' || c.status !== 'active') continue
    try {
      await updateCampaignStatus(c.campaignId, 'PAUSED')
      await updateMachineCampaign(c.id, { status: 'paused' })
      await logActivity({ machineId, kind: 'trial_paused', detail: `Machine pause: paused "${c.trialLabel}" (${c.projectSlug}).`, campaignId: c.campaignId })
      paused++
    } catch (e) {
      failed.push(c.campaignId)
      await logActivity({ machineId, kind: 'error', detail: `Machine pause: Meta pause of "${c.trialLabel}" failed: ${errMsg(e)}`, campaignId: c.campaignId })
    }
  }
  await setMachineStatus(machineId, 'paused')
  return { paused, failed }
}

/** Resume: reactivate paused trials in launch order — but each one only while
 * the fresh cap sum stays under the cap; the rest are logged 'cap_enforced'. */
export async function resumeMachine(machineId: string): Promise<{ resumed: number; capSkipped: number }> {
  const machine = await getMachine(machineId)
  if (!machine) throw new Error(`Ads machine not found: ${machineId}`)
  await setMachineStatus(machineId, 'running')
  const campaigns = await listMachineCampaigns(machineId)
  let resumed = 0
  let capSkipped = 0
  for (const c of campaigns) {
    if (c.channel !== 'meta' || c.status !== 'paused') continue
    const committed = await activeMetaSpendAed(machineId)
    if (committed + c.dailyBudgetAed > machine.dailyCapAed) {
      capSkipped++
      await logActivity({
        machineId, kind: 'cap_enforced',
        detail: `Resume skipped "${c.trialLabel}" (${c.projectSlug}): AED ${committed} committed + AED ${c.dailyBudgetAed} would exceed the AED ${machine.dailyCapAed}/day cap.`,
        campaignId: c.campaignId,
      })
      continue
    }
    try {
      await updateCampaignStatus(c.campaignId, 'ACTIVE')
      await updateMachineCampaign(c.id, { status: 'active' })
      await logActivity({ machineId, kind: 'trial_resumed', detail: `Resumed "${c.trialLabel}" (${c.projectSlug}) at AED ${c.dailyBudgetAed}/day.`, campaignId: c.campaignId })
      resumed++
    } catch (e) {
      await logActivity({ machineId, kind: 'error', detail: `Resume of "${c.trialLabel}" failed: ${errMsg(e)}`, campaignId: c.campaignId })
    }
  }
  return { resumed, capSkipped }
}

/** Stop: pause everything on Meta and mark the machine stopped. */
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
  let committed = await activeMetaSpendAed(machineId)
  if (committed > cap) {
    const campaigns = await listMachineCampaigns(machineId)
    const active = campaigns
      .filter((c) => c.channel === 'meta' && c.status === 'active')
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)) // newest first
    for (const c of active) {
      if (committed <= cap) break
      try {
        await updateCampaignStatus(c.campaignId, 'PAUSED')
        await updateMachineCampaign(c.id, { status: 'paused' })
        committed -= c.dailyBudgetAed
        pausedForCap++
        await logActivity({
          machineId, kind: 'cap_enforced',
          detail: `Cap lowered to AED ${cap}/day: paused "${c.trialLabel}" (${c.projectSlug}, AED ${c.dailyBudgetAed}/day) to get committed spend from AED ${committed + c.dailyBudgetAed} under the cap.`,
          campaignId: c.campaignId,
        })
      } catch (e) {
        await logActivity({ machineId, kind: 'error', detail: `Cap enforcement pause of "${c.trialLabel}" failed: ${errMsg(e)}`, campaignId: c.campaignId })
      }
    }
  }
  return { capAed: cap, pausedForCap }
}
