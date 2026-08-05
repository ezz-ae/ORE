import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { query } from '@/lib/db'
import { ensureUsersTable } from '@/lib/data'
import {
  getProfileSpine, updateProfileSpine, teamMemberIds,
  EDITABLE_PROFILE_FIELDS, type EditableProfileField,
} from '@/lib/freehold/teams'
import { logAuthority } from '@/lib/freehold/authority-db'
import { decideMemberAdmin } from '@/lib/freehold/authority'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MANAGEMENT = ['admin', 'ceo', 'director', 'sales_manager']
const VALID_ROLES = ['broker', 'team_leader', 'admin', 'sales_manager', 'director', 'ceo', 'marketing']

async function requireManager() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  const user = await verifySession(token)
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (!MANAGEMENT.includes(String(user.role))) return { error: NextResponse.json({ error: 'Management only' }, { status: 403 }) }
  return { user }
}

/**
 * The person behind the account — the offer-letter spine plus everything the
 * roster already knew.
 *
 * Management reads anyone. A team leader reads only the people they lead: the
 * same scope rule as the roster, applied one profile at a time so there is no
 * way to reach a colleague's commission rate by guessing an id.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  const user = await verifySession(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const isManagement = MANAGEMENT.includes(String(user.role))
  const isLeader = user.role === 'team_leader'
  if (!isManagement && !isLeader) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    if (isLeader) {
      const members = user.brokerId ? await teamMemberIds(user.brokerId) : []
      const isSelf = user.brokerId === id
      if (!isSelf && !members.includes(id)) {
        return NextResponse.json({ error: 'That person is not on your team' }, { status: 403 })
      }
    }
    const [account] = await query<{
      id: string; name: string | null; email: string; role: string
      phone: string | null; suspended: boolean | null; banned: boolean | null
      created_at: string | null; last_login_at: string | null
    }>(
      `SELECT id, name, email, role, phone,
              COALESCE(suspended,false) AS suspended, COALESCE(banned,false) AS banned,
              created_at::text, last_login_at::text
         FROM freehold_site_users WHERE id = $1 LIMIT 1`,
      [id],
    )
    if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const profile = await getProfileSpine(id)
    return NextResponse.json({ account, profile })
  } catch (err) {
    // Name the failure. A profile that silently renders empty is
    // indistinguishable from a person with nothing filled in.
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load profile' },
      { status: 500 },
    )
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireManager()
  if (auth.error) return auth.error
  const { id } = await params

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  try {
    await ensureUsersTable()

    // ── The offer-letter spine ────────────────────────────────────────────
    // Start date, licence number, title, commission, targets, reporting line.
    // Only whitelisted columns are written and the column NAME comes from the
    // whitelist, never from the request body.
    const spine: Partial<Record<EditableProfileField, unknown>> = {}
    for (const field of EDITABLE_PROFILE_FIELDS) {
      if (field in body) spine[field] = body[field]
    }
    if (Object.keys(spine).length) {
      const changed = await updateProfileSpine(id, spine)
      if (!changed) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
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
      // Changing what someone is allowed to do is the single most consequential
      // edit on this screen. It goes on the record with both roles named.
      void logAuthority({
        actorEmail: actor.email, actorRole: String(actor.role),
        action: 'member.role', targetType: 'member', targetId: id,
        decision: decideMemberAdmin(actor.role),
        detail: `${target?.role ?? 'unknown'} → ${body.role}`,
      })
    }
    if (typeof body.suspended === 'boolean') {
      await query(`UPDATE freehold_site_users SET suspended = $2 WHERE id = $1`, [id, body.suspended])
      void logAuthority({
        actorEmail: auth.user.email, actorRole: String(auth.user.role),
        action: 'member.suspend', targetType: 'member', targetId: id,
        decision: decideMemberAdmin(auth.user.role),
        detail: body.suspended ? 'suspended' : 'un-suspended',
      })
    }
    if (typeof body.banned === 'boolean') {
      // Banning also suspends access; unbanning leaves suspension as-is.
      await query(
        `UPDATE freehold_site_users SET banned = $2, ban_reason = $3${body.banned ? ', suspended = true' : ''} WHERE id = $1`,
        [id, body.banned, body.banned ? String(body.banReason ?? '') : null],
      )
      void logAuthority({
        actorEmail: auth.user.email, actorRole: String(auth.user.role),
        action: 'member.suspend', targetType: 'member', targetId: id,
        decision: decideMemberAdmin(auth.user.role),
        detail: body.banned ? `banned — ${String(body.banReason ?? 'no reason given')}` : 'un-banned',
      })
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
