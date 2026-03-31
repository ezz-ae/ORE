import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") || "score_badge"
  const id = req.nextUrl.searchParams.get("id") || "unknown"

  return NextResponse.json({
    widget_type: type,
    widget_id: id,
    freshness: new Date().toISOString(),
    interaction_mode: "overlay",
    data: {
      score: 85,
      label: "Excellent Investment Climate"
    }
  })
}
