/**
 * ONE WRITE PATH FOR A LEAD — the CRM screen and the chat use the same one.
 *
 * This code was the body of PATCH /api/freehold/crm/leads/[id]. It was only
 * reachable over HTTP with a session cookie, which meant the assistant could
 * not use it, which meant the assistant could not change a lead at all. Its
 * whole CRM capability was `crm_search_leads` — it could find the person going
 * cold and then do nothing about them.
 *
 * That is what "the chat is not effective" turns out to be. On ads it holds
 * twenty tools and can pause a campaign, move a budget, edit an ad, launch a
 * campaign. On the CRM — where the operator actually spends the day, and where
 * this was reported from — it could read and talk. So it wrote paragraphs
 * about a lead and offered buttons ("Draft WhatsApp Message", "Mark as
 * Contacted") that mapped to no capability at all.
 *
 * The fix is not a second write path for the machine. A duplicated update
 * drifts within a month: this one carries the broker-ownership rule, the
 * reassignment authority check, the value-rating points claim, the Ads Machine
 * bridge, the activity log and the Meta write-back, and a copy would miss two
 * of those on day one and quietly diverge on the rest. So the logic moved HERE
 * whole, and both callers are thin:
 *
 *   · the route awaits the session, then calls updateLead
 *   · the coordinator tool passes the signed-in user, then calls updateLead
 *
 * The rules apply identically either way — a broker cannot reassign a lead by
 * asking the assistant nicely, because the same branch runs.
 *
 * ── WHY IT RETURNS A STATUS INSTEAD OF THROWING ──────────────────────────
 *
 * The refusals here are ANSWERS, not faults: "brokers cannot reassign leads",
 * "not permitted, unlocks at…". The route needs them as HTTP codes and the
 * assistant needs them as sentences to say out loud. A thrown error would
 * flatten both into "something went wrong", and the reassignment window in
 * particular is a rule the person is entitled to hear stated.
 */
import { query } from '@/lib/db'
import { brokerOwnerKeys } from '@/lib/freehold/lead-access'
import { ensureLeadsTable, ensureLeadActivityTable } from '@/lib/data'
import { notify } from '@/lib/freehold/notifications'
import { emailLeadMovementToInbox, notifyBrokerOfAssignedLead } from '@/lib/transactional-email'
import { answerLeadScore } from '@/lib/freehold/ads-machine'
import { authorizeReassign } from '@/lib/freehold/authority-db'
import type { Role } from '@/lib/freehold/session-types'
import { statusForDenial } from '@/lib/freehold/authority'
import { reportLeadToMeta } from '@/lib/freehold/lead-writeback'
import { openRatingClaim } from '@/lib/freehold/points-db'
import { outcomeOf } from '@/lib/freehold/points'
import {
  statusForRating, FUNNEL_ORDER, rankOf, RATING_STATUS_CEILING,
} from '@/lib/freehold/rating-status'

/** Who is making the change. The same shape a verified session carries. */
export interface LeadActor {
  email: string
  role: Role
  brokerId?: string | null
}

export type LeadWriteResult =
  | { ok: true; id: string }
  /** `status` is the HTTP code the route should answer with. */
  | { ok: false; status: number; error: string; reason?: string; unlocksAt?: string | null }

/**
 * The fields a caller may set. Exported because the coordinator tools build
 * their patches from it — a tool that sets a field this list does not carry
 * would silently do nothing, and finding that out from a user is expensive.
 */
export const LEAD_WRITABLE_FIELDS = [
  'status', 'priority', 'assigned_broker_id', 'last_contact_at', 'interest',
  'message', 'snooze_until', 'archived', 'muted_until', 'blocked',
  'duplicate_dismissed_at',
] as const

// "Not a duplicate" dismissals persist on the lead row (survives reloads and
// devices). Best-effort column ensure, run once per instance.
let dismissColEnsured: Promise<void> | null = null
const ensureDismissColumn = () => {
  if (!dismissColEnsured) {
    dismissColEnsured = query(
      `ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS duplicate_dismissed_at timestamptz`
    ).then(() => undefined).catch((e) => { dismissColEnsured = null; throw e })
  }
  return dismissColEnsured
}

