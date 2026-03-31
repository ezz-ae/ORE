import { NextResponse } from "next/server"
import { getIntelligenceBlockData } from "@/lib/intelligence-block"

export const dynamic = "force-dynamic"

export async function GET() {
  const data = await getIntelligenceBlockData()
  return NextResponse.json({
    summary: data?.pulse || {},
    freshness: new Date().toISOString()
  })
}
