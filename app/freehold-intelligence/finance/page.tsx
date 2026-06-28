// Server component — computes real finance data (ad spend from the ledger,
// commission from deals) and passes it to the client.
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { query } from '@/lib/db'
import FinanceClient from './finance-client'
import { CompanyFinance } from './_company-finance'
import { getFinanceTotals, isManagementRole } from '@/lib/deals'

export const dynamic = 'force-dynamic'

const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0)
async function safe<T>(fn: () => Promise<T>, fb: T): Promise<T> { try { return await fn() } catch { return fb } }

async function computeRealSpend() {
  const spend30 = await safe(() => query<{ s: number }>(
    `SELECT COALESCE(SUM(amount_aed),0)::float AS s FROM freehold_site_finance_entries
     WHERE category = 'ad_spend' AND COALESCE(entry_date, created_at::date) >= CURRENT_DATE - INTERVAL '30 days'`), [{ s: 0 }])
  const leads30 = await safe(() => query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM freehold_site_leads WHERE created_at >= now() - INTERVAL '30 days'`), [{ c: 0 }])
  const monthlySpend = await safe(() => query<{ m: string; s: number }>(
    `SELECT to_char(date_trunc('month', COALESCE(entry_date, created_at::date)), 'Mon YYYY') AS m,
            COALESCE(SUM(amount_aed),0)::float AS s
     FROM freehold_site_finance_entries
     WHERE category = 'ad_spend' AND COALESCE(entry_date, created_at::date) >= now() - INTERVAL '6 months'
     GROUP BY date_trunc('month', COALESCE(entry_date, created_at::date))
     ORDER BY date_trunc('month', COALESCE(entry_date, created_at::date)) ASC`), [])
  const monthlyLeads = await safe(() => query<{ m: string; c: number }>(
    `SELECT to_char(date_trunc('month', created_at), 'Mon YYYY') AS m, COUNT(*)::int AS c
     FROM freehold_site_leads WHERE created_at >= now() - INTERVAL '6 months'
     GROUP BY date_trunc('month', created_at)`), [])

  const leadByMonth = new Map(monthlyLeads.map((r) => [r.m, num(r.c)]))
  const monthly = monthlySpend.map((r) => {
    const spentAed = num(r.s)
    const leads = leadByMonth.get(r.m) || 0
    return { month: r.m, spentAed, leads, cpl: leads > 0 ? Math.round(spentAed / leads) : 0 }
  })

  const totalSpend30d = num(spend30[0]?.s)
  const totalLeads30d = num(leads30[0]?.c)
  return {
    totalSpend30d,
    totalLeads30d,
    avgCpl30d: totalLeads30d > 0 ? Math.round(totalSpend30d / totalLeads30d) : 0,
    monthly,
  }
}

export default async function FinancePage() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  const user = await verifySession(token)
  const isManager = !!user && isManagementRole(user.role)
  const agentId = user && !isManager ? user.brokerId || user.email : undefined

  const [dealTotals, realSpend] = await Promise.all([
    safe(() => getFinanceTotals({ agentId }), {
      totalDeals: 0, approvedDeals: 0, pendingDeals: 0, totalSalesAed: 0,
      totalCommissionAed: 0, netCommissionAed: 0, totalPaidAed: 0, totalOutstandingAed: 0,
    }),
    safe(() => computeRealSpend(), { totalSpend30d: 0, totalLeads30d: 0, avgCpl30d: 0, monthly: [] }),
  ])

  return (
    <>
      {isManager && <div className="p-6 pb-0 lg:p-8 lg:pb-0"><CompanyFinance /></div>}
      <FinanceClient dealTotals={dealTotals} realSpend={realSpend} />
    </>
  )
}
