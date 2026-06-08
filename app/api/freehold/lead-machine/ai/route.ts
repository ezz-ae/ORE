import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { queryServerAgent } from '@/lib/freehold/server-ai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { message?: string }
  const message = body.message?.trim()
  if (!message) return NextResponse.json({ error: 'message is required' }, { status: 400 })

  // Pull live readiness context from Neon
  let context = ''
  try {
    const [summary] = await query<{
      total: number; with_landing: number; with_image: number; ready: number
    }>(`
      SELECT
        COUNT(*)::int                                                          AS total,
        COUNT(CASE WHEN hero_image IS NOT NULL THEN 1 END)::int               AS with_image,
        COUNT(CASE WHEN price_from_aed > 0 AND hero_image IS NOT NULL
                        THEN 1 END)::int                                       AS ready,
        (SELECT COUNT(DISTINCT project_slug)::int
         FROM freehold_site_project_landing_pages
         WHERE project_slug IS NOT NULL)                                       AS with_landing
      FROM freehold_site_projects
    `)
    if (summary) {
      context = `Live Freehold data: ${summary.total} total projects, ${summary.with_image} have images, ${summary.ready} campaign-ready (price + image), ${summary.with_landing} have landing pages.`
    }
  } catch { /* non-fatal */ }

  const systemPrompt = `You are the Freehold Lead Machine AI. You help prepare Dubai real estate listings for ad campaigns.
${context}
Answer only about campaign readiness, landing pages, ad requests, and blockers.
Use only the verified data above. Do not invent project names, prices, or yields.
Keep answers concise and actionable.`

  try {
    const answer = await queryServerAgent(message, { systemPrompt })
    return NextResponse.json({ answer, cardType: 'listing', listings: [], source: 'neon+ai' })
  } catch {
    return NextResponse.json({
      answer: `Based on live data: ${context || 'inventory data currently loading'}. Review the campaign readiness tab for detailed project status.`,
      cardType: 'listing',
      listings: [],
      source: 'fallback',
    })
  }
}
