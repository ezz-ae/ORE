import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { checkRateLimit } from '@/lib/freehold/rate-limit'
import { geminiGenerate, geminiText } from '@/lib/gemini-rest'
import { brandName } from '@/lib/freehold/brand'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Chat composer ingest — turns non-text input into text the Expert can use.
 * Two REAL modalities (Gemini multimodal; nothing simulated):
 *  - audio: a recorded voice note → exact transcript (EN/AR/RU as spoken).
 *  - image: a browser screenshot (optionally with the user's red marker box
 *    burned in + a note) → a precise description of what's on screen.
 * Honest when no key is configured: { unavailable: true }.
 *
 * POST { kind: 'audio'|'image'|'pdf', data: dataUrl, note?: string } → { text }
 * 'pdf' extracts the key facts from a brochure/fact-sheet so campaign and
 * notebook generation can ground on it.
 */
export async function POST(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res

  const rl = await checkRateLimit(`expert-ingest:${auth.user.email}`, { limit: 20, windowSec: 60 })
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many requests — slow down a moment.' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } })
  }

  const body = await req.json().catch(() => ({})) as { kind?: string; data?: string; note?: string }
  const kind = body.kind === 'audio' || body.kind === 'image' || body.kind === 'pdf' ? body.kind : null
  const dataUrl = typeof body.data === 'string' ? body.data : ''
  // Tolerate media-type PARAMETERS in the header — a MediaRecorder blob is
  // typically `audio/webm;codecs=opus`, so the old strict regex rejected every
  // Chrome/Firefox voice note. Capture the full header, require base64, then
  // forward only the BASE mime (`audio/webm`) which the model accepts.
  const match = dataUrl.match(/^data:([^,]*),(.+)$/)
  const header = match?.[1] ?? ''
  const base64 = match?.[2] ?? ''
  if (!kind || !match || !/;base64$/i.test(header)) {
    return NextResponse.json({ error: 'kind and a base64 data URL are required' }, { status: 400 })
  }
  const mimeType = header.replace(/;base64$/i, '').split(';')[0].trim() || 'application/octet-stream'
  // ~8 MB base64 cap — enough for a voice note or a screenshot frame.
  if (base64.length > 8_000_000) return NextResponse.json({ error: 'File too large (8MB max).' }, { status: 413 })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ unavailable: true })

  const note = String(body.note ?? '').trim()
  const instruction = kind === 'audio'
    ? 'Transcribe this voice note EXACTLY as spoken (it may be English, Arabic or Russian — keep the original language). Return ONLY the transcript, no preamble.'
    : kind === 'pdf'
    ? `This is a real-estate brochure or fact sheet. Extract ONLY facts that are explicitly stated: project name, developer, location, unit types and sizes, prices, payment plan, handover date, amenities, and any unique selling points. Plain text, one fact per line, no invention — omit anything not stated.${note ? ` The user says: "${note}".` : ''}`
    : `This is a screenshot of the ${brandName} real-estate marketing app. Describe precisely what is on screen — page/section, visible numbers, statuses, table rows, warnings — so an assistant that cannot see the image can act on it. If a red rectangle marks an area, focus on that area first.${note ? ` The user says: "${note}".` : ''} Be concrete and compact (under 200 words).`

  try {
    const resp = await geminiGenerate(apiKey, [{
      role: 'user',
      parts: [
        { inlineData: { mimeType, data: base64 } },
        { text: instruction },
      ],
    }], { temperature: 0.1, maxOutputTokens: 1024 })
    const text = geminiText(resp)
    if (!text) return NextResponse.json({ error: 'Could not read the input — try again.' }, { status: 502 })
    return NextResponse.json({ text })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Ingest failed' }, { status: 502 })
  }
}
