import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomUUID } from 'node:crypto'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { brokerOwnerKeys } from '@/lib/freehold/lead-access'
import { query } from '@/lib/db'
import { ensureLeadsTable, ensureLeadActivityTable } from '@/lib/data'
import { notify } from '@/lib/freehold/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Page size for the CRM list. Generous enough that a normal account is
 *  never truncated; bounded so the query stays sane as the table grows. */
const LEAD_LIST_LIMIT = 1000

const MANAGEMENT = ['admin', 'ceo', 'director', 'sales_manager']

const normPhone = (p: string | null) => (p ?? '').replace(/\D/g, '')

/** Normalised phones (7+ digits) that appear on MORE than one non-archived
 *  lead — the duplicate clusters, computed over the whole table so the flag
 *  is correct even for rows beyond the list cap. Fail-soft to empty. */
async function duplicatePhoneSet(): Promise<Set<string>> {
  try {
    const rows = await query<{ p: string }>(
      `SELECT regexp_replace(phone, '\D', '', 'g') AS p
         FROM freehold_site_leads
        WHERE archived IS NOT TRUE AND phone IS NOT NULL
        GROUP BY 1
       HAVING length(regexp_replace(phone, '\D', '', 'g')) >= 7 AND COUNT(*) > 1`,
    )
    return new Set(rows.map((r) => r.p))
  } catch { return new Set() }
}

// Persistent "not a duplicate" dismissals live on the lead row.
let dismissColEnsured: Promise<void> | null = null
const ensureDismissColumn = () => {
  if (!dismissColEnsured) {
    dismissColEnsured = query(
      `ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS duplicate_dismissed_at timestamptz`
    ).then(() => undefined).catch((e) => { dismissColEnsured = null; throw e })
  }
  return dismissColEnsured
}

interface DbLead {
  id: string
  name: string | null
  phone: string | null
  email: string | null
  source: string | null
  project_slug: string | null
  assigned_broker_id: string | null
  status: string | null
  priority: string | null
  created_at: string
  last_contact_at: string | null
  country: string | null
  budget_aed: number | null
  interest: string | null
  message: string | null
  landing_slug: string | null
  updated_at: string | null
  snooze_until: string | null
  lead_code: string | null
  duplicate_dismissed_at: string | null
  utm_id: string | null
  utm_campaign: string | null
  value_rating: number | null
}

