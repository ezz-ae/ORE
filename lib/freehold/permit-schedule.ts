import { normalizePermitExpiry } from '@/lib/freehold/trakheesi'

/**
 * THE AD STOPS WHEN THE PERMIT DOES.
 *
 * trakheesi.ts already states the rule: "an ad that keeps running past that
 * window is as non-compliant as one that never had a permit." The Ads Machine
 * enforces it — on a cron that runs twice a day, so a lapsed permit can keep
 * advertising for up to twelve hours. And the manual launcher enforced nothing
 * at all: a campaign launched from the wizard ran until somebody remembered.
 *
 * Meta can enforce it exactly. An ad set carries an `end_time`, and Meta stops
 * delivery at that instant whether or not anything of ours is awake.
 *
 * THE TIMEZONE TRAP, AND WHY THIS SIDESTEPS IT.
 *
 * Meta reads a bare local timestamp in the AD ACCOUNT's timezone, which we do
 * not read anywhere and cannot assume is Dubai. Sending "2026-08-31 23:59:59"
 * to an account set to Los Angeles would keep a lapsed permit advertising for
 * another eleven hours — the exact direction of error trakheesi.ts warns
 * about, arrived at a different way.
 *
 * So this never sends a wall clock. It sends an ABSOLUTE INSTANT with an
 * explicit +04:00 offset, which means the same moment in every timezone on
 * earth. The account's own timezone becomes irrelevant to the correctness of
 * the stop. (It would matter for hour-of-day scheduling, which we do not do.)
 *
 * Pure — no I/O, no clock of its own.
 */

/** Asia/Dubai. No DST, so a fixed offset is exact all year. */
export const DUBAI_OFFSET = '+04:00'

/**
 * When the ad must stop, for a permit expiring on this date.
 *
 * A permit is valid THROUGH its expiry date, so the ad runs to the last second
 * of that Dubai day and not a moment past it.
 *
 * Returns null when there is no usable expiry on file. Null means "no end" —
 * we do not invent a stop date for a permit whose window we do not know, and
 * we do not quietly let one run forever either: that case is a warning
 * elsewhere, not a fabricated deadline here.
 */
export function adEndTimeForPermit(expiryRaw: unknown): string | null {
  const expiry = normalizePermitExpiry(expiryRaw)
  return expiry ? `${expiry}T23:59:59${DUBAI_OFFSET}` : null
}

/**
 * Is this end time already behind us?
 *
 * Meta rejects an ad set whose end_time is in the past, and it is right to:
 * launching an ad that is already over is not a launch. Checked here so the
 * caller can refuse in plain words instead of forwarding a Graph error.
 */
export function endTimeHasPassed(endTimeIso: string | null, now: Date = new Date()): boolean {
  if (!endTimeIso) return false
  const t = Date.parse(endTimeIso)
  return Number.isFinite(t) && t <= now.getTime()
}
