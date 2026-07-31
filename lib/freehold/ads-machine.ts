/**
 * Ads Machine — data layer (stage 1: engine, no UI).
 *
 * An "ads machine" is an autonomous, budget-capped, self-optimizing ads
 * orchestrator: the operator picks projects and a HARD daily budget cap, the
 * machine plans/launches/rotates audience trials across channels, and every
 * action lands in an activity feed. This module owns the four tables and the
 * one authoritative cap-sum definition (activeSpendAed — ONE combined cap
 * across Meta AND Google) that every budget mutation in the engine checks
 * against.
 *
 * DB idiom mirrors lib/meta/form-registry.ts: query() + lazy
 * CREATE TABLE IF NOT EXISTS, fail-soft where a failure must never break the
 * caller (activity logging), throw-through where silence would lie (CRUD).
 */
import { randomUUID } from 'node:crypto'
import { query } from '@/lib/db'
import type { MachinePlan } from './ads-machine-planner'

export type MachineStatus = 'planning' | 'running' | 'paused' | 'stopped'
export type MachineChannel = 'meta' | 'google'
export type MachineCampaignStatus = 'active' | 'paused' | 'draft' | 'stopped'
export type ActivityKind =
  | 'planned'
  | 'launched'
  | 'google_draft_prepared'
  | 'budget_shift'
  | 'trial_paused'
  | 'trial_resumed'
  | 'observation'
  | 'feedback_request'
  | 'feedback_answered'
  | 'cap_enforced'
  | 'permit_blocked'
  /** Permit renewal notice — raised while ads are still running, so the permit
   *  can be renewed before the machine has to stop them. */
  | 'permit_warning'
  | 'error'

