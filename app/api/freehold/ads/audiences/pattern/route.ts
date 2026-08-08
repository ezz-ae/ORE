/**
 * ORDERING FROM THE KITCHEN.
 *
 * The client sends a description of a PERSON. It gets back what that person
 * costs to reach and what the machine understood — and nothing else.
 *
 * THE TARGETING NEVER CROSSES THIS LINE. Not in the preview, not in the save
 * response, not in a debug field. `planPattern` runs here, on the server, and
 * its `targeting` goes straight into the database; the browser is handed the
 * sentence, the reach band and the shape of the match. That is the entire
 * architectural point, and it is a property of this file specifically: put the
 * spec in one response and it is in the network tab forever, at which point
 * the recipe is public and anyone can rebuild it in Ads Manager for free.
 *
 * It also means the saved audience works everywhere immediately — the wizard
 * and the Ads Machine already consume `SavedAudience.spec` and neither needs
 * to learn what a pattern is.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES, type Role } from '@/lib/freehold/session-types'
import { planPattern, parsePattern, describePattern } from '@/lib/freehold/audience-pattern'
import { createAudience, forClient } from '@/lib/freehold/audiences'
import { SUPPORTED_LEAD_LANGUAGES } from '@/lib/meta/lead-language'
import { getReachEstimate, isMetaConfigured } from '@/lib/meta/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ROLES: Role[] = [...MANAGEMENT_ROLES, 'marketing']

export async function POST(req: NextRequest) {
  const auth = await requireSession(ROLES)
  if ('res' in auth) return auth.res

  let body: Record<string, unknown>
  try { body = (await req.json()) as Record<string, unknown> } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const pattern = parsePattern(body.pattern)
  // A bundle is only usable if an ad can be written in its language, which
  // means a landing page has to exist in it. That list is a real constraint of
  // this system, not a preference, so it comes from the one place that knows.
  const plan = planPattern(pattern, [...SUPPORTED_LEAD_LANGUAGES])

  // Reach is asked of Meta or it is not shown. An invented size is the same
  // mistake as an invented CPL — it reads as knowledge and it is a guess.
  let reach: Awaited<ReturnType<typeof getReachEstimate>> | null = null
  if (await isMetaConfigured()) {
    reach = await getReachEstimate(plan.targeting).catch(() => null)
  }

  const save = body.save === true
  if (!save) {
    return NextResponse.json({ preview: publicPlan(plan), reach })
  }

  const name = (typeof body.name === 'string' ? body.name : pattern.name).trim()
  if (!name) return NextResponse.json({ error: 'Give this audience a name' }, { status: 400 })

  const audience = await createAudience({
    name,
    // The person-sentence is the description. It is what the operator wrote,
    // in their words, and it is what every other screen will show.
    description: describePattern(pattern),
    kind: 'pattern',
    spec: plan.targeting,
    pattern: { ...pattern, name },
    createdBy: auth.user.email,
  })

  // Even on the way back out, the spec stays behind — through the same single
  // chokepoint every other route uses, rather than a second hand-rolled strip
  // that could quietly fall out of step with it.
  return NextResponse.json(
    { audience: forClient(audience), preview: publicPlan(plan), reach },
    { status: 201 },
  )
}

/** What the browser is allowed to know: who this is, how tightly it matched,
 *  and what it still needs. Never how. */
const publicPlan = (p: ReturnType<typeof planPattern>) => ({
  describes: p.describes,
  boundTraits: p.boundTraits,
  hintedTraits: p.hintedTraits,
  temperature: p.temperature,
  needsRetargetingSource: p.needsRetargetingSource,
  unreachable: p.unreachable,
  /** The audience is everyone. Said before anyone spends on it. */
  reachesEveryone: p.reachesEveryone,
})
