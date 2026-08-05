// Freehold Intelligence — Company operations calendar.
//
// One shared timeline for everything time-bound the company runs on:
//   - team meetings, external training / developer briefings (DAMAC, Emaar…)
//   - the shared company car (a real resource, approval-gated + conflict-blocked)
//   - reporting deadlines
//   - personal user meetings (shown to others as a private "Busy" block)
//   - daily tasks and CRM follow-ups, pulled in read-only from their own systems
//
// Visibility model — two honest levels:
//   • global  → full details visible to everyone (team_meeting/training/car/report)
//   • private → personal meetings; non-participants see only a "Busy" block, the
//               title/attendees/location are redacted server-side and never sent.
//
// Tasks and follow-ups are surfaced ONLY on their owner's calendar (they are
// personal work queues, editable from their own surfaces, read-only here).

import { randomUUID } from "node:crypto"
import { query, ensureOnce } from "@/lib/db"

export type CalendarKind = "meeting" | "team_meeting" | "training" | "car" | "report" | "roadshow" | "viewing"
export type VirtualKind = "task" | "followup"
export type AnyKind = CalendarKind | VirtualKind

export type CalendarVisibility = "global" | "private"
export type CalendarStatus = "confirmed" | "pending" | "approved" | "declined" | "cancelled"
export type RSVP = "invited" | "accepted" | "declined"
/** Outcome of a held (or missed) property viewing. Empty = not recorded yet. */
export type ViewingOutcome = "" | "held" | "no_show"

export const CALENDAR_KINDS: CalendarKind[] = ["meeting", "team_meeting", "training", "car", "report", "roadshow", "viewing"]
/** Kinds that must be approved by management before they are live. */
export const APPROVAL_KINDS: CalendarKind[] = ["car", "training"]
/** Kinds that book a shared, non-shareable resource — overlaps are blocked. */
export const CONFLICT_KINDS: CalendarKind[] = ["car"]
/** Kinds that are private to their creator + attendees. Viewings carry lead
 *  identity (client name), so on the shared calendar non-participants see only
 *  a Busy block — full detail lives on the lead's own CRM page. */
const PRIVATE_KINDS: CalendarKind[] = ["meeting", "viewing"]

export function deriveVisibility(kind: CalendarKind): CalendarVisibility {
  return PRIVATE_KINDS.includes(kind) ? "private" : "global"
}

export interface Attendee {
  userKey: string
  userName: string
  rsvp: RSVP
}

export interface CalendarEvent {
  id: string
  title: string
  description: string
  kind: AnyKind
  visibility: CalendarVisibility
  status: CalendarStatus
  startsAt: string
  endsAt: string
  allDay: boolean
  location: string
  resource: string
  externalParty: string
  createdBy: string
  createdByName: string
  approvedBy: string
  approvedByName: string
  decisionNote: string
  attendees: Attendee[]
  /** CRM lead this event belongs to (kind 'viewing') — empty when none. */
  leadId: string
  /** Broker responsible for the linked lead at booking time — empty when none. */
  brokerId: string
  /** Project the viewing is for, when known — empty otherwise. */
  projectSlug: string
  /** Viewing outcome, recorded after the event time passes. Empty = none yet. */
  outcome: ViewingOutcome
  source: "calendar" | "task" | "followup"
  /** viewer may edit / delete this event */
  editable: boolean
  /** viewer may approve / decline this (management + pending approval kind) */
  approvable: boolean
  /** private event the viewer is not part of — details stripped, shown as Busy */
  redacted: boolean
  /** deep link back to the source system (tasks / CRM lead) */
  link: string
  createdAt: string | null
  updatedAt: string | null
}

export interface CalendarEventInput {
  title: string
  description?: string
  kind: CalendarKind
  startsAt: string
  endsAt: string
  allDay?: boolean
  location?: string
  resource?: string
  externalParty?: string
  attendees?: { userKey: string; userName: string }[]
  leadId?: string
  brokerId?: string
  projectSlug?: string
}

