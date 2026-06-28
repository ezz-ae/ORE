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
      await query(`UPDATE freehold_site_users SET role = $2 WHERE id = $1`, [id, body.role])
    }
    if (typeof body.suspended === 'boolean') {
      await query(`UPDATE freehold_site_users SET suspended = $2 WHERE id = $1`, [id, body.suspended])
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
    await query(`DELETE FROM freehold_site_users WHERE id = $1`, [id])
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[team] delete failed', err)
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 })
  }
}
