import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { geminiGenerate, geminiText } from '@/lib/gemini-rest'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Real AI rewrite of a property landing page's copy from a free-form instruction.
 * Replaces the old fake "AI redesign" that ignored the prompt and swapped in a
 * canned template. Grounded in the property facts; honest when no key is set.
 * POST { prompt, property, current } → { config: { headline, subheadline, highlights[4], ctaText } }
 */
export async function POST(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const body = await req.json().catch(() => ({})) as {
    prompt?: string
    property?: Record<string, unknown>
    current?: Record<string, unknown>
  }
  const prompt = String(body.prompt ?? '').trim()
  if (!prompt) return NextResponse.json({ error: 'A prompt is required' }, { status: 400 })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ unavailable: true })

  const instruction = `You are a senior Dubai real-estate landing-page copywriter.
Rewrite this property landing page's copy to follow the user's instruction. Keep every fact accurate to the property — never invent prices, yields, or handover dates.

PROPERTY (facts): ${JSON.stringify(body.property ?? {})}
CURRENT COPY: ${JSON.stringify(body.current ?? {})}
USER INSTRUCTION: ${prompt}

Return ONLY strict JSON (no preamble, no markdown fences):
{"headline": string, "subheadline": string, "highlights": [string, string, string, string], "ctaText": string}`

  try {
    const data = await geminiGenerate(apiKey, [{ role: 'user', parts: [{ text: instruction }] }], { temperature: 0.6, maxOutputTokens: 1024 })
    const out = geminiText(data).replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
    const parsed = JSON.parse(out) as { headline?: unknown; subheadline?: unknown; highlights?: unknown; ctaText?: unknown }
    const hl = Array.isArray(parsed.highlights) ? parsed.highlights.filter((x) => typeof x === 'string').map(String).slice(0, 4) : []
    while (hl.length < 4) hl.push('')
    return NextResponse.json({
      config: {
        headline: typeof parsed.headline === 'string' ? parsed.headline : '',
        subheadline: typeof parsed.subheadline === 'string' ? parsed.subheadline : '',
        highlights: hl,
        ctaText: typeof parsed.ctaText === 'string' ? parsed.ctaText : '',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'The AI request failed. Try again.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