export interface Viewer {
  /** universal participant key — the user's email; attendees are keyed by this */
  key: string
  email: string
  name: string
  role: string
  /** brokerId||email — matches leads.assigned_broker_id / tasks.created_by */
  brokerKey: string
}

const MANAGEMENT: string[] = ["admin", "sales_manager", "director", "ceo"]
const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v))
const isMgmt = (role: string) => MANAGEMENT.includes(role)

// ─── Schema ──────────────────────────────────────────────────────────────────

const ensureSchema = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_site_calendar_events (
      id text PRIMARY KEY,
      title text NOT NULL,
      description text,
      kind text NOT NULL,
      visibility text NOT NULL DEFAULT 'global',
      status text NOT NULL DEFAULT 'confirmed',
      starts_at timestamptz NOT NULL,
      ends_at timestamptz NOT NULL,
      all_day boolean DEFAULT false,
      location text,
      resource text,
      external_party text,
      created_by text NOT NULL,
      created_by_name text,
      approved_by text,
      approved_by_name text,
      decision_note text,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_site_calendar_attendees (
      id text PRIMARY KEY,
      event_id text NOT NULL,
      user_key text NOT NULL,
      user_name text,
      rsvp text DEFAULT 'invited',
      created_at timestamptz DEFAULT now(),
      UNIQUE (event_id, user_key)
    )
  `)
  // Self-heal: this table's ON CONFLICT target needs a real unique index.
  // Tables created before the UNIQUE was declared never gained one, which
  // makes every upsert fail with 42P10 (the bug that broke project create).
  try {
    await query(`CREATE UNIQUE INDEX IF NOT EXISTS fh_calendar_attendees_uidx ON freehold_site_calendar_attendees (event_id, user_key)`)
  } catch { /* duplicates present — leave the data alone, surface nothing */ }
  // Viewings-as-objects (Layer 10): a viewing is a calendar event of kind
  // 'viewing' carrying its CRM lead + broker (+ project when known) and, once
  // the time has passed, an honest recorded outcome (held / no_show).
  await query(`ALTER TABLE freehold_site_calendar_events ADD COLUMN IF NOT EXISTS lead_id text`)
  await query(`ALTER TABLE freehold_site_calendar_events ADD COLUMN IF NOT EXISTS broker_id text`)
  await query(`ALTER TABLE freehold_site_calendar_events ADD COLUMN IF NOT EXISTS project_slug text`)
  await query(`ALTER TABLE freehold_site_calendar_events ADD COLUMN IF NOT EXISTS outcome text`)
  await query(`CREATE INDEX IF NOT EXISTS idx_cal_events_range ON freehold_site_calendar_events (starts_at, ends_at)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_cal_attendees_event ON freehold_site_calendar_attendees (event_id)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_cal_events_lead ON freehold_site_calendar_events (lead_id) WHERE lead_id IS NOT NULL`)
}
const ensureSchemaOnce = () => ensureOnce("freehold_site_calendar_events", ensureSchema)

// ─── Row mapping ─────────────────────────────────────────────────────────────

// Emit clean ISO-8601 UTC (…Z) so browser Date parsing and .ics export are exact.
const iso = (col: string, alias: string) =>
  `to_char(${col} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS ${alias}`

const EVENT_COLS = `id, title, description, kind, visibility, status,
  ${iso("starts_at", "starts_at")}, ${iso("ends_at", "ends_at")}, all_day, location, resource, external_party,
  created_by, created_by_name, approved_by, approved_by_name, decision_note,
  lead_id, broker_id, project_slug, outcome,
  ${iso("created_at", "created_at")}, ${iso("updated_at", "updated_at")}`

const outcomeOf = (v: unknown): ViewingOutcome => (v === "held" || v === "no_show" ? v : "")

function mapEvent(r: Record<string, unknown>, attendees: Attendee[], viewer: Viewer): CalendarEvent {
  const kind = str(r.kind) as AnyKind
  const visibility = (str(r.visibility) || "global") as CalendarVisibility
  const createdBy = str(r.created_by)
  const status = (str(r.status) || "confirmed") as CalendarStatus
  const isParticipant = createdBy === viewer.key || attendees.some((a) => a.userKey === viewer.key)
  const redacted = visibility === "private" && !isParticipant && !isMgmtSeesPrivate()
  const editable = !redacted && createdBy === viewer.key && status !== "cancelled"
  const approvable =
    !redacted && isMgmt(viewer.role) && status === "pending" && APPROVAL_KINDS.includes(kind as CalendarKind)

  if (redacted) {
    return {
      id: str(r.id),
      title: "",
      description: "",
      kind: "meeting",
      visibility,
      status,
      startsAt: str(r.starts_at),
      endsAt: str(r.ends_at),
      allDay: Boolean(r.all_day),
      location: "",
      resource: "",
      externalParty: "",
      createdBy: "",
      createdByName: "",
      approvedBy: "",
      approvedByName: "",
      decisionNote: "",
      attendees: [],
      leadId: "",
      brokerId: "",
      projectSlug: "",
      outcome: "",
      source: "calendar",
      editable: false,
      approvable: false,
      redacted: true,
      link: "",
      createdAt: r.created_at ? str(r.created_at) : null,
      updatedAt: r.updated_at ? str(r.updated_at) : null,
    }
  }

  return {
    id: str(r.id),
    title: str(r.title),
    description: str(r.description),
    kind,
    visibility,
    status,
    startsAt: str(r.starts_at),
    endsAt: str(r.ends_at),
    allDay: Boolean(r.all_day),
    location: str(r.location),
    resource: str(r.resource),
    externalParty: str(r.external_party),
    createdBy,
    createdByName: str(r.created_by_name),
    approvedBy: str(r.approved_by),
    approvedByName: str(r.approved_by_name),
    decisionNote: str(r.decision_note),
    attendees,
    leadId: str(r.lead_id),
    brokerId: str(r.broker_id),
    projectSlug: str(r.project_slug),
    outcome: outcomeOf(r.outcome),
    source: "calendar",
    editable,
    approvable,
    redacted: false,
    link: kind === "viewing" && r.lead_id ? `/freehold-intelligence/crm/leads/${str(r.lead_id)}` : "",
    createdAt: r.created_at ? str(r.created_at) : null,
    updatedAt: r.updated_at ? str(r.updated_at) : null,
  }
}

// Private meetings stay private from everyone who isn't a participant — including
// management. This is a policy hook kept explicit so it is easy to audit.
function isMgmtSeesPrivate(): boolean {
  return false
}

// ─── Reads ───────────────────────────────────────────────────────────────────

async function attendeesFor(eventIds: string[]): Promise<Map<string, Attendee[]>> {
  const map = new Map<string, Attendee[]>()
  if (!eventIds.length) return map
  const rows = await query<Record<string, unknown>>(
    `SELECT event_id, user_key, user_name, rsvp FROM freehold_site_calendar_attendees
     WHERE event_id = ANY($1) ORDER BY created_at ASC`,
    [eventIds],
  )
  for (const r of rows) {
    const id = str(r.event_id)
    const list = map.get(id) ?? []
    list.push({ userKey: str(r.user_key), userName: str(r.user_name), rsvp: (str(r.rsvp) || "invited") as RSVP })
    map.set(id, list)
  }
  return map
}

async function listNativeEvents(viewer: Viewer, fromISO: string, toISO: string): Promise<CalendarEvent[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT ${EVENT_COLS} FROM freehold_site_calendar_events
     WHERE starts_at < $2 AND ends_at > $1
     ORDER BY starts_at ASC LIMIT 1000`,
    [fromISO, toISO],
  )
  const ids = rows.map((r) => str(r.id))
  const att = await attendeesFor(ids)
  return rows.map((r) => mapEvent(r, att.get(str(r.id)) ?? [], viewer))
}

