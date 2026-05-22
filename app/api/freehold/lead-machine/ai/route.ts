import { NextResponse } from "next/server"
import { createLeadMachineAiResponse } from "@/src/features/freehold-intelligence/lead-machine"

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { message?: string }
  const message = body.message?.trim()
  if (!message) return NextResponse.json({ error: "message is required" }, { status: 400 })
  return NextResponse.json(createLeadMachineAiResponse(message))
}
