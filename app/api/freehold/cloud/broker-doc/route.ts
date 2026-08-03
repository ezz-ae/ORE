import { NextRequest, NextResponse } from 'next/server'
import { geminiApiKey } from "@/lib/gemini-rest"
import { put } from '@vercel/blob'
import { requireSession } from '@/lib/freehold/api-auth'
import { checkRateLimit } from '@/lib/freehold/rate-limit'
import { geminiGenerate, geminiText } from '@/lib/gemini-rest'
import { listCloudFiles, recordCloudFile, cloudConfigured, type CloudFile } from '@/lib/freehold/cloud'
import { buildDraftOffer, buildFactSheet, type OfferData } from '@/lib/freehold/broker-pdf'
import { BRAND } from '@/lib/freehold/brand'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Generate a broker document from a Cloud folder's project files and save it
// back into the folder. Today: a DRAFT sales offer (watermarked, non-binding)
// a broker sends to gauge whether a lead is serious.
//
// POST { kind: 'offer', folder?, projectName?, notes? } → { file }

async function extractFacts(file: CloudFile, apiKey: string): Promise<string> {
  try {
    const res = await fetch(file.url)
    if (!res.ok) return ''
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > 4_000_000) return ''
    const resp = await geminiGenerate(apiKey, [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: file.mime || 'application/pdf', data: buf.toString('base64') } },
        { text: 'Extract ONLY facts stated in this real-estate document: project, developer, location/area, unit type & size, price (AED), payment plan (deposit %, monthly amount, on-handover %), handover date, amenities/USPs. One fact per line. Invent nothing.' },
      ],
    }], { temperature: 0.1, maxOutputTokens: 1024 })
    return geminiText(resp).trim()
  } catch { return '' }
}

export async function POST(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res

  const rl = await checkRateLimit(`broker-doc:${auth.user.email}`, { limit: 10, windowSec: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'Slow down a moment.' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } })

  const apiKey = geminiApiKey()
  if (!apiKey) return NextResponse.json({ error: 'Document generation needs the AI key — set it under Integrations → AI.' }, { status: 503 })

  const body = await req.json().catch(() => ({})) as { kind?: string; folder?: string; projectName?: string; notes?: string }
  const kind: 'offer' | 'factsheet' = body.kind === 'factsheet' ? 'factsheet' : 'offer'
  const folder = body.folder?.trim() ? body.folder.trim().slice(0, 80) : null
  const projectName = String(body.projectName ?? '').trim().slice(0, 160)
  const notes = String(body.notes ?? '').trim().slice(0, 1500)

  // Ground on the folder's brochures.
  const files = await listCloudFiles(auth.user.email, folder)
  const pdfs = files.filter((f) => (f.mime || '').includes('pdf') || /\.pdf$/i.test(f.name)).slice(0, 2)
  const factBlocks: string[] = []
  for (const pdf of pdfs) { const facts = await extractFacts(pdf, apiKey); if (facts) factBlocks.push(facts) }

  // Ask the model to structure ONLY real facts into the offer fields.
  const prompt = `From the real-estate facts below, produce a JSON object for a DRAFT sales offer. Use ONLY values explicitly present — for anything missing use "To be confirmed". Do NOT invent prices or dates.
${projectName ? `Project hint: ${projectName}\n` : ''}${notes ? `Broker notes: ${notes}\n` : ''}
Facts:
${factBlocks.join('\n\n') || '(no documents provided — use the project hint/notes only)'}

Return ONLY this JSON (no prose):
{"project":"","developer":"","area":"","unit":"","priceAed":"","deposit":"","monthly":"","onHandover":"","handoverDate":"","highlights":["",""]}`

  let data: OfferData
  try {
    const resp = await geminiGenerate(apiKey, [{ role: 'user', parts: [{ text: prompt }] }], { temperature: 0.2, maxOutputTokens: 1024, responseMimeType: 'application/json' })
    const raw = geminiText(resp).trim()
    const json = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) as Record<string, unknown>
    data = {
      project: String(json.project || projectName || folder || 'Project'),
      developer: json.developer ? String(json.developer) : undefined,
      area: json.area ? String(json.area) : undefined,
      unit: json.unit ? String(json.unit) : undefined,
      priceAed: json.priceAed ? String(json.priceAed) : undefined,
      deposit: json.deposit ? String(json.deposit) : undefined,
      monthly: json.monthly ? String(json.monthly) : undefined,
      onHandover: json.onHandover ? String(json.onHandover) : undefined,
      handoverDate: json.handoverDate ? String(json.handoverDate) : undefined,
      highlights: Array.isArray(json.highlights) ? json.highlights.map(String).filter(Boolean).slice(0, 6) : [],
    }
  } catch {
    // Fall back to a bare offer from the hint so the broker still gets a document.
    data = { project: projectName || folder || 'Project', highlights: [] }
  }

  data.brokerName = auth.user.name || undefined
  data.brokerCompany = BRAND.company

  let pdfBytes: Uint8Array
  try {
    pdfBytes = kind === 'factsheet' ? await buildFactSheet(data) : await buildDraftOffer(data)
  } catch {
    return NextResponse.json({ error: 'Could not build the document — try again.' }, { status: 502 })
  }

  const prefix = kind === 'factsheet' ? 'fact-sheet' : 'draft-offer'
  const label = kind === 'factsheet' ? 'Fact sheet' : 'DRAFT offer'
  let file: CloudFile | null = null
  if (cloudConfigured()) {
    try {
      const safe = (data.project || kind).replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40)
      const blob = await put(`cloud/${prefix}-${safe}.pdf`, Buffer.from(pdfBytes), { access: 'public', contentType: 'application/pdf', addRandomSuffix: true })
      file = await recordCloudFile(auth.user.email, {
        name: `${label} — ${data.project}.pdf`,
        mime: 'application/pdf', url: blob.url, pathname: blob.pathname, size: pdfBytes.length, folder,
      })
    } catch { /* return the doc URL even if recording failed */ }
  }
  if (!file) return NextResponse.json({ error: 'Cloud storage is not configured — set BLOB_READ_WRITE_TOKEN.' }, { status: 503 })

  return NextResponse.json({ file, kind })
}