function dbLeadToCRM(row: DbLead, dupPhones?: Set<string>) {
  const stage = (row.status as string | null) ?? 'new'
  const stageMap: Record<string, string> = {
    new: 'new', contacted: 'contacted', qualified: 'qualified',
    viewing: 'viewing', negotiation: 'negotiation', closed: 'closed', lost: 'lost',
  }
  const temperature = row.priority === 'hot' ? 'hot'
    : row.priority === 'cold' ? 'cold'
    : row.priority === 'priority' ? 'priority'
    : 'warm'
  return {
    id: row.id,
    hubspotLeadId: '',
    name: row.name ?? 'Unknown',
    phone: row.phone ?? '',
    email: row.email ?? '',
    source: row.source ?? 'direct',
    landingId: row.landing_slug ?? '',
    // utm_id carries the ad platform's campaign id (meta-lead-sync writes it on
    // every instant-form lead) — the join key Attribution and quality reads use.
    campaignId: row.utm_id ?? row.utm_campaign ?? '',
    stage: stage.charAt(0).toUpperCase() + stage.slice(1),
    pipelineStage: stageMap[stage] ?? 'new',
    temperature,
    budgetAED: row.budget_aed ? `AED ${row.budget_aed.toLocaleString()}` : 'Unknown',
    projectInterest: row.interest ?? row.project_slug ?? 'General enquiry',
    intentScore: temperature === 'priority' ? 90 : temperature === 'hot' ? 75 : temperature === 'warm' ? 55 : 30,
    urgency: temperature === 'priority' ? 'critical' : temperature === 'hot' ? 'high' : 'medium',
    // REAL now, not hardcoded false. The follow-up queue renders risk badges
    // and a risk counter from these two flags; with the server pinning them
    // false, that entire UI was dead weight that could never fire.
    //   duplicate  = another non-archived lead shares this normalised phone
    //                (the same rule the Duplicates page clusters by), unless
    //                the cluster was dismissed as "not a duplicate".
    //   wrong no.  = phone missing or too short to dial (<7 digits).
    duplicateRisk: !row.duplicate_dismissed_at && !!dupPhones?.has(normPhone(row.phone)),
    wrongNumberRisk: normPhone(row.phone).length < 7,
    assignedAgent: row.assigned_broker_id ?? '',
    lastContactAt: row.last_contact_at ?? row.created_at,
    nextBestAction: stage === 'new' ? 'Reach out and qualify' : 'Follow up',
    suggestedMessage: '',
    aiSummary: row.message ?? '',
    hasViewingScheduled: stage === 'viewing',
    viewingDate: null,
    viewingProperty: null,
    notes: [],
    taggedProjects: row.project_slug ? [row.project_slug] : [],
    snoozeUntil: row.snooze_until ?? null,
    leadCode: row.lead_code ?? null,
    duplicateDismissedAt: row.duplicate_dismissed_at ?? null,
    /** Human 0–10 value judgment; null = not yet rated. */
    valueRating: row.value_rating ?? null,
  }
}

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const user = await verifySession(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await ensureLeadsTable()
    await ensureDismissColumn()
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS value_rating int`).catch(() => undefined)
    const isBroker = user.role === 'broker'
    const ownerKeys = brokerOwnerKeys(user)

    const params: unknown[] = []
    let sql = `SELECT id, name, phone, email, source, project_slug, assigned_broker_id,
                      status, priority, created_at::text, last_contact_at::text, country,
                      budget_aed, interest, message, landing_slug, updated_at::text,
                      snooze_until::text, lead_code, duplicate_dismissed_at::text,
                      utm_id, utm_campaign, value_rating
               FROM freehold_site_leads`

    if (isBroker && ownerKeys.length) {
      sql += ` WHERE assigned_broker_id = ANY($1)`
      params.push(ownerKeys)
    }
    // The list was capped at 200 with nothing saying so, while the dashboard
    // counter counts every row — so an account with 443 leads showed "443" next
    // to a list that simply stopped at 200. Indistinguishable, from the outside,
    // from leads having gone missing.
    //
    // The cap itself is worth keeping (an unbounded SELECT on a growing table
    // is how a page dies later), but it has to be BOTH generous enough that
    // ordinary accounts are never truncated, and honest when it does bite.
    sql += ` ORDER BY created_at DESC LIMIT ${LEAD_LIST_LIMIT}`

    const rows = await query<DbLead>(sql, params)
    const dupPhones = await duplicatePhoneSet()

    // The true count under the SAME filter the list used, so a broker's total
    // matches a broker's list rather than the whole company's.
    let total = rows.length
    try {
      const countSql = `SELECT COUNT(*)::text AS n FROM freehold_site_leads${
        isBroker && ownerKeys.length ? ' WHERE assigned_broker_id = ANY($1)' : ''
      }`
      const [c] = await query<{ n: string }>(countSql, isBroker && ownerKeys.length ? [ownerKeys] : [])
      total = Number(c?.n) || rows.length
    } catch { /* fall back to the page size — never break the list over a count */ }

    // UNOWNED LEADS. Auto-distribution only runs when the workspace is in
    // 'auto' mode; otherwise a lead that arrives from a Meta form or a landing
    // page keeps assigned_broker_id = NULL. Brokers are filtered to their own
    // leads, so an unowned lead is invisible to every broker and merely
    // unremarkable to management — it looks like a normal row while in fact
    // nobody is working it. That is indistinguishable, from the floor, from
    // "the lead never arrived". Managers get the count so it can be acted on.
    let unassigned = 0
    if (!isBroker) {
      const [c] = await query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM freehold_site_leads
          WHERE assigned_broker_id IS NULL AND status = 'new'`,
      ).catch(() => [{ n: '0' }])
      unassigned = Number(c?.n) || 0
    }
    return NextResponse.json({
      leads: rows.map((r) => dbLeadToCRM(r, dupPhones)),
      source: 'db',
      unassigned,
      total,
      /** True when the list is a window onto a larger set — the UI must say so. */
      truncated: total > rows.length,
    })
  } catch (err) {
    console.error('[crm/leads] query failed', err)
    return NextResponse.json({ leads: [], source: 'error' }, { status: 500 })
  }
}

// Create a lead. Brokers may add their OWN direct leads (auto-assigned to
// themselves); management may add a lead and assign it to any broker.
export async function POST(req: Request) {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const isManagement = MANAGEMENT.includes(user.role)
  if (!isManagement && user.role !== 'broker') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as {
    name?: string; phone?: string; email?: string; source?: string
    interest?: string; budgetAed?: number | string; message?: string; assignedBrokerId?: string
  }
  const name = (body.name || '').trim()
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  // A broker can only create a lead for themselves; management chooses the owner.
  const assignedBrokerId = isManagement
    ? (body.assignedBrokerId || null)
    : (user.brokerId ?? user.email)

  const budget = body.budgetAed != null && String(body.budgetAed).trim() !== ''
    ? Number(String(body.budgetAed).replace(/[^0-9.]/g, '')) || null
    : null

  try {
    await ensureLeadsTable()
    const id = randomUUID()
    await query(
      `INSERT INTO freehold_site_leads
         (id, name, phone, email, source, status, priority, assigned_broker_id, interest, budget_aed, message)
       VALUES ($1, $2, $3, $4, $5, 'new', 'warm', $6, $7, $8, $9)`,
      [
        id, name, body.phone || null, body.email || null,
        (body.source || 'Direct').trim(), assignedBrokerId,
        (body.interest || '').trim() || null, budget, (body.message || '').trim() || null,
      ],
    )
    // Real notification: new lead waiting (broadcast to management).
    notify('lead_new', { name }, { href: '/freehold-intelligence/crm/inbox' }).catch(() => {})
    // Log creation on the lead's real activity timeline (best-effort).
    try {
      await ensureLeadActivityTable()
      await query(
        `INSERT INTO freehold_site_lead_activity (id, lead_id, activity_type, description, created_by)
         VALUES ($1, $2, 'created', $3, $4)`,
        [
          randomUUID(), id,
          `Lead created via ${(body.source || 'Direct').trim()}${assignedBrokerId ? ` · assigned to ${assignedBrokerId}` : ''}`,
          user.email,
        ],
      )
    } catch { /* non-fatal */ }
    return NextResponse.json({ ok: true, id }, { status: 201 })
  } catch (err) {
    console.error('[crm/leads] create failed', err)
    return NextResponse.json({ error: 'Create failed' }, { status: 500 })
  }
}
