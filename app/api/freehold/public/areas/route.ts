import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 300

type AreaRow = {
  slug: string
  name: string
  area_type: string | null
  avg_yield: number | null
  avg_score: number | null
  project_count: number | null
}

export async function GET() {
  try {
    const rows = await query<AreaRow>(`
      SELECT slug, name, area_type, avg_yield, avg_score, project_count
      FROM freehold_site_area_profiles
      ORDER BY COALESCE(avg_score, 0) DESC NULLS LAST
      LIMIT 200
    `)
    return NextResponse.json({
      areas: rows.map((r) => ({
        ...r,
        avg_yield: r.avg_yield ? Number(r.avg_yield) : null,
        avg_score: r.avg_score ? Number(r.avg_score) : null,
        project_count: r.project_count ? Number(r.project_count) : null,
      })),
      count: rows.length,
      source: 'neon',
    })
  } catch (err) {
    console.error('[public/areas] query failed', err)
    return NextResponse.json({ areas: [], count: 0, source: 'error' }, { status: 500 })
  }
}
