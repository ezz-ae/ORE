import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifySession, SESSION_COOKIE } from "@/lib/freehold/auth-edge"
import { isManagementRole, listDeals } from "@/lib/deals"
import {
  listFinanceEntries,
  createFinanceEntry,
  getCompanyFinanceSummary,
  FINANCE_CATEGORIES,
  type FinanceCategory,
} from "@/lib/finance"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function requireManager() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  const user = await verifySession(token)
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  if (!isManagementRole(user.role)) return { error: NextResponse.json({ error: "Management only" }, { status: 403 }) }
  return { user }
}

export async function GET() {
  const auth = await requireManager()
  if (auth.error) return auth.error

  const [entries, summary, deals] = await Promise.all([
    listFinanceEntries(),
    getCompanyFinanceSummary(),
    listDeals({ status: "approved" }),
  ])
  // Commission payouts: approved deals with outstanding commission
  const payouts = deals
    .filter((d) => d.commissionOutstandingAed > 0)
    .map((d) => ({
      id: d.id,
      agentName: d.agentName,
      coAgentName: d.coAgentName,
      projectName: d.projectName,
      leadName: d.leadName,
      commissionAed: d.agencyCommissionAed,
      receivedAed: d.commissionReceivedAed,
      outstandingAed: d.commissionOutstandingAed,
    }))

  return NextResponse.json({ entries, summary, payouts })
}

export async function POST(req: NextRequest) {
  const auth = await requireManager()
  if (auth.error) return auth.error

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const category = String(body.category || "")
  if (!FINANCE_CATEGORIES.some((c) => c.key === category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 })
  }
  const amount = Number(body.amountAed)
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Amount must be greater than zero" }, { status: 400 })
  }

  try {
    const entry = await createFinanceEntry(
      {
        category: category as FinanceCategory,
        amountAed: amount,
        description: typeof body.description === "string" ? body.description : "",
        payee: typeof body.payee === "string" ? body.payee : "",
        status: body.status === "paid" ? "paid" : "pending",
        entryDate: typeof body.entryDate === "string" ? body.entryDate : undefined,
      },
      { id: auth.user.brokerId || auth.user.email },
    )
    return NextResponse.json({ entry }, { status: 201 })
  } catch (error) {
    console.error("[finance] create entry failed", error)
    return NextResponse.json({ error: "Failed to create entry" }, { status: 500 })
  }
}
