import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifySession, SESSION_COOKIE } from "@/lib/freehold/auth-edge"
import { isManagementRole } from "@/lib/deals"
import { setFinanceEntryStatus, deleteFinanceEntry } from "@/lib/finance"

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

  const status = body.status === "paid" ? "paid" : body.status === "pending" ? "pending" : null
  if (!status) return NextResponse.json({ error: "status must be paid or pending" }, { status: 400 })

  const entry = await setFinanceEntryStatus(id, status)
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
