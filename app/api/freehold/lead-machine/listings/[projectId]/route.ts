import { NextResponse } from "next/server"
import {
  getLeadMachineAdRequest,
  getLeadMachineComments,
  getLeadMachineLanding,
  getLeadMachineListing,
  getLeadMachineRequirements,
} from "@/src/features/freehold-intelligence/lead-machine"

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const listing = getLeadMachineListing(projectId)
  if (!listing) return NextResponse.json({ error: "listing not found" }, { status: 404 })
  return NextResponse.json({
    listing,
    landing: getLeadMachineLanding(listing.projectId),
    adRequest: getLeadMachineAdRequest(listing.projectId),
    requirements: getLeadMachineRequirements(listing.projectId),
    comments: getLeadMachineComments(listing.projectId),
  })
}
