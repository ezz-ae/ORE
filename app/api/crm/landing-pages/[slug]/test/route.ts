import { NextRequest, NextResponse } from "next/server"
import { getSessionUser, isAdminRole } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type CheckStatus = "pass" | "warn" | "fail"
type Check = { id: string; label: string; status: CheckStatus; detail: string }

// A landing-page pre-flight: fetch the live /lp/<slug> and run real checks on
// the returned HTML + response. No score is invented — every result comes from
// the actual page bytes, so a "pass" means the marker is really there.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  if (!isAdminRole(user.role)) return NextResponse.json({ error: "Admins only." }, { status: 403 })

  const { slug } = await params
  const origin = req.nextUrl.origin
  const url = `${origin}/lp/${encodeURIComponent(slug)}`

  const checks: Check[] = []
  let html = ""
  let status = 0
  let ms = 0

  const started = Date.now()
  try {
    const res = await fetch(url, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(15000) })
    ms = Date.now() - started
    status = res.status
    html = await res.text()
  } catch (err) {
    ms = Date.now() - started
    const detail = err instanceof Error && err.name === "TimeoutError" ? "Request timed out after 15s" : "Could not reach the page"
    return NextResponse.json({
      ok: false,
      url,
      checks: [{ id: "reachable", label: "Page reachable", status: "fail", detail }],
    })
  }

  const has = (re: RegExp) => re.test(html)
  const push = (id: string, label: string, ok: boolean, okDetail: string, badDetail: string, softFail = true) =>
    checks.push({ id, label, status: ok ? "pass" : softFail ? "warn" : "fail", detail: ok ? okDetail : badDetail })

  // 1 — reachable
  checks.push({
    id: "reachable",
    label: "Page reachable",
    status: status === 200 ? "pass" : "fail",
    detail: status === 200 ? `HTTP ${status}` : `HTTP ${status} — the page did not return OK`,
  })

  // 2 — load time (server → server, indicative)
  checks.push({
    id: "speed",
    label: "Response time",
    status: ms < 2500 ? "pass" : ms < 5000 ? "warn" : "fail",
    detail: `${ms} ms to first byte`,
  })

  // 3 — secure transport
  checks.push({
    id: "https",
    label: "Secure (HTTPS)",
    status: req.nextUrl.protocol === "https:" ? "pass" : "warn",
    detail: req.nextUrl.protocol === "https:" ? "Served over HTTPS" : "Not HTTPS in this environment — production serves over HTTPS",
  })

  // 4 — SEO title
  const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || "").trim()
  push("title", "Page title", title.length > 0, `"${title.slice(0, 60)}"`, "No <title> — set an SEO title", false)

  // 5 — meta description
  const desc = html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1]?.trim() || ""
  push("description", "Meta description", desc.length > 0, `${desc.length} chars`, "No meta description — add one for search + link previews")

  // 6 — mobile viewport
  push("viewport", "Mobile viewport", has(/<meta[^>]+name=["']viewport["']/i), "Responsive viewport set", "No viewport meta — the page won't scale on phones", false)

  // 7 — social preview image
  push("ogimage", "Social preview image", has(/property=["']og:image["']/i), "og:image present", "No og:image — shared links won't show a thumbnail")

  // 8 — WhatsApp
  push("whatsapp", "WhatsApp contact", has(/wa\.me\/|whatsapp/i), "WhatsApp link found", "No WhatsApp link — buyers can't chat instantly")

  // 9 — lead capture
  push("leadform", "Lead capture", has(/<form|data-lead-form|leadform/i), "Lead form present", "No lead form detected — visitors can't submit interest", false)

  // 10 — privacy policy (Meta lead ads require one)
  push("privacy", "Privacy policy link", has(/privacy/i), "Privacy reference found", "No privacy policy link — Meta lead ads require one")

  // 11 — hero imagery
  push("hero", "Hero imagery", has(/<img|background-image|url\(/i), "Imagery present", "No images detected — the page may look empty")

  const failed = checks.filter((c) => c.status === "fail").length
  const warned = checks.filter((c) => c.status === "warn").length
  return NextResponse.json({
    ok: failed === 0,
    url,
    passed: checks.length - failed - warned,
    warned,
    failed,
    checks,
  })
}
