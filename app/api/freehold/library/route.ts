import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { listLibrary, saveLibraryItem, updateLibraryItem, deleteLibraryItem, LIBRARY_KINDS, type LibraryKind } from '@/lib/freehold/library'
import { sendDesignReadyEmail } from '@/lib/transactional-email'

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
  // An explicit empty string is a deliberate BLANK document (the editor's
  // "New document" flow) — only reject when neither field was provided at all.
  if (url === null && content === null) return NextResponse.json({ error: 'Provide content or a URL' }, { status: 400 })
  const item = await saveLibraryItem(auth.user.email, { kind, title, content, url })
  if (!item) return NextResponse.json({ error: 'Could not save' }, { status: 500 })
  // Media exports (image/video/pdf) email the creator a copy with the link —
  // notes and reports stay quiet; nobody wants an email for a text note.
  if (['image', 'video', 'pdf'].includes(kind)) {
    void sendDesignReadyEmail(auth.user.email, title, url)
  }
  return NextResponse.json({ item }, { status: 201 })
}

/**
 * Update an owned asset (title/content/url) — what the Drive doc and video
 * editors save through. 404 when the id is not an editable library row (e.g.
 * a read-only Notebook output), which editors use to fall back to save-a-copy.
 */
export async function PATCH(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const body = await req.json().catch(() => ({})) as {
    id?: string; title?: string; content?: string; url?: string; folder?: string | null
  }
  const id = String(body.id ?? '').trim()
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  const patch: { title?: string; content?: string | null; url?: string | null; folder?: string | null } = {}
  if (typeof body.title === 'string' && body.title.trim()) patch.title = body.title
  if (typeof body.content === 'string') patch.content = body.content.slice(0, 100_000)
  if (typeof body.url === 'string' && /^(https?:\/\/|data:)/.test(body.url)) patch.url = body.url.slice(0, 2000)
  // folder: string moves the item into that folder; null (explicit) unfiles it.
  if ('folder' in body) patch.folder = body.folder == null ? null : String(body.folder)
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  const item = await updateLibraryItem(id, auth.user.email, auth.user.role, patch)
  if (!item) return NextResponse.json({ error: 'Not an editable library item' }, { status: 404 })
  return NextResponse.json({ item })
}

/** Remove an asset: DELETE /api/freehold/library?id=… (owner or management). */
export async function DELETE(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const id = req.nextUrl.searchParams.get('id')?.trim()
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  const ok = await deleteLibraryItem(id, auth.user.email, auth.user.role)
  if (!ok) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
