import { NextRequest, NextResponse } from "next/server"
import { processAiChatMessage } from "@/lib/ai-chat-logic"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const { message, conversationHistory, isMobile } = await req.json()
    if (!message) return NextResponse.json({ error: "Missing message" }, { status: 400 })
    
    const result = await processAiChatMessage({ message, conversationHistory, isMobile })
    return NextResponse.json(result)
  } catch (error) {
    console.error("Chat API Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function GET() {
  return new Response("Method Not Allowed", { status: 405 })
}
