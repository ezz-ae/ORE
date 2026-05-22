import { NextResponse } from "next/server"
import { crmLeads } from "@/src/features/freehold-intelligence/server-session"

export async function GET() {
  return NextResponse.json({ leads: crmLeads })
}
