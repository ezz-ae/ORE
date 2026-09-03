/**
 * TWO REGISTRATIONS, ONE PERSON, AND NOTHING THROWN AWAY.
 *
 * "the duplication need to be smartly combined — WE DONT DO REPLACEMENT, we do
 *  MERGE, so we get any new info added to the second registration, it could be
 *  valuable. the lead gets updated with a merged profile and keeps assign or
 *  rates as it was, so the first registration is the base — but it should be
 *  noticed that this lead double registered."
 *
 * What the button called "merge" actually did: PATCH the second record to
 * `status: 'lost'`. It copied NOTHING. Every field the person gave us the
 * second time — an email we never had, a bigger budget, a different tower, the
 * ad that finally moved them — was marked lost and left there.
 *
 * That is the expensive half of a duplicate. The cheap half is the wasted row;
 * the expensive half is the second answer to the same question, which is the
 * only place a change of mind is recorded.
 *
 * ── THE BASE IS THE FIRST REGISTRATION, AND IT IS NEVER OVERWRITTEN ──────
 *
 * A merge that lets the newer record win is a replacement with extra steps,
 * and it silently destroys judgment: the rating a broker gave, the owner the
 * lead was assigned to, the stage it reached. Those belong to the record that
 * has been worked, and the record that has been worked is the first one.
 *
 * So: base values stand. Later registrations may only FILL WHAT IS EMPTY.
 *
 * ── A CONFLICT IS A FACT, NOT A PROBLEM TO RESOLVE ───────────────────────
 *
 * Registered for a 1.2M studio in JVC, then a 3M two-bed in Dubai Hills. The
 * naive merge picks one and loses the other. But the disagreement IS the
 * finding — it is somebody shopping, and this product already has a name for
 * it (repeat-intent's `comparing`, the reading that is a buying signal rather
 * than waste).
 *
 * Conflicts are therefore kept and reported, never silently resolved. The
 * profile shows the base's answer; the merge record shows both.
 *
 * ── AND THE RATING IS NOT INHERITED, IN EITHER DIRECTION ─────────────────
 *
 * A merge must not manufacture a judgment. If the base is unrated and the
 * duplicate was rated 8, the merged lead stays UNRATED — nobody has looked at
 * the combined person. Silently adopting the other row's rating would feed a
 * number into the ad machine that no human ever said about this lead.
 *
 * Pure — no db, no clock of its own. Runs in `pnpm guards`.
 */

/** Fields a later registration is allowed to contribute. Deliberately short:
 *  everything here is something the PERSON told us. Nothing derived, nothing
 *  judged, nothing owned by the team. */
export const MERGEABLE_FIELDS = [
  'email', 'phone', 'name', 'country', 'budget_aed', 'interest',
  'project_slug', 'message',
] as const
export type MergeableField = (typeof MERGEABLE_FIELDS)[number]

/**
 * Fields a merge may NEVER touch, whatever the later record says.
 *
 * These are the team's work, not the buyer's answers. `value_rating` is the
 * ground truth the whole forecast loop is calibrated against, and inventing
 * one by inheritance would poison it at the source. See lib/freehold/
 * lead-forecast.ts for what reads it.
 */
export const NEVER_MERGED = [
  'value_rating', 'assigned_broker_id', 'status', 'priority',
  'last_contact_at', 'snooze_until', 'blocked', 'archived',
] as const

export interface MergeRow {
  id: string
  created_at: string
  [field: string]: unknown
}

export interface MergeFill {
  field: MergeableField
  value: unknown
  /** The registration that supplied it — so the timeline can say where. */
  fromId: string
}

export interface MergeConflict {
  field: MergeableField
  base: unknown
  later: unknown
  fromId: string
}

export interface MergePlan {
  /** The FIRST registration. Everything else merges into this one. */
  baseId: string
  /** The later registrations, oldest first. */
  mergedIds: string[]
  /** How many times this person registered, counting the base. */
  registrations: number
  /** Empty base fields a later registration can fill. */
  fills: MergeFill[]
  /** Both answers kept: the base's stands, the later one is recorded. */
  conflicts: MergeConflict[]
}

/** Is this value worth carrying? Empty string, null, undefined and NaN are
 *  absences; 0 is an answer (a stated budget of 0 is still a statement). */
const present = (v: unknown): boolean => {
  if (v === null || v === undefined) return false
  if (typeof v === 'string') return v.trim() !== ''
  if (typeof v === 'number') return Number.isFinite(v)
  return true
}

const same = (a: unknown, b: unknown): boolean => {
  if (typeof a === 'string' && typeof b === 'string') {
    return a.trim().toLowerCase() === b.trim().toLowerCase()
  }
  return a === b
}

/**
 * Plan the merge of one person's registrations.
 *
 * Takes every row, decides which is the base by arrival, and reports what the
 * later ones add and where they disagree. Decides nothing about ratings,
 * ownership or stage — those are in NEVER_MERGED and are not read here at all.
 *
 * Returns null for fewer than two rows: there is no merge to plan.
 */
export function planMerge(rows: readonly MergeRow[]): MergePlan | null {
  if (rows.length < 2) return null

  // Oldest first. A row with an unparseable date sorts LAST rather than
  // becoming the base by accident — the base decides which rating and which
  // owner survive, so it is never chosen by a NaN.
  const at = (r: MergeRow) => {
    const ms = Date.parse(r.created_at)
    return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY
  }
  const ordered = [...rows].sort((a, b) => at(a) - at(b))
  const [base, ...later] = ordered

  const fills: MergeFill[] = []
  const conflicts: MergeConflict[] = []
  // Tracks what the profile WILL hold, so two later registrations offering
  // the same empty field do not both count as fills — the earlier one wins
  // and the second is read against it like any other disagreement.
  const resolved: Record<string, unknown> = {}
  for (const f of MERGEABLE_FIELDS) resolved[f] = base[f]

  for (const row of later) {
    for (const field of MERGEABLE_FIELDS) {
      const incoming = row[field]
      if (!present(incoming)) continue
      if (!present(resolved[field])) {
        fills.push({ field, value: incoming, fromId: row.id })
        resolved[field] = incoming
        continue
      }
      if (!same(resolved[field], incoming)) {
        conflicts.push({ field, base: resolved[field], later: incoming, fromId: row.id })
      }
    }
  }

  return {
    baseId: base.id,
    mergedIds: later.map((r) => r.id),
    registrations: ordered.length,
    fills,
    conflicts,
  }
}

/** The patch to apply to the base row — only the gaps, never a replacement.
 *  Empty when the later registrations added nothing, and an empty merge is
 *  still a merge: the second registration is recorded either way. */
export function mergePatch(plan: MergePlan): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  for (const f of plan.fills) patch[f.field] = f.value
  return patch
}
