import { NextResponse } from "next/server"
import { getLeadMachineRequirements } from "@/src/features/freehold-intelligence/lead-machine"

export async function GET() {
  return NextResponse.json({ requirements: getLeadMachineRequirements() })
}
