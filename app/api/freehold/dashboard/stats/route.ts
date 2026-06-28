import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifySession, SESSION_COOKIE } from "@/lib/freehold/auth-edge"
import { query } from "@/lib/db"
import { getFinanceTotals, isManagementRole } from "@/lib/deals"
import { listTasks } from "@/lib/tasks"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const n = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0)

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn() } catch { return fallback }
}

export async function GET() {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const agentId = isManagementRole(user.role) ? undefined : (user.brokerId || user.email)

  const totals = await safe(() => getFinanceTotals({ agentId }), {
    totalDeals: 0, approvedDeals: 0, pendingDeals: 0, totalSalesAed: 0,
    totalCommissionAed: 0, netCommissionAed: 0, totalPaidAed: 0, totalOutstandingAed: 0,
  })

  const leadsToday = await safe(() => query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM freehold_site_leads WHERE created_at::date = CURRENT_DATE`), [{ c: 0 }])
  const leadsYesterday = await safe(() => query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM freehold_site_leads WHERE created_at::date = CURRENT_DATE - INTERVAL '1 day'`), [{ c: 0 }])
  const dealsWeek = await safe(() => query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM freehold_site_deals WHERE status IN ('approved','closed') AND created_at >= now() - INTERVAL '7 days'`), [{ c: 0 }])
  const revenueMtd = await safe(() => query<{ s: number }>(
    `SELECT COALESCE(SUM(commission_received_aed),0)::float AS s FROM freehold_site_deals
     WHERE status IN ('approved','closed') AND date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)`), [{ s: 0 }])
  const team = await safe(() => query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM freehold_site_users WHERE COALESCE(suspended, false) = false`), [{ c: 0 }])
  const openLeads = await safe(() => query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM freehold_site_leads WHERE COALESCE(status,'new') NOT IN ('closed','lost')`), [{ c: 0 }])

  const today = n(leadsToday[0]?.c)
  const yesterday = n(leadsYesterday[0]?.c)
  const leadDelta = today - yesterday

  const tasks = await safe(() => listTasks(), [])

  // Real activity feed from recent leads + recent deals.
  const recentLeads = await safe(() => query<{ name: string; created_at: string; status: string | null }>(
    `SELECT name, created_at::text, status FROM freehold_site_leads ORDER BY created_at DESC NULLS LAST LIMIT 5`), [])
  const recentDeals = await safe(() => query<{ lead_name: string; agent_name: string; status: string; created_at: string; property_value_aed: number }>(
    `SELECT lead_name, agent_name, status, created_at::text, property_value_aed FROM freehold_site_deals ORDER BY created_at DESC NULLS LAST LIMIT 5`), [])

  const fmtTime = (iso: string) => {
    try { return new Date(iso).toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai" }) } catch { return "" }
  }
  type Ev = { time: string; iso: string; user: string; action: string; tag: string }
  const events: Ev[] = [
    ...recentDeals.map((d) => ({
      time: fmtTime(d.created_at), iso: d.created_at, user: d.agent_name || "Agent",
      action: `Deal ${d.status === "closed" ? "closed" : d.status === "approved" ? "approved" : "created"} — ${d.lead_name}`,
      tag: "deal",
    })),
    ...recentLeads.map((l) => ({
      time: fmtTime(l.created_at), iso: l.created_at, user: l.name || "Lead",
      action: `New lead captured`, tag: "lead",
    })),
  ].sort((a, b) => (b.iso || "").localeCompare(a.iso || "")).slice(0, 6)

  return NextResponse.json({
    stats: {
      newLeadsToday: today,
      newLeadsDelta: leadDelta,
      pipelineValueAed: totals.totalSalesAed,
      dealsClosingWeek: n(dealsWeek[0]?.c),
      revenueMtdAed: n(revenueMtd[0]?.s),
      teamCount: n(team[0]?.c),
      openLeads: n(openLeads[0]?.c),
      commissionOutstandingAed: totals.totalOutstandingAed,
    },
    tasks: tasks.map((t) => ({ id: t.id, priority: t.priority, text: t.title, done: t.status === "done" })),
    events,
    recentLeads: recentLeads.map((l) => ({ name: l.name, status: l.status || "new" })),
  })
}
