import { NextResponse } from "next/server"
import { getProjectsBySlugs } from "@/lib/entrestate"
import { generateComparisonPdf } from "@/lib/pdf"

export async function POST(req: Request) {
  try {
    const { slugs } = await req.json()
    if (!Array.isArray(slugs) || slugs.length === 0) {
      return NextResponse.json({ error: "Project slugs are required" }, { status: 400 })
    }

    const selected = await getProjectsBySlugs(slugs.slice(0, 2))

    if (selected.length === 0) {
      return NextResponse.json({ error: "Projects not found" }, { status: 404 })
    }

    const pdfBuffer = await generateComparisonPdf(selected)

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=\"project-comparison.pdf\"",
      },
    })
  } catch (error) {
    console.error("[v0] Comparison PDF error:", error)
    return NextResponse.json({ error: "Failed to generate comparison PDF" }, { status: 500 })
  }
}
