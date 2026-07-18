import { NextResponse } from "next/server"
import { requireSession } from "@/lib/freehold/api-auth"
import { MANAGEMENT_ROLES } from "@/lib/freehold/session-types"
import { getTrainingIntegrityReport } from "@/lib/freehold/training-integrity"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const auth = await requireSession(MANAGEMENT_ROLES)
  if ('res' in auth) return auth.res

  const report = await getTrainingIntegrityReport()
  return NextResponse.json(report)
}
