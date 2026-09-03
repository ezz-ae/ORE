/**
 * THE GUARD'S RUNS, WRITTEN DOWN — and the alarm that only fires on news.
 *
 * app/api/cron/targeting-guard/route.ts has a header that says it "stores the
 * run, and raises an alarm only when something needs stopping." It did
 * neither. It ran daily at 06:15, read live Meta, decided one action per
 * campaign — correctly — and returned the result as an HTTP response body.
 *
 * A Vercel cron discards that body. So every morning for as long as this has
 * been deployed, the machine diagnosed the account and told nobody.
 *
 * That is the whole "is this an ads machine or a toy" question in one file.
 * The intelligence was right and unreachable, which is worth exactly as much
 * as being wrong.
 *
 * ── AND A GUARD THAT SHOUTS EVERY MORNING GETS MUTED ─────────────────────
 *
 * The route's own header warns about this: "a muted guard is worse than none."
 * A campaign that is broad today will still be broad tomorrow, so alerting on
 * STATE means the same alarm every day until somebody fixes it — which is how
 * a person learns to swipe it away, and then the new one arrives into a
 * channel they have already stopped reading.
 *
 * So the alarm fires on CHANGE: a campaign that has newly become a stop, or a
 * run that has newly gone quiet. `newStops` compares this run's stop set with
 * the last one, and an unchanged problem is recorded without a notification.
 * The record is always written; the interruption is earned.
 *
 * Pure — the previous run is passed in, not read. Runs in `pnpm guards`.
 */

export interface GuardStop {
  campaignId: string
  name: string
  key: string
}

export interface GuardRunSummary {
  checked: number
  stops: GuardStop[]
  alarm: boolean
}

/**
 * The stops in `now` that were not stops in `before`.
 *
 * Keyed on campaign AND reason: a campaign that was stopped for going broad
 * and is now stopped for a dead targeting signal is a NEW thing to say. The
 * same campaign for the same reason is yesterday's news and stays silent.
 */
export function newStops(now: readonly GuardStop[], before: readonly GuardStop[]): GuardStop[] {
  const seen = new Set(before.map((s) => `${s.campaignId}:${s.key}`))
  return now.filter((s) => !seen.has(`${s.campaignId}:${s.key}`))
}

/** Stops that were there and are gone — worth saying once, because it is the
 *  only signal that acting on the alarm did anything. */
export function clearedStops(now: readonly GuardStop[], before: readonly GuardStop[]): GuardStop[] {
  const seen = new Set(now.map((s) => `${s.campaignId}:${s.key}`))
  return before.filter((s) => !seen.has(`${s.campaignId}:${s.key}`))
}

/**
 * Does this run interrupt somebody?
 *
 * Only news does. Note what is deliberately NOT here: the number of stops.
 * Three unchanged stops are not three times as urgent as one unchanged stop;
 * they are the same unread message, and sending it again is how it stops
 * being read.
 */
export function shouldNotify(now: readonly GuardStop[], before: readonly GuardStop[]): boolean {
  return newStops(now, before).length > 0
}
