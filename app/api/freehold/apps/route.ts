import { NextResponse } from "next/server"
import { currentServerUser, getVisibleServerApps } from "@/src/features/freehold-intelligence/server-session"

export async function GET() {
  return NextResponse.json({ apps: getVisibleServerApps(currentServerUser.role) })
}