let ensured: Promise<void> | null = null
async function ensure(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS freehold_site_ads_machines (
          id             text PRIMARY KEY,
          name           text NOT NULL,
          project_slugs  jsonb NOT NULL DEFAULT '[]'::jsonb,
          status         text NOT NULL DEFAULT 'planning',
          daily_cap_aed  int NOT NULL,
          plan           jsonb,
          created_by     text,
          created_at     timestamptz NOT NULL DEFAULT now(),
          updated_at     timestamptz NOT NULL DEFAULT now()
        )`)
      await query(`
        CREATE TABLE IF NOT EXISTS freehold_site_ads_machine_campaigns (
          id               text PRIMARY KEY,
          machine_id       text NOT NULL,
          channel          text NOT NULL,
          campaign_id      text NOT NULL,
          project_slug     text NOT NULL,
          trial_label      text NOT NULL,
          daily_budget_aed int NOT NULL DEFAULT 0,
          status           text NOT NULL DEFAULT 'active',
          created_at       timestamptz NOT NULL DEFAULT now()
        )`)
      await query(`
        CREATE TABLE IF NOT EXISTS freehold_site_ads_machine_activity (
          id          text PRIMARY KEY,
          machine_id  text NOT NULL,
          kind        text NOT NULL,
          detail      text NOT NULL DEFAULT '',
          campaign_id text,
          data        jsonb,
          created_at  timestamptz NOT NULL DEFAULT now()
        )`)
      await query(`
        CREATE TABLE IF NOT EXISTS freehold_site_ads_machine_lead_verdicts (
          id                text PRIMARY KEY,
          machine_id        text NOT NULL,
          lead_id           text NOT NULL,
          campaign_id       text NOT NULL,
          question_kind     text NOT NULL DEFAULT 'confirm', -- confirm|score
          verdict           text,      -- yes|no (derived for score-kind: >=6 yes, <=4 no, 5 stays NULL/neutral)
          score             int,       -- raw 0-10 answer for score-kind questions
          verdict_by        text,
          owner_email       text,
          suggested_verdict text,
          created_at        timestamptz NOT NULL DEFAULT now(),
          answered_at       timestamptz,
          UNIQUE (machine_id, lead_id)
        )`)
    })().catch((e) => { ensured = null; throw e })
  }
  await ensured
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AdsMachine {
  id: string
  name: string
  projectSlugs: string[]
  status: MachineStatus
  dailyCapAed: number
  plan: MachinePlan | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface MachineCampaign {
  id: string
  machineId: string
  channel: MachineChannel
  campaignId: string
  projectSlug: string
  trialLabel: string
  dailyBudgetAed: number
  status: MachineCampaignStatus
  createdAt: string
}

export interface MachineActivity {
  id: string
  machineId: string
  kind: ActivityKind
  detail: string
  campaignId: string | null
  data: unknown
  createdAt: string
}

export type QuestionKind = 'confirm' | 'score'

export interface LeadVerdictRow {
  id: string
  machineId: string
  leadId: string
  campaignId: string
  questionKind: QuestionKind
  verdict: 'yes' | 'no' | null
  score: number | null
  verdictBy: string | null
  ownerEmail: string | null
  suggestedVerdict: 'yes' | 'no' | null
  createdAt: string
  answeredAt: string | null
}

const STATUSES = new Set<MachineStatus>(['planning', 'running', 'paused', 'stopped'])

const machineRow = (r: Record<string, unknown>): AdsMachine => ({
  id: String(r.id ?? ''),
  name: String(r.name ?? ''),
  projectSlugs: Array.isArray(r.project_slugs)
    ? (r.project_slugs as unknown[]).map(String)
    : (typeof r.project_slugs === 'string' ? (JSON.parse(r.project_slugs) as unknown[]).map(String) : []),
  status: STATUSES.has(r.status as MachineStatus) ? (r.status as MachineStatus) : 'planning',
  dailyCapAed: Number(r.daily_cap_aed ?? 0) || 0,
  plan: (r.plan ?? null) as MachinePlan | null,
  createdBy: r.created_by ? String(r.created_by) : null,
  createdAt: String(r.created_at ?? ''),
  updatedAt: String(r.updated_at ?? ''),
})

const campaignRow = (r: Record<string, unknown>): MachineCampaign => ({
  id: String(r.id ?? ''),
  machineId: String(r.machine_id ?? ''),
  channel: r.channel === 'google' ? 'google' : 'meta',
  campaignId: String(r.campaign_id ?? ''),
  projectSlug: String(r.project_slug ?? ''),
  trialLabel: String(r.trial_label ?? ''),
  dailyBudgetAed: Number(r.daily_budget_aed ?? 0) || 0,
  status: (['active', 'paused', 'draft', 'stopped'] as const).includes(r.status as MachineCampaignStatus)
    ? (r.status as MachineCampaignStatus) : 'active',
  createdAt: String(r.created_at ?? ''),
})

const verdictRow = (r: Record<string, unknown>): LeadVerdictRow => ({
  id: String(r.id ?? ''),
  machineId: String(r.machine_id ?? ''),
  leadId: String(r.lead_id ?? ''),
  campaignId: String(r.campaign_id ?? ''),
  questionKind: r.question_kind === 'score' ? 'score' : 'confirm',
  verdict: r.verdict === 'yes' || r.verdict === 'no' ? r.verdict : null,
  score: typeof r.score === 'number' ? r.score : (r.score != null ? Number(r.score) : null),
  verdictBy: r.verdict_by ? String(r.verdict_by) : null,
  ownerEmail: r.owner_email ? String(r.owner_email) : null,
  suggestedVerdict: r.suggested_verdict === 'yes' || r.suggested_verdict === 'no' ? r.suggested_verdict : null,
  createdAt: String(r.created_at ?? ''),
  answeredAt: r.answered_at ? String(r.answered_at) : null,
})

// ─── Machine CRUD ─────────────────────────────────────────────────────────────

export async function createMachine(params: {
  name: string
  projectSlugs: string[]
  dailyCapAed: number
  plan: MachinePlan
  createdBy: string
}): Promise<AdsMachine> {
  await ensure()
  const id = `mach-${randomUUID()}`
  const rows = await query<Record<string, unknown>>(
    `INSERT INTO freehold_site_ads_machines (id, name, project_slugs, status, daily_cap_aed, plan, created_by)
     VALUES ($1, $2, $3::jsonb, 'planning', $4, $5::jsonb, $6)
     RETURNING *`,
    [
      id,
      params.name.trim().slice(0, 160),
      JSON.stringify(params.projectSlugs),
      Math.max(0, Math.round(params.dailyCapAed)),
      JSON.stringify(params.plan),
      params.createdBy.slice(0, 200),
    ],
  )
  return machineRow(rows[0])
}

export async function getMachine(id: string): Promise<AdsMachine | null> {
  await ensure()
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM freehold_site_ads_machines WHERE id = $1 LIMIT 1`, [id],
  )
  return rows[0] ? machineRow(rows[0]) : null
}

