import { NextRequest, NextResponse } from "next/server"
import { getSessionUser, logActivity } from "@/lib/auth"
import { getConversationById, setConversationPinned } from "@/lib/ai-conversations"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    }

    const body = await req.json()
    const id = String(body?.id || "").trim()
    const pinned = Boolean(body?.pinned)

    if (!id) {
      return NextResponse.json({ error: "Conversation ID is required." }, { status: 400 })
    }

    const conversation = await getConversationById(id)
    if (!conversation || conversation.user_id !== user.id) {
      return NextResponse.json({ error: "Not found." }, { status: 404 })
    }

    const updated = await setConversationPinned(id, pinned)
    await logActivity("ai_conversation_pinned", user.id, { conversationId: id, pinned })
    return NextResponse.json({ conversation: updated })
  } catch (error) {
    console.error("[v0] Pin conversation error:", error)
    return NextResponse.json({ error: "Failed to update conversation." }, { status: 500 })
  }
}
