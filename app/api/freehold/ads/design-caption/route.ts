/**
 * READ THE DESIGN, WRITE THE CAPTION.
 *
 * The operator's designs already carry the ad's whole argument — headline,
 * price, payment terms, the disqualifier — composed by a human in the
 * design tool. Retyping it into the copy fields was double work and a drift
 * risk: the caption could contradict the picture it rides under.
 *
 * This reads the uploaded design with a vision model and hands back copy IN
 * THE DESIGN'S OWN LANGUAGE, built ONLY from what is visibly on it. The
 * rule matters more than the feature: a model that "improves" the numbers
 * on a property ad is manufacturing a claim nobody approved. Extraction,
 * not invention — the same doctrine as every number on every screen.
 */
import { NextRequest, NextResponse } from 'next/server'
import { generateObject } from 'ai'
import { z } from 'zod'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES, type Role } from '@/lib/freehold/session-types'
import { expertModel } from '@/lib/freehold/ai-sdk'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const ROLES: Role[] = [...MANAGEMENT_ROLES, 'marketing']

const Extracted = z.object({
  headline: z.string().describe('The design\'s main claim, under 40 characters, in the design\'s own language'),
  primaryText: z.string().describe('2-4 sentence ad caption built ONLY from facts visible on the design, same language, ending with a simple call to action'),
  description: z.string().describe('One short supporting line from the design (price or key term), or empty'),
})

export async function POST(req: NextRequest) {
  const auth = await requireSession(ROLES)
  if ('res' in auth) return auth.res

  let body: { image?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const raw = String(body.image ?? '')
  if (!raw.startsWith('data:image/')) {
    return NextResponse.json({ error: 'image must be a data URL' }, { status: 400 })
  }
  // The upload path already shrinks to ≤2048px; anything bigger here is a
  // caller bypassing it, and the model does not need more pixels anyway.
  if (raw.length > 6_000_000) {
    return NextResponse.json({ error: 'Image too large' }, { status: 413 })
  }

  try {
    const { object } = await generateObject({
      // Flash tier on purpose: this is OCR-plus-phrasing, not reasoning, and
      // it runs on every upload — latency is part of the feature.
      model: expertModel('gemini-2.5-flash'),
      schema: Extracted,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', image: raw },
          {
            type: 'text',
            text: 'This is a real-estate ad design. Extract ad copy from it, in the SAME language the design is written in. Use ONLY facts and numbers visible on the design — never add, round, or improve a number, and never invent a detail that is not on the image. If the design states who the offer is NOT suitable for, keep that line: it is deliberate.',
          },
        ],
      }],
    })
    return NextResponse.json({
      headline: object.headline.trim().slice(0, 60),
      primaryText: object.primaryText.trim(),
      description: object.description.trim().slice(0, 90),
    })
  } catch {
    // Extraction is a convenience: its failure must never block an upload
    // flow, so the client treats an error as "no suggestion".
    return NextResponse.json({ error: 'Could not read the design' }, { status: 502 })
  }
}
