import { NextResponse } from "next/server"
import { createMockAiAnswer } from "@/src/features/freehold-intelligence/server-session"

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { message?: string; conversationId?: string }
  const message = body.message?.trim()
  if (!message) return NextResponse.json({ error: "message is required" }, { status: 400 })
  return NextResponse.json({ conversationId: body.conversationId ?? "conv_owner_24h", ...createMockAiAnswer(message, "owner") })
}
