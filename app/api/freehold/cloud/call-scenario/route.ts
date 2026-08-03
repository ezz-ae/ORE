import { NextRequest, NextResponse } from 'next/server'
import { geminiApiKey } from "@/lib/gemini-rest"
import { put } from '@vercel/blob'
import { requireSession } from '@/lib/freehold/api-auth'
import { checkRateLimit } from '@/lib/freehold/rate-limit'
import { geminiGenerate, geminiText } from '@/lib/gemini-rest'
import { listCloudFiles, recordCloudFile, cloudConfigured, type CloudFile } from '@/lib/freehold/cloud'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Generate a cold-call script for NEW leads, grounded on the real project files
// a broker dropped in a Cloud folder (brochures, fact sheets). Facts are pulled
// from the folder's PDFs via the AI; the script is saved back INTO the folder
// as a .txt so it lives beside the source material — the broker's prep pack.
//
// POST { folder, projectName?, notes? } → { script, file }

async function extractPdfFacts(file: CloudFile, apiKey: string): Promise<string> {
  try {
    const res = await fetch(file.url)
    if (!res.ok) return ''
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > 4_000_000) return '' // skip oversized brochures — keep the call fast
    const base64 = buf.toString('base64')
    const resp = await geminiGenerate(apiKey, [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: file.mime || 'application/pdf', data: base64 } },
        { text: 'Extract ONLY facts explicitly stated in this real-estate document: project, developer, location, unit types & sizes, prices, payment plan (deposit %, monthly amount, on-handover %), handover date, amenities, USPs. One fact per line. Invent nothing.' },
      ],
    }], { temperature: 0.1, maxOutputTokens: 1024 })
    return geminiText(resp).trim()
  } catch { return '' }
}

export async function POST(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res

  const rl = await checkRateLimit(`call-scenario:${auth.user.email}`, { limit: 10, windowSec: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'Slow down a moment.' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } })

  const apiKey = geminiApiKey()
  if (!apiKey) return NextResponse.json({ error: 'Call-script generation needs the AI key — set it under Integrations → AI.' }, { status: 503 })

  const body = await req.json().catch(() => ({})) as { folder?: string; projectName?: string; notes?: string }
  const folder = body.folder?.trim() ? body.folder.trim().slice(0, 80) : null
  const projectName = String(body.projectName ?? '').trim().slice(0, 160)
  const notes = String(body.notes ?? '').trim().slice(0, 2000)

  // Pull the folder's files; ground on the PDFs (brochures / fact sheets).
  const files = await listCloudFiles(auth.user.email, folder)
  const fileNames = files.map((f) => f.name).slice(0, 40)
  const pdfs = files.filter((f) => (f.mime || '').includes('pdf') || /\.pdf$/i.test(f.name)).slice(0, 2)
  const factBlocks: string[] = []
  for (const pdf of pdfs) {
    const facts = await extractPdfFacts(pdf, apiKey)
    if (facts) factBlocks.push(`From "${pdf.name}":\n${facts}`)
  }

  const grounding = [
    projectName ? `Project: ${projectName}` : '',
    folder ? `Folder: ${folder}` : '',
    fileNames.length ? `Files in folder: ${fileNames.join(', ')}` : '',
    notes ? `Broker notes: ${notes}` : '',
    factBlocks.length ? `\nExtracted facts (use ONLY these numbers — invent nothing):\n${factBlocks.join('\n\n')}` : '',
  ].filter(Boolean).join('\n')

  const prompt = `You are the top-performing phone closer at a Dubai real-estate brokerage. Write a COLD-CALL SCRIPT a broker will use to call a NEW inbound lead about the project below.

${grounding || 'No project files were provided — write a strong generic Dubai off-plan cold-call script.'}

Rules:
- UAE market, English (the broker can localize). Warm, confident, never pushy.
- Use ONLY prices/payment numbers that appear in the extracted facts. If a number isn't given, say "let me confirm the exact figure" instead of inventing one.
- Structure with clear headers:
  1) Opening (name, permission to talk, pattern interrupt)
  2) Qualify (budget, cash vs payment plan, timeline, end-use vs investment)
  3) The pitch (lead with the monthly-installment + "direct from developer, no bank" angle and scarcity if the facts support it)
  4) Objection handling (price, trust/"is it real", timing, "just browsing") — a line each
  5) The close (book a viewing or a video call — assume the yes)
  6) Follow-up SMS/WhatsApp (2 lines)
- Keep it tight and speakable — short sentences a broker can read live.`

  let script = ''
  try {
    const resp = await geminiGenerate(apiKey, [{ role: 'user', parts: [{ text: prompt }] }], { temperature: 0.6, maxOutputTokens: 2048 })
    script = geminiText(resp).trim()
  } catch {
    return NextResponse.json({ error: 'The AI could not generate the script — try again.' }, { status: 502 })
  }
  if (!script) return NextResponse.json({ error: 'Empty script — try again.' }, { status: 502 })

  // Save the script INTO the folder as a .txt so it lives beside the brochures.
  let file: CloudFile | null = null
  if (cloudConfigured()) {
    try {
      const safe = (projectName || folder || 'project').replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40)
      const blob = await put(`cloud/call-script-${safe}.txt`, script, { access: 'public', contentType: 'text/plain', addRandomSuffix: true })
      file = await recordCloudFile(auth.user.email, {
        name: `Call script — ${projectName || folder || 'project'}.txt`,
        mime: 'text/plain', url: blob.url, pathname: blob.pathname, size: script.length, folder,
      })
    } catch { /* still return the script even if saving the file failed */ }
  }

  return NextResponse.json({ script, file })
}
