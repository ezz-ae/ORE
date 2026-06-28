import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { query } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// 360° view of one team member — management only.
const ALLOWED = new Set(['admin', 'ceo', 'director', 'sales_manager'])

const n = (v: unknown) => (v == null ? 0 : Number(v) || 0)

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ALLOWED.has(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await ctx.params

  // Resolve the agent. leads key = users.id; activity key = email; deals/ad-spend
  // key = brokerId||email — so we match generously across id + email + name.
  const [agent] = await query<{ id: string; name: string; email: string; phone: string | null; role: string; created_at: string | null }>(
    `SELECT id::text, name, email, phone, role, created_at::text FROM freehold_site_users WHERE id::text = $1 LIMIT 1`,
    [id],
  ).catch(() => [])
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

  const email = agent.email || ''
  const name = agent.name || ''

  const [leadStats, leads, activity, deals, adSpend, campaigns] = await Promise.all([
    query<{ total: string; new_count: string; closed: string; hot: string; overdue: string }>(
      `SELECT COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE status = 'new')::text AS new_count,
        COUNT(*) FILTER (WHERE status = 'closed')::text AS closed,
        COUNT(*) FILTER (WHERE priority IN ('hot','priority'))::text AS hot,
        COUNT(*) FILTER (WHERE last_contact_at < now() - INTERVAL '72 hours' AND status NOT IN ('closed','lost'))::text AS overdue
       FROM freehold_site_leads WHERE assigned_broker_id = $1`, [id]).catch(() => []),
    query<Record<string, unknown>>(
      `SELECT id, name, status, priority, COALESCE(source,'direct') AS source, budget_aed, created_at::text
       FROM freehold_site_leads WHERE assigned_broker_id = $1 ORDER BY created_at DESC LIMIT 50`, [id]).catch(() => []),
    query<Record<string, unknown>>(
      `SELECT a.activity_type, a.description, a.created_at::text, l.name AS lead_name
       FROM freehold_site_lead_activity a LEFT JOIN freehold_site_leads l ON l.id = a.lead_id
       WHERE a.created_by = $1 ORDER BY a.created_at DESC LIMIT 60`, [email]).catch(() => []),
    query<Record<string, unknown>>(
      `SELECT id, lead_name, project_name, property_value_aed, net_commission_aed, commission_received_aed,
              payment_status, status, created_at::text, co_agent_name
       FROM freehold_site_deals
       WHERE agent_id = $1 OR agent_id = $2 OR co_agent_name = $3
       ORDER BY created_at DESC LIMIT 50`, [id, email, name]).catch(() => []),
    query<{ credits: string; aed: string; active: string }>(
      `SELECT COALESCE(SUM(credits_spent),0)::text AS credits,
              (COALESCE(SUM(credits_spent),0) * 10)::text AS aed,
              COUNT(*) FILTER (WHERE status = 'active')::text AS active
       FROM ad_spend_allocations WHERE broker_id = $1 OR broker_id = $2`, [id, email]).catch(() => []),
    query<Record<string, unknown>>(
      `SELECT campaign_name, credits_spent, status, created_at::text
       FROM ad_spend_allocations WHERE broker_id = $1 OR broker_id = $2
       ORDER BY created_at DESC LIMIT 20`, [id, email]).catch(() => []),
  ])

  // Commission / deal rollup from the fetched deals (approved + closed count toward money).
  const earned = ['approved', 'closed']
  const totals = (deals as Array<Record<string, unknown>>).reduce<{
    totalDeals: number; approvedDeals: number; closedDeals: number; pendingDeals: number
    salesVolumeAed: number; commissionAed: number; receivedAed: number
  }>(
    (acc, d) => {
      acc.totalDeals++
      const st = String(d.status || '')
      if (earned.includes(st)) {
        acc.approvedDeals++
        acc.salesVolumeAed += n(d.property_value_aed)
        acc.commissionAed += n(d.net_commission_aed)
        acc.receivedAed += n(d.commission_received_aed)
      }
      if (st === 'closed') acc.closedDeals++
      if (st === 'pending_step1' || st === 'pending_step2') acc.pendingDeals++
      return acc
    },
    { totalDeals: 0, approvedDeals: 0, closedDeals: 0, pendingDeals: 0, salesVolumeAed: 0, commissionAed: 0, receivedAed: 0 },
  )
  const outstandingAed = Math.max(0, totals.commissionAed - totals.receivedAed)

  const ls = leadStats[0] ?? { total: '0', new_count: '0', closed: '0', hot: '0', overdue: '0' }
  const spend = adSpend[0] ?? { credits: '0', aed: '0', active: '0' }
  const tenureDays = agent.created_at ? Math.max(0, Math.round((Date.now() - new Date(agent.created_at).getTime()) / 86400000)) : null

  return NextResponse.json({
    agent: { id: agent.id, name, email, phone: agent.phone, role: agent.role, tenureDays },
    leadStats: {
      total: n(ls.total), new: n(ls.new_count), closed: n(ls.closed), hot: n(ls.hot), overdue: n(ls.overdue),
      closingRate: n(ls.total) > 0 ? Math.round((n(ls.closed) / n(ls.total)) * 100) : 0,
    },
    leads: (leads as Array<Record<string, unknown>>).map((l) => ({
      id: l.id, name: l.name, status: l.status, priority: l.priority, source: l.source,
      budgetAed: n(l.budget_aed), createdAt: l.created_at,
    })),
    activity: (activity as Array<Record<string, unknown>>).map((a) => ({
      type: a.activity_type, description: a.description, leadName: a.lead_name, createdAt: a.created_at,
    })),
    deals: (deals as Array<Record<string, unknown>>).map((d) => ({
      id: d.id, leadName: d.lead_name, projectName: d.project_name, status: d.status,
      propertyValueAed: n(d.property_value_aed), netCommissionAed: n(d.net_commission_aed),
      receivedAed: n(d.commission_received_aed), paymentStatus: d.payment_status,
      coAgentName: d.co_agent_name, createdAt: d.created_at,
    })),
    finance: { ...totals, outstandingAed },
    ads: {
      totalCredits: n(spend.credits), totalAed: n(spend.aed), activeCampaigns: n(spend.active),
      campaigns: (campaigns as Array<Record<string, unknown>>).map((c) => ({
        name: c.campaign_name, creditsSpent: n(c.credits_spent), status: c.status, createdAt: c.created_at,
      })),
    },
  })
}
