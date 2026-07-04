import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getProfileByHandle } from '@/lib/freehold/agent-profiles'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Public: the data behind an agent's shareable bio page (/a/<handle>). No auth —
// but it returns only the agent's chosen public fields and their selected
// projects. No contact PII beyond what the agent put on their card.

export async function GET(_req: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const profile = await getProfileByHandle(handle)
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let projects: Array<Record<string, unknown>> = []
  if (profile.projectSlugs.length) {
    try {
      const rows = await query<Record<string, unknown>>(
        `SELECT slug, name, area, developer_name, price_from_aed, hero_image
         FROM freehold_site_projects WHERE slug = ANY($1) LIMIT 24`,
        [profile.projectSlugs],
      )
      // Preserve the agent's chosen order.
      const bySlug = new Map(rows.map((r) => [String(r.slug), r]))
      projects = profile.projectSlugs
        .map((s) => bySlug.get(s))
        .filter((r): r is Record<string, unknown> => !!r)
        .map((r) => ({
          slug: String(r.slug),
          name: String(r.name || ''),
          area: String(r.area || ''),
          developer: String(r.developer_name || ''),
          priceFromAed: r.price_from_aed != null ? Number(r.price_from_aed) : null,
          image: (r.hero_image as string) || null,
        }))
    } catch { projects = [] }
  }

  return NextResponse.json({
    profile: {
      handle: profile.handle,
      displayName: profile.displayName,
      title: profile.title,
      phone: profile.phone,
      whatsapp: profile.whatsapp,
      email: profile.email,
      bio: profile.bio,
    },
    projects,
  })
}
