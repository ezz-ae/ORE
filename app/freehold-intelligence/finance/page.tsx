// Server component wrapper — fetches real credit data from DB, falls back gracefully
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { query } from '@/lib/db'
import FinanceClient from './finance-client'
import { financeSummary } from '@/src/features/freehold-intelligence/finance'
import { getFinanceTotals, isManagementRole } from '@/lib/deals'

export const dynamic = 'force-dynamic'

export default async function FinancePage() {
  // Try to get real spend data from DB
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE)?.value
    const user = await verifySession(token)

    // Brokers see only their own deal totals; management sees everything.
    const agentId = user && !isManagementRole(user.role) ? user.brokerId || user.email : undefined

    const [creditRows, ledgerRows, dealTotals] = await Promise.all([
      query(`SELECT broker_id, tier, allocated, balance, total_spent FROM broker_credit_balances ORDER BY total_spent DESC LIMIT 20`),
      query(`SELECT type, SUM(amount) as total FROM credit_ledger GROUP BY type`),
      getFinanceTotals({ agentId }),
    ])

    return <FinanceClient initialSummary={financeSummary} creditBalances={creditRows} ledgerSummary={ledgerRows} dealTotals={dealTotals} />
  } catch {
    const dealTotals = await getFinanceTotals().catch(() => undefined)
    return <FinanceClient initialSummary={financeSummary} creditBalances={[]} ledgerSummary={[]} dealTotals={dealTotals} />
  }
}
