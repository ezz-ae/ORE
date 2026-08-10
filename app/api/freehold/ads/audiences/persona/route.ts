/**
 * PERSONA AUDIENCES — ordering from our list, not Meta's.
 *
 * The client picks up to three of OUR words ("doctors", "golden-visa
 * seekers"), a language and a market. The kitchen resolves each word into a
 * LIST of live Meta interests and behaviours, stacks them as AND layers, and
 * bolts the real-estate MUST group on top.
 *
 * THE RECIPE NEVER CROSSES THIS LINE. The response carries the reach, the
 * ingredient COUNT and which of our words resolved — never the entities.
 * Same rule as the pattern route, for the same reason: a spec in one response
 * is in the network tab forever.
 *
 * A persona whose ingredients all fail to resolve REFUSES with a 422 — the
 * same honesty as the locale refusal at launch. We never sell an audience
 * that quietly matches nobody.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES, type Role } from '@/lib/freehold/session-types'
import {
  PERSONAS, MAX_STACK, getPersona, resolvePersona, planPersona,
  PersonaUnresolvableError, type ResolvedPersona,
} from '@/lib/freehold/persona-audience'
import { RESIDENCY_COUNTRIES, type Residency, type SpeakerBundle } from '@/lib/freehold/audience-pattern'
import { createAudience, forClient } from '@/lib/freehold/audiences'
import { getReachEstimate, isMetaConfigured } from '@/lib/meta/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const ROLES: Role[] = [...MANAGEMENT_ROLES, 'marketing']

const SPEAKERS = new Set<SpeakerBundle>(['arabic', 'english', 'russian'])

// GET — the library and the dials. Ids only: names live in the client's
// dictionaries, ingredients live here.
export async function GET() {
  const auth = await requireSession(ROLES)
  if ('res' in auth) return auth.res
  return NextResponse.json({
    personas: PERSONAS.map((p) => ({ id: p.id })),
    maxStack: MAX_STACK,
    residencies: Object.keys(RESIDENCY_COUNTRIES),
    metaConnected: await isMetaConfigured(),
  })
}

// POST — resolve + plan + (optionally) save. `save: false` is the live
// preview: reach and resolution health, nothing persisted.
export async function POST(req: NextRequest) {
  const auth = await requireSession(ROLES)
  if ('res' in auth) return auth.res

  let body: Record<string, unknown>
  try { body = (await req.json()) as Record<string, unknown> } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const ids = Array.isArray(body.personaIds)
    ? [...new Set(body.personaIds.filter((x): x is string => typeof x === 'string'))].slice(0, MAX_STACK)
    : []
  const recipes = ids.map(getPersona).filter((r): r is NonNullable<typeof r> => r != null)
  if (recipes.length === 0) {
    return NextResponse.json({ error: 'Pick at least one buyer type from the list.' }, { status: 400 })
  }

  const speaker = SPEAKERS.has(body.speaker as SpeakerBundle) ? (body.speaker as SpeakerBundle) : 'arabic'
  const residency = (typeof body.residency === 'string' && body.residency in RESIDENCY_COUNTRIES
    ? body.residency : 'resident') as Residency

  if (!(await isMetaConfigured())) {
    return NextResponse.json({ error: 'Meta is not connected. Connect Meta Ads under Integrations first.' }, { status: 409 })
  }

  // Resolve every selected persona against Meta's live vocabulary. One
  // unresolvable persona fails the WHOLE order — a stack quietly missing a
  // layer is a different audience than the one the operator named.
  const stack: ResolvedPersona[] = []
  const resolution: Array<{ id: string; ingredients: number; unresolvedTerms: string[] }> = []
  for (const recipe of recipes) {
    try {
      const r = await resolvePersona(recipe)
      stack.push(r)
      resolution.push({ id: recipe.id, ingredients: r.interests.length + r.behaviors.length, unresolvedTerms: r.unresolvedTerms })
    } catch (err) {
      if (err instanceof PersonaUnresolvableError) {
        return NextResponse.json({ error: err.message, personaId: recipe.id, unresolvable: true }, { status: 422 })
      }
      return NextResponse.json({ error: 'Meta did not answer while building this audience. Try again.' }, { status: 502 })
    }
  }

  const ageMin = recipes.reduce((m, r) => Math.max(m, r.ageMin ?? 30), 30)
  const ageMax = recipes.reduce((m, r) => Math.min(m, r.ageMax ?? 65), 65)
  // Women/men/everyone — a real Meta field, permitted for UAE property ads
  // (the housing special-category restriction is a North-America rule). Only
  // the two codes Meta defines survive; anything else means everyone.
  const genders = Array.isArray(body.genders)
    ? (body.genders as unknown[]).map(Number).filter((g) => g === 1 || g === 2)
    : []
  const targeting = planPersona({ stack, speaker, residency, ageMin, ageMax, genders })

  const reach = await getReachEstimate(targeting).catch(() => null)

  if (body.save !== true) {
    return NextResponse.json({ reach, resolution, preview: publicShape(targeting, ids) })
  }

  const name = (typeof body.name === 'string' ? body.name : '').trim()
  if (!name) return NextResponse.json({ error: 'Give this audience a name' }, { status: 400 })

  const audience = await createAudience({
    name,
    description: typeof body.description === 'string' && body.description.trim()
      ? body.description.trim().slice(0, 300)
      : ids.join(' + '),
    kind: 'behavioral',
    spec: targeting,
    createdBy: auth.user.email,
  })

  return NextResponse.json(
    { audience: forClient(audience), reach, resolution, preview: publicShape(targeting, ids) },
    { status: 201 },
  )
}

/** What the browser may know: the shape, never the ingredients. */
const publicShape = (t: { ageMin: number; ageMax: number; countries: string[]; leadLanguages?: string[]; narrowing?: unknown[] }, ids: string[]) => ({
  personaIds: ids,
  countries: t.countries,
  ageMin: t.ageMin,
  ageMax: t.ageMax,
  languages: t.leadLanguages ?? [],
  layers: (t.narrowing ?? []).length,
})