// Describe what a PATCH changed so the lead's activity timeline reflects real
// history. Failures never break the update itself.
async function logPatchActivity(leadId: string, body: Record<string, unknown>, actor: string) {
  const entries: Array<{ type: string; description: string }> = []
  // Lead name for human-readable movement emails (best-effort).
  const leadRow = await query<{ name: string | null }>(
    `SELECT name FROM freehold_site_leads WHERE id = $1 LIMIT 1`, [leadId],
  ).catch(() => [] as { name: string | null }[])
  const leadRef = { id: leadId, name: leadRow[0]?.name ?? null }

  if (typeof body.status === 'string' && body.status) {
    entries.push({ type: 'stage', description: `Stage changed to ${body.status}` })
    // Movement feed: the brand inbox tracks every step, not just arrivals.
    void emailLeadMovementToInbox('stage', leadRef, `stage changed to ${body.status}`)
  }
  if ('assigned_broker_id' in body) {
    entries.push({
      type: 'assignment',
      description: body.assigned_broker_id ? `Assigned to ${body.assigned_broker_id}` : 'Unassigned',
    })
    if (body.assigned_broker_id) {
      // In-app notification straight to the assignee (best-effort)…
      notify('lead_assigned', { lead: leadId }, {
        recipient: String(body.assigned_broker_id),
        href: `/freehold-intelligence/crm/leads/${leadId}`,
      }).catch(() => {})
      // …and the EMAIL. The assign API and the automation engine both emailed
      // the broker; this route — the one behind the CRM's own assignment UI —
      // only pinged in-app, so a broker away from the dashboard missed exactly
      // the assignments made by hand. notifyBrokerOfAssignedLead also feeds
      // the movement note to the brand inbox, so one call covers both.
      void notifyBrokerOfAssignedLead(String(body.assigned_broker_id), leadId)
    } else {
      void emailLeadMovementToInbox('unassigned', leadRef, 'unassigned — nobody owns this lead now')
    }
  }
  if (typeof body.priority === 'string' && body.priority) {
    entries.push({ type: 'note', description: `Priority set to ${body.priority}` })
  }
  if ('value_rating' in body) {
    entries.push({ type: 'note', description: `Value rated ${Number(body.value_rating)}/10` })
  }
  if ('snooze_until' in body && body.snooze_until) {
    const until = new Date(String(body.snooze_until))
    entries.push({
      type: 'note',
      description: `Snoozed until ${Number.isNaN(until.getTime()) ? String(body.snooze_until) : until.toISOString().slice(0, 16).replace('T', ' ')}`,
    })
  }
  if (body.archived === true) entries.push({ type: 'note', description: 'Conversation archived' })
  if (body.blocked === true) entries.push({ type: 'note', description: 'Contact blocked' })
  if ('duplicate_dismissed_at' in body && body.duplicate_dismissed_at) {
    entries.push({ type: 'note', description: 'Marked as not a duplicate' })
  }
  if (entries.length === 0) return
  try {
    await ensureLeadActivityTable()
    for (const e of entries) {
      await query(
        `INSERT INTO freehold_site_lead_activity (id, lead_id, activity_type, description, created_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [crypto.randomUUID(), leadId, e.type, e.description, actor]
      )
    }
  } catch {
    // Activity logging is best-effort — the update already succeeded.
  }
}


export async function updateLead(
  id: string,
  patch: Record<string, unknown>,
  user: LeadActor,
): Promise<LeadWriteResult> {
  // A COPY, because a rating may add a status to it below. Mutating the
  // caller's object would silently change what a route thinks it asked for.
  const body: Record<string, unknown> = { ...patch }

  // Brokers may only modify their own leads, and may not reassign them away.
  const isBroker = user.role === 'broker'
  const ownerKeys = brokerOwnerKeys(user)
  if (isBroker) {
    if ('assigned_broker_id' in body) {
      return { ok: false, status: 403, error: 'Brokers cannot reassign leads' }
    }
    try {
      await ensureLeadsTable()
      const owner = await query<{ assigned_broker_id: string | null }>(
        `SELECT assigned_broker_id FROM freehold_site_leads WHERE id = $1`,
        [id]
      )
      if (owner.length === 0) return { ok: false, status: 404, error: 'Not found' }
      if (!ownerKeys.includes(owner[0].assigned_broker_id ?? '')) {
        return { ok: false, status: 403, error: 'Forbidden' }
      }
    } catch {
      return { ok: false, status: 503, error: 'DB unavailable' }
    }
  }

  // ── Reassignment authority ──────────────────────────────────────────────
  // A team leader's power to move a lead is not a flag on their account: it
  // depends on THIS lead's state. Inside the grace window the assigned broker
  // is protected; a lead they have actually worked is never up for grabs,
  // however old; a lead still untouched once the window passes unlocks.
  // Management is not
  // fairness-gated but every decision — allowed or denied — is written down,
  // which is what settles the argument later.
  if (!isBroker && 'assigned_broker_id' in body) {
    const { decision, facts } = await authorizeReassign(
      id,
      { email: user.email, role: user.role, id: user.brokerId ?? null },
      `→ ${String(body.assigned_broker_id || 'unassigned')}`,
    )
    if (!facts) return { ok: false, status: 404, error: 'Not found' }
    if (!decision.allowed) {
      return { ok: false, status: statusForDenial(decision), error: 'Reassignment not permitted', reason: decision.reason, unlocksAt: decision.unlocksAt ?? null }
    }
  }

  const ALLOWED_FIELDS: readonly string[] = LEAD_WRITABLE_FIELDS
  const updates: string[] = []
  const values: unknown[] = []

  // ── VALUE RATING — one click, one scale ─────────────────────────────────
  // A 0–10 judgment of what this lead is actually WORTH, replacing the old
  // binary green/red. The bottom of the scale is the point: a lead rated 0
  // teaches the machine what it should stop buying, which is exactly as
  // valuable as knowing what to buy more of. Written canonically on the lead;
  // if the Ads Machine has an unanswered question about this same lead, the
  // one click answers that too — nobody rates the same lead twice.
  if ('value_rating' in body) {
    const v = Number(body.value_rating)
    if (!Number.isFinite(v) || v < 0 || v > 10) {
      return { ok: false, status: 400, error: 'value_rating must be 0–10' }
    }
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS value_rating int`).catch(() => undefined)
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS value_rated_by text`).catch(() => undefined)
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS value_rated_at timestamptz`).catch(() => undefined)
    // Placeholders MUST be numbered by values.length, not updates.length —
    // `value_rated_at = now()` (and `updated_at = now()` below) add to `updates`
    // without a bound value, so numbering by updates.length desyncs every
    // later placeholder. A combined PATCH like {value_rating, status} then
    // pointed `status` and the WHERE id at the same $-index and left one
    // parameter unreferenced (Postgres 500). Numbering by values.length is
    // correct because only value-bearing clauses advance it.
    updates.push(`value_rating = $${values.length + 1}`)
    values.push(Math.round(v))
    updates.push(`value_rated_by = $${values.length + 1}`)
    values.push(user.email)
    updates.push(`value_rated_at = now()`)

    // ── The points claim, opened on the FIRST rating only ─────────────────
    //
    // A rating that changes nothing is worse than no rating: brokers stop
    // within a week, and this is the strongest signal in the product. So an
    // accurate call earns the point back — settled later, when the forecast
    // has had time to be right or wrong.
    //
    // The snapshot is taken HERE, before the outcome could be known, because
    // that is the whole integrity of the scheme. Best-effort: a rating must
    // never fail because the points table is unreachable — the rating is the
    // signal, the point is only the thank-you. See lib/freehold/points.ts.
    void (async () => {
      try {
        const [row] = await query<{ status: string | null; blocked: boolean | null; phone: string | null }>(
          `SELECT status, blocked, phone FROM freehold_site_leads WHERE id = $1 LIMIT 1`,
          [id],
        )
        await openRatingClaim({
          leadId: id,
          brokerId: user.brokerId ?? user.email,
          rating: Math.round(v),
          outcomeAtRating: outcomeOf({
            status: row?.status,
            blocked: row?.blocked,
            badPhone: !row?.phone || row.phone.replace(/\D/g, '').length < 7,
          }),
        })
      } catch { /* the rating stands whatever the points table does */ }
    })()

    // Bridge into the machine's learning, best-effort: the rating must never
    // fail because the machine has no question open.
    void (async () => {
      try {
        const rows = await query<{ id: string }>(
          `SELECT id FROM freehold_site_ads_machine_lead_verdicts
            WHERE lead_id = $1 AND answered_at IS NULL LIMIT 1`,
          [id],
        )
        if (rows[0]) await answerLeadScore(rows[0].id, Math.round(v), user.email)
      } catch { /* machine table may not exist yet */ }
    })()
  }

  // ── A RATING MOVES THE LEAD ────────────────────────────────────────────
  //
  // This team rates and does not drag cards, so the status column sat at 'new'
  // across the whole account while the follow-up queue, the team metrics, the
  // money ladder and the campaign funnel all read it and reported a business
  // that had done nothing. A broker who rates a lead 8 has said it is worth
  // pursuing, and `writeBackFor` has been telling Meta exactly that on exactly
  // this threshold since the write-back shipped. The CRM now agrees with it.
  //
  // Written into the SAME update, so the rating and the move are one write and
  // one history — and it goes through `body`, so logPatchActivity records the
  // stage change and the movement email fires exactly as a manual move does.
  //
  // Forward only, never past qualified, never on a lost lead, and never on a
  // low or middling rating. The rules and their reasons are in
  // lib/freehold/rating-status.ts.
  if ('value_rating' in body && !('status' in body)) {
    try {
      const [cur] = await query<{ status: string | null }>(
        `SELECT status FROM freehold_site_leads WHERE id = $1 LIMIT 1`, [id],
      )
      const moved = statusForRating(Number(body.value_rating), cur?.status ?? null)
      if (moved) body.status = moved
    } catch {
      // The rating still lands. A status this write could not derive is a lead
      // that stays where it was, which is the honest failure.
    }
  }

  for (const field of ALLOWED_FIELDS) {
    if (field in body) {
      // Numbered by values.length, NOT updates.length — for exactly the reason
      // spelled out above the value_rating block: `value_rated_at = now()` and
      // `updated_at = now()` push a clause without pushing a value, so counting
      // clauses desyncs every later placeholder. This loop was still counting
      // clauses, so a PATCH carrying value_rating AND another field (say
      // status) bound that field to the same $-index as the WHERE id — writing
      // the lead's own id into status.
      updates.push(`${field} = $${values.length + 1}`)
      values.push(body[field])
    }
  }

  // Stamp WHEN this broker received the lead. The grace window measures from
  // here, so without it a reassigned lead would be judged by the date the lead
  // first arrived and would never be protected.
  if ('assigned_broker_id' in body) updates.push(`assigned_at = now()`)

  if (updates.length === 0) return { ok: false, status: 400, error: 'No valid fields to update' }

  updates.push(`updated_at = now()`)
  values.push(id)

  try {
    await ensureLeadsTable()
    if ('duplicate_dismissed_at' in body) await ensureDismissColumn()
    await query(
      `UPDATE freehold_site_leads SET ${updates.join(', ')} WHERE id = $${values.length}`,
      values
    )
    await logPatchActivity(id, body, user.email)
    // THE OTHER HALF OF THE SIGNAL. Meta only ever learns that a form was
    // submitted; whether the lead was real is decided here, in the CRM, and
    // until now that judgment never travelled back — so the optimiser kept
    // buying more of whatever produced submissions. Fire-and-forget: an ad
    // platform must never be able to fail a CRM write.
    void reportLeadToMeta(id)
    return { ok: true, id }
  } catch {
    return { ok: false, status: 500, error: 'Update failed' }
  }
}


