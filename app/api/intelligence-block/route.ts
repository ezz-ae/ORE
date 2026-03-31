// ─────────────────────────────────────────────────────────────────
// app/api/intelligence-block/route.ts
// Powers the homepage Intelligence Block
// Cache: 10 min (revalidate=600). No auth required.
// ─────────────────────────────────────────────────────────────────
import { NextResponse } from "next/server"
import { getIntelligenceBlockData } from "@/lib/intelligence-block"

export const revalidate = 600

export async function GET() {
  return NextResponse.json(await getIntelligenceBlockData())
}
