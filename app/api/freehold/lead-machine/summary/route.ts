import { NextResponse } from "next/server"
import { getLeadMachineSummary } from "@/src/features/freehold-intelligence/lead-machine"

export async function GET() {
  return NextResponse.json({ summary: getLeadMachineSummary() })
}
