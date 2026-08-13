/**
 * MAY THIS LOGIN RUN ADS FROM THIS PAGE — asked before the launch, not by it.
 *
 * The launch that keeps failing:
 *
 *   "The Page you selected is not authorised … error_subcode 1487202"
 *
 * An ad does not run from the ad account, it runs from a Facebook Page, and
 * seeing a Page is a different permission from advertising with it. A login can
 * read a Page's posts, pull its lead forms, show its name in a picker — and
 * still be refused at the moment an ad is created.
 *
 * THE FACT WAS ALREADY IN HAND AND NOBODY ASKED FOR IT. `/me/accounts` returns
 * a `tasks` array per Page, and ADVERTISE (or MANAGE, which contains it) is the
 * exact permission 1487202 is about. `listAccessiblePages` already read it. But:
 *
 *   · the launch route checked only that the posted Page was IN the list, never
 *     what the list said about it;
 *   · the configured Page — the one the wizard uses when nobody picks another,
 *     which is the common case — was appended with canAdvertise hardcoded true;
 *   · so was every Page discovered through a lead form.
 *
 * Three assertions where there was a readable fact, and the result is that the
 * refusal arrives from Meta at the end of the wizard, after the campaign and
 * its ad sets have already been created.
 *
 * THREE STATES, NOT TWO. Meta omits `tasks` entirely for some token scopes, and
 * an omission is not a denial. Blocking a launch on a field we did not receive
 * would stop legitimate campaigns on our own blind spot, so unknown proceeds and
 * lets Meta be the judge — the same position landing-preflight and the permit
 * gate take about missing evidence.
 *
 * Pure + client-safe — no Meta import, no I/O. Runs in `pnpm guards`.
 */

/** Walkable — each renders its own word. */
export const PAGE_ADS_VERDICTS = ['can', 'cannot', 'unknown'] as const
export type PageAdsVerdict = (typeof PAGE_ADS_VERDICTS)[number]

/**
 * The tasks that permit ad creation from a Page.
 *
 * ADVERTISE is the permission itself. MANAGE is full control, which contains
 * it — a Page admin is never refused for want of the narrower grant, and
 * omitting MANAGE here would have blocked the owner of the Page.
 */
export const ADS_TASKS = ['ADVERTISE', 'MANAGE'] as const

/**
 * Read Meta's `tasks` array for one Page.
 *
 * Anything that is not an array of strings is `unknown`: a missing field, a
 * null, a shape we did not expect. An EMPTY array is a real answer, though —
 * Meta returning "this login has no tasks on this Page" is a denial, not a gap.
 */
export function pageAdsVerdict(tasks: unknown): PageAdsVerdict {
  if (!Array.isArray(tasks)) return 'unknown'
  const list = tasks.filter((t): t is string => typeof t === 'string').map((t) => t.toUpperCase())
  if (list.length !== tasks.length) return 'unknown'
  return list.some((t) => (ADS_TASKS as readonly string[]).includes(t)) ? 'can' : 'cannot'
}

/**
 * Does this verdict stop a launch?
 *
 * Only a read denial. `unknown` proceeds — see the header: refusing on a field
 * Meta did not send would block real campaigns over our own blind spot.
 */
export const blocksLaunch = (v: PageAdsVerdict): boolean => v === 'cannot'

/**
 * The sentence shown when a launch is refused for this.
 *
 * Kept here rather than in the route so the refusal, the readiness strip and
 * SUBCODE_ADVICE[1487202] cannot drift into describing the same fault three
 * different ways — the guard asserts they agree on the fix.
 */
export function pageAdsRefusal(pageName: string | null): string {
  const who = pageName ? `“${pageName}”` : 'this Page'
  return `This Meta login cannot run ads from ${who}. Someone with full control of the Page has to give it Ads access in Meta Business Suite → Settings → People (or Partners) — or pick a different Page in the launcher. Nothing was created and no credits were spent.`
}
