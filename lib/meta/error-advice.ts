/**
 * WHAT META'S ERROR MEANS, IN WORDS THE PERSON READING IT CAN ACT ON.
 *
 * Every failed launch this month reached the operator as Meta's own text:
 *
 *   "Invalid parameter — Interests with ID 6002714398372 is invalid.
 *    — subcode 1487079"
 *   "Facebook Stories Placement Not Allowed Alone — subcode 1815891"
 *   "Parameter label cannot be specified for non-custom questions
 *    — subcode 1892063"
 *
 * Each one is a real, specific fault with a real, specific fix, and each one
 * was read by a broker who then phoned someone to ask whether the system was
 * broken. The subcode is the most useful thing in the string and the least
 * readable, and Meta's wording describes its own API rather than the thing the
 * person was trying to do.
 *
 * So: a known fault gets one plain sentence and, where there is one, the
 * button to press. An unknown fault keeps Meta's own words untouched —
 * inventing an explanation for an error we have not seen would be worse than
 * the raw text, because it would be confidently wrong.
 *
 * Pure + client-safe — no Meta or DB imports, so a page can run it on an error
 * string it got from an API route.
 */

/**
 * Faults keyed by Meta's error_subcode — the only part of a Graph error that
 * identifies the fault exactly. Every entry here is one this account has
 * actually produced; none are guessed from documentation.
 */
export const SUBCODE_ADVICE: Record<number, string> = {
  // The app that issued the token is still in Development Mode.
  1885183:
    'Your Meta developer app is in Development Mode, so Meta blocks live ad creation. In developers.facebook.com open the app that issued your access token, complete Settings → Basic (privacy policy URL), switch the app to Live, then launch again.',
  // The token cannot act for the Page the ads run from.
  1341012:
    'The connected login cannot use this Facebook Page. In Business Settings, add the Page to the same Business as the ad account and give the connected person an Admin or Advertiser role on it, then reconnect under Integrations → Meta Ads.',
  // An interest id that no longer exists. Launches now re-resolve every
  // interest by name first, so reaching this means a name Meta dropped too.
  1487079:
    'One of the interests in this audience is not available at Meta any more. Open the audience, press Check now, and launch again.',
  // Facebook Stories cannot be the only placement in an ad set.
  1815891:
    'Facebook Stories cannot run on its own. Add Facebook Feed or Instagram Stories to this ad, or remove Facebook Stories.',
  // Meta writes the wording for prefill questions itself.
  1892063:
    'Meta writes the wording for name, email and phone itself. Remove the custom wording from those questions and keep it only on your own questions.',
  // Meta removed the umbrella creative-enhancements switch.
  3858504:
    'Meta changed how creative options are sent. This one is on us, not on your setup — send us this message and we will update it.',
}

/** Blockers that stop reads, keyed by top-level Graph code. */
export const CODE_ADVICE: Record<number, string> = {
  200:
    'Meta is refusing to share this ad account’s data: the account has not granted the connected login permission to read or manage its ads. In business.facebook.com → Business Settings → Users, pick the person who connected Meta, open Assigned assets → Ad accounts, add this ad account and tick "Manage campaigns". Then reconnect under Integrations → Meta Ads.',
  190:
    'The connected Meta login has expired. Reconnect under Integrations → Meta Ads.',
  10:
    'Meta denied this action for the connected login — a permission it needs is missing. Check the login’s asset access in Business Settings, then reconnect under Integrations → Meta Ads.',
  4:
    'Meta is rate-limiting this ad account right now — too many requests in a short window. Nothing is broken; wait a few minutes and try again.',
  17:
    'Meta is rate-limiting the connected login right now — too many requests in a short window. Nothing is broken; wait a few minutes and try again.',
}

/**
 * Faults Meta describes only in prose. Matched on wording because the codes
 * are shared with a dozen unrelated problems — 100 in particular is Meta's
 * catch-all for "some parameter is wrong".
 */
const MESSAGE_ADVICE: Array<{ test: RegExp; advice: string }> = [
  {
    // Meta's shrug. It is genuinely uninformative, so the honest answer says
    // that plainly instead of dressing it up as a diagnosis.
    test: /an unknown error (has )?occurred/i,
    advice: 'Meta refused this without saying why. Try once more in a minute — if it happens again, send us a screenshot and we will take it from there.',
  },
  {
    test: /minimum budget|budget.*(is )?too low|daily budget must/i,
    advice: 'The daily budget is below Meta’s minimum for this country. Raise it and launch again.',
  },
  {
    test: /permit|trakheesi/i,
    advice: 'Meta rejected the ad text over the permit number. Check the permit is current and written exactly as issued.',
  },
]

/**
 * The sentence to show for a Meta failure, or null when Meta's own text is
 * already the clearest thing available.
 *
 * `message` is matched too, so a page holding nothing but the error string
 * from an API route gets the same answer the server would give.
 */
export function explainMetaError(input: {
  message?: string | null
  code?: number | null
  subcode?: number | null
}): string | null {
  const { message, code, subcode } = input
  if (subcode && SUBCODE_ADVICE[subcode]) return SUBCODE_ADVICE[subcode]
  if (code && CODE_ADVICE[code]) return CODE_ADVICE[code]
  const msg = String(message ?? '')
  if (!msg) return null
  // A subcode inside an already-formatted string ("… — subcode 1815891"),
  // which is the shape these errors arrive in once they have crossed an API
  // route and lost their structured fields.
  const inline = msg.match(/subcode\s+(\d+)/i)
  if (inline && SUBCODE_ADVICE[Number(inline[1])]) return SUBCODE_ADVICE[Number(inline[1])]
  for (const { test, advice } of MESSAGE_ADVICE) if (test.test(msg)) return advice
  return null
}

/**
 * A launch failure names the step it failed at — "[ad set (Instagram Story)]".
 * That prefix is worth keeping: with four ad sets, WHICH one failed is half
 * the answer. Returned separately so a screen can show it quietly.
 */
export function splitLaunchStep(message: string): { step: string | null; rest: string } {
  const m = message.match(/^\[([^\]]+)\]\s*([\s\S]*)$/)
  return m ? { step: m[1], rest: m[2] } : { step: null, rest: message }
}
