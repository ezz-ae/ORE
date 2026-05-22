import { NextResponse } from "next/server"
import { createMockAiAnswer } from "@/src/features/freehold-intelligence/server-session"

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { question?: string }
  const question = body.question?.trim()
  if (!question) return NextResponse.json({ error: "question is required" }, { status: 400 })
  return NextResponse.json({ scope: "crm", ...createMockAiAnswer(question, "sales_manager") })
}
