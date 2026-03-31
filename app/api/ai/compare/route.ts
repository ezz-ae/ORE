import { NextRequest, NextResponse } from "next/server"
import { getProjectBySlug } from "@/lib/ore"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const { projectSlug1, projectSlug2 } = await req.json()

    if (!projectSlug1 || !projectSlug2) {
      return NextResponse.json({ error: "Two project slugs are required" }, { status: 400 })
    }

    const [project1, project2] = await Promise.all([
      getProjectBySlug(projectSlug1),
      getProjectBySlug(projectSlug2),
    ])

    if (!project1 || !project2) {
      return NextResponse.json({ error: "One or both projects not found" }, { status: 404 })
    }

    return NextResponse.json({ project1, project2 })
  } catch (error) {
    console.error("[v0] AI Compare API Error:", error)
    return NextResponse.json(
      { error: "Failed to process comparison request. Please try again." },
      { status: 500 },
    )
  }
}
