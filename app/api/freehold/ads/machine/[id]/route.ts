import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { query } from '@/lib/db'
import { normalizePermit, normalizePermitExpiry, permitDaysLeft, permitState } from '@/lib/freehold/trakheesi'
import { MANAGEMENT_ROLES, type Role } from '@/lib/freehold/session-types'
import {
  getMachine,
  setMachineStatus,
  setMachinePlan,
  listMachineCampaigns,
  listActivity,
  listUnansweredVerdicts,
  getVerdictAggregates,
  getVerdictStats,
  activeSpendAed,
  submitVerdictAnswer,
  getVerdictRow,
} from '@/lib/freehold/ads-machine'
import { applyPlanEdits, type TrialEdit, type ProjectEdit } from '@/lib/freehold/ads-machine-plan-edit'
import {
  runMachineCycle,
  pauseMachine,
  resumeMachine,
  stopMachine,
  changeMachineCap,
  setTrialRunning,
} from '@/lib/freehold/ads-machine-engine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const OPERATOR_ROLES: Role[] = [...MANAGEMENT_ROLES, 'marketing']

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(OPERATOR_ROLES)
  if ('res' in auth) return auth.res
  const { id } = await params

  const machine = await getMachine(id)
  if (!machine) return NextResponse.json({ error: 'Machine not found' }, { status: 404 })

  const [campaigns, activity, verdictQueue, verdictAggregates, verdictStats, committedDailyAed] = await Promise.all([
    listMachineCampaigns(id),
    listActivity(id, 100),
    listUnansweredVerdicts(id),
    getVerdictAggregates(id),
    getVerdictStats(id),
    activeSpendAed(id),
  ])

  // Verdict starvation — the silent single point of failure made loud. A trial
  // with unanswered questions and fewer than 3 decisive human answers cannot be
  // verdict-condemned OR verdict-protected: rotation falls back to metrics
  // alone. Surface exactly which trials are blocked and how many answers are
  // missing, so an unanswered queue never goes dark quietly.
  const MIN_DECISIVE = 3
  const starvedTrials = campaigns
    .filter((c) => c.status === 'active')
    .map((c) => {
      const s = verdictStats.get(c.campaignId)
      return s && s.pending > 0 && s.decisive < MIN_DECISIVE
        ? { campaignId: c.campaignId, trialLabel: c.trialLabel, projectSlug: c.projectSlug, pending: s.pending, decisive: s.decisive, needed: MIN_DECISIVE - s.decisive }
        : null
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  // The EVIDENCE the engine actually decided on, per trial. It was already
  // recorded in the latest 'observation' entry but only as prose inside the
  // activity feed — so the operator could see the machine's budgets while the
  // numbers behind its pauses (leads, on which basis, CPL, CRM quality,
  // verdicts) stayed buried. Money decisions have to be legible.
  const latestObservation = activity.find((a) => a.kind === 'observation')
  const obsData = latestObservation?.data as { trials?: unknown[] } | undefined
  const evidence = Array.isArray(obsData?.trials) ? obsData.trials : []

  // PERMIT STANDING per project. A Trakheesi permit is issued for a fixed
  // window, and the engine stops a project's trials the day it lapses — so the
  // operator needs to see that coming while there is still time to renew,
  // rather than discovering it from a stopped campaign. Computed from the same
  // helper the engine gates on, so this can never disagree with what it did.
  const permits = machine.plan?.viable
    ? machine.plan.projects.map((p) => {
        const expiry = normalizePermitExpiry(p.permitExpiry)
        return {
          projectSlug: p.slug,
          listingName: p.listingName,
          permitNumber: normalizePermit(p.permitNumber),
          permitExpiry: expiry,
          daysLeft: permitDaysLeft(expiry),
          state: permitState(p.permitNumber, expiry),
          /** Whether this project still has live spend riding on that permit. */
          activeTrials: campaigns.filter((c) => c.projectSlug === p.slug && c.status === 'active').length,
        }
      })
    : []

  // THE BRAIN'S PULSE. The planner consults the shared targeting signals on
  // every plan (recommendTargeting → targeting-base), but nothing ever showed
  // whether the brain is actually FED — and its live fold turned out to have
  // been silently dead since it was written. Freshness is now on the dashboard
  // so a starved brain can never hide again. Fail-soft null: a missing signals
  // table (fresh white-label) renders as "not fed yet", not an error.
  let brain: { liveSignals: number; lastFold: string | null } | null = null
  try {
    const [b] = await query<{ n: string; last: string | null }>(
      `SELECT COUNT(*)::text AS n, MAX(updated_at)::text AS last
         FROM entrestate_targeting_signals WHERE tenant_id LIKE '%-live'`,
    )
    brain = { liveSignals: Number(b?.n) || 0, lastFold: b?.last ?? null }
  } catch { brain = null }

  return NextResponse.json({
    machine,
    campaigns,
    activity,
    verdictQueue,
    verdictAggregates,
    starvedTrials,
    permits,
    brain,
    evidence,
    evidenceAt: latestObservation?.createdAt ?? null,
    budget: {
      dailyCapAed: machine.dailyCapAed,
      committedDailyAed,
      headroomAed: Math.max(0, machine.dailyCapAed - committedDailyAed),
    },
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(OPERATOR_ROLES)
  if ('res' in auth) return auth.res
  const { id } = await params

  const machine = await getMachine(id)
  if (!machine) return NextResponse.json({ error: 'Machine not found' }, { status: 404 })

  let body: { action?: unknown; dailyCapAed?: unknown; edits?: unknown; projectEdits?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const out: Record<string, unknown> = {}

  // Review-step edits: the operator adjusted budgets / copy / included trials
  // and per-project Trakheesi permits in the launch preview. Editing the
  // plan-as-DATA only makes sense before it has launched — a running machine's
  // live campaigns aren't retro-changed here.
  const rawEdits = Array.isArray(body.edits) ? (body.edits as TrialEdit[]) : null
  const rawProjectEdits = Array.isArray(body.projectEdits) ? (body.projectEdits as ProjectEdit[]) : null
  async function persistEdits(): Promise<NextResponse | null> {
    if (!rawEdits && !rawProjectEdits) return null
    if (machine!.status !== 'planning') {
      return NextResponse.json({ error: 'Plan edits can only be made before the machine starts.' }, { status: 400 })
    }
    const edited = applyPlanEdits(machine!.plan, rawEdits ?? [], machine!.dailyCapAed, rawProjectEdits ?? [])
    if (!edited.ok) return NextResponse.json({ error: edited.error }, { status: 400 })
    await setMachinePlan(id, edited.plan)
    machine!.plan = edited.plan
    return null
  }

  // Cap change first, so "lower the cap AND pause" enforces against the new cap.
  if (body.dailyCapAed !== undefined) {
    const cap = Number(body.dailyCapAed)
    if (!Number.isFinite(cap) || cap <= 0) {
      return NextResponse.json({ error: 'dailyCapAed must be a positive number' }, { status: 400 })
    }
    out.capChange = await changeMachineCap(id, cap)
  }

  const action = typeof body.action === 'string' ? body.action : null
  if (action) {
    switch (action) {
      case 'plan_edit': {
        const err = await persistEdits()
        if (err) return err
        out.planEdited = true
        break
      }
      case 'start': {
        if (!machine.plan || !machine.plan.viable) {
          return NextResponse.json({ error: 'This machine has no viable plan to run' }, { status: 400 })
        }
        // Apply the review-step edits (if any) BEFORE launching, so the first
        // cycle executes exactly what the operator confirmed in the preview.
        const err = await persistEdits()
        if (err) return err
        await setMachineStatus(id, 'running')
        // Starting runs one cycle immediately — the first launches happen now,
        // under the same fresh server-side cap checks as every later cycle.
        out.cycle = await runMachineCycle(id)
        break
      }
      case 'pause':
        out.pause = await pauseMachine(id)
        break
      case 'resume':
        out.resume = await resumeMachine(id)
        break
      case 'stop':
        out.stop = await stopMachine(id)
        break
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } else if (body.dailyCapAed === undefined) {
    return NextResponse.json({ error: 'Nothing to do — send an action and/or dailyCapAed' }, { status: 400 })
  }

  const updated = await getMachine(id)
  return NextResponse.json({ machine: updated, ...out })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Any authenticated user may reach POST: run_cycle is operator-gated below,
  // and lead_verdict authorizes per-row (owner or management).
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const { id } = await params

  const machine = await getMachine(id)
  if (!machine) return NextResponse.json({ error: 'Machine not found' }, { status: 404 })

  let body: { action?: unknown; verdictRowId?: unknown; verdict?: unknown; score?: unknown; campaignId?: unknown; running?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const isManagement = MANAGEMENT_ROLES.includes(auth.user.role)

  if (body.action === 'run_cycle') {
    if (!isManagement && auth.user.role !== 'marketing') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const cycle = await runMachineCycle(id)
    return NextResponse.json({ cycle })
  }

  // Per-campaign on/off — the dashboard's trial switch.
  if (body.action === 'trial_toggle') {
    if (!isManagement && auth.user.role !== 'marketing') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const campaignId = typeof body.campaignId === 'string' ? body.campaignId : ''
    if (!campaignId) return NextResponse.json({ error: 'campaignId is required' }, { status: 400 })
    if (typeof body.running !== 'boolean') return NextResponse.json({ error: 'running (boolean) is required' }, { status: 400 })
    const result = await setTrialRunning(id, campaignId, body.running)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'lead_verdict') {
    const rowId = typeof body.verdictRowId === 'string' ? body.verdictRowId : ''
    if (!rowId) return NextResponse.json({ error: 'verdictRowId is required' }, { status: 400 })
    const row = await getVerdictRow(rowId)
    if (!row) return NextResponse.json({ error: 'Verdict request not found' }, { status: 404 })
    if (row.machineId !== id) {
      return NextResponse.json({ error: 'Verdict belongs to a different machine' }, { status: 400 })
    }
    const answered = await submitVerdictAnswer({
      rowId,
      verdict: body.verdict,
      score: body.score,
      byEmail: auth.user.email,
      isManagement,
    })
    if (!answered.ok) return NextResponse.json({ error: answered.error }, { status: answered.status })
    return NextResponse.json({ verdict: answered.row })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
