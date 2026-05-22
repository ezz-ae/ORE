import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { getReviewItems } from "@/src/features/freehold-intelligence/data-access"

export async function GET() {
  const comments = await getReviewItems("comment")
  return NextResponse.json({ comments })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { page_ref?: string; body?: string; author?: string }
  if (!body.body?.trim()) return NextResponse.json({ error: "body is required" }, { status: 400 })

  const rows = await query(
    `INSERT INTO freehold_comments_tasks (kind, page_ref, body, author, status)
     VALUES ('comment', $1, $2, $3, 'open')
     RETURNING *`,
    [body.page_ref || "freehold-intelligence", body.body.trim(), body.author || "Freehold stakeholder"]
  )
  return NextResponse.json({ comment: rows[0] }, { status: 201 })
}
