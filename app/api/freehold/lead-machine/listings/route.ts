import { NextResponse } from "next/server"
import { getLeadMachineMatrix, leadMachineListings } from "@/src/features/freehold-intelligence/lead-machine"

export async function GET() {
  return NextResponse.json({ listings: leadMachineListings, matrix: getLeadMachineMatrix() })
}
