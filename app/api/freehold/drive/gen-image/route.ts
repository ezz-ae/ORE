import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { genImage } from '@/lib/creative-studio/providers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Real AI image for the Drive image editor. With an `imageUrl` (the current
 * canvas as a data: URL) it does an image→image EDIT; without one it generates
 * from text. Uses the same Google provider as Creative Studio (`genImage`) — no
 * new model wiring. Honest: on provider failure the real error message is
 * returned and the editor keeps the user's canvas untouched.
 */
export async function POST(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const body = await req.json().catch(() => ({})) as { prompt?: string; aspectRatio?: string; imageUrl?: string }
  const prompt = String(body.prompt ?? '').trim()
  if (!prompt) return NextResponse.json({ error: 'A prompt is required' }, { status: 400 })
  try {
    const { url, provider } = await genImage(prompt, {
      aspectRatio: typeof body.aspectRatio === 'string' ? body.aspectRatio : undefined,
      imageUrl: typeof body.imageUrl === 'string' ? body.imageUrl : undefined,
    })
    return NextResponse.json({ url, provider })
  } catch (err) {
    let message = err instanceof Error ? err.message : 'Image generation failed'
    // A Google 403 means the key exists but is rejected — say so usefully
    // instead of a bare "Forbidden".
    if (/403|forbidden|permission/i.test(message)) {
      message = 'AI access denied by Google (403) — check GEMINI_API_KEY in the deployment and that the Generative Language API is enabled for that key’s project.'
    }
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
