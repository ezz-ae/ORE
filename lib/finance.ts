import { randomUUID } from "node:crypto"
import { query } from "@/lib/db"
import { getFinanceTotals } from "@/lib/deals"
import {
  FINANCE_CATEGORIES,
  type FinanceCategory,
  type FinanceEntry,
  type FinanceEntryInput,
  type FinanceEntryStatus,
  type CompanyFinanceSummary,
} from "@/lib/finance-shared"

// Re-export the client-safe types/constants so existing server imports of
// "@/lib/finance" keep working unchanged.
export {
  FINANCE_CATEGORIES,
  type FinanceCategory,
  type FinanceEntry,
  type FinanceEntryInput,
  type FinanceEntryStatus,
  type CompanyFinanceSummary,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const num = (v: unknown): number => {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string") {
    const n = Number(v.replace(/,/g, "").trim())
    if (Number.isFinite(n)) return n
  }
  return 0
}

const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v))

const normCategory = (v: unknown): FinanceCategory => {
  const c = str(v).toLowerCase()
  return (FINANCE_CATEGORIES.find((x) => x.key === c)?.key ?? "other") as FinanceCategory
}

// ─── Schema ───────────────────────────────────────────────────────────────────

let ensurePromise: Promise<void> | null = null

const ensureSchema = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_site_finance_entries (
      id text PRIMARY KEY,
      category text NOT NULL DEFAULT 'other',
      description text,
      amount_aed numeric DEFAULT 0,
      payee text,
      status text DEFAULT 'pending',
      entry_date date DEFAULT now(),
      related_deal_id text,
      created_by text,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )
  `)
  for (const [name, type] of [
    ["category", "text"], ["description", "text"], ["amount_aed", "numeric DEFAULT 0"],
    ["payee", "text"], ["status", "text DEFAULT 'pending'"], ["entry_date", "date"],
    ["related_deal_id", "text"], ["created_by", "text"],
    ["created_at", "timestamptz DEFAULT now()"], ["updated_at", "timestamptz DEFAULT now()"],
  ] as Array<[string, string]>) {
    await query(`ALTER TABLE freehold_site_finance_entries ADD COLUMN IF NOT EXISTS ${name} ${type}`)
  }
}

const ensureSchemaOnce = async () => {
  if (!ensurePromise) {
    ensurePromise = ensureSchema().catch((e) => { ensurePromise = null; throw e })
  }
  await ensurePromise
}

// ─── Mapping ────────────────────────────────────────────────────────────────────

const mapRow = (r: Record<string, unknown>): FinanceEntry => ({
  id: str(r.id),
  category: normCategory(r.category),
  description: str(r.description),
  amountAed: num(r.amount_aed),
  payee: str(r.payee),
  status: (str(r.status) || "pending") as FinanceEntryStatus,
  entryDate: r.entry_date ? String(r.entry_date) : null,
  relatedDealId: r.related_deal_id ? String(r.related_deal_id) : null,
  createdBy: str(r.created_by),
  createdAt: r.created_at ? String(r.created_at) : null,
})

const SELECT = `id, category, description, amount_aed, payee, status, entry_date::text, related_deal_id, created_by, created_at::text`

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listFinanceEntries(filters: { category?: FinanceCategory; limit?: number } = {}): Promise<FinanceEntry[]> {
  try {
    await ensureSchemaOnce()
    const params: unknown[] = []
    let where = ""
    if (filters.category) {
      params.push(filters.category)
      where = `WHERE category = $${params.length}`
    }
    params.push(Math.max(1, Math.min(filters.limit ?? 500, 1000)))
    const rows = await query<Record<string, unknown>>(
      `SELECT ${SELECT} FROM freehold_site_finance_entries ${where}
       ORDER BY entry_date DESC NULLS LAST, created_at DESC NULLS LAST LIMIT $${params.length}`,
      params,
    )
    return rows.map(mapRow)
  } catch (error) {
    console.error("[finance] listFinanceEntries failed", error)
    return []
  }
}

export async function createFinanceEntry(
  input: FinanceEntryInput,
  creator: { id: string },
): Promise<FinanceEntry> {
  await ensureSchemaOnce()
  const id = `fin_${randomUUID()}`
  const rows = await query<Record<string, unknown>>(
    `INSERT INTO freehold_site_finance_entries
       (id, category, description, amount_aed, payee, status, entry_date, related_deal_id, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::date, now()::date), $8, $9, now(), now())
     RETURNING ${SELECT}`,
    [
      id,
      normCategory(input.category),
      input.description || "",
      num(input.amountAed),
      input.payee || "",
      input.status === "paid" ? "paid" : "pending",
      input.entryDate || null,
      input.relatedDealId || null,
      creator.id,
    ],
  )
  return mapRow(rows[0])
}

export async function setFinanceEntryStatus(id: string, status: FinanceEntryStatus): Promise<FinanceEntry | null> {
  await ensureSchemaOnce()
  const rows = await query<Record<string, unknown>>(
    `UPDATE freehold_site_finance_entries SET status = $2, updated_at = now() WHERE id = $1 RETURNING ${SELECT}`,
    [id, status === "paid" ? "paid" : "pending"],
  )
  return rows[0] ? mapRow(rows[0]) : null
}

export async function deleteFinanceEntry(id: string): Promise<boolean> {
  await ensureSchemaOnce()
  await query(`DELETE FROM freehold_site_finance_entries WHERE id = $1`, [id])
  return true
}

/** Unified company finance: commission income (deals) + operating expenses (ledger). */
export async function getCompanyFinanceSummary(): Promise<CompanyFinanceSummary> {
  const emptyByCategory = Object.fromEntries(FINANCE_CATEGORIES.map((c) => [c.key, 0])) as Record<FinanceCategory, number>
  try {
    await ensureSchemaOnce()
    const [dealTotals, rows] = await Promise.all([
      getFinanceTotals(),
      query<{ category: string; total: number; paid: number; pending: number }>(
        `SELECT category,
                COALESCE(SUM(amount_aed), 0) AS total,
                COALESCE(SUM(amount_aed) FILTER (WHERE status = 'paid'), 0) AS paid,
                COALESCE(SUM(amount_aed) FILTER (WHERE status = 'pending'), 0) AS pending
         FROM freehold_site_finance_entries GROUP BY category`,
      ),
    ])

    const byCategory = { ...emptyByCategory }
    let totalExpenses = 0
    let expensesPaid = 0
    let expensesPending = 0
    for (const r of rows) {
      const cat = normCategory(r.category)
      byCategory[cat] = (byCategory[cat] || 0) + num(r.total)
      totalExpenses += num(r.total)
      expensesPaid += num(r.paid)
      expensesPending += num(r.pending)
    }

    const commissionNet = dealTotals.netCommissionAed
    return {
      commissionEarnedAed: dealTotals.totalCommissionAed,
      commissionNetAed: commissionNet,
      commissionPaidAed: dealTotals.totalPaidAed,
      commissionOutstandingAed: dealTotals.totalOutstandingAed,
      totalSalesAed: dealTotals.totalSalesAed,
      totalExpensesAed: totalExpenses,
      expensesPaidAed: expensesPaid,
      expensesPendingAed: expensesPending,
      byCategory,
      netPositionAed: commissionNet - totalExpenses,
    }
  } catch (error) {
    console.error("[finance] getCompanyFinanceSummary failed", error)
    return {
      commissionEarnedAed: 0, commissionNetAed: 0, commissionPaidAed: 0, commissionOutstandingAed: 0,
      totalSalesAed: 0, totalExpensesAed: 0, expensesPaidAed: 0, expensesPendingAed: 0,
      byCategory: emptyByCategory, netPositionAed: 0,
    }
  }
}
