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

// FAIL-CLOSED API auth. Every /api/* route requires a valid Freehold session
// EXCEPT the explicit public allowlist below — new routes are private by
// default, the only safe direction for a system that will soon hold real ad
// budgets and lead PII. Secret/signature-gated machine endpoints (cron,
// bootstrap, webhook) are allowlisted here and verify their own secret in-handler.
const PUBLIC_API_EXACT = new Set([
  "/api/health",
  "/api/markets",
  "/api/intelligence-block",
  "/api/embed",
  "/api/lp-analytics",          // anonymous landing-page analytics ingestion
  "/api/leads",                 // public landing-page lead capture (POST)
  "/api/auth/login",
  "/api/auth/request-reset",
  "/api/auth/reset",
  "/api/auth/bootstrap-admin",  // setup-key-gated in handler
  "/api/server/login",
  "/api/server/logout",
  "/api/whatsapp/webhook",      // Meta HMAC-signature-gated in handler
])
const PUBLIC_API_PREFIXES = [
  "/api/freehold/public/",      // public catalogue (projects, areas, developers, search)
  "/api/market-score/",         // public market pulse
  "/api/pdf/",                  // public brochure download + lead capture
  "/api/cron/",                 // CRON_SECRET-gated in handler
]

// Roles allowed to spend ad budget / read lead-form PII (marketing + management).
const ADS_ROLES = new Set<string>([...MANAGEMENT_ROLES, "marketing"])

export async function proxy(request: NextRequest) {
  const url = request.nextUrl.clone()
  const hostname = request.headers.get("host") || ""
  const { pathname } = url

  // ── Fail-closed session auth for every /api route (public allowlist only) ──
  // MUST run before any host-based short-circuit below (e.g. the crm. subdomain
  // branch) so no Host header can skip the check. New routes are private by
  // default; secret/signature-gated machine endpoints verify their own secret.
  if (pathname.startsWith("/api/")) {
    const isPublic =
      PUBLIC_API_EXACT.has(pathname) ||
      PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))
    if (!isPublic) {
      const token = request.cookies.get(SESSION_COOKIE)?.value
      const user = await verifySession(token)
      if (!user) {
        return NextResponse.json({ error: "Authentication required." }, { status: 401 })
      }
      // Ad spend + lead PII: launching/editing campaigns (any write to
      // /api/meta|google/*) and reading Meta lead-form data must be gated to
      // marketing + management. Brokers keep GET access (view their campaigns).
      const adsScope = pathname.startsWith("/api/meta/") || pathname.startsWith("/api/google/")
      const isWrite = !["GET", "HEAD", "OPTIONS"].includes(request.method)
      const isLeadPII = pathname.startsWith("/api/meta/forms/")
      if (adsScope && (isWrite || isLeadPII) && !ADS_ROLES.has(user.role)) {
        return NextResponse.json({ error: "Insufficient role for ad operations." }, { status: 403 })
      }
    }
  }

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