/**
 * RECORD THAT SOMEBODY ACTUALLY REACHED OUT.
 *
 * Two writes that belong together and were never done together: the activity
 * row (what happened, who did it, when) and `last_contact_at` on the lead
 * (which is what the overdue-follow-up queue, the response clock and the team
 * metrics all read). Logging one without the other is how a lead that was
 * called this morning still shows in the "going cold" list at lunchtime.
 *
 * This is the write behind the "Mark as Contacted" button the assistant kept
 * offering with nothing underneath it.
 *
 * The lead update goes through updateLead, so a broker touching somebody
 * else's lead is refused here exactly as it is in the CRM screen.
 */
export const CONTACT_CHANNELS = ['call', 'whatsapp', 'email', 'meeting', 'note'] as const
export type ContactChannel = (typeof CONTACT_CHANNELS)[number]

export async function logLeadContact(
  leadId: string,
  channel: ContactChannel,
  note: string,
  user: LeadActor,
): Promise<LeadWriteResult> {
  // The ownership rules live in one place. Stamping the contact time IS the
  // permission check — if this refuses, nothing is logged either, so a broker
  // cannot write history onto a lead that is not theirs.
  const stamped = await updateLead(leadId, { last_contact_at: new Date().toISOString() }, user)
  if (!stamped.ok) return stamped

  try {
    await ensureLeadActivityTable()
    await query(
      `INSERT INTO freehold_site_lead_activity (id, lead_id, activity_type, description, created_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [crypto.randomUUID(), leadId, channel, note || `Logged ${channel}`, user.email],
    )
  } catch {
    // The contact time is the load-bearing half and it landed. A missing
    // timeline row is visible as a gap; a missing timestamp would put the lead
    // back in the chase queue an hour after somebody called them.
  }
  return { ok: true, id: leadId }
}

/**
 * READ ONE LEAD, WITH THE SAME OWNERSHIP RULE THE WRITES USE.
 *
 * `searchCrmLeads` scopes by role already, but it searches by free text. A
 * caller holding an id needs to fetch THAT lead and be refused if it is not
 * theirs — and needs the refusal to look identical to the one a write gets,
 * or the two drift and one of them becomes the way around the other.
 */
export interface LeadFacts {
  id: string
  name: string | null
  phone: string | null
  status: string | null
  projectSlug: string | null
  source: string | null
  lastContactAt: string | null
  assignedBrokerId: string | null
}

export async function getLeadForActor(
  leadId: string,
  user: LeadActor,
): Promise<{ ok: true; lead: LeadFacts } | { ok: false; status: number; error: string }> {
  try {
    await ensureLeadsTable()
    const rows = await query<{
      id: string; name: string | null; phone: string | null; status: string | null
      project_slug: string | null; source: string | null
      last_contact_at: string | null; assigned_broker_id: string | null
    }>(
      `SELECT id, name, phone, status, project_slug, source,
              last_contact_at::text, assigned_broker_id
         FROM freehold_site_leads WHERE id = $1`,
      [leadId],
    )
    const row = rows[0]
    if (!row) return { ok: false, status: 404, error: 'No lead with that id' }
    if (user.role === 'broker' && !brokerOwnerKeys(user).includes(row.assigned_broker_id ?? '')) {
      return { ok: false, status: 403, error: 'That lead is not yours' }
    }
    return {
      ok: true,
      lead: {
        id: row.id, name: row.name, phone: row.phone, status: row.status,
        projectSlug: row.project_slug, source: row.source,
        lastContactAt: row.last_contact_at, assignedBrokerId: row.assigned_broker_id,
      },
    }
  } catch {
    return { ok: false, status: 503, error: 'Could not read that lead just now' }
  }
}

/**
 * LEADS SOMEBODY ADVANCED WITHOUT SAYING WHAT THEY WERE WORTH.
 *
 * The mirror of the rule above. A rating moves a lead; moving a lead does NOT
 * invent a rating, because a status is what was done and a rating is what
 * somebody thinks, and deriving one from the other would manufacture a
 * broker's opinion and hand it to the ad machine as though a person had given
 * it. What it can honestly do is ask.
 *
 * These are the leads where the answer is worth the most: somebody thought
 * them good enough to move to qualified or deeper, and the machine that buys
 * the next thousand like them has no idea why.
 *
 * Broker-scoped in SQL, like the follow-up queue — a broker must not be able
 * to infer another broker's book from a row count.
 */
export async function unratedAdvancedLeads(
  user: LeadActor,
  limit = 20,
): Promise<{ ok: true; leads: LeadFacts[] } | { ok: false; error: string }> {
  const capped = Math.min(Math.max(Math.round(limit) || 20, 1), 100)
  const params: unknown[] = [[...FUNNEL_ORDER.slice(rankOf(RATING_STATUS_CEILING))]]
  let scope = ''
  if (user.role === 'broker') {
    params.push(brokerOwnerKeys(user))
    scope = ' AND assigned_broker_id = ANY($2)'
  }
  params.push(capped)
  try {
    await ensureLeadsTable()
    const rows = await query<{
      id: string; name: string | null; phone: string | null; status: string | null
      project_slug: string | null; source: string | null
      last_contact_at: string | null; assigned_broker_id: string | null
    }>(
      `SELECT id, name, phone, status, project_slug, source,
              last_contact_at::text, assigned_broker_id
         FROM freehold_site_leads
        WHERE archived IS NOT TRUE
          AND value_rating IS NULL
          AND status = ANY($1)${scope}
        ORDER BY updated_at DESC NULLS LAST
        LIMIT $${params.length}`,
      params,
    )
    return {
      ok: true,
      leads: rows.map((r) => ({
        id: r.id, name: r.name, phone: r.phone, status: r.status,
        projectSlug: r.project_slug, source: r.source,
        lastContactAt: r.last_contact_at, assignedBrokerId: r.assigned_broker_id,
      })),
    }
  } catch {
    // "Nothing to rate" and "the read failed" are different answers, and the
    // first one said falsely is how a backlog becomes invisible.
    return { ok: false, error: 'Could not read the unrated leads just now.' }
  }
}


/**
 * MOVE THE LEADS THAT WERE ALREADY RATED — the same rule, applied to history.
 *
 * `statusForRating` advances a lead from the moment it shipped. Everything
 * rated before that is still where it was, so an account whose team has rated
 * for months watches the new rule change nothing and reasonably concludes it
 * does not work.
 *
 * This lives here, beside the live write, rather than only in a script,
 * because the operator this was built for was explicit: they are tired of
 * running commands. A one-off maintenance job that can only be reached through
 * a terminal is a job that does not get done, and the whole point of the
 * assistant is that it can do the work. So the same function backs both the
 * script and the confirm-gated chat tool.
 *
 * DRY RUN BY DEFAULT. `apply` must be passed explicitly. Restatusing thousands
 * of leads changes what every queue and report says about a business, and that
 * is a decision somebody takes with the numbers in front of them.
 */
export interface RatingStatusPlan {
  /** Rated leads examined. */
  rated: number
  /** How many the rule would move, grouped `from → to`. */
  moves: Array<{ from: string; to: string; count: number }>
  total: number
  /** Only set when `apply` was true. */
  moved?: number
  failed?: number
}

export async function applyRatingStatuses(
  user: LeadActor,
  opts: { apply?: boolean; limit?: number } = {},
): Promise<{ ok: true; plan: RatingStatusPlan } | { ok: false; status: number; error: string }> {
  // Management only. Restatusing the book is not a broker's action even for
  // their own leads — it is a change to how the whole business reads.
  if (user.role === 'broker') {
    return { ok: false, status: 403, error: 'Only management can move leads in bulk.' }
  }
  const cap = Math.min(Math.max(Math.round(opts.limit ?? 5000) || 5000, 1), 20_000)

  let rows: Array<{ id: string; status: string | null; value_rating: number | null }>
  try {
    await ensureLeadsTable()
    rows = await query(
      `SELECT id, status, value_rating
         FROM freehold_site_leads
        WHERE archived IS NOT TRUE AND value_rating IS NOT NULL
        LIMIT $1`,
      [cap],
    )
  } catch {
    return { ok: false, status: 503, error: 'Could not read the rated leads just now.' }
  }

  // THE RULE DECIDES. Anything it returns null for — low ratings, the middle
  // band, lost leads, anything already at or past qualified — is left exactly
  // as it is, by construction rather than by a second set of WHERE clauses
  // that would drift from the live path.
  const planned = rows
    .map((r) => ({ id: r.id, from: r.status ?? '', to: statusForRating(r.value_rating, r.status), rating: r.value_rating }))
    .filter((m): m is typeof m & { to: NonNullable<typeof m.to> } => m.to !== null)

  const grouped = new Map<string, number>()
  for (const m of planned) {
    const k = `${m.from || '(none)'}\u0000${m.to}`
    grouped.set(k, (grouped.get(k) ?? 0) + 1)
  }
  const moves = [...grouped.entries()]
    .map(([k, count]) => ({ from: k.split('\u0000')[0], to: k.split('\u0000')[1], count }))
    .sort((a, b) => b.count - a.count)

  const plan: RatingStatusPlan = { rated: rows.length, moves, total: planned.length }
  if (!opts.apply) return { ok: true, plan }

  let moved = 0
  let failed = 0
  for (const m of planned) {
    try {
      // Guarded on the status that was READ, so a lead somebody moves while
      // this runs is skipped rather than dragged back.
      const res = await query<{ id: string }>(
        `UPDATE freehold_site_leads SET status = $2, updated_at = now()
          WHERE id = $1 AND status IS NOT DISTINCT FROM $3 RETURNING id`,
        [m.id, m.to, m.from || null],
      )
      if (res.length === 0) continue
      moved++
      // A status that changed with no entry beside it is a lead that moved by
      // itself — the thing nobody can explain six weeks later.
      await query(
        `INSERT INTO freehold_site_lead_activity (id, lead_id, activity_type, description, created_by)
         VALUES ($1, $2, 'stage', $3, $4)`,
        [
          crypto.randomUUID(), m.id,
          `Stage changed to ${m.to} — derived from the existing rating of ${m.rating}/10`,
          user.email || 'system',
        ],
      ).catch(() => { /* the move is the point; a missing note shows as a gap */ })
    } catch { failed++ }
  }
  return { ok: true, plan: { ...plan, moved, failed } }
}
