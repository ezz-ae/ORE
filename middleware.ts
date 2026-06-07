import { NextResponse, type NextRequest } from 'next/server'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'

/**
 * Server-side route guard. Enforced on the Edge before any page renders, so it
 * cannot be bypassed from the client:
 *   - no / invalid session                      → /server (login)
 *   - /management with insufficient role        → that user's own home
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const token = req.cookies.get(SESSION_COOKIE)?.value
  const user = await verifySession(token)

  if (!user) {
    const url = req.nextUrl.clone()
    url.pathname = '/server'
    url.search = ''
    return NextResponse.redirect(url)
  }

  if (pathname.startsWith('/management') && !MANAGEMENT_ROLES.includes(user.role)) {
    const url = req.nextUrl.clone()
    url.pathname = user.home
    url.search = ''
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/management/:path*', '/freehold-intelligence/:path*'],
}
