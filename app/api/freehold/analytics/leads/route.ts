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
    const [leadStats, sourceStats, stageStats, recentActivity] = await Promise.all([
      query<{ total: string; last_30d: string; last_7d: string; closed: string; new_count: string }>(`
        SELECT
          COUNT(*)::text AS total,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::text AS last_30d,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::text AS last_7d,
          COUNT(*) FILTER (WHERE status = 'closed')::text AS closed,
          COUNT(*) FILTER (WHERE status = 'new')::text AS new_count
        FROM freehold_site_leads
      `),
      query<{ source: string; count: string }>(`
        SELECT COALESCE(source, 'direct') AS source, COUNT(*)::text AS count
        FROM freehold_site_leads
        GROUP BY source
        ORDER BY COUNT(*) DESC
        LIMIT 8
      `),
      query<{ status: string; count: string }>(`
        SELECT COALESCE(status, 'new') AS status, COUNT(*)::text AS count
        FROM freehold_site_leads
        GROUP BY status
        ORDER BY COUNT(*) DESC
      `),
      query<{ date: string; count: string }>(`
        SELECT DATE_TRUNC('day', created_at)::date::text AS date, COUNT(*)::text AS count
        FROM freehold_site_leads
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE_TRUNC('day', created_at)
        ORDER BY date ASC
      `),
    ])

    const stats = leadStats[0] ?? { total: '0', last_30d: '0', last_7d: '0', closed: '0', new_count: '0' }

    return NextResponse.json({
      leads: {
        total: parseInt(stats.total),
        last30d: parseInt(stats.last_30d),
        last7d: parseInt(stats.last_7d),
        closed: parseInt(stats.closed),
        new: parseInt(stats.new_count),
        closingRate: stats.total !== '0' ? Math.round((parseInt(stats.closed) / parseInt(stats.total)) * 100) : 0,
      },
      sources: sourceStats.map(r => ({ label: r.source, count: parseInt(r.count) })),
      stages: stageStats.map(r => ({ stage: r.status, count: parseInt(r.count) })),
      daily: recentActivity.map(r => ({ date: r.date, leads: parseInt(r.count) })),
    })
  } catch {
    return NextResponse.json({ error: 'Analytics unavailable' }, { status: 503 })
  }
}
