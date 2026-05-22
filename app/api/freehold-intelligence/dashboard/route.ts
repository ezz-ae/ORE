import { NextResponse } from "next/server"
import { getDashboardSnapshot, getMilestones, getSystems } from "@/src/features/freehold-intelligence/data-access"

export async function GET() {
  const [snapshot, systems, milestones] = await Promise.all([getDashboardSnapshot(), getSystems(), getMilestones()])
  return NextResponse.json({ snapshot, systems, milestones })
}
