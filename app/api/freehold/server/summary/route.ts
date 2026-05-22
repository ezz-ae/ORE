import { NextResponse } from "next/server"
import { currentServerUser, serverSummary } from "@/src/features/freehold-intelligence/server-session"

export async function GET() {
  return NextResponse.json({ user: currentServerUser, summary: serverSummary })
}
