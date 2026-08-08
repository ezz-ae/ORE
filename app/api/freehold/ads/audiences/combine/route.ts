/**
 * COMBINE — several saved audiences become one new saved audience.
 *
 * Union semantics: someone who fits ANY of the picked audiences is in. The
 * merge itself lives in `combineSpecs`; the new audience saves like any other
 * and launches like any other. No screen explains the mechanics.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES, type Role } from '@/lib/freehold/session-types'
import { getAudience, createAudience, forClient, combineSpecs } from '@/lib/freehold/audiences'
import { getReachEstimate, isMetaConfigured } from '@/lib/meta/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ROLES: Role[] = [...MANAGEMENT_ROLES, 'marketing']
const MAX_COMBINE = 5

export async function POST(req: NextRequest) {
  const auth = await requireSession(ROLES)
  if ('res' in auth) return auth.res

  let body: Record<string, unknown>
  try { body = (await req.json()) as Record<string, unknown> } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const ids = Array.isArray(body.ids)
    ? [...new Set(body.ids.filter((x): x is string => typeof x === 'string' && !!x))].slice(0, MAX_COMBINE)
    : []
  if (ids.length < 2) {
    return NextResponse.json({ error: 'Pick at least two audiences to combine.' }, { status: 400 })
  }
  const name = (typeof body.name === 'string' ? body.name : '').trim()
  if (!name) return NextResponse.json({ error: 'Give the combined audience a name' }, { status: 400 })

  const sources = []
  for (const id of ids) {
    const a = await getAudience(id)
    if (!a) return NextResponse.json({ error: 'One of those audiences no longer exists.' }, { status: 400 })
    sources.push(a)
  }

  const spec = combineSpecs(sources.map((a) => a.spec))
  const audience = await createAudience({
    name,
    description: sources.map((a) => a.name).join(' + '),
    kind: 'behavioral',
    spec,
    createdBy: auth.user.email,
  })

  let reach = null
  if (await isMetaConfigured()) {
    reach = await getReachEstimate(spec).catch(() => null)
  }

  return NextResponse.json({ audience: forClient(audience), reach }, { status: 201 })
}
