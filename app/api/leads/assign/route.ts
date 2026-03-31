import { NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { query } from "@/lib/db"
import { ensureLeadActivityTable, ensureLeadsTable } from "@/lib/entrestate"
import { getSessionUser, isAdminRole, logActivity } from "@/lib/auth"

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    }
    if (!isAdminRole(user.role)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    }

    const { leadId, brokerId } = await req.json()
    if (!leadId || !brokerId) {
      return NextResponse.json({ error: "leadId and brokerId are required" }, { status: 400 })
    }

    await ensureLeadsTable()
    await ensureLeadActivityTable()

    await query(
      `UPDATE gc_leads
       SET assigned_broker_id = $1,
           status = COALESCE(status, 'contacted')
       WHERE id = $2`,
      [brokerId, leadId],
    )

    await query(
      `INSERT INTO gc_lead_activity (id, lead_id, activity_type, description, created_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [randomUUID(), leadId, "assignment", `Assigned to ${brokerId}`, user.id],
    )

    await logActivity("lead_assigned", user.id, { leadId, brokerId })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Lead assignment error:", error)
    return NextResponse.json({ error: "Failed to assign lead" }, { status: 500 })
  }
}
