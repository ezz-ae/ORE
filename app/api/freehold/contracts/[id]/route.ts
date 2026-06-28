import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifySession, SESSION_COOKIE } from "@/lib/freehold/auth-edge"
import { isManagementRole } from "@/lib/deals"
import { renewContract } from "@/lib/contracts"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isManagementRole(user.role)) return NextResponse.json({ error: "Management only" }, { status: 403 })
  const { id } = await params
  let body: Record<string, unknown>
  try { body = await req.json() } catch { body = {} }
  if (body.action === "renew") {
    const contract = await renewContract(id)
    if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 })
    return NextResponse.json({ contract })
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
