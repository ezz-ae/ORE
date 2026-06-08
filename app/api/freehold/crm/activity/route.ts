import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface DbActivity {
  id: string
  lead_id: string
  activity_type: string
  description: string | null
  created_by: string | null
  created_at: string
  lead_name: string | null
  lead_phone: string | null
}

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const user = await verifySession(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const isBroker = user.role === 'broker'
    const brokerId = user.brokerId ?? user.email

    let sql = `
      SELECT
        a.id, a.lead_id, a.activity_type, a.description, a.created_by,
        a.created_at::text,
        l.name AS lead_name, l.phone AS lead_phone
      FROM freehold_site_lead_activity a
      LEFT JOIN freehold_site_leads l ON l.id = a.lead_id`

    const params: unknown[] = []
    if (isBroker && brokerId) {
      sql += ` WHERE l.assigned_broker_id = $1`
      params.push(brokerId)
    }
    sql += ` ORDER BY a.created_at DESC LIMIT 100`

    const rows = await query<DbActivity>(sql, params)
    return NextResponse.json({ activity: rows, source: 'db' })
  } catch {
    return NextResponse.json({ activity: [], source: 'mock' })
  }
}

export async function POST(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const user = await verifySession(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { leadId?: string; activityType?: string; description?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }) }

  if (!body.leadId || !body.activityType) {
    return NextResponse.json({ error: 'leadId and activityType required' }, { status: 400 })
  }

  try {
    const id = crypto.randomUUID()
    await query(
      `INSERT INTO freehold_site_lead_activity (id, lead_id, activity_type, description, created_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, body.leadId, body.activityType, body.description ?? null, user.email]
    )
    return NextResponse.json({ ok: true, id })
  } catch {
    return NextResponse.json({ error: 'Failed to log activity' }, { status: 500 })
  }
}
