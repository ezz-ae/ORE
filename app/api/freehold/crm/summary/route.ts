import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Dismissed duplicate clusters are excluded from the risk count.
let dismissColEnsured: Promise<void> | null = null
const ensureDismissColumn = () => {
  if (!dismissColEnsured) {
    dismissColEnsured = query(
      `ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS duplicate_dismissed_at timestamptz`
    ).then(() => undefined).catch((e) => { dismissColEnsured = null; throw e })
  }
  return dismissColEnsured
}

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const user = await verifySession(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await ensureDismissColumn().catch(() => {})
    const [row] = await query<{
      hot_leads: number
      urgent_follow_ups: number
      new_leads: number
      total_leads: number
      closed_leads: number
      wrong_number_risks: number
    }>(`
      SELECT
        COUNT(CASE WHEN priority = 'hot' OR priority = 'priority' THEN 1 END)::int         AS hot_leads,
        COUNT(CASE WHEN status IN ('new', 'contacted') AND
                        last_contact_at < NOW() - INTERVAL '48 hours' THEN 1 END)::int     AS urgent_follow_ups,
        COUNT(CASE WHEN status = 'new' THEN 1 END)::int                                    AS new_leads,
        COUNT(*)::int                                                                       AS total_leads,
        COUNT(CASE WHEN status IN ('closed', 'converted') THEN 1 END)::int                 AS closed_leads,
        COUNT(CASE WHEN phone IS NOT NULL AND phone <> ''
                    AND length(regexp_replace(phone, '\\D', '', 'g')) < 7 THEN 1 END)::int AS wrong_number_risks
      FROM freehold_site_leads
    `)

    // Duplicate risk = leads sharing a normalised phone number with another
    // lead (same clustering as the Duplicates page), minus dismissed clusters.
    let duplicateRisks = 0
    try {
      const [dup] = await query<{ dup_leads: number }>(`
        SELECT COALESCE(SUM(cnt), 0)::int AS dup_leads FROM (
          SELECT COUNT(*) AS cnt
          FROM freehold_site_leads
          WHERE phone IS NOT NULL
            AND length(regexp_replace(phone, '\\D', '', 'g')) >= 7
            AND duplicate_dismissed_at IS NULL
            AND (status IS NULL OR status <> 'lost')
          GROUP BY right(regexp_replace(phone, '\\D', '', 'g'), 9)
          HAVING COUNT(*) > 1
        ) g
      `)
      duplicateRisks = dup?.dup_leads ?? 0
    } catch { /* keep 0 */ }

    // Stuck stage = active stage holding the most leads with no contact for 7+ days.
    let stuckStage: { stage: string; count: number } | null = null
    try {
      const [stuck] = await query<{ status: string; cnt: number }>(`
        SELECT status, COUNT(*)::int AS cnt
        FROM freehold_site_leads
        WHERE status IN ('new', 'contacted', 'qualified', 'viewing', 'negotiation')
          AND COALESCE(last_contact_at, created_at) < NOW() - INTERVAL '7 days'
        GROUP BY status
        ORDER BY cnt DESC
        LIMIT 1
      `)
      if (stuck?.status) stuckStage = { stage: stuck.status, count: stuck.cnt }
    } catch { /* keep null */ }

    // Average time-to-close from real deals (approved/closed), in days.
    let avgCloseDays: number | null = null
    let closedDealsCount = 0
    try {
      const [deals] = await query<{ avg_days: number | null; n: number }>(`
        SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400)::float AS avg_days,
               COUNT(*)::int AS n
        FROM freehold_site_deals
        WHERE status IN ('approved', 'closed')
          AND updated_at IS NOT NULL AND created_at IS NOT NULL
      `)
      closedDealsCount = deals?.n ?? 0
      avgCloseDays = deals?.avg_days != null && closedDealsCount > 0
        ? Math.round(Number(deals.avg_days) * 10) / 10
        : null
    } catch { /* keep null */ }

    const totalLeads = row?.total_leads ?? 0
    const closedLeads = row?.closed_leads ?? 0

    return NextResponse.json({
      summary: {
        hotLeads: row?.hot_leads ?? 0,
        urgentFollowUps: row?.urgent_follow_ups ?? 0,
        newLeads: row?.new_leads ?? 0,
        totalLeads,
        closedLeads,
        conversionRate: totalLeads > 0 ? Math.round((closedLeads / totalLeads) * 100) : null,
        avgCloseDays,
        closedDealsCount,
        stuckStage,
        duplicateRisks,
        wrongNumberRisks: row?.wrong_number_risks ?? 0,
        source: 'neon',
      },
    })
  } catch (err) {
    console.error('[crm/summary] query failed', err)
    return NextResponse.json({
      summary: {
        hotLeads: 0, urgentFollowUps: 0, newLeads: 0, totalLeads: 0, closedLeads: 0,
        conversionRate: null, avgCloseDays: null, closedDealsCount: 0, stuckStage: null,
        duplicateRisks: 0, wrongNumberRisks: 0, source: 'error',
      },
    })
  }
}
