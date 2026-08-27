/**
 * WRITE THE AD — three angles, from the listing's own facts.
 *
 * The launcher's copy came from a template that has gone out on every campaign
 * this product ever launched: "{name} — starting from AED {price}. Request the
 * investor summary now." That names the thing and asks for the form, which is
 * what a directory listing does.
 *
 * The rules live in lib/freehold/campaign-copy.ts and every one of them is a
 * refusal: no price, plan, date, size or amenity that was not supplied; no
 * invented scarcity; no superlative nobody can support. The operator's brief
 * is passed as MATERIAL beneath the rules, never as instructions.
 *
 * THREE ANGLES IN PARALLEL, because one suggestion is a suggestion people
 * accept out of politeness. Three different arguments make somebody choose,
 * and choosing is when they read the copy at all.
 */
import { NextRequest, NextResponse } from 'next/server'
import { generateObject } from 'ai'
import { z } from 'zod'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES, type Role } from '@/lib/freehold/session-types'
import { expertModel } from '@/lib/freehold/ai-sdk'
import {
  COPY_ANGLES, promptFor, acceptCopy, hasEnoughFacts, trimToWord, BRIEF_MAX,
  type CopyFacts, type WrittenCopy,
} from '@/lib/freehold/campaign-copy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const ROLES: Role[] = [...MANAGEMENT_ROLES, 'marketing', 'broker']

const Written = z.object({
  headline: z.string(),
  primaryText: z.string(),
  description: z.string(),
})

export async function POST(req: NextRequest) {
  const auth = await requireSession(ROLES)
  if ('res' in auth) return auth.res

  let body: { facts?: CopyFacts; language?: string; brief?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const facts: CopyFacts = body.facts ?? {}
  // NOTHING TO WRITE FROM IS NOT A REASON TO INVENT. Refused with a name the
  // screen can say, rather than answered with an ad about a property nobody
  // described.
  if (!hasEnoughFacts(facts)) {
    return NextResponse.json({ error: 'noFacts' }, { status: 400 })
  }
  const language = ['en', 'ar', 'ru'].includes(String(body.language)) ? String(body.language) : 'en'
  const brief = trimToWord(body.brief, BRIEF_MAX)

  // One call per angle, in parallel. A single call asked for three variants
  // returns the same ad three times with the adjectives moved around — the
  // angles have to be separate prompts to come back genuinely different.
  const results = await Promise.all(COPY_ANGLES.map(async (angle) => {
    try {
      const { object } = await generateObject({
        model: expertModel(),
        schema: Written,
        prompt: promptFor({ facts, angle, language, brief }),
      })
      return acceptCopy(angle, object)
    } catch {
      // One angle failing is not the request failing — two good options beat
      // an error page.
      return null
    }
  }))

  const options = results.filter((r): r is WrittenCopy => r !== null)
  if (options.length === 0) {
    return NextResponse.json({ error: 'writerUnavailable' }, { status: 502 })
  }
  return NextResponse.json({ options, language })
}
