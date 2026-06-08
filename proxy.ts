import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'

const marketPublicGuideRoutes = new Set(["areas", "financing", "golden-visa", "regulations", "trends", "why-dubai"])

export async function proxy(request: NextRequest) {
  const url = request.nextUrl.clone()
  const hostname = request.headers.get("host") || ""
  const { pathname } = url

  // ── Market routing ────────────────────────────────────────────────────────
  if (pathname === "/market" || pathname.startsWith("/market/")) {
    const [, , segment] = pathname.split("/")
    url.pathname = segment && !marketPublicGuideRoutes.has(segment)
      ? `/freehold-intelligence/apps/market/${segment}`
      : "/freehold-intelligence/apps/market"
    return NextResponse.redirect(url, { status: 307 })
  }

  // ── CRM subdomain redirect ─────────────────────────────────────────────────
  if (hostname.startsWith("crm.")) {
    if (pathname.startsWith("/api")) {
      const res = NextResponse.next()
      res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate")
      return res
    }
    url.hostname = "freeholdproperty.ae"
    url.protocol = "https:"
    if (!pathname.startsWith("/crm")) {
      url.pathname = `/crm${pathname}`
    }
    return NextResponse.redirect(url, { status: 308 })
  }

  // ── Session auth for protected routes ─────────────────────────────────────
  if (pathname.startsWith('/freehold-intelligence')) {
    const token = request.cookies.get(SESSION_COOKIE)?.value
    const user = await verifySession(token)

    if (!user) {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/server'
      loginUrl.search = ''
      return NextResponse.redirect(loginUrl)
    }

    if (pathname.startsWith('/freehold-intelligence/management') && !MANAGEMENT_ROLES.includes(user.role)) {
      const homeUrl = request.nextUrl.clone()
      homeUrl.pathname = user.home
      homeUrl.search = ''
      return NextResponse.redirect(homeUrl)
    }
  }

  const res = NextResponse.next()

  // ── Cache control ──────────────────────────────────────────────────────────
  if (pathname.startsWith("/crm") || pathname.startsWith("/api")) {
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate")
  }

  return res
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|manifest.json).*)",
  ],
}