export async function listMachines(): Promise<AdsMachine[]> {
  await ensure()
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM freehold_site_ads_machines ORDER BY created_at DESC LIMIT 100`,
  )
  return rows.map(machineRow)
}

export async function setMachineStatus(id: string, status: MachineStatus): Promise<void> {
  await ensure()
  await query(
    `UPDATE freehold_site_ads_machines SET status = $2, updated_at = now() WHERE id = $1`,
    [id, status],
  )
}

export async function setMachineCap(id: string, dailyCapAed: number): Promise<void> {
  await ensure()
  await query(
    `UPDATE freehold_site_ads_machines SET daily_cap_aed = $2, updated_at = now() WHERE id = $1`,
    [id, Math.max(0, Math.round(dailyCapAed))],
  )
}

export async function setMachinePlan(id: string, plan: MachinePlan): Promise<void> {
  await ensure()
  await query(
    `UPDATE freehold_site_ads_machines SET plan = $2::jsonb, updated_at = now() WHERE id = $1`,
    [id, JSON.stringify(plan)],
  )
}

// ─── Activity feed ────────────────────────────────────────────────────────────

/** Fail-soft: a broken activity log must never abort a launch/rotation. */
export async function logActivity(params: {
  machineId: string
  kind: ActivityKind
  detail: string
  campaignId?: string | null
  data?: unknown
}): Promise<void> {
  try {
    await ensure()
    await query(
      `INSERT INTO freehold_site_ads_machine_activity (id, machine_id, kind, detail, campaign_id, data)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        `act-${randomUUID()}`,
        params.machineId,
        params.kind,
        params.detail.slice(0, 2000),
        params.campaignId ?? null,
        params.data !== undefined ? JSON.stringify(params.data) : null,
      ],
    )
  } catch (err) {
    console.error('[ads-machine] logActivity failed', err)
  }
}

export async function listActivity(machineId: string, limit = 100): Promise<MachineActivity[]> {
  await ensure()
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM freehold_site_ads_machine_activity
     WHERE machine_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [machineId, Math.min(Math.max(limit, 1), 500)],
  )
  return rows.map((r) => ({
    id: String(r.id ?? ''),
    machineId: String(r.machine_id ?? ''),
    kind: String(r.kind ?? 'observation') as ActivityKind,
    detail: String(r.detail ?? ''),
    campaignId: r.campaign_id ? String(r.campaign_id) : null,
    data: r.data ?? null,
    createdAt: String(r.created_at ?? ''),
  }))
}

// ─── Machine campaigns ───────────────────────────────────────────────────────

export async function listMachineCampaigns(machineId: string): Promise<MachineCampaign[]> {
  await ensure()
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM freehold_site_ads_machine_campaigns
     WHERE machine_id = $1 ORDER BY created_at ASC`,
    [machineId],
  )
  return rows.map(campaignRow)
}

export async function addMachineCampaign(params: {
  machineId: string
  channel: MachineChannel
  campaignId: string
  projectSlug: string
  trialLabel: string
  dailyBudgetAed: number
  status: MachineCampaignStatus
}): Promise<MachineCampaign> {
  await ensure()
  const rows = await query<Record<string, unknown>>(
    `INSERT INTO freehold_site_ads_machine_campaigns
       (id, machine_id, channel, campaign_id, project_slug, trial_label, daily_budget_aed, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      `mc-${randomUUID()}`,
      params.machineId,
      params.channel,
      params.campaignId,
      params.projectSlug,
      params.trialLabel,
      Math.max(0, Math.round(params.dailyBudgetAed)),
      params.status,
    ],
  )
  return campaignRow(rows[0])
}

