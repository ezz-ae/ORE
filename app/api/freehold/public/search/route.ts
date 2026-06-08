import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

type SearchProject = { type: 'project'; slug: string; name: string; area: string; developer: string; price: number | null }
type SearchArea = { type: 'area'; slug: string; name: string; area_type: string | null; project_count: number | null }
type SearchDeveloper = { type: 'developer'; slug: string; name: string; project_count: number | null }
type SearchResult = SearchProject | SearchArea | SearchDeveloper

export async function GET(request: NextRequest) {
  const q = new URL(request.url).searchParams.get('q')?.trim()
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [], query: q ?? '', source: 'neon' })
  }

  const pattern = `%${q.toLowerCase()}%`

  try {
    const [projects, areas, developers] = await Promise.all([
      query<{ slug: string; name: string; area: string; developer_name: string; price_from_aed: number | null }>(
        `SELECT slug, name, area, developer_name, price_from_aed
         FROM freehold_site_projects
         WHERE lower(name) LIKE $1 OR lower(area) LIKE $1 OR lower(developer_name) LIKE $1
         ORDER BY COALESCE(market_score, 0) DESC NULLS LAST
         LIMIT 10`,
        [pattern],
      ),
      query<{ slug: string; name: string; area_type: string | null; project_count: number | null }>(
        `SELECT slug, name, area_type, project_count
         FROM freehold_site_area_profiles
         WHERE lower(name) LIKE $1
         ORDER BY COALESCE(project_count, 0) DESC NULLS LAST
         LIMIT 5`,
        [pattern],
      ),
      query<{ slug: string; name: string; project_count: number | null }>(
        `SELECT slug, name, (payload->>'projectCount')::int AS project_count
         FROM freehold_site_developer_profiles
         WHERE lower(name) LIKE $1
         ORDER BY (payload->>'projectCount')::int DESC NULLS LAST
         LIMIT 5`,
        [pattern],
      ),
    ])

    const results: SearchResult[] = [
      ...projects.map((r) => ({
        type: 'project' as const,
        slug: r.slug,
        name: r.name,
        area: r.area,
        developer: r.developer_name,
        price: r.price_from_aed ? Number(r.price_from_aed) : null,
      })),
      ...areas.map((r) => ({
        type: 'area' as const,
        slug: r.slug,
        name: r.name,
        area_type: r.area_type,
        project_count: r.project_count ? Number(r.project_count) : null,
      })),
      ...developers.map((r) => ({
        type: 'developer' as const,
        slug: r.slug,
        name: r.name,
        project_count: r.project_count ? Number(r.project_count) : null,
      })),
    ]

    return NextResponse.json({ results, query: q, count: results.length, source: 'neon' })
  } catch (err) {
    console.error('[public/search] query failed', err)
    return NextResponse.json({ results: [], query: q, count: 0, source: 'error' }, { status: 500 })
  }
}
