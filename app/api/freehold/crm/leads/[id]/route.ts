import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { brokerOwnerKeys } from '@/lib/freehold/lead-access'
import { query } from '@/lib/db'
import { ensureLeadsTable, ensureLeadActivityTable } from '@/lib/data'
import { notify } from '@/lib/freehold/notifications'
import { emailLeadMovementToInbox, notifyBrokerOfAssignedLead } from '@/lib/transactional-email'
import { answerLeadScore } from '@/lib/freehold/ads-machine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// "Not a duplicate" dismissals persist on the lead row (survives reloads and
// devices). Best-effort column ensure, run once per instance.
let dismissColEnsured: Promise<void> | null = null
const ensureDismissColumn = () => {
  if (!dismissColEnsured) {
    dismissColEnsured = query(
      `ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS duplicate_dismissed_at timestamptz`
    ).then(() => undefined).catch((e) => { dismissColEnsured = null; throw e })
  }
  return dismissColEnsured
}

// Describe what a PATCH changed so the lead's activity timeline reflects real
// history. Failures never break the update itself.
async function logPatchActivity(leadId: string, body: Record<string, unknown>, actor: string) {
  const entries: Array<{ type: string; description: string }> = []
  // Lead name for human-readable movement emails (best-effort).
  const leadRow = await query<{ name: string | null }>(
    `SELECT name FROM freehold_site_leads WHERE id = $1 LIMIT 1`, [leadId],
  ).catch(() => [] as { name: string | null }[])
  const leadRef = { id: leadId, name: leadRow[0]?.name ?? null }

  if (typeof body.status === 'string' && body.status) {
    entries.push({ type: 'stage', description: `Stage changed to ${body.status}` })
    // Movement feed: the brand inbox tracks every step, not just arrivals.
    void emailLeadMovementToInbox('stage', leadRef, `stage changed to ${body.status}`)
  }
  if ('assigned_broker_id' in body) {
    entries.push({
      type: 'assignment',
      description: body.assigned_broker_id ? `Assigned to ${body.assigned_broker_id}` : 'Unassigned',
    })
    if (body.assigned_broker_id) {
      // In-app notification straight to the assignee (best-effort)…
      notify('lead_assigned', { lead: leadId }, {
        recipient: String(body.assigned_broker_id),
        href: `/freehold-intelligence/crm/leads/${leadId}`,
      }).catch(() => {})
      // …and the EMAIL. The assign API and the automation engine both emailed
      // the broker; this route — the one behind the CRM's own assignment UI —
      // only pinged in-app, so a broker away from the dashboard missed exactly
      // the assignments made by hand. notifyBrokerOfAssignedLead also feeds
      // the movement note to the brand inbox, so one call covers both.
      void notifyBrokerOfAssignedLead(String(body.assigned_broker_id), leadId)
    } else {
      void emailLeadMovementToInbox('unassigned', leadRef, 'unassigned — nobody owns this lead now')
    }
  }
  if (typeof body.priority === 'string' && body.priority) {
    entries.push({ type: 'note', description: `Priority set to ${body.priority}` })
  }
  if ('value_rating' in body) {
    entries.push({ type: 'note', description: `Value rated ${Number(body.value_rating)}/10` })
  }
  if ('snooze_until' in body && body.snooze_until) {
    const until = new Date(String(body.snooze_until))
    entries.push({
      type: 'note',
      description: `Snoozed until ${Number.isNaN(until.getTime()) ? String(body.snooze_until) : until.toISOString().slice(0, 16).replace('T', ' ')}`,
    })
  }
  if (body.archived === true) entries.push({ type: 'note', description: 'Conversation archived' })
  if (body.blocked === true) entries.push({ type: 'note', description: 'Contact blocked' })
  if ('duplicate_dismissed_at' in body && body.duplicate_dismissed_at) {
    entries.push({ type: 'note', description: 'Marked as not a duplicate' })
  }
  if (entries.length === 0) return
  try {
    await ensureLeadActivityTable()
    for (const e of entries) {
      await query(
        `INSERT INTO freehold_site_lead_activity (id, lead_id, activity_type, description, created_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [crypto.randomUUID(), leadId, e.type, e.description, actor]
      )
    }
  } catch {
    // Activity logging is best-effort — the update already succeeded.
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const user = await verifySession(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Brokers may only read their own leads.
  const isBroker = user.role === 'broker'
  const ownerKeys = brokerOwnerKeys(user)
  const queryParams: unknown[] = [id]
  let ownerFilter = ''
  if (isBroker && ownerKeys.length) { queryParams.push(ownerKeys); ownerFilter = ` AND assigned_broker_id = ANY($2)` }

  try {
    const rows = await query<Record<string, unknown>>(
      `SELECT id, name, phone, email, source, project_slug, assigned_broker_id,
              status, priority, created_at::text, last_contact_at::text, country,
              budget_aed, interest, message, landing_slug, updated_at::text
       FROM freehold_site_leads
       WHERE id = $1${ownerFilter}`,
      queryParams
    )
    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ lead: rows[0] })
  } catch {
    return NextResponse.json({ error: 'DB unavailable' }, { status: 503 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const user = await verifySession(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }) }

  // Brokers may only modify their own leads, and may not reassign them away.
  const isBroker = user.role === 'broker'
  const ownerKeys = brokerOwnerKeys(user)
  if (isBroker) {
    if ('assigned_broker_id' in body) {
      return NextResponse.json({ error: 'Brokers cannot reassign leads' }, { status: 403 })
    }
    try {
      await ensureLeadsTable()
      const owner = await query<{ assigned_broker_id: string | null }>(
        `SELECT assigned_broker_id FROM freehold_site_leads WHERE id = $1`,
        [id]
      )
      if (owner.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      if (!ownerKeys.includes(owner[0].assigned_broker_id ?? '')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } catch {
      return NextResponse.json({ error: 'DB unavailable' }, { status: 503 })
    }
  }

  const ALLOWED_FIELDS = ['status', 'priority', 'assigned_broker_id', 'last_contact_at', 'interest', 'message', 'snooze_until', 'archived', 'muted_until', 'blocked', 'duplicate_dismissed_at']
  const updates: string[] = []
  const values: unknown[] = []

  // ── VALUE RATING — one click, one scale ─────────────────────────────────
  // A 0–10 judgment of what this lead is actually WORTH, replacing the old
  // binary green/red. The bottom of the scale is the point: a lead rated 0
  // teaches the machine what it should stop buying, which is exactly as
  // valuable as knowing what to buy more of. Written canonically on the lead;
  // if the Ads Machine has an unanswered question about this same lead, the
  // one click answers that too — nobody rates the same lead twice.
  if ('value_rating' in body) {
    const v = Number(body.value_rating)
    if (!Number.isFinite(v) || v < 0 || v > 10) {
      return NextResponse.json({ error: 'value_rating must be 0–10' }, { status: 400 })
    }
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS value_rating int`).catch(() => undefined)
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS value_rated_by text`).catch(() => undefined)
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS value_rated_at timestamptz`).catch(() => undefined)
    // Placeholders MUST be numbered by values.length, not updates.length —
    // `value_rated_at = now()` (and `updated_at = now()` below) add to `updates`
    // without a bound value, so numbering by updates.length desyncs every
    // later placeholder. A combined PATCH like {value_rating, status} then
    // pointed `status` and the WHERE id at the same $-index and left one
    // parameter unreferenced (Postgres 500). Numbering by values.length is
    // correct because only value-bearing clauses advance it.
    updates.push(`value_rating = $${values.length + 1}`)
    values.push(Math.round(v))
    updates.push(`value_rated_by = $${values.length + 1}`)
    values.push(user.email)
    updates.push(`value_rated_at = now()`)
    // Bridge into the machine's learning, best-effort: the rating must never
    // fail because the machine has no question open.
    void (async () => {
      try {
        const rows = await query<{ id: string }>(
          `SELECT id FROM freehold_site_ads_machine_lead_verdicts
            WHERE lead_id = $1 AND answered_at IS NULL LIMIT 1`,
          [id],
        )
        if (rows[0]) await answerLeadScore(rows[0].id, Math.round(v), user.email)
      } catch { /* machine table may not exist yet */ }
    })()
  }

  for (const field of ALLOWED_FIELDS) {
    if (field in body) {
      updates.push(`${field} = $${updates.length + 1}`)
      values.push(body[field])
    }
  }

  if (updates.length === 0) return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })

  updates.push(`updated_at = now()`)
  values.push(id)

  try {
    await ensureLeadsTable()
    if ('duplicate_dismissed_at' in body) await ensureDismissColumn()
    await query(
      `UPDATE freehold_site_leads SET ${updates.join(', ')} WHERE id = $${values.length}`,
      values
    )
    await logPatchActivity(id, body, user.email)
    return NextResponse.json({ ok: true, id })
  } catch {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}