// Tasks with a due date → read-only calendar items, only on the owner's calendar.
async function listTaskEvents(viewer: Viewer, fromISO: string, toISO: string): Promise<CalendarEvent[]> {
  try {
    const rows = await query<Record<string, unknown>>(
      `SELECT id, title, description, assignee, priority, status, due_date::text AS due_date, created_by
       FROM freehold_site_tasks
       WHERE due_date IS NOT NULL AND due_date >= $1::date AND due_date <= $2::date
         AND status <> 'done'
         AND (created_by = $3 OR assignee = $4 OR assignee = $5)
       ORDER BY due_date ASC LIMIT 500`,
      [fromISO, toISO, viewer.brokerKey, viewer.email, viewer.name],
    )
    return rows.map((r) => {
      const day = str(r.due_date)
      return {
        id: `task:${str(r.id)}`,
        title: str(r.title),
        description: str(r.description),
        kind: "task" as AnyKind,
        visibility: "private" as CalendarVisibility,
        status: "confirmed" as CalendarStatus,
        startsAt: `${day}T00:00:00`,
        endsAt: `${day}T23:59:59`,
        allDay: true,
        location: "",
        resource: "",
        externalParty: str(r.priority),
        createdBy: str(r.created_by),
        createdByName: "",
        approvedBy: "",
        approvedByName: "",
        decisionNote: "",
        attendees: [],
        leadId: "",
        brokerId: "",
        projectSlug: "",
        outcome: "" as ViewingOutcome,
        source: "task" as const,
        editable: false,
        approvable: false,
        redacted: false,
        link: "/freehold-intelligence/tasks",
        createdAt: null,
        updatedAt: null,
      }
    })
  } catch (error) {
    console.error("[calendar] task merge failed", error)
    return []
  }
}