export async function updateMachineCampaign(
  id: string,
  patch: { status?: MachineCampaignStatus; dailyBudgetAed?: number },
): Promise<void> {
  await ensure()
  if (patch.status !== undefined && patch.dailyBudgetAed !== undefined) {
    await query(
      `UPDATE freehold_site_ads_machine_campaigns SET status = $2, daily_budget_aed = $3 WHERE id = $1`,
      [id, patch.status, Math.max(0, Math.round(patch.dailyBudgetAed))],
    )
  } else if (patch.status !== undefined) {
    await query(`UPDATE freehold_site_ads_machine_campaigns SET status = $2 WHERE id = $1`, [id, patch.status])
  } else if (patch.dailyBudgetAed !== undefined) {
    await query(
      `UPDATE freehold_site_ads_machine_campaigns SET daily_budget_aed = $2 WHERE id = $1`,
      [id, Math.max(0, Math.round(patch.dailyBudgetAed))],
    )
  }
}

/**
 * THE one cap-sum definition: the machine's committed daily spend is the sum
 * of daily budgets of its ACTIVE campaigns across BOTH channels — Google is a
 * live channel with the same autonomous-within-cap spend authority as Meta,
 * and one combined cap governs them together. Every mutation that can add
 * spend (launch, resume, budget raise, cap decrease) must check this fresh —
 * never a cached figure. Drafts/paused/stopped rows never count.
 */
export async function activeSpendAed(machineId: string): Promise<number> {
  await ensure()
  const [row] = await query<{ total: number }>(
    `SELECT COALESCE(SUM(daily_budget_aed), 0)::int AS total
     FROM freehold_site_ads_machine_campaigns
     WHERE machine_id = $1 AND channel IN ('meta', 'google') AND status = 'active'`,
    [machineId],
  )
  return Number(row?.total ?? 0) || 0
}

// ─── Lead verdicts (the human feedback loop) ─────────────────────────────────

export interface VerdictRequestInput {
  machineId: string
  leadId: string
  campaignId: string
  questionKind: QuestionKind
  ownerEmail: string | null
  suggestedVerdict: 'yes' | 'no' | null
}

/**
 * Upsert verdict requests. On conflict the row is only refreshed while it is
 * UNANSWERED (guard: answered_at IS NULL) — owner/suggestion may update and an
 * unanswered 'score' question may upgrade to 'confirm' (the lead's status
 * moved, so the sharper question applies), but never the reverse, and an
 * answered row is never touched. Returns the number of TRUE inserts so the
 * engine can log one honest aggregate 'feedback_request' per cycle.
 * suggested_verdict is a UI pre-fill ONLY — it never counts as an answer.
 */
export async function insertLeadVerdictRequests(requests: VerdictRequestInput[]): Promise<number> {
  if (!requests.length) return 0
  await ensure()
  let inserted = 0
  for (const r of requests) {
    try {
      const rows = await query<{ inserted: boolean }>(
        `INSERT INTO freehold_site_ads_machine_lead_verdicts
           (id, machine_id, lead_id, campaign_id, question_kind, owner_email, suggested_verdict)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (machine_id, lead_id) DO UPDATE SET
           owner_email = EXCLUDED.owner_email,
           suggested_verdict = EXCLUDED.suggested_verdict,
           question_kind = CASE
             WHEN freehold_site_ads_machine_lead_verdicts.question_kind = 'score'
              AND EXCLUDED.question_kind = 'confirm' THEN 'confirm'
             ELSE freehold_site_ads_machine_lead_verdicts.question_kind
           END
         WHERE freehold_site_ads_machine_lead_verdicts.answered_at IS NULL
         RETURNING (xmax = 0) AS inserted`,
        [
          `lv-${randomUUID()}`,
          r.machineId,
          r.leadId,
          r.campaignId,
          r.questionKind,
          r.ownerEmail ? r.ownerEmail.toLowerCase() : null,
          r.suggestedVerdict,
        ],
      )
      if (rows[0]?.inserted) inserted++
    } catch (err) {
      // One bad row must not sink the batch.
      console.error('[ads-machine] verdict upsert failed', r.leadId, err)
    }
  }
  return inserted
}

