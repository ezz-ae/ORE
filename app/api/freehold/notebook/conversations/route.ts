import { NextResponse } from "next/server"
import { notebookConversations } from "@/src/features/freehold-intelligence/server-session"

export async function GET() {
  return NextResponse.json({ conversations: notebookConversations })
}