// CRM follow-ups (leads with a scheduled snooze/next-follow-up) → read-only
// calendar items, only on the assigned broker's calendar.
async function listFollowupEvents(viewer: Viewer, fromISO: string, toISO: string): Promise<CalendarEvent[]> {
  try {
    const rows = await query<Record<string, unknown>>(
      `SELECT id, name, lead_code,
              to_char(snooze_until AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS snooze_until, status
       FROM freehold_site_leads
       WHERE snooze_until IS NOT NULL AND snooze_until >= $1 AND snooze_until <= $2
         AND assigned_broker_id = $3
         AND status NOT IN ('closed', 'converted', 'lost')
       ORDER BY snooze_until ASC LIMIT 500`,
      [fromISO, toISO, viewer.brokerKey],
    )
    return rows.map((r) => {
      const when = str(r.snooze_until)
      return {
        id: `followup:${str(r.id)}`,
        title: str(r.name) || str(r.lead_code) || "Lead",
        description: "",
        kind: "followup" as AnyKind,
        visibility: "private" as CalendarVisibility,
        status: "confirmed" as CalendarStatus,
        startsAt: when,
        endsAt: when,
        allDay: false,
        location: "",
        resource: "",
        externalParty: str(r.lead_code),
        createdBy: viewer.key,
        createdByName: "",
        approvedBy: "",
        approvedByName: "",
        decisionNote: "",
        attendees: [],
        leadId: str(r.id),
        brokerId: viewer.brokerKey,
        projectSlug: "",
        outcome: "" as ViewingOutcome,
        source: "followup" as const,
        editable: false,
        approvable: false,
        redacted: false,
        link: `/freehold-intelligence/crm/leads/${str(r.id)}`,
        createdAt: null,
        updatedAt: null,
      }
    })
  } catch (error) {
    console.error("[calendar] followup merge failed", error)
    return []
  }
}

