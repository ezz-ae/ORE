import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'

// Internal command surfaces — pages that must never render for anonymous visitors.
const internalPagePrefixes = [
  "/freehold-intelligence",
  "/ads-studio",
  "/notebook",
  "/cloud",
  "/agent-network",
  "/reports",
  "/settings",
]

// Internal API groups — operational endpoints (ads, messaging, intelligence,
// CRM, finance) that must only be callable with a valid Freehold session.
const internalApiPrefixes = [
  "/api/google/",
  "/api/meta/",
  "/api/whatsapp/",
  "/api/freehold/",
  "/api/freehold-intelligence/",
  "/api/ai/generate-ad",
  "/api/ai/recommend-followup",
  "/api/ai/summarize-lead",
  "/api/ai/ask-notebook",
  "/api/ai/upload-brochure",
]

// Endpoints under the internal prefixes that intentionally serve the public
// site (anonymous visitors) and must stay open.
const publicApiPrefixes = ["/api/freehold/public/"]

// Inbound webhooks authenticate via their own signatures, not session cookies.
const webhookPaths = new Set(["/api/whatsapp/webhook"])

export async function proxy(request: NextRequest) {
  const url = request.nextUrl.clone()
  const hostname = request.headers.get("host") || ""
  const { pathname } = url

  // ── Market routing ────────────────────────────────────────────────────────
  // The legacy /market dashboard was removed. Redirect any old /market* link to
  // the public projects catalogue so inbound bookmarks land on live content
  // instead of a 404.
  if (pathname === "/market" || pathname.startsWith("/market/")) {
    url.pathname = "/projects"
    url.search = ""
    return NextResponse.redirect(url, { status: 308 })
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

  // ── Session auth for internal APIs ─────────────────────────────────────────
  const isInternalApi =
    internalApiPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix)) &&
    !publicApiPrefixes.some((prefix) => pathname.startsWith(prefix)) &&
    !webhookPaths.has(pathname)
  if (isInternalApi) {
    const token = request.cookies.get(SESSION_COOKIE)?.value
    const user = await verifySession(token)
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    }
  }

  // ── Session auth for internal pages ────────────────────────────────────────
  const isInternalPage = internalPagePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
  if (isInternalPage) {
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
