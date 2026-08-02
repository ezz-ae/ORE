import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifySession, SESSION_COOKIE } from "@/lib/freehold/auth-edge"
import { isManagementRole } from "@/lib/deals"
import { setFinanceEntryStatus, updateFinanceEntry, deleteFinanceEntry } from "@/lib/finance"
import { FINANCE_CATEGORIES, type FinanceCategory } from "@/lib/finance-shared"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function requireManager() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  const user = await verifySession(token)
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  if (!isManagementRole(user.role)) return { error: NextResponse.json({ error: "Management only" }, { status: 403 }) }
  return { user }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireManager()
  if (auth.error) return auth.error
  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // Two shapes: a bare {status} toggle (unchanged), OR a full field edit so an
  // expense's reason/amount/category/payee can be corrected in place instead of
  // deleted and re-added. Detect "is this an edit?" by any editable field.
  const hasFieldEdit =
    'category' in body || 'amountAed' in body || 'payee' in body || 'description' in body
  const statusVal = body.status === "paid" ? "paid" : body.status === "pending" ? "pending" : undefined

  if (!hasFieldEdit) {
    if (!statusVal) return NextResponse.json({ error: "status must be paid or pending" }, { status: 400 })
    const entry = await setFinanceEntryStatus(id, statusVal)
    if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 })
    return NextResponse.json({ entry })
  }

  const patch: { category?: FinanceCategory; amountAed?: number; payee?: string; description?: string; status?: "paid" | "pending" } = {}
  if ('category' in body) {
    const cat = String(body.category)
    if (!FINANCE_CATEGORIES.some((c) => c.key === cat)) {
      return NextResponse.json({ error: "Unknown category" }, { status: 400 })
    }
    patch.category = cat as FinanceCategory
  }
  if ('amountAed' in body) {
    const amount = Number(body.amountAed)
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "amountAed must be a positive number" }, { status: 400 })
    }
    patch.amountAed = amount
  }
  if ('payee' in body) patch.payee = String(body.payee ?? "").slice(0, 200)
  if ('description' in body) patch.description = String(body.description ?? "").slice(0, 500)
  if (statusVal) patch.status = statusVal

  const entry = await updateFinanceEntry(id, patch)
  if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 })
  return NextResponse.json({ entry })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireManager()
  if (auth.error) return auth.error
  const { id } = await params
  await deleteFinanceEntry(id)
  return NextResponse.json({ ok: true })
}
