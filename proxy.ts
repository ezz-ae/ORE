import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone()
  const hostname = request.headers.get("host") || ""
  const { pathname } = url

  // crm.orerealestate.ae → orerealestate.ae/crm
  if (hostname.startsWith("crm.")) {
    // Keep same-origin API calls on crm.* to avoid redirecting fetch/XHR to a different
    // origin (which can break cookies/CORS and method semantics for POST requests).
    if (pathname.startsWith("/api")) {
      const res = NextResponse.next()
      res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate")
      return res
    }

    url.hostname = "orerealestate.ae"
    url.protocol = "https:"
    if (!pathname.startsWith("/crm")) {
      url.pathname = `/crm${pathname}`
    }
    // Preserve method/body semantics for non-GET requests.
    return NextResponse.redirect(url, { status: 308 })
  }

  const res = NextResponse.next()

  // CRM and API: never cache — always fresh from server
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
