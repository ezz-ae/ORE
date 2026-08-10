/**
 * INBOUND, FIRST SLICE: a broker asks for a campaign instead of running one.
 *
 * The doctrine, as decided: a broker holds Assets and can request a campaign
 * without ever touching the ads tools; the system (a manager, with the whole
 * Lead Machine behind them) does the launching. The broker states WHAT —
 * project, budget, intent — and never has to know what an ad set is.
 *
 * WHERE THE MONEY MOVES, AND WHERE IT DELIBERATELY DOES NOT. Assets are the
 * broker's credit balance — the ledger that already exists, with the
 * reserve/refund rail the launch route already uses. A request moves NOTHING:
 * it checks the balance is sufficient and records intent. The charge happens
 * at launch, through the exact same deduction every launch makes — the launch
 * route just charges the REQUESTING broker instead of the person clicking the
 * button. One ledger, one rail, no second money system, no hold semantics to
 * reconcile. A rejected request therefore has nothing to refund, which is the
 * cheapest correct implementation of "release".
 *
 * THE STATUS WALK IS ONE-WAY. requested → approved → launched, with rejected
 * reachable until launch. Nothing returns: a launched request is a campaign
 * now (the campaign_id is the receipt), and re-opening a rejected request is
 * creating a new one. `canTransition` is the single authority and the API
 * refuses anything it refuses.
 */
import { randomUUID } from 'node:crypto'
import { query, ensureOnce as dbEnsureOnce } from '@/lib/db'

/** Every state a request can be in — walkable, so screens and the guard
 *  suite enumerate the same set the code can produce. */
export const REQUEST_STATUSES = ['requested', 'approved', 'launched', 'rejected'] as const
export type RequestStatus = (typeof REQUEST_STATUSES)[number]

/** The one authority on what may follow what. */
export function canTransition(from: RequestStatus, to: RequestStatus): boolean {
  if (from === 'requested') return to === 'approved' || to === 'rejected'
  if (from === 'approved') return to === 'launched' || to === 'rejected'
  return false // launched and rejected are terminal
}

export interface CampaignRequest {
  id: string
  brokerId: string
  projectSlug: string | null
  projectName: string | null
  title: string
  note: string | null
  dailyBudgetAed: number
  status: RequestStatus
  decidedBy: string | null
  decidedAt: string | null
  campaignId: string | null
  createdAt: string
}

async function ensure() {
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_site_campaign_requests (
      id               text PRIMARY KEY,
      broker_id        text NOT NULL,
      project_slug     text,
      project_name     text,
      title            text NOT NULL,
      note             text,
      daily_budget_aed integer NOT NULL,
      status           text NOT NULL DEFAULT 'requested',
      decided_by       text,
      decided_at       timestamptz,
      campaign_id      text,
      created_at       timestamptz NOT NULL DEFAULT now()
    )
  `)
  await query(`CREATE INDEX IF NOT EXISTS idx_campaign_requests_broker ON freehold_site_campaign_requests (broker_id, created_at DESC)`)
}
const ensureOnce = () => dbEnsureOnce('freehold_site_campaign_requests', ensure)

const mapRow = (r: Record<string, unknown>): CampaignRequest => ({
  id: String(r.id),
  brokerId: String(r.broker_id),
  projectSlug: r.project_slug ? String(r.project_slug) : null,
  projectName: r.project_name ? String(r.project_name) : null,
  title: String(r.title ?? ''),
  note: r.note ? String(r.note) : null,
  dailyBudgetAed: Number(r.daily_budget_aed) || 0,
  status: (REQUEST_STATUSES as readonly string[]).includes(String(r.status))
    ? (String(r.status) as RequestStatus) : 'requested',
  decidedBy: r.decided_by ? String(r.decided_by) : null,
  decidedAt: r.decided_at ? String(r.decided_at) : null,
  campaignId: r.campaign_id ? String(r.campaign_id) : null,
  createdAt: String(r.created_at ?? ''),
})

export async function createCampaignRequest(input: {
  brokerId: string
  projectSlug?: string | null
  projectName?: string | null
  title: string
  note?: string | null
  dailyBudgetAed: number
}): Promise<CampaignRequest> {
  await ensureOnce()
  const id = `creq_${randomUUID()}`
  await query(
    `INSERT INTO freehold_site_campaign_requests
       (id, broker_id, project_slug, project_name, title, note, daily_budget_aed)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, input.brokerId, input.projectSlug ?? null, input.projectName ?? null,
     input.title, input.note ?? null, Math.round(input.dailyBudgetAed)],
  )
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM freehold_site_campaign_requests WHERE id = $1`, [id])
  return mapRow(rows[0])
}

export async function getCampaignRequest(id: string): Promise<CampaignRequest | null> {
  await ensureOnce()
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM freehold_site_campaign_requests WHERE id = $1`, [id])
  return rows[0] ? mapRow(rows[0]) : null
}

/** A broker sees their own; management passes no brokerId and sees all. */
export async function listCampaignRequests(brokerId?: string): Promise<CampaignRequest[]> {
  await ensureOnce()
  const rows = brokerId
    ? await query<Record<string, unknown>>(
        `SELECT * FROM freehold_site_campaign_requests WHERE broker_id = $1 ORDER BY created_at DESC LIMIT 100`, [brokerId])
    : await query<Record<string, unknown>>(
        `SELECT * FROM freehold_site_campaign_requests ORDER BY created_at DESC LIMIT 200`)
  return rows.map(mapRow)
}

/** Approve or reject. Refuses transitions canTransition refuses, and says
 *  which state actually blocked it rather than failing silently. */
export async function decideCampaignRequest(
  id: string, to: 'approved' | 'rejected', decidedBy: string,
): Promise<{ ok: true; request: CampaignRequest } | { ok: false; error: string }> {
  const current = await getCampaignRequest(id)
  if (!current) return { ok: false, error: 'Request not found' }
  if (!canTransition(current.status, to)) {
    return { ok: false, error: `A ${current.status} request cannot become ${to}` }
  }
  await query(
    `UPDATE freehold_site_campaign_requests
     SET status = $2, decided_by = $3, decided_at = now() WHERE id = $1 AND status = $4`,
    [id, to, decidedBy, current.status],
  )
  const after = await getCampaignRequest(id)
  return after ? { ok: true, request: after } : { ok: false, error: 'Request not found' }
}

/** The launch's receipt. Idempotent — a second call with the same campaign
 *  changes nothing. */
export async function markRequestLaunched(id: string, campaignId: string): Promise<void> {
  const current = await getCampaignRequest(id)
  if (!current || !canTransition(current.status, 'launched')) return
  await query(
    `UPDATE freehold_site_campaign_requests
     SET status = 'launched', campaign_id = $2 WHERE id = $1`,
    [id, campaignId],
  )
}
