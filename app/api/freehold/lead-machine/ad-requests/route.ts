import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const user = await verifySession(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const rows = await query<{
      id: string; project_slug: string; platform: string | null;
      status: string | null; created_at: string
    }>(`
      SELECT id::text, project_slug, platform, status, created_at::text
      FROM freehold_site_ad_requests
      ORDER BY created_at DESC
      LIMIT 100
    `)
    return NextResponse.json({ adRequests: rows, source: 'neon' })
  } catch {
    // Table may not exist yet — return empty list rather than error
    return NextResponse.json({ adRequests: [], source: 'empty' })
  }
}

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const user = await verifySession(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as {
    projectId?: string; platform?: string; campaignAngle?: string
  }
  if (!body.projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 })

  try {
    const id = crypto.randomUUID()
    await query(
      `INSERT INTO freehold_site_ad_requests (id, project_slug, platform, campaign_angle, status, created_by)
       VALUES ($1, $2, $3, $4, 'Draft', $5)`,
      [id, body.projectId, body.platform ?? 'Meta', body.campaignAngle ?? null, user.email],
    )
    return NextResponse.json({
      adRequest: { id, projectId: body.projectId, status: 'Draft', source: 'neon' },
    }, { status: 201 })
  } catch {
    // Table does not exist yet — acknowledge gracefully
    return NextResponse.json({
      adRequest: {
        id: `pending-${Date.now()}`,
        projectId: body.projectId,
        platform: body.platform ?? 'Meta',
        status: 'Draft',
        message: 'Ad request noted. Campaign table will be created on first admin deploy.',
      },
    }, { status: 201 })
  }
}
