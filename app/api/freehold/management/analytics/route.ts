import { NextResponse } from "next/server"
import { requireSession } from "@/lib/freehold/api-auth"
import { MANAGEMENT_ROLES } from "@/lib/freehold/session-types"
import { query } from "@/lib/db"
import { getFinanceTotals } from "@/lib/deals"
import { getCompanyFinanceSummary } from "@/lib/finance"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const n = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0)
async function safe<T>(fn: () => Promise<T>, fb: T): Promise<T> { try { return await fn() } catch { return fb } }

export async function GET() {
  // Company finance + sales aggregates — management roles only.
  const auth = await requireSession(MANAGEMENT_ROLES)
  if ('res' in auth) return auth.res

  const [totals, finance] = await Promise.all([
    safe(() => getFinanceTotals(), { totalDeals: 0, approvedDeals: 0, pendingDeals: 0, totalSalesAed: 0, totalCommissionAed: 0, netCommissionAed: 0, totalPaidAed: 0, totalOutstandingAed: 0 }),
    safe(() => getCompanyFinanceSummary(), null),
  ])

  // Monthly deal performance (last 6 months) — sales + commission + count.
  const monthlyDeals = await safe(() => query<{ m: string; sales: number; comm: number; c: number }>(
    `SELECT to_char(date_trunc('month', created_at), 'Mon YYYY') AS m,
            COALESCE(SUM(property_value_aed), 0)::float AS sales,
            COALESCE(SUM(agency_commission_aed), 0)::float AS comm,
            COUNT(*)::int AS c
     FROM freehold_site_deals
     WHERE status IN ('approved','closed') AND created_at >= now() - INTERVAL '6 months'
     GROUP BY date_trunc('month', created_at) ORDER BY date_trunc('month', created_at) ASC`), [])

  // Monthly lead volume (last 6 months).
  const monthlyLeads = await safe(() => query<{ m: string; c: number }>(
    `SELECT to_char(date_trunc('month', created_at), 'Mon YYYY') AS m, COUNT(*)::int AS c
     FROM freehold_site_leads WHERE created_at >= now() - INTERVAL '6 months'
     GROUP BY date_trunc('month', created_at) ORDER BY date_trunc('month', created_at) ASC`), [])

  // Leads by source.
  const leadsBySource = await safe(() => query<{ source: string; c: number; closed: number }>(
    `SELECT COALESCE(NULLIF(source,''),'direct') AS source,
            COUNT(*)::int AS c,
            COUNT(*) FILTER (WHERE status = 'closed')::int AS closed
     FROM freehold_site_leads GROUP BY 1 ORDER BY c DESC LIMIT 8`), [])

  // Totals for conversion math.
  const leadCount = await safe(() => query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM freehold_site_leads`), [{ c: 0 }])
  const totalLeads = n(leadCount[0]?.c)
  const closedDeals = totals.approvedDeals

  // YTD figures.
  const ytd = await safe(() => query<{ sales: number; comm: number; deals: number }>(
    `SELECT COALESCE(SUM(property_value_aed),0)::float AS sales,
            COALESCE(SUM(agency_commission_aed),0)::float AS comm,
            COUNT(*)::int AS deals
     FROM freehold_site_deals
     WHERE status IN ('approved','closed') AND date_part('year', created_at) = date_part('year', CURRENT_DATE)`), [{ sales: 0, comm: 0, deals: 0 }])
  const ytdLeads = await safe(() => query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM freehold_site_leads WHERE date_part('year', created_at) = date_part('year', CURRENT_DATE)`), [{ c: 0 }])

  return NextResponse.json({
    totals,
    finance,
    monthlyDeals: monthlyDeals.map((r) => ({ month: r.m, sales: n(r.sales), commission: n(r.comm), deals: n(r.c) })),
    monthlyLeads: monthlyLeads.map((r) => ({ month: r.m, leads: n(r.c) })),
    leadsBySource: leadsBySource.map((r) => ({ source: r.source, leads: n(r.c), closed: n(r.closed), conversionPct: n(r.c) > 0 ? Math.round((n(r.closed) / n(r.c)) * 100) : 0 })),
    conversion: {
      totalLeads,
      closedDeals,
      conversionPct: totalLeads > 0 ? Math.round((closedDeals / totalLeads) * 100) : 0,
    },
    ytd: {
      salesAed: n(ytd[0]?.sales),
      commissionAed: n(ytd[0]?.comm),
      deals: n(ytd[0]?.deals),
      leads: n(ytdLeads[0]?.c),
      costPerLeadAed: finance && n(ytdLeads[0]?.c) > 0 ? Math.round(finance.byCategory.ad_spend / n(ytdLeads[0]?.c)) : 0,
    },
    expensesByCategory: finance ? finance.byCategory : {},
  })
}
