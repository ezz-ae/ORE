import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { geminiGenerate, geminiText } from '@/lib/gemini-rest'
import { userSafeAiError } from '@/lib/freehold/ai-errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Mode = 'rewrite' | 'shorten' | 'expand' | 'professional' | 'translate_ar' | 'translate_ru' | 'translate_en' | 'instruct'

const LIMIT = 40_000

const INSTRUCTION: Record<Exclude<Mode, 'instruct'>, string> = {
  rewrite:      'Rewrite this to be clearer and more compelling while keeping the same meaning, facts, and structure.',
  shorten:      'Make this significantly more concise while keeping every key fact.',
  expand:       'Expand this with more useful detail and supporting points, without inventing facts.',
  professional: 'Rewrite this in a polished, professional, client-ready tone.',
  translate_ar: 'Translate this into natural, professional Arabic. Keep numbers, prices and proper nouns intact.',
  translate_ru: 'Translate this into natural, professional Russian. Keep numbers, prices and proper nouns intact.',
  translate_en: 'Translate this into natural, professional English. Keep numbers, prices and proper nouns intact.',
}

// Real Gemini assist for the Drive doc editor: rewrite / restructure / translate.
// Returns the transformed text only. Honest: no key → unavailable; the client
// keeps the user's text untouched.
export async function POST(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const body = await req.json().catch(() => ({})) as { content?: string; mode?: string; instruction?: string }
  const content = String(body.content ?? '').trim()
  if (!content) return NextResponse.json({ error: 'content is required' }, { status: 400 })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ unavailable: true, content: '' })

  const mode = body.mode as Mode | undefined
  // Free-form 'instruct' (and any unknown mode) falls through to the caller's
  // instruction string — the co-editor rail's natural-language edits.
  const directive = (mode && mode !== 'instruct' && INSTRUCTION[mode]) ||
    (typeof body.instruction === 'string' && body.instruction.trim()) ||
    INSTRUCTION.rewrite
  const truncated = content.length > LIMIT
  const prompt = `You are a senior real-estate marketing editor. ${directive}
Return ONLY the resulting text — no preamble, no markdown fences, no commentary. Preserve any existing HTML tags if the input contains them.

INPUT:
${content.slice(0, LIMIT)}`

  try {
    const data = await geminiGenerate(apiKey, [{ role: 'user', parts: [{ text: prompt }] }], { temperature: 0.6, maxOutputTokens: 4096 })
    const out = geminiText(data).replace(/^```[a-z]*\n?/i, '').replace(/```$/, '').trim()
    if (!out) return NextResponse.json({ error: 'The AI returned nothing. Try again.' }, { status: 502 })
    return NextResponse.json({ content: out, truncated })
  } catch (err) {
    // Raw provider detail goes to the server log; the user sees plain language.
    return NextResponse.json({ error: userSafeAiError(err) }, { status: 502 })
  }
}
