/**
 * Client-safe finance types and constants — no server-only imports (no pg/db),
 * so this can be imported from client components.
 */

export type FinanceCategory =
  | "ad_spend"
  | "commission"
  | "salary"
  | "expense"
  | "transportation"
  | "referral"
  | "other"

export const FINANCE_CATEGORIES: { key: FinanceCategory; label: string }[] = [
  { key: "ad_spend", label: "Ads" },
  { key: "commission", label: "Commission" },
  { key: "salary", label: "Salaries" },
  { key: "expense", label: "Expenses" },
  { key: "transportation", label: "Transportation" },
  { key: "referral", label: "Referrals" },
  { key: "other", label: "Other" },
]

export type FinanceEntryStatus = "pending" | "paid"

export interface FinanceEntry {
  id: string
  category: FinanceCategory
  description: string
  amountAed: number
  payee: string
  status: FinanceEntryStatus
  entryDate: string | null
  relatedDealId: string | null
  createdBy: string
  createdAt: string | null
}

export interface FinanceEntryInput {
  category: FinanceCategory
  description?: string
  amountAed: number
  payee?: string
  status?: FinanceEntryStatus
  entryDate?: string
  relatedDealId?: string
}

export interface CompanyFinanceSummary {
  commissionEarnedAed: number
  commissionNetAed: number
  commissionPaidAed: number
  commissionOutstandingAed: number
  totalSalesAed: number
  totalExpensesAed: number
  expensesPaidAed: number
  expensesPendingAed: number
  byCategory: Record<FinanceCategory, number>
  netPositionAed: number
}
