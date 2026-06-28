import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { query } from '@/lib/db'
import type { CRMAgentCapacity } from '@/src/features/freehold-intelligence/server-session'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const user = await verifySession(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const rows = await query<{
      id: string
      name: string
      email: string
      phone: string | null
      role: string
      total_leads: string
      hot_leads: string
      recent_wins: string
      overdue_followups: string
    }>(
      `SELECT
         u.id,
         u.name,
         u.email,
         u.phone,
         u.role,
         COALESCE(l.total_leads, 0)::text        AS total_leads,
         COALESCE(l.hot_leads, 0)::text           AS hot_leads,
         COALESCE(l.recent_wins, 0)::text         AS recent_wins,
         COALESCE(l.overdue_followups, 0)::text   AS overdue_followups
       FROM freehold_site_users u
       LEFT JOIN LATERAL (
         SELECT
           COUNT(*)                                                             AS total_leads,
           COUNT(*) FILTER (WHERE priority = 'hot')                            AS hot_leads,
           COUNT(*) FILTER (WHERE status = 'closed'
                              AND updated_at > now() - INTERVAL '30 days')     AS recent_wins,
           COUNT(*) FILTER (WHERE last_contact_at < now() - INTERVAL '72 hours'
                              AND status NOT IN ('closed','lost'))              AS overdue_followups
         FROM freehold_site_leads
         WHERE assigned_broker_id = u.id::text
       ) l ON TRUE
       WHERE u.role = 'broker'
       ORDER BY l.total_leads DESC NULLS LAST`,
      []
    )

    if (rows.length === 0) return NextResponse.json({ agents: [], source: 'db_empty' })

    const MAX_CAPACITY = 12
    const agents: CRMAgentCapacity[] = rows.map(r => {
      const total = parseInt(r.total_leads, 10)
      const utilization = Math.round((total / MAX_CAPACITY) * 100)
      const status: CRMAgentCapacity['status'] =
        utilization >= 90 ? 'overloaded' : utilization >= 65 ? 'at_capacity' : 'available'
      const nameParts = r.name.split(' ')
      const initials = nameParts.map(p => p[0]).slice(0, 2).join('').toUpperCase()
      return {
        id: r.id,
        name: r.name,
        initials,
        role: r.role === 'broker' ? 'Sales Advisor' : r.role,
        totalLeads: total,
        hotLeads: parseInt(r.hot_leads, 10),
        overdueFollowUps: parseInt(r.overdue_followups, 10),
        utilization,
        status,
        specialty: '',
        recentWins: parseInt(r.recent_wins, 10),
        email: r.email || '',
        phone: r.phone || '',
      }
    })

    return NextResponse.json({ agents, source: 'db' })
  } catch {
    return NextResponse.json({ agents: [], source: 'error' })
  }
}
