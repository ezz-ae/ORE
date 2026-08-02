import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { checkRateLimit } from '@/lib/freehold/rate-limit'
import { geminiGenerate, geminiText } from '@/lib/gemini-rest'
import { saveLibraryItem } from '@/lib/freehold/library'
import type { LibraryKind } from '@/lib/freehold/library'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Upload a file into the Drive WITHOUT external blob storage:
//  - image (small)      → stored inline as a data URL (kind: image)
//  - pdf / larger image → text/facts extracted via Gemini, saved as a report
//  - txt / md / csv      → text stored directly (kind: note)
//  - other binaries      → honest reject with a "export to PDF/CSV" hint
//
// POST { name, mimeType, data: base64, folder? } → { item } | { error }
export async function POST(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res

  const rl = await checkRateLimit(`drive-upload:${auth.user.email}`, { limit: 20, windowSec: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'Too many uploads — slow down a moment.' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } })

  const body = await req.json().catch(() => ({})) as { name?: string; mimeType?: string; data?: string; text?: string; folder?: string }
  const name = String(body.name ?? '').trim().slice(0, 160) || 'Upload'
  const mimeType = String(body.mimeType ?? '')
  const folder = body.folder?.trim() ? body.folder.trim().slice(0, 80) : null

  // 1 — plain text sent directly (client already read it): store as a note.
  if (typeof body.text === 'string' && body.text.trim()) {
    const item = await saveLibraryItem(auth.user.email, { kind: 'note', title: name, content: body.text.slice(0, 100_000), folder })
    return item ? NextResponse.json({ item }, { status: 201 }) : NextResponse.json({ error: 'Could not save' }, { status: 500 })
  }

  const base64 = String(body.data ?? '')
  if (!base64) return NextResponse.json({ error: 'No file data' }, { status: 400 })
  // ~16.5MB base64 (~12MB file) — brochures are large; still within Gemini's
  // inline-extraction request ceiling.
  if (base64.length > 16_500_000) return NextResponse.json({ error: 'File too large (12MB max).' }, { status: 413 })

  const isImage = mimeType.startsWith('image/')
  const isPdf = mimeType === 'application/pdf' || /\.pdf$/i.test(name)

  // 2 — small image → inline data URL, kind: image (renders as a thumbnail).
  if (isImage && base64.length < 1_400_000) {
    const item = await saveLibraryItem(auth.user.email, { kind: 'image', title: name, url: `data:${mimeType};base64,${base64}`, folder })
    return item ? NextResponse.json({ item }, { status: 201 }) : NextResponse.json({ error: 'Could not save' }, { status: 500 })
  }

  // 3 — pdf / large image → extract with Gemini, save the text as a report.
  if (isPdf || isImage) {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'AI text extraction needs the AI key — set it under Integrations → AI, or upload a .txt/.csv.' }, { status: 503 })
    const instruction = isPdf
      ? 'This is a real-estate document (brochure, fact sheet or contract). Extract ALL readable text and key facts faithfully — project, developer, prices, payment plan, unit types, dates, amenities. Plain text, preserve structure, invent nothing.'
      : 'Describe this image and transcribe any text on it faithfully. Plain text, invent nothing.'
    try {
      const resp = await geminiGenerate(apiKey, [{ role: 'user', parts: [{ inlineData: { mimeType, data: base64 } }, { text: instruction }] }], { temperature: 0.1, maxOutputTokens: 4096 })
      const text = geminiText(resp)
      if (!text) return NextResponse.json({ error: 'Could not read the file — try another format.' }, { status: 502 })
      const item = await saveLibraryItem(auth.user.email, { kind: 'report' as LibraryKind, title: name, content: text.slice(0, 100_000), folder })
      return item ? NextResponse.json({ item }, { status: 201 }) : NextResponse.json({ error: 'Could not save' }, { status: 500 })
    } catch {
      return NextResponse.json({ error: 'Extraction failed — try again or upload a .txt/.csv.' }, { status: 502 })
    }
  }

  // 4 — Word/Excel/other binaries can't be read without a parser. Honest.
  return NextResponse.json(
    { error: 'This file type can’t be read directly. Export it to PDF (documents) or CSV (spreadsheets) and upload that.' },
    { status: 415 },
  )
}
