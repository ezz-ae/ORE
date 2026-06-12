import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const user = await verifySession(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const [row] = await query<{
      hot_leads: number
      urgent_follow_ups: number
      new_leads: number
      total_leads: number
    }>(`
      SELECT
        COUNT(CASE WHEN priority = 'hot' OR priority = 'priority' THEN 1 END)::int         AS hot_leads,
        COUNT(CASE WHEN status IN ('new', 'contacted') AND
                        last_contact_at < NOW() - INTERVAL '48 hours' THEN 1 END)::int     AS urgent_follow_ups,
        COUNT(CASE WHEN status = 'new' THEN 1 END)::int                                    AS new_leads,
        COUNT(*)::int                                                                       AS total_leads
      FROM freehold_site_leads
    `)

    return NextResponse.json({
      summary: {
        hotLeads: row?.hot_leads ?? 0,
        urgentFollowUps: row?.urgent_follow_ups ?? 0,
        newLeads: row?.new_leads ?? 0,
        totalLeads: row?.total_leads ?? 0,
        duplicateRisks: 0,
        wrongNumberRisks: 0,
        source: 'neon',
      },
    })
  } catch (err) {
    console.error('[crm/summary] query failed', err)
    return NextResponse.json({
      summary: { hotLeads: 0, urgentFollowUps: 0, newLeads: 0, totalLeads: 0, duplicateRisks: 0, wrongNumberRisks: 0, source: 'error' },
    })
  }
}
