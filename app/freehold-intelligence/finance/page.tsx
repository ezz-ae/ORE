// Server component wrapper — fetches real credit data from DB, falls back gracefully
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { query } from '@/lib/db'
import FinanceClient from './finance-client'
import { financeSummary } from '@/src/features/freehold-intelligence/finance'

export default async function FinancePage() {
  // Try to get real spend data from DB
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE)?.value
    // Session available for future per-user scoping; not required for aggregate finance summary
    await verifySession(token)

    const [creditRows, ledgerRows] = await Promise.all([
      query(`SELECT broker_id, tier, allocated, balance, total_spent FROM broker_credit_balances ORDER BY total_spent DESC LIMIT 20`),
      query(`SELECT type, SUM(amount) as total FROM credit_ledger GROUP BY type`),
    ])

    return <FinanceClient initialSummary={financeSummary} creditBalances={creditRows} ledgerSummary={ledgerRows} />
  } catch {
    return <FinanceClient initialSummary={financeSummary} creditBalances={[]} ledgerSummary={[]} />
  }
}
