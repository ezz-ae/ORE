/**
 * ONE CLOCK, SO META AND THIS PRODUCT AGREE ON WHAT DAY IT IS.
 *
 * Meta reports in the AD ACCOUNT's timezone — Asia/Dubai on this account, as
 * the account header says. This product rendered every timestamp with
 * `new Date(iso).toLocaleString(locale, {…})` and no `timeZone`, which means
 * the browser's zone on the client and the SERVER's zone on a server-rendered
 * page. On Vercel that server is UTC.
 *
 * So one lead had three different arrival times depending on where it was
 * read, and none of them was guaranteed to match the time Ads Manager showed
 * for the same lead. A lead that arrived 01:30 Dubai displayed as 21:30 the
 * PREVIOUS DAY to anyone rendering in UTC — wrong hour, wrong day, and
 * therefore wrong in every "leads today" count and every response-time
 * measurement built on top of it.
 *
 * ── THE INSTANT WAS NEVER THE PROBLEM ────────────────────────────────────
 *
 * freehold_site_leads.created_at is `timestamptz` and the sync casts Meta's
 * `created_time` (ISO 8601 with offset) straight into it, so the moment itself
 * is recorded exactly. Nothing has been lost and nothing needs backfilling.
 * What was missing is a single answer to "in which zone do we SAY it".
 *
 * ── AND WHY THIS IS NOT `+4` ─────────────────────────────────────────────
 *
 * Dubai has no daylight saving, so a fixed +4 works — for Dubai. The operation
 * timezone is configurable (NEXT_PUBLIC_BRAND_TIMEZONE) because this product
 * is sold to operators elsewhere, and a hardcoded offset would be silently
 * wrong twice a year for any of them. Intl does the arithmetic instead, which
 * costs nothing and cannot drift.
 *
 * hour-truth.ts keeps its own +4 constant deliberately: it computes an hourly
 * histogram over millions of rows and is documented as Dubai-only.
 */
import { BRAND } from './brand'

/** The zone this operation reports in. Meta's ad account uses the same one. */
export const OPERATION_TZ = BRAND.timezone

/**
 * Format an instant in the operation's zone, always.
 *
 * `timeZone` is applied last and cannot be overridden by the caller — the
 * whole point is that two screens cannot disagree, and an escape hatch is how
 * they start to.
 */
export function formatInstant(
  value: string | number | Date | null | undefined,
  locale: string,
  opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' },
  tz: string = OPERATION_TZ,
): string {
  if (value === null || value === undefined || value === '') return '—'
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat(locale, { ...opts, timeZone: tz }).format(d)
}

/** The calendar day an instant falls on, in the operation's zone: YYYY-MM-DD. */
export function dayKey(
  value: string | number | Date, tz: string = OPERATION_TZ,
): string {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  // 'en-CA' renders ISO-shaped YYYY-MM-DD, which sorts correctly as a string.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d)
}

/** Do these two instants fall on the same local day? */
export const sameDay = (
  a: string | number | Date, b: string | number | Date, tz: string = OPERATION_TZ,
): boolean => dayKey(a, tz) === dayKey(b, tz)

/**
 * The offset of `tz` from UTC, in minutes, at a given instant.
 *
 * Computed by formatting the instant AS IF in the zone and reading the
 * difference — the standard trick, and the only one that stays right across a
 * DST boundary for the operators who have one.
 */
export function offsetMinutes(at: Date, tz: string = OPERATION_TZ): number {
  const asUtc = new Date(at.toLocaleString('en-US', { timeZone: 'UTC' }))
  const asLocal = new Date(at.toLocaleString('en-US', { timeZone: tz }))
  return Math.round((asLocal.getTime() - asUtc.getTime()) / 60_000)
}

/**
 * The UTC millisecond bounds of a local calendar day.
 *
 * This is the half that makes counts agree with Ads Manager. "Leads today"
 * computed on UTC boundaries includes four hours of yesterday evening and
 * excludes four hours of today — so the product's count and Meta's count for
 * the same day differ, and neither is obviously wrong on screen.
 *
 * Returned as [start, end) — end is the first millisecond of the next day, so
 * a `>= start AND < end` comparison needs no off-by-one thinking at the call
 * site.
 */
export function dayBounds(
  day: string, tz: string = OPERATION_TZ,
): { startMs: number; endMs: number } {
  const [y, m, d] = day.split('-').map(Number)
  // Guess at UTC midnight, then correct by the zone's offset at that moment.
  const guess = Date.UTC(y, (m || 1) - 1, d || 1)
  const startMs = guess - offsetMinutes(new Date(guess), tz) * 60_000
  // Re-read the offset at the day's END: a zone that changes offset inside the
  // day would otherwise produce a 23- or 25-hour day measured as 24.
  const endGuess = guess + 86_400_000
  const endMs = endGuess - offsetMinutes(new Date(endGuess), tz) * 60_000
  return { startMs, endMs }
}

/** Today's calendar day in the operation's zone. */
export const today = (nowMs: number, tz: string = OPERATION_TZ): string =>
  dayKey(nowMs, tz)

/**
 * The zone's everyday name — "Asia/Dubai" → "Dubai".
 *
 * Derived from the IANA id rather than hardcoded, so an operator in another
 * city gets their own city's name without anybody editing this file.
 */
export const zoneLabel = (tz: string = OPERATION_TZ): string =>
  (tz.split('/').pop() ?? tz).replace(/_/g, ' ')

/**
 * An instant with its zone said out loud: "17 Aug 2026, 12:32 Dubai time".
 *
 * Used wherever the exact moment is the point — when a lead registered above
 * all. A bare "12:32" is the sentence that started this: it looks precise, it
 * reads as local, and it was silently whichever zone the reader's laptop
 * happened to be in. Naming the zone costs one word and removes the question.
 */
export function formatInstantZoned(
  value: string | number | Date | null | undefined,
  locale: string,
  opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' },
  tz: string = OPERATION_TZ,
): string {
  const shown = formatInstant(value, locale, opts, tz)
  return shown === '—' ? shown : `${shown} ${zoneLabel(tz)} time`
}
