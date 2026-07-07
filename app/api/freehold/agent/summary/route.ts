import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { query } from '@/lib/db'
import { getFinanceTotals } from '@/lib/deals'
import { getLiveIntegrationStatuses } from '@/lib/freehold/integration-status'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * "About me" rollup for the signed-in broker — always session-scoped, so any
 * authenticated user (broker or manager) sees exactly their own numbers and
 * nothing cross-broker. Query shapes mirror /api/freehold/analytics/agent/[id]
 * (the management 360° view) but keyed to the session instead of a param.
 */

const n = (v: unknown) => (v == null ? 0 : Number(v) || 0)

export async function GET() {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // A broker's records may be keyed by brokerId (defaults to users.id at login)
  // or, historically, by email — match both, like the analytics rollup does.
  const sid = user.brokerId || user.email
  const brokerKeys = Array.from(new Set([sid, user.email].filter(Boolean)))

  const [leadStats, response, focusLeads, focusDeals, dealFacts, firstSpend, member, finance, integrationStatuses] =
    await Promise.all([
      query<{ total: string; open: string; hot: string; closed: string; new_month: string }>(
        `SELECT COUNT(*)::text AS total,
           COUNT(*) FILTER (WHERE status NOT IN ('closed','converted','lost'))::text AS open,
           COUNT(*) FILTER (WHERE priority IN ('hot','priority') AND status NOT IN ('closed','converted','lost'))::text AS hot,
           COUNT(*) FILTER (WHERE status IN ('closed','converted'))::text AS closed,
           COUNT(*) FILTER (WHERE created_at >= date_trunc('month', now()))::text AS new_month
         FROM freehold_site_leads WHERE assigned_broker_id = ANY($1)`,
        [brokerKeys],
      ).catch(() => []),
      // Avg hours between a lead landing and this broker's first logged activity
      // on it. Null (not zero) when no lead has a first response yet.
      query<{ hours: string | null; samples: string }>(
        `SELECT AVG(EXTRACT(EPOCH FROM (fa.first_at - l.created_at)) / 3600.0)::text AS hours,
                COUNT(*)::text AS samples
         FROM freehold_site_leads l
         JOIN LATERAL (
           SELECT MIN(a.created_at) AS first_at
           FROM freehold_site_lead_activity a
           WHERE a.lead_id = l.id AND a.created_by = $2
         ) fa ON fa.first_at IS NOT NULL AND fa.first_at >= l.created_at
         WHERE l.assigned_broker_id = ANY($1)`,
        [brokerKeys, user.email],
      ).catch(() => []),
      // Top project interests among my leads — the real "focus areas".
      query<{ slug: string; name: string; leads: string }>(
        `SELECT l.project_slug AS slug,
                COALESCE(NULLIF(MAX(p.name), ''), l.project_slug) AS name,
                COUNT(*)::text AS leads
         FROM freehold_site_leads l
         LEFT JOIN freehold_site_projects p ON p.slug = l.project_slug
         WHERE l.assigned_broker_id = ANY($1)
           AND l.project_slug IS NOT NULL AND l.project_slug <> ''
         GROUP BY l.project_slug
         ORDER BY COUNT(*) DESC
         LIMIT 5`,
        [brokerKeys],
      ).catch(() => []),
      query<{ slug: string; closed: string }>(
        `SELECT project_slug AS slug, COUNT(*)::text AS closed
         FROM freehold_site_deals
         WHERE agent_id = ANY($1) AND status = 'closed' AND project_slug <> ''
         GROUP BY project_slug`,
        [brokerKeys],
      ).catch(() => []),
      query<{ closed: string; first_closed_at: string | null }>(
        `SELECT COUNT(*) FILTER (WHERE status = 'closed')::text AS closed,
                MIN(created_at) FILTER (WHERE status = 'closed')::text AS first_closed_at
         FROM freehold_site_deals WHERE agent_id = ANY($1)`,
        [brokerKeys],
      ).catch(() => []),
      query<{ first_spend: string | null }>(
        `SELECT MIN(created_at)::text AS first_spend
         FROM credit_ledger WHERE broker_id = ANY($1) AND type = 'spend'`,
        [brokerKeys],
      ).catch(() => []),
      query<{ created_at: string | null }>(
        `SELECT created_at::text FROM freehold_site_users WHERE lower(email) = lower($1) LIMIT 1`,
        [user.email],
      ).catch(() => []),
      // Same scope as /api/freehold/deals?totals=1, so the numbers agree.
      getFinanceTotals({ agentId: sid }),
      getLiveIntegrationStatuses().catch(() => []),
    ])

  const ls = leadStats[0] ?? { total: '0', open: '0', hot: '0', closed: '0', new_month: '0' }
  const total = n(ls.total)
  const closedLeads = n(ls.closed)
  const hot = n(ls.hot)

  const resp = response[0]
  const avgFirstResponseHours =
    resp && resp.hours != null && n(resp.samples) > 0
      ? Math.round(Number(resp.hours) * 10) / 10
      : null

  const closedByProject = new Map(focusDeals.map((d) => [d.slug, n(d.closed)]))
  const focus = focusLeads.map((f) => ({
    slug: f.slug,
    name: f.name,
    leads: n(f.leads),
    closedDeals: closedByProject.get(f.slug) ?? 0,
  }))

  const df = dealFacts[0] ?? { closed: '0', first_closed_at: null }
  const closedDeals = n(df.closed)
  const firstCampaignAt = firstSpend[0]?.first_spend ?? null

  // Workspace-wide provider status for the broker's "My AI" page. Only the
  // external providers (never the data/infra posture rows), and only name +
  // state — no env-key details.
  const integrations = integrationStatuses
    .filter((s) => s.category !== 'data')
    .map(({ id, name, category, state }) => ({ id, name, category, state }))
  const aiStatus = integrationStatuses.find((s) => s.id === 'ai')
  const aiConfigured = !!aiStatus && aiStatus.state !== 'disconnected'

  return NextResponse.json({
    memberSince: member[0]?.created_at ?? null,
    leads: {
      total,
      open: n(ls.open),
      hot,
      closed: closedLeads,
      newThisMonth: n(ls.new_month),
      closingRate: total > 0 ? Math.round((closedLeads / total) * 100) : null,
    },
    avgFirstResponseHours,
    deals: { closed: closedDeals, firstClosedAt: df.first_closed_at },
    finance: {
      totalDeals: finance.totalDeals,
      approvedDeals: finance.approvedDeals,
      totalSalesAed: finance.totalSalesAed,
      totalCommissionAed: finance.totalCommissionAed,
      totalPaidAed: finance.totalPaidAed,
      totalOutstandingAed: finance.totalOutstandingAed,
    },
    focus,
    // Achievement FACTS — every earned flag and date is derived from real rows.
    achievements: {
      firstDealClosed: { earned: closedDeals > 0, date: df.first_closed_at },
      tenLeadsHandled: { earned: total >= 10, count: total },
      firstCampaignLaunched: { earned: !!firstCampaignAt, date: firstCampaignAt },
      hotStreak: { earned: hot >= 3, count: hot },
    },
    integrations,
    aiConfigured,
  })
}
