import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

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
      created_at: string | null
      last_login_at: string | null
    }>(
      `SELECT id, name, email, role, ai_access,
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
      status:     'active' as const,
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
