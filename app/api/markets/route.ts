import { NextResponse } from "next/server"
import { getIntelligenceBlockData } from "@/lib/intelligence-block"
import { randomUUID } from "node:crypto"

export const dynamic = "force-dynamic"

export async function GET() {
  const data = await getIntelligenceBlockData()
  return NextResponse.json({
    markets: data?.best_areas || [],
    projects: data?.trending || [],
    data: data,
    provenance: {
      run_id: `run_${randomUUID().slice(0, 8)}`,
      snapshot_ts: new Date().toISOString()
    }
  })
}
