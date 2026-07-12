import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { requireSession } from '@/lib/freehold/api-auth'
import { checkRateLimit } from '@/lib/freehold/rate-limit'
import { MANAGEMENT_ROLES, type Role } from '@/lib/freehold/session-types'
import { genImage } from '@/lib/creative-studio/providers'
import { PRESENTER_PERSONAS } from '@/lib/creative-studio/constants'
import { getSavedPresenters, savePresenterFace, deletePresenterFace, personaById } from '@/lib/creative-studio/presenters'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Reusable presenter faces — generate each persona's face ONCE, reuse across
// every video. GET lists personas + any saved face; POST generates+saves one;
// DELETE resets it. Generating spends real image budget → marketing/management.
const WRITE_ROLES: readonly Role[] = [...MANAGEMENT_ROLES, 'marketing']

export async function GET() {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const saved = await getSavedPresenters()
  const presenters = PRESENTER_PERSONAS.map((p) => ({
    id: p.id, name: p.name, tagline: p.tagline, gender: p.gender, ethnicity: p.ethnicity, ageRange: p.ageRange,
    faceUrl: saved[p.id]?.faceUrl ?? null,
  }))
  return NextResponse.json({ presenters })
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(WRITE_ROLES)
  if ('res' in auth) return auth.res

  const rl = await checkRateLimit(`presenter-gen:${auth.user.email}`, { limit: 6, windowSec: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'Slow down a moment.' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } })

  const body = await req.json().catch(() => ({})) as { personaId?: string; regenerate?: boolean }
  const persona = personaById(String(body.personaId ?? ''))
  if (!persona) return NextResponse.json({ error: 'Unknown presenter' }, { status: 400 })

  // Reuse the saved face unless a regenerate was explicitly requested.
  const saved = await getSavedPresenters()
  if (saved[persona.id] && !body.regenerate) {
    return NextResponse.json({ presenter: { id: persona.id, name: persona.name, faceUrl: saved[persona.id].faceUrl } })
  }

  const prompt = `Professional photorealistic portrait headshot of ${persona.description} Natural studio lighting, plain neutral background, looking straight at camera, head and shoulders, sharp focus, high detail. A consistent character reference for a Dubai real-estate video presenter. No text, no logos, no watermark.`

  let url: string
  try {
    const out = await genImage(prompt, { aspectRatio: '3:4' })
    url = out.url
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Image generation failed' }, { status: 502 })
  }

  // Persist a stable https URL so the face works as a reference everywhere. A
  // data: URL from Google/Gemini is uploaded to Blob; an http URL (fal) is kept.
  let faceUrl = url
  if (url.startsWith('data:') && process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const m = url.match(/^data:([^;]+);base64,(.+)$/)
      if (m) {
        const blob = await put(`presenters/${persona.id}.png`, Buffer.from(m[2], 'base64'), {
          access: 'public', contentType: m[1] || 'image/png', addRandomSuffix: true,
        })
        faceUrl = blob.url
      }
    } catch { /* fall back to the data URL — still reusable via inline reference */ }
  }

  await savePresenterFace(persona.id, faceUrl, prompt, auth.user.email)
  return NextResponse.json({ presenter: { id: persona.id, name: persona.name, faceUrl } })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession(WRITE_ROLES)
  if ('res' in auth) return auth.res
  const personaId = req.nextUrl.searchParams.get('personaId')
  if (!personaId) return NextResponse.json({ error: 'personaId is required' }, { status: 400 })
  const ok = await deletePresenterFace(personaId)
  return NextResponse.json({ ok })
}
