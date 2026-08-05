import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/freehold/api-auth"
import { MANAGEMENT_ROLES, type Role } from "@/lib/freehold/session-types"
import { genImage } from "@/lib/creative-studio/providers"
import { saveLibraryItem } from "@/lib/freehold/library"

export const runtime = "nodejs"
export const maxDuration = 60

// Generating spends real AI budget — same gate as the Creative Studio UI.
// Must mirror the Creative Suite layout's MOVED_TOOL_ROLES: the ad-designer,
// reel and image/video editors were open to every signed-in role in Drive and
// the move must not tighten access. A narrower list here meant the page
// opened but Generate answered 403 — the literal "Creative Studio forbidden".
const WRITE_ROLES: readonly Role[] = [...MANAGEMENT_ROLES, "marketing", "broker"]

/**
 * Single-image generation for guided flows (Reel Autopilot & friends): one
 * prompt in, a real image out, saved to the Library so it lives in Drive like
 * everything else the user makes. Thin wrapper over the same genImage engine
 * the chat tool and Creative Studio use.
 */
export async function POST(req: NextRequest) {
  const auth = await requireSession(WRITE_ROLES)
  if ("res" in auth) return auth.res
  let body: { prompt?: string; aspectRatio?: string; title?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }
  const prompt = String(body.prompt ?? "").trim()
  if (!prompt) return NextResponse.json({ error: "prompt is required" }, { status: 400 })
  try {
    const out = await genImage(prompt, { aspectRatio: body.aspectRatio ? String(body.aspectRatio) : undefined })
    const item = await saveLibraryItem(auth.user.email, {
      kind: "image",
      title: (body.title || prompt).slice(0, 80),
      url: out.url,
    })
    return NextResponse.json({ url: out.url, provider: out.provider, libraryId: item?.id ?? null })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message.slice(0, 300) : "Image generation failed" },
      { status: 502 },
    )
  }
}
