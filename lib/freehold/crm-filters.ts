/**
 * THE FILTERS THAT LIVE INSIDE THE SEARCH BOX.
 *
 * "i dont want them to be taking space i want them smart — when user put his
 *  mouse on search to write, this dropdown appear."
 *
 * A CRM grows filter chips the way a desk grows paper. Every one is
 * defensible on the day it ships and the row of them is unreadable by the
 * fifth, so people stop reading and go back to scrolling. The rule here is
 * that a filter costs NO screen until somebody is already looking for
 * something — the search box is where that intent shows up, so the filters
 * hang off it and vanish again.
 *
 * ── GROUPS, AND WHY THE LOGIC BETWEEN THEM DIFFERS ───────────────────────
 *
 * Within a group the filters OR: "today or yesterday" is one question about
 * time, and picking both should widen the answer.
 *
 * Between groups they AND: "Meta" plus "not rated" is two questions, and
 * picking both should narrow it.
 *
 * That is the same rule Meta's own flexible_spec uses, and this product
 * already documents it at lib/freehold/audience-pattern.ts — an operator who
 * has learned it once should not have to learn a second, contradictory
 * version of it in the CRM.
 *
 * ── EVERY TIME FILTER IS THE OPERATION'S TIME ────────────────────────────
 *
 * "Today" computed on UTC boundaries includes four hours of yesterday evening
 * in Dubai and excludes four hours of this morning, so the CRM's count and
 * Ads Manager's count for the same day disagree and neither looks wrong. The
 * bounds come from clock.ts, which is the one place that knows the account's
 * zone. See its dayBounds header for the full reasoning.
 *
 * Pure — the clock is injected as `nowMs`. Runs in `pnpm guards`.
 */
import { dayKey, dayBounds, OPERATION_TZ } from '@/lib/freehold/clock'
import { QUALIFIED_STATUSES, VALUABLE_RATING, AVOID_RATING } from '@/lib/freehold/lead-stages'

/** Walkable — the dropdown's sections, in the order they are shown. */
export const CRM_FILTER_GROUPS = ['when', 'quality', 'source'] as const
export type CrmFilterGroup = (typeof CRM_FILTER_GROUPS)[number]

/** Walkable — every filter. The id is the i18n key suffix and the URL value. */
export const CRM_FILTERS = [
  'today', 'yesterday', 'last7',
  'qualified', 'notRated', 'disqualified', 'junk', 'repeat',
  'meta', 'hubspot', 'landing',
] as const
export type CrmFilterId = (typeof CRM_FILTERS)[number]

/**
 * The subset of a lead this module reads.
 *
 * Declared rather than importing CRMLeadIntelligence so the rules can be
 * tested against small literals instead of a forty-field fixture — and so a
 * change to the CRM's row shape cannot silently change what a filter means.
 */
export interface FilterableLead {
  createdAt?: string
  pipelineStage?: string
  valueRating?: number | null
  blocked?: boolean
  duplicateRisk?: boolean
  wrongNumberRisk?: boolean
  source?: string
  campaignId?: string
  adId?: string
  hubspotLeadId?: string
  landingId?: string
}

export interface CrmFilterDef {
  id: CrmFilterId
  group: CrmFilterGroup
  match: (lead: FilterableLead, nowMs: number, tz?: string) => boolean
}

/** Instant → ms, or null when the row carries no usable date. */
const at = (v?: string): number | null => {
  if (!v) return null
  const ms = Date.parse(v)
  return Number.isFinite(ms) ? ms : null
}

/** Is this lead's arrival inside the local day `offsetDays` back from today? */
const onDay = (lead: FilterableLead, nowMs: number, tz: string, offsetDays: number): boolean => {
  const ms = at(lead.createdAt)
  if (ms === null) return false
  const day = dayKey(nowMs - offsetDays * 86_400_000, tz)
  const { startMs, endMs } = dayBounds(day, tz)
  return ms >= startMs && ms < endMs
}

const rating = (l: FilterableLead): number | null =>
  typeof l.valueRating === 'number' && Number.isFinite(l.valueRating) ? l.valueRating : null

