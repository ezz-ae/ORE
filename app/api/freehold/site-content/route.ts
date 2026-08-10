/**
 * The public site's editable words — read and write.
 *
 * Writes are management + marketing, matching every other Web Studio door.
 * Reads need a session too: the content is public once rendered, but the
 * EDITOR listing (what is overridden vs built-in) is an internal view.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES, type Role } from '@/lib/freehold/session-types'
import { getPageContent, setPageContent, PAGE_CONTENT_FIELDS, CONTENT_PAGES } from '@/lib/freehold/site-content'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const WRITE_ROLES: Role[] = [...MANAGEMENT_ROLES, 'marketing']

export async function GET() {
  const auth = await requireSession(WRITE_ROLES)
  if ('res' in auth) return auth.res
  const pages = await Promise.all(CONTENT_PAGES.map(async (page) => ({
    page,
    fields: PAGE_CONTENT_FIELDS[page],
    values: await getPageContent(page),
  })))
  return NextResponse.json({ pages })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireSession(WRITE_ROLES)
  if ('res' in auth) return auth.res
  let body: { page?: string; data?: Record<string, unknown> }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const page = String(body.page ?? '')
  if (!PAGE_CONTENT_FIELDS[page]) {
    return NextResponse.json({ error: `Unknown page: ${page}` }, { status: 400 })
  }
  if (!body.data || typeof body.data !== 'object') {
    return NextResponse.json({ error: 'data must be an object' }, { status: 400 })
  }
  const values = await setPageContent(page, body.data, auth.user.email)
  return NextResponse.json({ page, values })
}
