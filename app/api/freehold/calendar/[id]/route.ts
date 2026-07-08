import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifySession, SESSION_COOKIE } from "@/lib/freehold/auth-edge"
import {
  getEvent,
  editEvent,
  decideEvent,
  cancelEvent,
  rsvpEvent,
  deleteEvent,
  ConflictError,
  type EventPatch,
  type RSVP,
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

function fail(error: unknown): NextResponse {
  if (error instanceof ConflictError) {
    return NextResponse.json({ error: "conflict", conflict: error.conflict }, { status: 409 })
  }
  if (error instanceof Error && error.message === "forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  console.error("[calendar] mutation failed", error)
  return NextResponse.json({ error: "Failed" }, { status: 400 })
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const event = await getEvent(id, viewerOf(user))
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ event })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const viewer = viewerOf(user)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const action = String(body.action || "edit")

  try {
    let event = null
    if (action === "approve" || action === "decline") {
      event = await decideEvent(
        id,
        action === "approve" ? "approved" : "declined",
        viewer,
        typeof body.note === "string" ? body.note : "",
      )
    } else if (action === "cancel") {
      event = await cancelEvent(id, viewer)
    } else if (action === "rsvp") {
      const rsvp = String(body.rsvp || "")
      if (!["invited", "accepted", "declined"].includes(rsvp)) {
        return NextResponse.json({ error: "Invalid rsvp" }, { status: 400 })
      }
      event = await rsvpEvent(id, viewer, rsvp as RSVP)
    } else {
      const patch: EventPatch = {}
      if (typeof body.title === "string") patch.title = body.title
      if (typeof body.description === "string") patch.description = body.description
      if (typeof body.startsAt === "string") patch.startsAt = body.startsAt
      if (typeof body.endsAt === "string") patch.endsAt = body.endsAt
      if (typeof body.location === "string") patch.location = body.location
      if (typeof body.externalParty === "string") patch.externalParty = body.externalParty
      if (Array.isArray(body.attendees)) {
        patch.attendees = (body.attendees as unknown[])
          .map((a) => (a && typeof a === "object" ? (a as Record<string, unknown>) : {}))
          .map((a) => ({ userKey: String(a.userKey || ""), userName: String(a.userName || "") }))
          .filter((a) => a.userKey)
      }
      event = await editEvent(id, patch, viewer)
    }
    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ event })
  } catch (error) {
    return fail(error)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  try {
    const ok = await deleteEvent(id, viewerOf(user))
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return fail(error)
  }
}
