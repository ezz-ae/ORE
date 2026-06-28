import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { query } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED = new Set(['admin', 'ceo', 'director', 'marketing', 'sales_manager'])

// Whitelisted dimensions → safe SQL. `agent` joins the users table for a name.
const PERIODS: Record<string, string> = { '7': "7 days", '30': "30 days", '90': "90 days" }

// Lead-quality score from priority — the live "lead score".
const SCORE_SQL = `AVG(CASE l.priority WHEN 'priority' THEN 95 WHEN 'hot' THEN 80 WHEN 'warm' THEN 50 ELSE 25 END)`

export async function GET(req: Request) {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ALLOWED.has(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const dim = url.searchParams.get('dim') || 'source'
  const period = url.searchParams.get('period') || '30'
  const where = PERIODS[period] ? `WHERE l.created_at >= now() - INTERVAL '${PERIODS[period]}'` : ''

  try {
    let rows: Array<{ key: string; label: string; leads: string; closed: string; hot: string; avg_budget: string | null; score: string | null }>
    if (dim === 'agent') {
      rows = await query(
        `SELECT COALESCE(u.id::text, 'unassigned') AS key,
                COALESCE(u.name, 'Unassigned') AS label,
                COUNT(*)::text AS leads,
                COUNT(*) FILTER (WHERE l.status = 'closed')::text AS closed,
                COUNT(*) FILTER (WHERE l.priority IN ('hot','priority'))::text AS hot,
                AVG(l.budget_aed)::text AS avg_budget,
                ${SCORE_SQL}::text AS score
         FROM freehold_site_leads l
         LEFT JOIN freehold_site_users u ON u.id::text = l.assigned_broker_id
         ${where}
         GROUP BY u.id, u.name
         ORDER BY COUNT(*) DESC LIMIT 20`)
    } else {
      const col = dim === 'country' ? "COALESCE(l.country, 'Unknown')" : "COALESCE(l.source, 'direct')"
      rows = await query(
        `SELECT ${col} AS key, ${col} AS label,
                COUNT(*)::text AS leads,
                COUNT(*) FILTER (WHERE l.status = 'closed')::text AS closed,
                COUNT(*) FILTER (WHERE l.priority IN ('hot','priority'))::text AS hot,
                AVG(l.budget_aed)::text AS avg_budget,
                ${SCORE_SQL}::text AS score
         FROM freehold_site_leads l
         ${where}
         GROUP BY ${col}
         ORDER BY COUNT(*) DESC LIMIT 20`)
    }

    const out = rows.map((r) => {
      const leads = parseInt(r.leads, 10)
      const closed = parseInt(r.closed, 10)
      const hot = parseInt(r.hot, 10)
      return {
        key: r.key,
        label: r.label,
        leads,
        closed,
        convRate: leads > 0 ? Math.round((closed / leads) * 100) : 0,
        hotShare: leads > 0 ? Math.round((hot / leads) * 100) : 0,
        avgBudget: r.avg_budget ? Math.round(Number(r.avg_budget)) : 0,
        score: r.score ? Math.round(Number(r.score)) : 0,
      }
    })
    return NextResponse.json({ rows: out, dim, period })
  } catch {
    return NextResponse.json({ rows: [], dim, period })
  }
}
