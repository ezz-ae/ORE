import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { queryServerAgent } from '@/lib/freehold/server-ai'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { checkRateLimit } from '@/lib/freehold/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Screen-aware chat prompts. Given what the user is actually LOOKING AT (a text
 * snapshot of their open page), return 2–4 short, tappable prompts that name the
 * specific things on screen — e.g. "Analyse this DAMAC Lagoons campaign" instead
 * of a generic "See the latest campaigns". The side chat shows these in place of
 * static starters. Fails soft: an empty array means the client keeps its static
 * defaults.
 */
const LANG: Record<string, string> = { ar: 'Arabic', ru: 'Russian', en: 'English' }

export async function POST(req: NextRequest) {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ prompts: [] })

  const rl = await checkRateLimit(`expert-suggest:${user.email}`, { limit: 30, windowSec: 60 })
  if (!rl.ok) return NextResponse.json({ prompts: [] })

  const body = await req.json().catch(() => ({})) as { page?: string; pageContent?: string; locale?: string }
  const pageContent = String(body.pageContent ?? '').slice(0, 4000).trim()
  // Not enough on screen to be specific — let the client fall back to statics.
  if (pageContent.length < 40) return NextResponse.json({ prompts: [] })

  const lang = LANG[String(body.locale ?? 'en')] ?? 'English'
  const systemPrompt = `You generate SHORT tappable prompt suggestions for an AI assistant docked next to the user's screen.
Return ONLY JSON: {"prompts": string[]} with 2 to 4 items.
Each prompt is what the USER would tap to ask about THIS specific screen — first person, imperative or a question, MAX 9 words.
Name the concrete things visible (campaign names, project names, numbers, statuses). If a "DAMAC" campaign is on screen, prefer "Analyse the DAMAC campaign" over "See campaigns".
Never invent names or numbers that are not in the screen text. If the screen is generic, give practical prompts for this kind of page.
Write the prompts in ${lang}. No preamble, no markdown, JSON only.`

  try {
    const raw = await queryServerAgent(
      `The user is on "${body.page ?? 'a page'}". Here is the visible text of their screen:\n\n${pageContent}\n\nGenerate the suggestions.`,
      { systemPrompt, responseMimeType: 'application/json', maxOutputTokens: 400, temperature: 0.5 },
    )
    const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
    const parsed = JSON.parse(cleaned) as { prompts?: unknown }
    const prompts = Array.isArray(parsed.prompts)
      ? parsed.prompts.filter((p): p is string => typeof p === 'string' && p.trim().length > 0).map((p) => p.trim().slice(0, 90)).slice(0, 4)
      : []
    return NextResponse.json({ prompts })
  } catch {
    return NextResponse.json({ prompts: [] })
  }
}
