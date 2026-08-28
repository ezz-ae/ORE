import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { brokerOwnerKeys } from '@/lib/freehold/lead-access'
import { query } from '@/lib/db'
import { ensureLeadsTable } from '@/lib/data'
import { updateLead } from '@/lib/freehold/crm-write'
import { notify } from '@/lib/freehold/notifications'
import { emailLeadMovementToInbox, notifyBrokerOfAssignedLead } from '@/lib/transactional-email'
import { answerLeadScore } from '@/lib/freehold/ads-machine'
import { authorizeReassign, authorizeDelete } from '@/lib/freehold/authority-db'
import { statusForDenial } from '@/lib/freehold/authority'
import { reportLeadToMeta } from '@/lib/freehold/lead-writeback'
import { openRatingClaim } from '@/lib/freehold/points-db'
import { outcomeOf } from '@/lib/freehold/points'

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

/**
 * Change a lead.
 *
 * The rules live in lib/freehold/crm-write.ts, not here, because the assistant
 * changes leads through the same function — a broker cannot reassign a lead by
 * asking the chat instead of pressing the button, since it is one code path.
 * This handler does the two things only an HTTP route can: read the session and
 * turn a refusal into a status code.
 */
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

  const result = await updateLead(id, body, {
    email: user.email, role: user.role, brokerId: user.brokerId ?? null,
  })
  if (!result.ok) {
    const { status, ...rest } = result
    return NextResponse.json(rest, { status })
  }
  return NextResponse.json({ ok: true, id })
}

/**
 * Delete a lead — the owner and nobody else.
 *
 * "always the only one can even delete them and the lead … anyone else is
 * account with limitations." Until now there was no delete endpoint at all, so
 * the rule had nowhere to live. It lives here: the paying account can destroy a
 * record, an admin or a team leader can only archive it, and either way the
 * attempt is on the record.
 *
 * Archiving stays available to everyone through PATCH { archived: true } — the
 * safe, reversible action that covers the real day-to-day need.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  const user = await verifySession(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const decision = await authorizeDelete('lead', id, { email: user.email, role: user.role })
  if (!decision.allowed) {
    return NextResponse.json(
      { error: 'Only the account owner can delete a lead. Archive it instead.', reason: decision.reason },
      { status: statusForDenial(decision) },
    )
  }

  try {
    await ensureLeadsTable()
    const rows = await query<{ id: string }>(
      `DELETE FROM freehold_site_leads WHERE id = $1 RETURNING id`, [id],
    )
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ok: true, id })
  } catch (err) {
    // Say what actually failed. "Try again" for a foreign-key or permission
    // error is the reflex that made the whole system feel broken.
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Delete failed' },
      { status: 500 },
    )
  }
}
