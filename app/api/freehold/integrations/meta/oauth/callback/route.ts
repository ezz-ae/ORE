/**
 * STEP TWO: TAKE THE CODE, KEEP A TOKEN THAT LASTS.
 *
 * Facebook returns a code and a state. The code becomes a token that expires
 * in about an hour, which is useless for a system that reads campaigns every
 * morning — so it is immediately exchanged for the long-lived one (~60 days)
 * and the expiry is stored alongside it.
 *
 * THE EXPIRY IS THE POINT. A token that dies quietly takes the campaigns, the
 * lead sync and every ads screen with it, and every one of those failures
 * reads like a bug in the product rather than an expired login. Recorded, it
 * becomes a sentence somebody can act on two weeks early.
 *
 * The ad account and page are NOT chosen here. A realtor may have several of
 * each, and picking one for them is how a campaign ends up on the wrong
 * account. The token is stored, and they choose next.
 */
import { NextResponse } from 'next/server'
import { cookies, headers } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'
import { verifyState, expiryFrom, OAUTH_GRAPH_VERSION } from '@/lib/freehold/meta-oauth'
import { getStoredMetaCreds, setStoredMetaCreds } from '@/lib/freehold/integration-credentials'
import { resolveActiveSchema } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const appId = () => process.env.META_APP_ID ?? process.env.FACEBOOK_APP_ID ?? ''
const appSecret = () => process.env.META_APP_SECRET ?? process.env.FACEBOOK_APP_SECRET ?? ''

const back = (url: URL, status: string) => {
  const to = new URL('/freehold-intelligence/integrations/meta', url.origin)
  to.searchParams.set('meta', status)
  return NextResponse.redirect(to)
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user || !MANAGEMENT_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // The realtor pressed Cancel, or Facebook refused. Not an error to log at
  // severity — it is a person changing their mind.
  if (url.searchParams.get('error')) return back(url, 'cancelled')

  const code = url.searchParams.get('code') ?? ''
  const state = url.searchParams.get('state') ?? ''
  if (!code || !state) return back(url, 'invalid')

  // PROVES THIS CALLBACK BELONGS TO A LOGIN THIS SERVER STARTED. Without it,
  // somebody could walk a realtor through connecting their ad account to
  // another workspace, and the connection would look entirely normal.
  const checked = verifyState(state, appSecret(), Date.now())
  if (!checked.ok) return back(url, `state_${checked.reason}`)
  if (checked.tenant !== (await resolveActiveSchema())) return back(url, 'state_wrong_tenant')

  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? ''
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const redirect_uri = `${proto}://${host}/api/freehold/integrations/meta/oauth/callback`

  try {
    // Code → short-lived token (about an hour).
    const shortUrl = new URL(`https://graph.facebook.com/${OAUTH_GRAPH_VERSION}/oauth/access_token`)
    shortUrl.searchParams.set('client_id', appId())
    shortUrl.searchParams.set('client_secret', appSecret())
    shortUrl.searchParams.set('redirect_uri', redirect_uri)
    shortUrl.searchParams.set('code', code)
    const shortRes = await fetch(shortUrl, { signal: AbortSignal.timeout(10_000) })
    const short = await shortRes.json() as { access_token?: string }
    if (!shortRes.ok || !short.access_token) return back(url, 'exchange_failed')

    // Short-lived → long-lived (about sixty days). Skipping this is the bug
    // that looks like it worked: everything is fine for an hour.
    const longUrl = new URL(`https://graph.facebook.com/${OAUTH_GRAPH_VERSION}/oauth/access_token`)
    longUrl.searchParams.set('grant_type', 'fb_exchange_token')
    longUrl.searchParams.set('client_id', appId())
    longUrl.searchParams.set('client_secret', appSecret())
    longUrl.searchParams.set('fb_exchange_token', short.access_token)
    const longRes = await fetch(longUrl, { signal: AbortSignal.timeout(10_000) })
    const long = await longRes.json() as { access_token?: string; expires_in?: number }
    if (!longRes.ok || !long.access_token) return back(url, 'exchange_failed')

    // Whatever was already chosen is kept: a reconnect refreshes the token,
    // it does not silently un-pick somebody's ad account, page or dataset.
    const existing = await getStoredMetaCreds().catch(() => null)
    await setStoredMetaCreds({
      accessToken: long.access_token,
      adAccountId: existing?.adAccountId ?? '',
      pageId: existing?.pageId ?? '',
      pixelId: existing?.pixelId ?? null,
      crmDatasetId: existing?.crmDatasetId ?? null,
      tokenExpiresAt: expiryFrom(long.expires_in, Date.now()),
    }, user.email)

    // Already set up: this was a reconnect, so go back finished. Otherwise the
    // realtor still has to choose an ad account and a page.
    return back(url, existing?.adAccountId && existing?.pageId ? 'reconnected' : 'choose')
  } catch {
    return back(url, 'exchange_failed')
  }
}
