import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { query } from '@/lib/db'
import { queryServerAgent } from '@/lib/freehold/server-ai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const user = await verifySession(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as Record<string, string>
  const question = (body.question || body.message || body.prompt || body.query || '').trim()
  if (!question) return NextResponse.json({ error: 'question is required' }, { status: 400 })

  // Pull a compact lead context from Neon to ground the AI answer
  let leadContext = ''
  try {
    const [summary] = await query<{
      total: number; hot: number; new_count: number; avg_budget: number | null
    }>(`
      SELECT
        COUNT(*)::int                                               AS total,
        COUNT(CASE WHEN priority = 'hot' THEN 1 END)::int         AS hot,
        COUNT(CASE WHEN status = 'new' THEN 1 END)::int           AS new_count,
        ROUND(AVG(budget_aed))                                     AS avg_budget
      FROM freehold_site_leads
    `)
    if (summary) {
      leadContext = `Live CRM snapshot: ${summary.total} total leads, ${summary.hot} hot, ${summary.new_count} new. Average budget AED ${summary.avg_budget?.toLocaleString() ?? 'unknown'}.`
    }
  } catch { /* non-fatal */ }

  const systemPrompt = `You are the Freehold CRM Sales AI. You help the sales team manage Dubai real estate leads.
${leadContext}
Answer only about CRM topics: lead prioritisation, follow-up actions, pipeline, WhatsApp drafts.
Do not invent project names, phone numbers, or prices. Keep answers under 150 words.`

  try {
    const answer = await queryServerAgent(question, { systemPrompt })
    return NextResponse.json({ scope: 'crm', answer, source: 'ai' })
  } catch {
    return NextResponse.json({
      scope: 'crm',
      answer: 'AI is currently unavailable. Check the lead pipeline directly in the CRM tab.',
      source: 'fallback',
    })
  }
}