export async function listCalendar(viewer: Viewer, fromISO: string, toISO: string): Promise<CalendarEvent[]> {
  try {
    await ensureSchemaOnce()
    const [native, tasks, followups] = await Promise.all([
      listNativeEvents(viewer, fromISO, toISO),
      listTaskEvents(viewer, fromISO, toISO),
      listFollowupEvents(viewer, fromISO, toISO),
    ])
    return [...native, ...tasks, ...followups].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  } catch (error) {
    console.error("[calendar] list failed", error)
    return []
  }
}

export async function getEvent(id: string, viewer: Viewer): Promise<CalendarEvent | null> {
  await ensureSchemaOnce()
  const rows = await query<Record<string, unknown>>(
    `SELECT ${EVENT_COLS} FROM freehold_site_calendar_events WHERE id = $1`,
    [id],
  )
  if (!rows[0]) return null
  const att = await attendeesFor([id])
  return mapEvent(rows[0], att.get(id) ?? [], viewer)
}

// ─── Conflict detection (shared resources) ───────────────────────────────────

export async function findConflict(
  kind: CalendarKind,
  resource: string,
  startsAt: string,
  endsAt: string,
  excludeId?: string,
): Promise<{ id: string; title: string; startsAt: string; endsAt: string } | null> {
  if (!CONFLICT_KINDS.includes(kind) || !resource) return null
  const rows = await query<Record<string, unknown>>(
    `SELECT id, title, ${iso("starts_at", "starts_at")}, ${iso("ends_at", "ends_at")}
     FROM freehold_site_calendar_events
     WHERE kind = $1 AND resource = $2
       AND status IN ('pending', 'approved', 'confirmed')
       AND starts_at < $4 AND ends_at > $3
       AND ($5::text IS NULL OR id <> $5)
     ORDER BY starts_at ASC LIMIT 1`,
    [kind, resource, startsAt, endsAt, excludeId ?? null],
  )
  const r = rows[0]
  return r ? { id: str(r.id), title: str(r.title), startsAt: str(r.starts_at), endsAt: str(r.ends_at) } : null
}

// ─── Writes ──────────────────────────────────────────────────────────────────

export class ConflictError extends Error {
  conflict: { id: string; title: string; startsAt: string; endsAt: string }
  constructor(conflict: { id: string; title: string; startsAt: string; endsAt: string }) {
    super("Resource already booked for this time")
    this.name = "ConflictError"
    this.conflict = conflict
  }
}

export async function createEvent(input: CalendarEventInput, creator: Viewer): Promise<CalendarEvent> {
  await ensureSchemaOnce()
  const kind = input.kind
  const resource = input.resource?.trim() || ""
  const visibility = deriveVisibility(kind)
  // Approval kinds land as pending; everything else is confirmed immediately.
  const status: CalendarStatus = APPROVAL_KINDS.includes(kind) ? "pending" : "confirmed"

  const conflict = await findConflict(kind, resource, input.startsAt, input.endsAt)
  if (conflict) throw new ConflictError(conflict)

  const id = `cal_${randomUUID()}`
  await query(
    `INSERT INTO freehold_site_calendar_events
       (id, title, description, kind, visibility, status, starts_at, ends_at, all_day,
        location, resource, external_party, created_by, created_by_name,
        lead_id, broker_id, project_slug, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17, now(), now())`,
    [
      id,
      input.title,
      input.description || "",
      kind,
      visibility,
      status,
      input.startsAt,
      input.endsAt,
      Boolean(input.allDay),
      input.location?.trim() || "",
      resource,
      input.externalParty?.trim() || "",
      creator.key,
      creator.name,
      input.leadId?.trim() || null,
      input.brokerId?.trim() || null,
      input.projectSlug?.trim() || null,
    ],
  )

  const attendees = input.attendees ?? []
  for (const a of attendees) {
    if (!a.userKey) continue
    await query(
      `INSERT INTO freehold_site_calendar_attendees (id, event_id, user_key, user_name, rsvp, created_at)
       VALUES ($1,$2,$3,$4,'invited', now()) ON CONFLICT (event_id, user_key) DO NOTHING`,
      [`att_${randomUUID()}`, id, a.userKey, a.userName || ""],
    )
  }

  const created = await getEvent(id, creator)
  if (!created) throw new Error("Failed to create event")
  return created
}

