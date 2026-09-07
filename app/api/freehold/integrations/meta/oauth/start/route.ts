/**
 * STEP ONE: SEND THE REALTOR TO FACEBOOK.
 *
 * Replaces "paste an access token" with a redirect. Nothing is stored here —
 * the state is signed rather than saved, so a login that is abandoned leaves
 * nothing behind to clean up.
 */
import { NextResponse } from 'next/server'
import { cookies, headers } from 'next/headers'
import { randomUUID } from 'node:crypto'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'
import { authorizeUrl, signState } from '@/lib/freehold/meta-oauth'
import { resolveActiveSchema } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const appId = () => process.env.META_APP_ID ?? process.env.FACEBOOK_APP_ID ?? ''
const appSecret = () => process.env.META_APP_SECRET ?? process.env.FACEBOOK_APP_SECRET ?? ''

/** The callback must match what is registered in the Meta app, exactly. Built
 *  from the request's own host so a preview deployment does not silently send
 *  people to production. */
export async function redirectUri(): Promise<string> {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? ''
  const proto = h.get('x-forwarded-proto') ?? 'https'
  return `${proto}://${host}/api/freehold/integrations/meta/oauth/callback`
}

export async function GET() {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  // Connecting an ad account spends money and reads lead PII. Management only.
  if (!user || !MANAGEMENT_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!appId() || !appSecret()) {
    return NextResponse.json(
      { error: 'Meta app is not configured', detail: 'META_APP_ID and META_APP_SECRET must be set.' },
      { status: 503 },
    )
  }

  const state = signState(
    { tenant: await resolveActiveSchema(), nonce: randomUUID(), issuedAtMs: Date.now() },
    appSecret(),
  )
  return NextResponse.redirect(
    authorizeUrl({ appId: appId(), redirectUri: await redirectUri(), state }),
  )
}
