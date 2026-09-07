/**
 * CONNECT META THE WAY A BROKER CAN.
 *
 * "i want an easier connection way in meta for a realtor."
 *
 * Today connecting requires pasting an access token, an ad account id and a
 * page id into a form. That is a developer's task described as a settings
 * screen: a brokerage owner has never generated a token, will not find the
 * Graph API Explorer, and the first thing they will do is give up or send you
 * their Facebook password.
 *
 * This is the same connection as a button. They click Connect, approve on
 * Facebook, come back, and pick which ad account and which page.
 *
 * ── ASK FOR THE LEAST THAT WORKS ─────────────────────────────────────────
 *
 * Every scope is a line on the consent screen and a question in App Review.
 * A realtor reading a list of nine permissions closes the tab; a reviewer
 * reading a permission the product never uses rejects the submission. So each
 * one below is named with what breaks without it, and nothing is requested
 * "in case".
 *
 * ── AND THE TOKEN EXPIRES, WHICH IS THE PART THAT BITES ──────────────────
 *
 * The token Facebook hands back at the end of a login lasts about an hour.
 * Exchanged, it lasts about sixty days. Nothing warns you when it dies: the
 * campaigns simply stop being readable, the lead sync stops, and the screens
 * show an error that reads like a bug.
 *
 * So the expiry is stored with the token and treated as a fact about the
 * connection. A connection that will expire in a week is a thing to say out
 * loud while it still works, not an incident to explain afterwards.
 *
 * Pure — no network, no secrets read from the environment here. Runs in
 * `pnpm guards`.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

/** Graph version. Pinned deliberately and in one place: an OAuth flow that
 *  drifts version between the authorize call and the token exchange fails in
 *  a way that reads as "the user declined". */
export const OAUTH_GRAPH_VERSION = 'v20.0'

/**
 * The permissions this product actually uses, and what breaks without each.
 *
 * Deliberately NOT requested: `pages_manage_ads`, `pages_manage_posts`,
 * `instagram_basic`, `public_profile` beyond the default. The product does not
 * post as the page, does not manage page content, and does not read profiles —
 * asking anyway costs a consent line and a review question for nothing.
 */
export const META_SCOPES: ReadonlyArray<{ scope: string; because: string }> = [
  { scope: 'ads_read', because: 'read campaigns, ad sets, ads and their performance' },
  { scope: 'ads_management', because: 'launch, pause and edit — the whole ads machine' },
  { scope: 'business_management', because: 'list the ad accounts and pages this person can actually use' },
  { scope: 'leads_retrieval', because: 'download instant-form leads; without it no lead ever arrives' },
  { scope: 'pages_show_list', because: 'let them choose which page the ads run from' },
  { scope: 'pages_read_engagement', because: 'read the lead forms attached to that page' },
]

export const scopeString = (): string => META_SCOPES.map((s) => s.scope).join(',')

/**
 * The state parameter, signed rather than stored.
 *
 * It has one job — prove the callback belongs to a login this server started,
 * so a third party cannot walk somebody through connecting THEIR ad account to
 * an attacker's tenant. A random value would need server-side storage and a
 * cleanup story; a signed value needs neither and cannot be forged without the
 * app secret.
 *
 * Carries the tenant and an issue time, so a state cannot be replayed a week
 * later against a different workspace.
 */
export function signState(
  payload: { tenant: string; nonce: string; issuedAtMs: number },
  secret: string,
): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const mac = createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${mac}`
}

/** How long a login may take before its state is refused. Ten minutes is long
 *  enough for somebody to read a consent screen and short enough that a state
 *  captured from a browser history is useless. */
export const STATE_TTL_MS = 10 * 60_000

export function verifyState(
  state: string,
  secret: string,
  nowMs: number,
): { ok: true; tenant: string } | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' } {
  const [body, mac] = String(state ?? '').split('.')
  if (!body || !mac) return { ok: false, reason: 'malformed' }

  const expected = createHmac('sha256', secret).update(body).digest('base64url')
  // Compared in constant time. A signature check that returns early on the
  // first wrong byte leaks how much of a guess was right.
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: 'bad_signature' }

  let parsed: { tenant?: unknown; issuedAtMs?: unknown }
  try {
    parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    return { ok: false, reason: 'malformed' }
  }
  const issued = Number(parsed.issuedAtMs)
  if (!Number.isFinite(issued) || nowMs - issued > STATE_TTL_MS || issued > nowMs + 60_000) {
    return { ok: false, reason: 'expired' }
  }
  return { ok: true, tenant: String(parsed.tenant ?? '') }
}

/** Where to send the realtor to approve. */
export function authorizeUrl(input: {
  appId: string
  redirectUri: string
  state: string
}): string {
  const u = new URL(`https://www.facebook.com/${OAUTH_GRAPH_VERSION}/dialog/oauth`)
  u.searchParams.set('client_id', input.appId)
  u.searchParams.set('redirect_uri', input.redirectUri)
  u.searchParams.set('state', input.state)
  u.searchParams.set('scope', scopeString())
  u.searchParams.set('response_type', 'code')
  return u.toString()
}

/**
 * When this connection stops working.
 *
 * Facebook returns `expires_in` seconds. Absent means a token that does not
 * expire (a system user's), and that is recorded as null rather than as a date
 * far in the future — "never" and "in ten years" are different facts and only
 * one of them is true.
 */
export function expiryFrom(expiresInSeconds: unknown, nowMs: number): string | null {
  const n = Number(expiresInSeconds)
  if (!Number.isFinite(n) || n <= 0) return null
  return new Date(nowMs + n * 1000).toISOString()
}

/** Days until a connection dies. Null when it does not expire. */
export function daysUntilExpiry(expiresAt: string | null | undefined, nowMs: number): number | null {
  if (!expiresAt) return null
  const t = Date.parse(expiresAt)
  if (!Number.isFinite(t)) return null
  return Math.floor((t - nowMs) / 86_400_000)
}

/**
 * Say something while it still works.
 *
 * A token dies quietly: campaigns stop being readable, the lead sync stops,
 * and every screen shows an error that reads like a bug in the product. Two
 * weeks is enough notice for somebody to click reconnect between other things.
 */
export const RECONNECT_WARNING_DAYS = 14

export type ConnectionHealth = 'ok' | 'expiring' | 'expired' | 'never_expires'

export function connectionHealth(expiresAt: string | null | undefined, nowMs: number): ConnectionHealth {
  const days = daysUntilExpiry(expiresAt, nowMs)
  if (days === null) return 'never_expires'
  if (days < 0) return 'expired'
  return days <= RECONNECT_WARNING_DAYS ? 'expiring' : 'ok'
}
