import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifySession, SESSION_COOKIE } from "@/lib/freehold/auth-edge"
import { getBuyerMatchProfile } from "@/lib/freehold/buyer-match"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Buyer Match — thin HTTP wrapper over lib/freehold/buyer-match.ts (the logic
// was extracted so the Ads Machine planner can call it directly). Response
// shape is unchanged.

export async function POST(req: NextRequest) {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const profile = await getBuyerMatchProfile({
    listingSlug: typeof body.listingSlug === "string" ? body.listingSlug : undefined,
    price: typeof body.price === "number" ? body.price : undefined,
    countries: Array.isArray(body.countries) && body.countries.length ? (body.countries as string[]) : undefined,
  })

  return NextResponse.json(profile)
}