export async function getVerdictRow(id: string): Promise<LeadVerdictRow | null> {
  await ensure()
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM freehold_site_ads_machine_lead_verdicts WHERE id = $1 LIMIT 1`, [id],
  )
  return rows[0] ? verdictRow(rows[0]) : null
}

/** Answer a 'confirm' question with an explicit yes/no. Only unanswered
 * confirm-kind rows accept it. Returns the updated row, or null (already
 * answered / wrong kind / not found). */
export async function answerLeadVerdict(
  rowId: string,
  verdict: 'yes' | 'no',
  verdictBy: string,
): Promise<LeadVerdictRow | null> {
  await ensure()
  const rows = await query<Record<string, unknown>>(
    `UPDATE freehold_site_ads_machine_lead_verdicts
     SET verdict = $2, verdict_by = $3, answered_at = now()
     WHERE id = $1 AND answered_at IS NULL AND question_kind = 'confirm'
     RETURNING *`,
    [rowId, verdict, verdictBy.slice(0, 200)],
  )
  return rows[0] ? verdictRow(rows[0]) : null
}

/** Answer a 'score' question (0–10 "how likely would this lead buy"). The
 * yes/no verdict is DERIVED: >=6 → yes, <=4 → no, exactly 5 → neutral (NULL,
 * excluded from yes-ratio numerator AND denominator). */
export async function answerLeadScore(
  rowId: string,
  score: number,
  verdictBy: string,
): Promise<LeadVerdictRow | null> {
  await ensure()
  const s = Math.min(10, Math.max(0, Math.round(score)))
  const derived: 'yes' | 'no' | null = s >= 6 ? 'yes' : s <= 4 ? 'no' : null
  const rows = await query<Record<string, unknown>>(
    `UPDATE freehold_site_ads_machine_lead_verdicts
     SET score = $2, verdict = $3, verdict_by = $4, answered_at = now()
     WHERE id = $1 AND answered_at IS NULL AND question_kind = 'score'
     RETURNING *`,
    [rowId, s, derived, verdictBy.slice(0, 200)],
  )
  return rows[0] ? verdictRow(rows[0]) : null
}

/** A verdict row joined with the real lead + trial context the UI needs to
 * ask a human a fair question. Phone is masked before it leaves the server. */
export interface VerdictQueueItem extends LeadVerdictRow {
  leadName: string
  leadPhoneMasked: string
  leadStatus: string | null
  leadArrivedAt: string | null
  trialLabel: string
  projectSlug: string
  machineName?: string
}

const queueSelect = `
  SELECT v.*,
         l.name       AS lead_name,
         l.phone      AS lead_phone,
         l.status     AS lead_status,
         l.created_at AS lead_created_at,
         c.trial_label, c.project_slug,
         m.name       AS machine_name
  FROM freehold_site_ads_machine_lead_verdicts v
  LEFT JOIN freehold_site_leads l ON l.id = v.lead_id
  LEFT JOIN freehold_site_ads_machine_campaigns c
    ON c.machine_id = v.machine_id AND c.campaign_id = v.campaign_id
  LEFT JOIN freehold_site_ads_machines m ON m.id = v.machine_id`

const queueItem = (r: Record<string, unknown>): VerdictQueueItem => ({
  ...verdictRow(r),
  leadName: String(r.lead_name ?? '') || 'Unknown lead',
  leadPhoneMasked: maskPhone(r.lead_phone ? String(r.lead_phone) : null),
  leadStatus: r.lead_status ? String(r.lead_status) : null,
  leadArrivedAt: r.lead_created_at ? String(r.lead_created_at) : null,
  trialLabel: String(r.trial_label ?? ''),
  projectSlug: String(r.project_slug ?? ''),
  machineName: r.machine_name ? String(r.machine_name) : undefined,
})

export async function listUnansweredVerdicts(machineId: string): Promise<VerdictQueueItem[]> {
  await ensure()
  const rows = await query<Record<string, unknown>>(
    `${queueSelect}
     WHERE v.machine_id = $1 AND v.answered_at IS NULL
     ORDER BY v.created_at ASC
     LIMIT 200`,
    [machineId],
  )
  return rows.map(queueItem)
}

/**
 * The session user's own unanswered verdict rows across ALL machines.
 * includeUnassigned (management) also surfaces rows whose owner could not be
 * resolved (owner_email IS NULL) — the admin queue.
 */
export async function listMyUnansweredVerdicts(
  email: string,
  includeUnassigned: boolean,
): Promise<VerdictQueueItem[]> {
  await ensure()
  const rows = await query<Record<string, unknown>>(
    `${queueSelect}
     WHERE v.answered_at IS NULL
       AND (lower(v.owner_email) = lower($1) OR ($2 AND v.owner_email IS NULL))
     ORDER BY v.created_at ASC
     LIMIT 200`,
    [email, includeUnassigned],
  )
  return rows.map(queueItem)
}

/** Per-trial (campaign) human-verdict tally. `decisive` counts only real
 * yes/no answers: a neutral 5-score is answered but excluded from the
 * yes-ratio's numerator AND denominator. */
export interface TrialVerdictStats {
  campaignId: string
  answered: number
  yes: number
  no: number
  pending: number
  decisive: number
  /** yes / (yes + no); null until at least one decisive answer exists. */
  yesRatio: number | null
}

export async function getVerdictStats(machineId: string): Promise<Map<string, TrialVerdictStats>> {
  await ensure()
  const rows = await query<{ campaign_id: string; answered: number; yes: number; no: number; pending: number }>(
    `SELECT campaign_id,
            COUNT(*) FILTER (WHERE answered_at IS NOT NULL)::int AS answered,
            COUNT(*) FILTER (WHERE answered_at IS NOT NULL AND verdict = 'yes')::int AS yes,
            COUNT(*) FILTER (WHERE answered_at IS NOT NULL AND verdict = 'no')::int  AS no,
            COUNT(*) FILTER (WHERE answered_at IS NULL)::int AS pending
     FROM freehold_site_ads_machine_lead_verdicts
     WHERE machine_id = $1
     GROUP BY campaign_id`,
    [machineId],
  )
  const map = new Map<string, TrialVerdictStats>()
  for (const r of rows) {
    const yes = Number(r.yes) || 0
    const no = Number(r.no) || 0
    const decisive = yes + no
    map.set(String(r.campaign_id), {
      campaignId: String(r.campaign_id),
      answered: Number(r.answered) || 0,
      yes, no,
      pending: Number(r.pending) || 0,
      decisive,
      yesRatio: decisive > 0 ? yes / decisive : null,
    })
  }
  return map
}

export interface VerdictAggregates {
  byOwner: Array<{ owner: string; answered: number; yes: number; no: number; pending: number }>
  byDay: Array<{ day: string; answered: number; yes: number; no: number; pending: number }>
}

/** Answered/yes/no/pending broken down per owner and per day — the operator's
 * read on who is actually answering the machine's questions, and how fast. */
export async function getVerdictAggregates(machineId: string): Promise<VerdictAggregates> {
  await ensure()
  const [byOwner, byDay] = await Promise.all([
    query<{ owner: string; answered: number; yes: number; no: number; pending: number }>(
      `SELECT COALESCE(lower(owner_email), '(unassigned)') AS owner,
              COUNT(*) FILTER (WHERE answered_at IS NOT NULL)::int AS answered,
              COUNT(*) FILTER (WHERE verdict = 'yes')::int AS yes,
              COUNT(*) FILTER (WHERE verdict = 'no')::int  AS no,
              COUNT(*) FILTER (WHERE answered_at IS NULL)::int AS pending
       FROM freehold_site_ads_machine_lead_verdicts
       WHERE machine_id = $1
       GROUP BY 1
       ORDER BY pending DESC, answered DESC`,
      [machineId],
    ),
    query<{ day: string; answered: number; yes: number; no: number; pending: number }>(
      `SELECT to_char(created_at, 'YYYY-MM-DD') AS day,
              COUNT(*) FILTER (WHERE answered_at IS NOT NULL)::int AS answered,
              COUNT(*) FILTER (WHERE verdict = 'yes')::int AS yes,
              COUNT(*) FILTER (WHERE verdict = 'no')::int  AS no,
              COUNT(*) FILTER (WHERE answered_at IS NULL)::int AS pending
       FROM freehold_site_ads_machine_lead_verdicts
       WHERE machine_id = $1
       GROUP BY 1
       ORDER BY 1 DESC
       LIMIT 30`,
      [machineId],
    ),
  ])
  return {
    byOwner: byOwner.map((r) => ({
      owner: r.owner, answered: Number(r.answered) || 0, yes: Number(r.yes) || 0,
      no: Number(r.no) || 0, pending: Number(r.pending) || 0,
    })),
    byDay: byDay.map((r) => ({
      day: r.day, answered: Number(r.answered) || 0, yes: Number(r.yes) || 0,
      no: Number(r.no) || 0, pending: Number(r.pending) || 0,
    })),
  }
}

/** Mask a phone for feedback surfaces: keep an honest hint (prefix + last 3
 * digits) without exposing the full dialable number. */
export function maskPhone(phone: string | null | undefined): string {
  const p = (phone ?? '').trim()
  if (!p) return ''
  const digits = p.replace(/\D/g, '')
  if (digits.length <= 4) return '•'.repeat(digits.length)
  const head = p.startsWith('+') ? p.slice(0, 4) : digits.slice(0, 2)
  return `${head}•••${digits.slice(-3)}`
}

/**
 * Validate + record one human answer to a verdict question, with the
 * authorization rule both routes share: the row's owner (by email) may answer
 * it, management may answer anything, and an owner-less row is management's
 * queue. Logs 'feedback_answered' on success.
 */
export async function submitVerdictAnswer(params: {
  rowId: string
  verdict?: unknown
  score?: unknown
  byEmail: string
  isManagement: boolean
}): Promise<{ ok: true; row: LeadVerdictRow } | { ok: false; error: string; status: number }> {
  const row = await getVerdictRow(params.rowId)
  if (!row) return { ok: false, error: 'Verdict request not found', status: 404 }
  if (row.answeredAt) return { ok: false, error: 'Already answered', status: 409 }

  const isOwner = !!row.ownerEmail && row.ownerEmail.toLowerCase() === params.byEmail.toLowerCase()
  if (!isOwner && !params.isManagement) {
    return { ok: false, error: 'Only the lead owner or management can answer this', status: 403 }
  }

  let updated: LeadVerdictRow | null = null
  let detail = ''
  if (row.questionKind === 'confirm') {
    if (params.verdict !== 'yes' && params.verdict !== 'no') {
      return { ok: false, error: "This question takes a verdict of 'yes' or 'no'", status: 400 }
    }
    updated = await answerLeadVerdict(row.id, params.verdict, params.byEmail)
    detail = `${params.byEmail} answered ${params.verdict.toUpperCase()} on lead ${row.leadId}`
  } else {
    const s = Number(params.score)
    if (!Number.isFinite(s) || s < 0 || s > 10) {
      return { ok: false, error: 'This question takes a score of 0–10', status: 400 }
    }
    updated = await answerLeadScore(row.id, s, params.byEmail)
    const derived = updated?.verdict ? updated.verdict.toUpperCase() : 'NEUTRAL'
    detail = `${params.byEmail} scored lead ${row.leadId} at ${Math.round(s)}/10 (${derived})`
  }
  if (!updated) return { ok: false, error: 'Could not record the answer (already answered?)', status: 409 }

  await logActivity({
    machineId: row.machineId,
    kind: 'feedback_answered',
    detail,
    campaignId: row.campaignId,
    data: { verdictRowId: row.id, leadId: row.leadId, verdict: updated.verdict, score: updated.score },
  })
  return { ok: true, row: updated }
}
