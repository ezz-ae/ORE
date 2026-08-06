/**
 * WHAT A META ERROR ACTUALLY MEANS, AND WHAT IT DOES NOT.
 *
 * The Lead Machine hub opened on eight red alarms reading:
 *
 *   Insights read failed for Advantage Broad: Unsupported get request. Object
 *   with ID '120246739739770436' does not exist, cannot be loaded due to
 *   missing permissions, or does not support this operation. — subcode 33
 *
 * Two campaigns, four cycles, the same permanent failure re-logged every time.
 * "NEEDS YOU (8)" was really "needs you (2)", and the six duplicates pushed
 * every other alarm off the screen.
 *
 * THE TRAP IN SUBCODE 33 IS THAT IT IS THREE ANSWERS IN ONE. Meta's own text
 * says so: does not exist, OR missing permissions, OR unsupported operation.
 * The tempting move is to read "does not exist" and mark the campaign deleted
 * — and that is wrong, because a token that lost `ads_read`, or an ad account
 * that changed hands, produces the identical error on a campaign that is alive
 * and spending. Stopping it would be destructive on a guess.
 *
 * So this module classifies only what can be known, and the caller acts only
 * on what the classification supports:
 *
 *   · `unreachable` — we cannot read it and CANNOT TELL WHY. Report once, keep
 *     tracking, change nothing.
 *   · `auth`        — the token itself is rejected. Nothing will work until a
 *     human reconnects, so it is worth saying plainly and once.
 *   · `rate_limit`  — will pass on its own. Not an alarm at all.
 *   · `transient`   — everything else; retry is the right response.
 *
 * Pure — takes an error, returns a classification. Runs in `pnpm guards`.
 */

export type MetaErrorKind = 'unreachable' | 'auth' | 'rate_limit' | 'transient'

/** Meta's numeric codes, as documented. Kept named so the mapping below can be
 *  read against the docs rather than trusted. */
const AUTH_CODES = new Set([102, 190, 458, 459, 463, 464, 467])
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613])
/** Permission refusals that are NOT a dead token — the app or account simply
 *  is not allowed to do this. Permanent until a human changes something, so
 *  they must not sit in 'transient' being retried forever. */
const PERMISSION_CODES = new Set([10, 200, 272, 294])
/** 100/33 is the "object with ID … does not exist, cannot be loaded due to
 *  missing permissions, or does not support this operation" family. */
const UNREACHABLE_SUBCODES = new Set([33])

interface MetaErrorShape { code?: unknown; error_subcode?: unknown; message?: unknown }

/** Errors reach here in several shapes — a thrown Error whose message is the
 *  serialised Graph response, an axios-ish body, or the raw Graph payload. */
function extract(err: unknown): { code: number | null; subcode: number | null; message: string } {
  if (err === null || err === undefined) return { code: null, subcode: null, message: '' }

  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : ''
  let holder: MetaErrorShape | null = null

  if (typeof err === 'object') {
    const o = err as Record<string, unknown>
    const nested = (o.error ?? (o.response as Record<string, unknown> | undefined)?.error) as MetaErrorShape | undefined
    holder = nested ?? (o as MetaErrorShape)
  }

  const num = (v: unknown): number | null => {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }

  let code = holder ? num(holder.code) : null
  let subcode = holder ? num(holder.error_subcode) : null
  const text = [message, holder && typeof holder.message === 'string' ? holder.message : '']
    .filter(Boolean).join(' ')

  // A message that carries the Graph JSON inline is common when the client
  // stringifies the response into an Error. Read the codes back out of it
  // rather than falling through to 'transient' and retrying forever.
  if (code === null || subcode === null) {
    const c = /"code"\s*:\s*(\d+)/.exec(text)
    const s = /(?:"error_subcode"\s*:\s*|subcode\s+)(\d+)/.exec(text)
    if (code === null && c) code = Number(c[1])
    if (subcode === null && s) subcode = Number(s[1])
  }

  return { code, subcode, message: text }
}

export function metaErrorKind(err: unknown): MetaErrorKind {
  const { code, subcode, message } = extract(err)

  if (code !== null && RATE_LIMIT_CODES.has(code)) return 'rate_limit'
  if (code !== null && AUTH_CODES.has(code)) return 'auth'
  if (code !== null && PERMISSION_CODES.has(code)) return 'unreachable'
  if (subcode !== null && UNREACHABLE_SUBCODES.has(subcode)) return 'unreachable'

  // Text fallback, for clients that drop the numeric fields. Deliberately
  // narrow: matching "permission" alone would swallow genuine auth failures
  // into the softer bucket and stop them ever being surfaced.
  const lower = message.toLowerCase()
  if (/rate limit|too many calls|request limit reached/.test(lower)) return 'rate_limit'
  if (/access token|session has expired|not authenticated|oauth/.test(lower)) return 'auth'
  if (/does not exist|unsupported get request|cannot be loaded/.test(lower)) return 'unreachable'
  return 'transient'
}

/** Should a human be told, or will this resolve itself? */
export const isWorthAlarming = (k: MetaErrorKind): boolean => k === 'unreachable' || k === 'auth'

/**
 * What to put in front of an operator.
 *
 * Meta's raw string is three hypotheses, an object id and a documentation URL,
 * and it is repeated verbatim on the hub today. None of that tells anyone what
 * to do. This says what we know, admits what we cannot tell apart, and names
 * the one place a person can go to check.
 */
export function explainMetaError(kind: MetaErrorKind, subject: string): string {
  switch (kind) {
    case 'unreachable':
      return `${subject} can no longer be read from Meta. Either it was deleted in Ads Manager, or the connected account lost access to it — the error Meta returns is the same for both, so this cannot be told apart from here. Nothing has been changed or stopped. Check it in Ads Manager, or reconnect Meta under Integrations.`
    case 'auth':
      return `Meta is rejecting the connection itself, so nothing can be read or launched until it is reconnected under Integrations. No campaign has been changed.`
    case 'rate_limit':
      return `${subject} was not read because Meta is rate-limiting us. It will be read on the next cycle.`
    default:
      return `${subject} could not be read from Meta this cycle. It will be retried.`
  }
}
