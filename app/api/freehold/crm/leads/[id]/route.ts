import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { query } from '@/lib/db'
import { ensureLeadsTable } from '@/lib/data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const user = await verifySession(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const rows = await query<Record<string, unknown>>(
      `SELECT id, name, phone, email, source, project_slug, assigned_broker_id,
              status, priority, created_at::text, last_contact_at::text, country,
              budget_aed, interest, message, landing_slug, updated_at::text
       FROM freehold_site_leads
       WHERE id = $1`,
      [id]
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

  const ALLOWED_FIELDS = ['status', 'priority', 'assigned_broker_id', 'last_contact_at', 'interest', 'message', 'snooze_until']
  const updates: string[] = []
  const values: unknown[] = []

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
    await query(
      `UPDATE freehold_site_leads SET ${updates.join(', ')} WHERE id = $${values.length}`,
      values
    )
    return NextResponse.json({ ok: true, id })
  } catch {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}
