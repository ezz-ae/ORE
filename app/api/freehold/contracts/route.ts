import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifySession, SESSION_COOKIE } from "@/lib/freehold/auth-edge"
import { isManagementRole } from "@/lib/deals"
import { listContracts, createContract, type ContractType } from "@/lib/contracts"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function mgr() {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  if (!isManagementRole(user.role)) return { error: NextResponse.json({ error: "Management only" }, { status: 403 }) }
  return { user }
}

export async function GET() {
  const a = await mgr(); if (a.error) return a.error
  return NextResponse.json({ contracts: await listContracts() })
}

export async function POST(req: NextRequest) {
  const a = await mgr(); if (a.error) return a.error
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }
  const name = String(body.name || "").trim()
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 })
  const contract = await createContract({
    name,
    type: body.type as ContractType,
    counterparty: typeof body.counterparty === "string" ? body.counterparty : "",
    value: typeof body.value === "string" ? body.value : "",
    startDate: typeof body.startDate === "string" ? body.startDate : undefined,
    endDate: typeof body.endDate === "string" ? body.endDate : undefined,
    autoRenew: Boolean(body.autoRenew),
    notes: typeof body.notes === "string" ? body.notes : "",
  })
  return NextResponse.json({ contract }, { status: 201 })
}
