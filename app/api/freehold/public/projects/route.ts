import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 60

type ProjectRow = {
  slug: string
  name: string
  area: string
  developer_name: string
  status: string | null
  price_from_aed: number | null
  rental_yield: number | null
  golden_visa_eligible: boolean
  hero_image: string | null
  market_score: number | null
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get('limit') || '100'), 200)
  const offset = Math.max(Number(searchParams.get('offset') || '0'), 0)
  const area = searchParams.get('area')
  const developer = searchParams.get('developer')

  try {
    const params: unknown[] = [limit, offset]
    let sql = `
      SELECT slug, name, area, developer_name, status,
             price_from_aed, rental_yield, golden_visa_eligible,
             hero_image, market_score
      FROM freehold_site_projects
      WHERE hero_image IS NOT NULL AND price_from_aed > 0`

    if (area) {
      params.push(area)
      sql += ` AND lower(area) = lower($${params.length})`
    }
    if (developer) {
      params.push(developer)
      sql += ` AND lower(developer_name) = lower($${params.length})`
    }

    sql += `
      ORDER BY COALESCE(market_score, 0) DESC NULLS LAST
      LIMIT $1 OFFSET $2`

    const rows = await query<ProjectRow>(sql, params)
    return NextResponse.json({
      projects: rows.map((r) => ({
        ...r,
        price_from_aed: r.price_from_aed ? Number(r.price_from_aed) : null,
        rental_yield: r.rental_yield ? Number(r.rental_yield) : null,
        market_score: r.market_score ? Number(r.market_score) : null,
      })),
      count: rows.length,
      source: 'neon',
    })
  } catch (err) {
    console.error('[public/projects] query failed', err)
    return NextResponse.json({ projects: [], count: 0, source: 'error' }, { status: 500 })
  }
}