export interface EventPatch {
  title?: string
  description?: string
  startsAt?: string
  endsAt?: string
  location?: string
  externalParty?: string
  attendees?: { userKey: string; userName: string }[]
}

async function rawEvent(id: string): Promise<Record<string, unknown> | null> {
  const rows = await query<Record<string, unknown>>(
    `SELECT ${EVENT_COLS} FROM freehold_site_calendar_events WHERE id = $1`,
    [id],
  )
  return rows[0] ?? null
}

export async function editEvent(id: string, patch: EventPatch, actor: Viewer): Promise<CalendarEvent | null> {
  await ensureSchemaOnce()
  const row = await rawEvent(id)
  if (!row) return null
  if (str(row.created_by) !== actor.key) throw new Error("forbidden")

  const kind = str(row.kind) as CalendarKind
  const resource = str(row.resource)
  const nextStart = patch.startsAt ?? str(row.starts_at)
  const nextEnd = patch.endsAt ?? str(row.ends_at)
  if (patch.startsAt || patch.endsAt) {
    const conflict = await findConflict(kind, resource, nextStart, nextEnd, id)
    if (conflict) throw new ConflictError(conflict)
  }

  const sets: string[] = []
  const params: unknown[] = []
  const set = (col: string, val: unknown) => { params.push(val); sets.push(`${col} = $${params.length}`) }
  if (typeof patch.title === "string") set("title", patch.title)
  if (typeof patch.description === "string") set("description", patch.description)
  if (typeof patch.startsAt === "string") set("starts_at", patch.startsAt)
  if (typeof patch.endsAt === "string") set("ends_at", patch.endsAt)
  if (typeof patch.location === "string") set("location", patch.location)
  if (typeof patch.externalParty === "string") set("external_party", patch.externalParty)
  if (sets.length) {
    params.push(id)
    await query(
      `UPDATE freehold_site_calendar_events SET ${sets.join(", ")}, updated_at = now() WHERE id = $${params.length}`,
      params,
    )
  }

  if (patch.attendees) {
    await query(`DELETE FROM freehold_site_calendar_attendees WHERE event_id = $1`, [id])
    for (const a of patch.attendees) {
      if (!a.userKey) continue
      await query(
        `INSERT INTO freehold_site_calendar_attendees (id, event_id, user_key, user_name, rsvp, created_at)
         VALUES ($1,$2,$3,$4,'invited', now()) ON CONFLICT (event_id, user_key) DO NOTHING`,
        [`att_${randomUUID()}`, id, a.userKey, a.userName || ""],
      )
    }
  }

  return getEvent(id, actor)
}

export async function decideEvent(
  id: string,
  decision: "approved" | "declined",
  actor: Viewer,
  note: string,
): Promise<CalendarEvent | null> {
  await ensureSchemaOnce()
  if (!isMgmt(actor.role)) throw new Error("forbidden")
  const row = await rawEvent(id)
  if (!row) return null
  const kind = str(row.kind) as CalendarKind
  if (!APPROVAL_KINDS.includes(kind)) throw new Error("not an approval item")

  if (decision === "approved") {
    const conflict = await findConflict(kind, str(row.resource), str(row.starts_at), str(row.ends_at), id)
    if (conflict) throw new ConflictError(conflict)
  }
  await query(
    `UPDATE freehold_site_calendar_events
     SET status = $2, approved_by = $3, approved_by_name = $4, decision_note = $5, updated_at = now()
     WHERE id = $1`,
    [id, decision, actor.key, actor.name, note || ""],
  )
  return getEvent(id, actor)
}

export async function cancelEvent(id: string, actor: Viewer): Promise<CalendarEvent | null> {
  await ensureSchemaOnce()
  const row = await rawEvent(id)
  if (!row) return null
  if (str(row.created_by) !== actor.key && !isMgmt(actor.role)) throw new Error("forbidden")
  await query(
    `UPDATE freehold_site_calendar_events SET status = 'cancelled', updated_at = now() WHERE id = $1`,
    [id],
  )
  return getEvent(id, actor)
}