export const CRM_FILTER_DEFS: readonly CrmFilterDef[] = [
  // ── when ────────────────────────────────────────────────────────────────
  { id: 'today', group: 'when', match: (l, now, tz = OPERATION_TZ) => onDay(l, now, tz, 0) },
  { id: 'yesterday', group: 'when', match: (l, now, tz = OPERATION_TZ) => onDay(l, now, tz, 1) },
  {
    id: 'last7', group: 'when',
    // Seven local days INCLUDING today — the window a person means by "this
    // week's leads". Anchored on the day boundary rather than `now - 7d`, so
    // the answer does not change while somebody is looking at it.
    match: (l, now, tz = OPERATION_TZ) => {
      const ms = at(l.createdAt)
      if (ms === null) return false
      const { startMs } = dayBounds(dayKey(now - 6 * 86_400_000, tz), tz)
      const { endMs } = dayBounds(dayKey(now, tz), tz)
      return ms >= startMs && ms < endMs
    },
  },

  // ── quality ─────────────────────────────────────────────────────────────
  {
    id: 'qualified', group: 'quality',
    // EITHER JUDGMENT, exactly as the campaign score counts it: a broker who
    // rated a lead 8 has said it is worth pursuing as surely as somebody who
    // dragged its card. See lib/freehold/campaign-score.ts.
    match: (l) => {
      const r = rating(l)
      return QUALIFIED_STATUSES.has(String(l.pipelineStage ?? ''))
        || (r !== null && r >= VALUABLE_RATING)
    },
  },
  {
    id: 'notRated', group: 'quality',
    // The queue this whole feature exists to make visible: nobody has said
    // what these are worth, so the ad machine is buying blind.
    match: (l) => rating(l) === null,
  },
  {
    id: 'disqualified', group: 'quality',
    // A human looked and said no. Distinct from junk, which is a defect in
    // the record rather than a verdict on the person.
    match: (l) => {
      const r = rating(l)
      return r !== null && r <= AVOID_RATING
    },
  },
  {
    id: 'junk', group: 'quality',
    // Unusable rather than unwanted: blocked, or a number that cannot be
    // dialled.
    //
    // A REPEAT IS NOT JUNK. This filter shipped counting duplicateRisk here,
    // which put somebody who registered for a second apartment in the same
    // bucket as a blocked number. The same person coming back is the strongest
    // buying signal a funnel produces — see lib/freehold/repeat-intent.ts, and
    // use the `repeat` filter to find them on purpose.
    match: (l) => l.blocked === true || l.wrongNumberRisk === true,
  },
  {
    id: 'repeat', group: 'quality',
    // Registered more than once. Deliberately its own filter rather than a
    // shade of junk: the question "who came back" is one a sales team asks on
    // purpose, and the answer is a call list.
    match: (l) => l.duplicateRisk === true,
  },

  // ── source ──────────────────────────────────────────────────────────────
  {
    id: 'meta', group: 'source',
    // An id is proof; the source string is a label somebody typed.
    match: (l) => !!l.campaignId || !!l.adId || /meta|facebook|instagram|fb|ig/i.test(String(l.source ?? '')),
  },
  { id: 'hubspot', group: 'source', match: (l) => !!l.hubspotLeadId },
  { id: 'landing', group: 'source', match: (l) => !!l.landingId },
]

const BY_ID = new Map(CRM_FILTER_DEFS.map((f) => [f.id, f]))

export const filtersInGroup = (g: CrmFilterGroup): CrmFilterDef[] =>
  CRM_FILTER_DEFS.filter((f) => f.group === g)

/** Only ids this module actually defines — a stale saved view cannot poison it. */
export const parseFilters = (raw: readonly string[] | undefined): CrmFilterId[] =>
  [...new Set((raw ?? []).filter((v): v is CrmFilterId => BY_ID.has(v as CrmFilterId)))]

/**
 * Does this lead survive the selection?
 *
 * OR within a group, AND between groups — see the header. An empty selection
 * matches everything: no filter is not a filter that excludes.
 */
export function matchesFilters(
  lead: FilterableLead,
  selected: readonly CrmFilterId[],
  nowMs: number,
  tz: string = OPERATION_TZ,
): boolean {
  if (selected.length === 0) return true
  for (const group of CRM_FILTER_GROUPS) {
    const chosen = selected.filter((id) => BY_ID.get(id)?.group === group)
    if (chosen.length === 0) continue
    if (!chosen.some((id) => BY_ID.get(id)!.match(lead, nowMs, tz))) return false
  }
  return true
}

/** How many rows each filter WOULD leave, given what is already chosen.
 *  A count of zero is worth showing — it says "nothing here", which is an
 *  answer, and hiding the option would leave the operator wondering. */
export function filterCounts(
  leads: readonly FilterableLead[],
  selected: readonly CrmFilterId[],
  nowMs: number,
  tz: string = OPERATION_TZ,
): Record<CrmFilterId, number> {
  const out = {} as Record<CrmFilterId, number>
  for (const f of CRM_FILTER_DEFS) {
    const withThis = selected.includes(f.id) ? selected : [...selected, f.id]
    out[f.id] = leads.filter((l) => matchesFilters(l, withThis, nowMs, tz)).length
  }
  return out
}
