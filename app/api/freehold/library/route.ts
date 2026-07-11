import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { listLibrary, saveLibraryItem, deleteLibraryItem, LIBRARY_KINDS, type LibraryKind } from '@/lib/freehold/library'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** The Library shelf: ?kind=report|note|creative|image|video|pdf filters. */
export async function GET(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const kind = req.nextUrl.searchParams.get('kind') ?? undefined
  return NextResponse.json({ items: await listLibrary(auth.user.email, auth.user.role, kind) })
}

/** Save an asset: text content (reports/creatives/notes) or a media URL. */
export async function POST(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const body = await req.json().catch(() => ({})) as {
    kind?: string; title?: string; content?: string; url?: string
  }
  const kind = body.kind as LibraryKind
  const title = String(body.title ?? '').trim()
  if (!LIBRARY_KINDS.includes(kind)) return NextResponse.json({ error: 'Invalid kind' }, { status: 400 })
  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  const url = typeof body.url === 'string' && /^https?:\/\//.test(body.url) ? body.url.slice(0, 2000) : null
  const content = typeof body.content === 'string' ? body.content.slice(0, 100_000) : null
  if (!url && !content) return NextResponse.json({ error: 'Provide content or a URL' }, { status: 400 })
  const item = await saveLibraryItem(auth.user.email, { kind, title, content, url })
  if (!item) return NextResponse.json({ error: 'Could not save' }, { status: 500 })
  return NextResponse.json({ item }, { status: 201 })
}

/** Remove an asset: DELETE /api/freehold/library?id=… (owner or management). */
export async function DELETE(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const id = req.nextUrl.searchParams.get('id')?.trim()
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  return NextResponse.json({ ok: await deleteLibraryItem(id, auth.user.email, auth.user.role) })
}
