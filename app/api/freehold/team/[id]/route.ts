import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { query } from '@/lib/db'
import { ensureUsersTable } from '@/lib/data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MANAGEMENT = ['admin', 'ceo', 'director', 'sales_manager']
const VALID_ROLES = ['broker', 'admin', 'sales_manager', 'director', 'ceo', 'marketing']

async function requireManager() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  const user = await verifySession(token)
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (!MANAGEMENT.includes(String(user.role))) return { error: NextResponse.json({ error: 'Management only' }, { status: 403 }) }
  return { user }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireManager()
  if (auth.error) return auth.error
  const { id } = await params

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  try {
    await ensureUsersTable()
    if (typeof body.role === 'string') {
      if (!VALID_ROLES.includes(body.role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
      // Role changes are privileged: only CEO/Admin may reassign roles, nobody
      // may change their own role (no self-escalation), and only a CEO may grant
      // or alter a CEO account.
      const actor = auth.user
      const [target] = await query<{ role: string; email: string }>(
        `SELECT role, email FROM freehold_site_users WHERE id = $1 LIMIT 1`, [id],
      )
      const actorRole = String(actor.role)
      if (!['ceo', 'admin'].includes(actorRole)) {
        return NextResponse.json({ error: 'Only CEO or Admin can change roles' }, { status: 403 })
      }
      if (target?.email && target.email.toLowerCase() === String(actor.email).toLowerCase()) {
        return NextResponse.json({ error: 'You cannot change your own role' }, { status: 403 })
      }
      if ((body.role === 'ceo' || target?.role === 'ceo') && actorRole !== 'ceo') {
        return NextResponse.json({ error: 'Only a CEO can grant or change a CEO account' }, { status: 403 })
      }
      await query(`UPDATE freehold_site_users SET role = $2 WHERE id = $1`, [id, body.role])
    }
    if (typeof body.suspended === 'boolean') {
      await query(`UPDATE freehold_site_users SET suspended = $2 WHERE id = $1`, [id, body.suspended])
    }
    if (typeof body.banned === 'boolean') {
      // Banning also suspends access; unbanning leaves suspension as-is.
      await query(
        `UPDATE freehold_site_users SET banned = $2, ban_reason = $3${body.banned ? ', suspended = true' : ''} WHERE id = $1`,
        [id, body.banned, body.banned ? String(body.banReason ?? '') : null],
      )
    }
    // Full profile edit (name, email, phone, commission).
    if (typeof body.name === 'string' && body.name.trim()) {
      await query(`UPDATE freehold_site_users SET name = $2 WHERE id = $1`, [id, body.name.trim()])
    }
    if (typeof body.email === 'string' && body.email.trim()) {
      const email = body.email.trim().toLowerCase()
      const clash = await query<{ id: string }>(
        `SELECT id FROM freehold_site_users WHERE lower(email) = $1 AND id <> $2 LIMIT 1`, [email, id],
      )
      if (clash.length) return NextResponse.json({ error: 'Another user already has that email' }, { status: 409 })
      await query(`UPDATE freehold_site_users SET email = $2 WHERE id = $1`, [id, email])
    }
    if (typeof body.phone === 'string') {
      await query(`UPDATE freehold_site_users SET phone = $2 WHERE id = $1`, [id, body.phone.trim() || null])
    }
    if (body.commissionRate !== undefined) {
      const rate = body.commissionRate === null || body.commissionRate === '' ? null : Number(body.commissionRate)
      if (rate !== null && (Number.isNaN(rate) || rate < 0 || rate > 100)) {
        return NextResponse.json({ error: 'Commission must be 0–100' }, { status: 400 })
      }
      await query(`UPDATE freehold_site_users SET commission_rate = $2 WHERE id = $1`, [id, rate])
    }
    return NextResponse.json({ ok: true, id })
  } catch (err) {
    console.error('[team] update failed', err)
    return NextResponse.json({ error: 'Failed to update member' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireManager()
  if (auth.error) return auth.error
  const { id } = await params
  try {
    const actor = auth.user
    const [target] = await query<{ role: string; email: string }>(
      `SELECT role, email FROM freehold_site_users WHERE id = $1 LIMIT 1`, [id],
    )
    // Deleting accounts is CEO/Admin-only; you can't delete yourself, and only a
    // CEO can remove a CEO account.
    if (!['ceo', 'admin'].includes(String(actor.role))) {
      return NextResponse.json({ error: 'Only CEO or Admin can remove members' }, { status: 403 })
    }
    if (target?.email && target.email.toLowerCase() === String(actor.email).toLowerCase()) {
      return NextResponse.json({ error: 'You cannot remove your own account' }, { status: 403 })
    }
    if (target?.role === 'ceo' && String(actor.role) !== 'ceo') {
      return NextResponse.json({ error: 'Only a CEO can remove a CEO account' }, { status: 403 })
    }
    await query(`DELETE FROM freehold_site_users WHERE id = $1`, [id])
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[team] delete failed', err)
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 })
  }
}
