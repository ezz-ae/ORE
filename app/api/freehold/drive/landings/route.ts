import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { getLandingPagesForDashboard } from '@/lib/landing-pages'
import { query } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Landing pages for the Drive — real-estate cards (hero, area, price, status)
// so the Drive is the one place a marketer sees every asset AND every page.
// Brokers don't manage landings, so they get an empty list.
export async function GET() {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  if (auth.user.role === 'broker') return NextResponse.json({ landings: [] })
  try {
    const rows = await getLandingPagesForDashboard(60)

    // Enrich with the project's hero image, area and price from live inventory
    // (the dashboard row doesn't carry them). One grouped query, best-effort.
    const slugs = rows.map((r) => r.projectSlug).filter(Boolean)
    const projMap = new Map<string, { hero: string; area: string; price: number | null }>()
    if (slugs.length) {
      const projects = await query<{ slug: string; hero_image: string | null; area: string | null; price_from_aed: number | null }>(
        `SELECT lower(slug) AS slug, hero_image, area, price_from_aed
         FROM freehold_site_projects WHERE lower(slug) = ANY($1)`,
        [slugs.map((s) => s.toLowerCase())],
      ).catch(() => [])
      for (const p of projects) projMap.set(p.slug, {
        hero: p.hero_image ?? '', area: p.area ?? '', price: p.price_from_aed,
      })
    }

    const landings = rows.map((r) => {
      const proj = projMap.get(r.projectSlug.toLowerCase())
      return {
        slug: r.slug,
        title: r.headline || r.slug,
        status: r.isLiveNow ? 'published' : r.pendingPublish ? 'pending' : 'draft',
        heroImage: proj?.hero ?? '',
        area: proj?.area ?? '',
        priceFromAed: proj?.price ?? null,
        leads: r.leadCount,
        views: r.pageViews,
        updatedAt: r.updatedAt,
      }
    })
    return NextResponse.json({ landings })
  } catch {
    return NextResponse.json({ landings: [] })
  }
}
