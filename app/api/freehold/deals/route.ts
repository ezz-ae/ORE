import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifySession, SESSION_COOKIE } from "@/lib/freehold/auth-edge"
import {
  listDeals,
  createDeal,
  getFinanceTotals,
  isManagementRole,
  type DealInput,
  type DealStatus,
} from "@/lib/deals"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const sessionId = (user: { brokerId?: string; email: string }) => user.brokerId || user.email

export async function GET(req: NextRequest) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  const user = await verifySession(token)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const statusParam = url.searchParams.get("status") as DealStatus | null
  const withTotals = url.searchParams.get("totals") === "1"

  // Brokers only see their own deals; management sees everything.
  const agentId = isManagementRole(user.role) ? undefined : sessionId(user)

  const deals = await listDeals({
    agentId,
    status: statusParam || undefined,
  })

  const totals = withTotals ? await getFinanceTotals({ agentId }) : undefined
  return NextResponse.json({ deals, totals })
}

export async function POST(req: NextRequest) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  const user = await verifySession(token)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: DealInput
  try {
    body = (await req.json()) as DealInput
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (!body.leadName || !String(body.leadName).trim()) {
    return NextResponse.json({ error: "Client / lead name is required" }, { status: 400 })
  }

  try {
    const deal = await createDeal(body, {
      id: sessionId(user),
      name: user.name,
      role: user.role,
    })
    return NextResponse.json({ deal }, { status: 201 })
  } catch (error) {
    console.error("[deals] create failed", error)
    return NextResponse.json({ error: "Failed to create deal" }, { status: 500 })
  }
}
