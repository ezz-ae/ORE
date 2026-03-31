import { NextResponse } from "next/server"
import { getProjectBySlug } from "@/lib/entrestate"
import { generateProjectPdf } from "@/lib/pdf"
import { query } from "@/lib/db"
import { randomUUID } from "node:crypto"

async function ensureLeadsTable() {
  await query(
    `CREATE TABLE IF NOT EXISTS gc_leads (
      id text PRIMARY KEY,
      name text NOT NULL,
      phone text NOT NULL,
      email text,
      source text,
      project_slug text,
      assigned_broker_id text,
      created_at timestamptz DEFAULT now()
    )`,
  )
  await query(`ALTER TABLE gc_leads ADD COLUMN IF NOT EXISTS assigned_broker_id text`)
}

export async function POST(req: Request) {
  try {
    const { slug, name, phone, email, source } = await req.json()

    if (!slug) {
      return NextResponse.json({ error: "Project slug is required" }, { status: 400 })
    }

    const project = await getProjectBySlug(slug)
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    if (name && phone) {
      await ensureLeadsTable()
      await query(
        `INSERT INTO gc_leads (id, name, phone, email, source, project_slug)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [randomUUID(), name, phone, email || null, source || "project-download", slug],
      )
    }

    const pdfBuffer = await generateProjectPdf(project)

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=\"${project.slug}-project.pdf\"`,
      },
    })
  } catch (error) {
    console.error("[v0] Project PDF error:", error)
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 })
  }
}
