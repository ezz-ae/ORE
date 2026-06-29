/**
 * Shared API-route auth guard. Server-only (uses next/headers cookies).
 *
 * Usage inside a route handler:
 *   const auth = await requireSession()           // any authenticated user
 *   if ('res' in auth) return auth.res
 *   const auth = await requireSession(MGMT_ROLES) // role-gated
 *   if ('res' in auth) return auth.res
 *   const { user } = auth
 */
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { verifySession, SESSION_COOKIE } from './auth-edge'
import type { Role, SessionUser } from './session-types'

export type SessionResult = { user: SessionUser } | { res: NextResponse }

/**
 * Verify the caller's session. Returns `{ user }` when authorized, or `{ res }`
 * (a 401/403 NextResponse) the caller should return immediately.
 *
 * @param roles optional allow-list; when omitted, any authenticated user passes.
 */
export async function requireSession(roles?: readonly Role[]): Promise<SessionResult> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  const user = await verifySession(token)
  if (!user) return { res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (roles && !roles.includes(user.role)) {
    return { res: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { user }
}
