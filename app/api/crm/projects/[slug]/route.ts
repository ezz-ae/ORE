import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDashboardProjectBySlug } from "@/lib/ore"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const { slug } = await params
  const project = await getDashboardProjectBySlug(slug)
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 })
  }

  return NextResponse.json({ project })
}