export async function rsvpEvent(id: string, actor: Viewer, rsvp: RSVP): Promise<CalendarEvent | null> {
  await ensureSchemaOnce()
  const row = await rawEvent(id)
  if (!row) return null
  await query(
    `INSERT INTO freehold_site_calendar_attendees (id, event_id, user_key, user_name, rsvp, created_at)
     VALUES ($1,$2,$3,$4,$5, now())
     ON CONFLICT (event_id, user_key) DO UPDATE SET rsvp = $5`,
    [`att_${randomUUID()}`, id, actor.key, actor.name, rsvp],
  )
  return getEvent(id, actor)
}

// ─── Viewings (calendar events of kind 'viewing' linked to a CRM lead) ──────

/** Slim viewing shape for the lead-360 page. Access is NOT redacted here:
 *  callers must already have gated access to the lead itself (broker owns it,
 *  or management) — anyone who may open the lead may see its viewings. */
export interface LeadViewing {
  id: string
  title: string
  startsAt: string
  endsAt: string
  status: CalendarStatus
  outcome: ViewingOutcome
  note: string
  location: string
  createdBy: string
  createdByName: string
}

export async function listLeadViewings(leadId: string): Promise<LeadViewing[]> {
  try {
    await ensureSchemaOnce()
    const rows = await query<Record<string, unknown>>(
      `SELECT id, title, description, status, outcome, location, created_by, created_by_name,
              ${iso("starts_at", "starts_at")}, ${iso("ends_at", "ends_at")}
       FROM freehold_site_calendar_events
       WHERE kind = 'viewing' AND lead_id = $1 AND status <> 'cancelled'
       ORDER BY starts_at DESC LIMIT 50`,
      [leadId],
    )
    return rows.map((r) => ({
      id: str(r.id),
      title: str(r.title),
      startsAt: str(r.starts_at),
      endsAt: str(r.ends_at),
      status: (str(r.status) || "confirmed") as CalendarStatus,
      outcome: outcomeOf(r.outcome),
      note: str(r.description),
      location: str(r.location),
      createdBy: str(r.created_by),
      createdByName: str(r.created_by_name),
    }))
  } catch (error) {
    console.error("[calendar] lead viewings failed", error)
    return []
  }
}

/**
 * Record the real outcome of a viewing once its start time has passed.
 * Only the creator or management may record it; it can be set exactly once
 * (the outcome is a fact, not an editable field).
 */
export async function recordViewingOutcome(
  id: string,
  outcome: "held" | "no_show",
  actor: Viewer,
): Promise<CalendarEvent | null> {
  await ensureSchemaOnce()
  const row = await rawEvent(id)
  if (!row) return null
  if (str(row.kind) !== "viewing") throw new Error("not a viewing")
  if (str(row.created_by) !== actor.key && !isMgmt(actor.role)) throw new Error("forbidden")
  if (outcomeOf(row.outcome)) throw new Error("outcome already recorded")
  if (new Date(str(row.starts_at)).getTime() > Date.now()) throw new Error("viewing has not started yet")
  await query(
    `UPDATE freehold_site_calendar_events SET outcome = $2, updated_at = now() WHERE id = $1`,
    [id, outcome],
  )
  return getEvent(id, actor)
}

export async function deleteEvent(id: string, actor: Viewer): Promise<boolean> {
  await ensureSchemaOnce()
  const row = await rawEvent(id)
  if (!row) return false
  if (str(row.created_by) !== actor.key && !isMgmt(actor.role)) throw new Error("forbidden")
  await query(`DELETE FROM freehold_site_calendar_attendees WHERE event_id = $1`, [id])
  await query(`DELETE FROM freehold_site_calendar_events WHERE id = $1`, [id])
  return true
}
