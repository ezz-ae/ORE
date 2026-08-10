import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'
import { upsertDeveloperProfile } from '@/lib/data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const WRITE_ROLES = [...MANAGEMENT_ROLES, 'marketing'] as const

/**
 * Create or update a developer profile, in the table the public site reads.
 *
 * The old path wrote to `freehold_site_web_content`, which no public page has
 * ever read — the row existed, the toast said "created", and /developers never
 * listed it. One endpoint, one table, and the same call for create and update
 * so pressing "AI complete" twice cannot mint a second row.
 */
export async function POST(req: NextRequest) {
  const auth = await requireSession([...WRITE_ROLES])
  if ('res' in auth) return auth.res

  const body = (await req.json().catch(() => ({}))) as {
    name?: unknown; slug?: unknown; description?: unknown
  }
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'A developer needs a name' }, { status: 400 })

  try {
    const saved = await upsertDeveloperProfile({
      slug: typeof body.slug === 'string' && body.slug.trim() ? body.slug.trim() : name,
      name,
      ...(typeof body.description === 'string' ? { description: body.description } : {}),
    })
    return NextResponse.json({
      ok: true,
      ...saved,
      // The listing shows developers that have projects. Say so rather than
      // let a correctly saved profile look like it failed to appear.
      listed: saved.projectCount > 0,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not save the developer' },
      { status: 400 },
    )
  }
}
