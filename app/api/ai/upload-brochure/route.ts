import { NextRequest, NextResponse } from "next/server"
import { createRequire } from "module"

const require = createRequire(import.meta.url)
const pdf = require("pdf-parse")

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const data = await pdf(fileBuffer)

    return NextResponse.json({ text: data.text })
  } catch (error) {
    console.error("[v0] Brochure Upload API Error:", error)
    return NextResponse.json(
      { error: "Failed to process brochure. Please try again." },
      { status: 500 },
    )
  }
}
