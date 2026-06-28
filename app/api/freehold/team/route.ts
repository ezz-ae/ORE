import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomUUID } from 'node:crypto'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { query } from '@/lib/db'
import { upsertUserProfile, getUserProfileByEmail } from '@/lib/data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MANAGEMENT = ['admin', 'ceo', 'director', 'sales_manager']
const VALID_ROLES = ['broker', 'admin', 'sales_manager', 'director', 'ceo', 'marketing']

const DB_ROLE_TO_UI: Record<string, string> = {
  ceo:           'Owner',
  director:      'Admin',
  admin:         'Admin',
  sales_manager: 'Admin',
  marketing:     'Agent',
  broker:        'Agent',
}

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const user = await verifySession(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const rows = await query<{
      id: string
      name: string | null
      email: string
      role: string
      ai_access: boolean | null
      phone: string | null
      commission_rate: number | null
      suspended: boolean | null
      banned: boolean | null
      ban_reason: string | null
      created_at: string | null
      last_login_at: string | null
    }>(
      `SELECT id, name, email, role, ai_access, phone, commission_rate,
              COALESCE(suspended, false) AS suspended,
              COALESCE(banned, false) AS banned, ban_reason,
              created_at::text,
              last_login_at::text
       FROM freehold_site_users
       ORDER BY
         CASE role
           WHEN 'ceo'           THEN 1
           WHEN 'director'      THEN 2
           WHEN 'admin'         THEN 3
           WHEN 'sales_manager' THEN 4
           WHEN 'marketing'     THEN 5
           ELSE 6
         END, name ASC`,
    )

    const members = rows.map((r) => ({
      id:         r.id,
      name:       r.name ?? r.email.split('@')[0],
      email:      r.email,
      role:       DB_ROLE_TO_UI[r.role] ?? 'Agent',
      dbRole:     r.role,
      status:     (r.banned ? 'banned' : r.suspended ? 'suspended' : 'active') as 'active' | 'suspended' | 'banned',
      suspended:  r.suspended ?? false,
      banned:     r.banned ?? false,
      banReason:  r.ban_reason ?? null,
      phone:      r.phone ?? null,
      commissionRate: r.commission_rate ?? null,
      joinedAt:   r.created_at?.slice(0, 10) ?? '',
      lastActive: r.last_login_at?.slice(0, 10) ?? null,
      initials:   initials(r.name ?? r.email),
      aiAccess:   r.ai_access ?? false,
    }))

    return NextResponse.json({ members, count: members.length, source: 'db' })
  } catch (err) {
    console.error('[team] query failed', err)
    return NextResponse.json({ error: 'Failed to load team' }, { status: 500 })
  }
}

// Invite / create a team member.
export async function POST(req: NextRequest) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  const user = await verifySession(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!MANAGEMENT.includes(String(user.role))) return NextResponse.json({ error: 'Management only' }, { status: 403 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const name = String(body.name || '').trim()
  const email = String(body.email || '').trim().toLowerCase()
  const role = VALID_ROLES.includes(String(body.role)) ? String(body.role) : 'broker'
  if (!name || !email) return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })

  try {
    const existing = await getUserProfileByEmail(email)
    if (existing) return NextResponse.json({ error: 'A user with that email already exists' }, { status: 409 })
    const member = await upsertUserProfile({ id: `user_${randomUUID()}`, name, email, role })
    return NextResponse.json({ member }, { status: 201 })
  } catch (err) {
    console.error('[team] invite failed', err)
    return NextResponse.json({ error: 'Failed to invite member' }, { status: 500 })
  }
}
