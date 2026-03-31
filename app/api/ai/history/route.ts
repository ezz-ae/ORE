import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { listConversations } from "@/lib/ai-conversations"

export const runtime = "nodejs"

export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    }

    const conversations = await listConversations(user.id, 5)
    const latest = conversations[0] || null

    return NextResponse.json({
      latest,
      conversations: conversations.map((conversation) => ({
        id: conversation.id,
        title: conversation.title,
        pinned: conversation.pinned,
        updated_at: conversation.updated_at,
      })),
    })
  } catch (error) {
    console.error("[v0] AI history error:", error)
    return NextResponse.json({ error: "Failed to load history." }, { status: 500 })
  }
}
