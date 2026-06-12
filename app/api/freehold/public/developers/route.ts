import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 300

type DeveloperRow = {
  slug: string
  name: string
  tier: string | null
  avg_score: number | null
  project_count: number | null
}

export async function GET() {
  try {
    const rows = await query<DeveloperRow>(`
      SELECT slug, name, tier, avg_score,
             (payload->>'projectCount')::int AS project_count
      FROM freehold_site_developer_profiles
      ORDER BY (payload->>'projectCount')::int DESC NULLS LAST, avg_score DESC NULLS LAST
      LIMIT 200
    `)
    return NextResponse.json({
      developers: rows.map((r) => ({
        ...r,
        avg_score: r.avg_score ? Number(r.avg_score) : null,
        project_count: r.project_count ? Number(r.project_count) : null,
      })),
      count: rows.length,
      source: 'neon',
    })
  } catch (err) {
    console.error('[public/developers] query failed', err)
    return NextResponse.json({ developers: [], count: 0, source: 'error' }, { status: 500 })
  }
}
