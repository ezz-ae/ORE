import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifySession, SESSION_COOKIE } from "@/lib/freehold/auth-edge"
import {
  listCalendar,
  createEvent,
  ConflictError,
  CALENDAR_KINDS,
  type CalendarKind,
  type Viewer,
} from "@/lib/calendar"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const viewerOf = (u: { brokerId?: string; email: string; name: string; role: string }): Viewer => ({
  key: u.email,
  email: u.email,
  name: u.name,
  role: u.role,
  brokerKey: u.brokerId || u.email,
})

// Default to the visible month ±1 week so week/month views always have context.
function defaultRange(): { from: string; to: string } {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  from.setDate(from.getDate() - 7)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  to.setDate(to.getDate() + 7)
  to.setHours(23, 59, 59, 999)
  return { from: from.toISOString(), to: to.toISOString() }
}

export async function GET(req: NextRequest) {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const d = defaultRange()
  const from = url.searchParams.get("from") || d.from
  const to = url.searchParams.get("to") || d.to
  const viewer = viewerOf(user)
  const events = await listCalendar(viewer, from, to)
  const isMgmt = ["admin", "sales_manager", "director", "ceo"].includes(viewer.role)
  return NextResponse.json({
    events,
    from,
    to,
    me: { email: viewer.email, name: viewer.name, role: viewer.role, isMgmt },
  })
}

export async function POST(req: NextRequest) {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const title = String(body.title || "").trim()
  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 })

  const kind = String(body.kind || "")
  if (!CALENDAR_KINDS.includes(kind as CalendarKind)) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 })
  }

  const startsAt = String(body.startsAt || "")
  const endsAt = String(body.endsAt || "")
  if (!startsAt || !endsAt) return NextResponse.json({ error: "Start and end are required" }, { status: 400 })
  if (new Date(endsAt).getTime() < new Date(startsAt).getTime()) {
    return NextResponse.json({ error: "End must be after start" }, { status: 400 })
  }

  const attendees = Array.isArray(body.attendees)
    ? (body.attendees as unknown[])
        .map((a) => (a && typeof a === "object" ? (a as Record<string, unknown>) : {}))
        .map((a) => ({ userKey: String(a.userKey || ""), userName: String(a.userName || "") }))
        .filter((a) => a.userKey)
    : []

  try {
    const event = await createEvent(
      {
        title,
        description: typeof body.description === "string" ? body.description : "",
        kind: kind as CalendarKind,
        startsAt,
        endsAt,
        allDay: Boolean(body.allDay),
        location: typeof body.location === "string" ? body.location : "",
        resource: typeof body.resource === "string" ? body.resource : "",
        externalParty: typeof body.externalParty === "string" ? body.externalParty : "",
        attendees,
      },
      viewerOf(user),
    )
    return NextResponse.json({ event }, { status: 201 })
  } catch (error) {
    if (error instanceof ConflictError) {
      return NextResponse.json({ error: "conflict", conflict: error.conflict }, { status: 409 })
    }
    console.error("[calendar] create failed", error)
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 })
  }
}
