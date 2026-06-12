import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifySession, SESSION_COOKIE } from "@/lib/freehold/auth-edge"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const user = await verifySession(token)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { outputId?: string; exportType?: string }
  if (!body.outputId) return NextResponse.json({ error: "outputId is required" }, { status: 400 })

  return NextResponse.json({
    export: {
      outputId: body.outputId,
      exportType: body.exportType ?? "pdf",
      status: "queued",
      message: "Export queued. External delivery requires owner approval.",
      requestedBy: user.email,
      requestedAt: new Date().toISOString(),
    },
  })
}
