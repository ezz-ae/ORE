import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { saveLibraryItem, updateLibraryItem } from '@/lib/freehold/library'
import { sendDesignReadyEmail } from '@/lib/transactional-email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Dedicated Drive image save: stores an EXPORTED canvas PNG as a Library
 * image row. The generic library POST rejects non-https urls and truncates to
 * 2000 chars, so it cannot hold a `data:image/…` export — this endpoint can.
 *
 * With an `id`, the OWNED image row is updated IN PLACE (editing an image
 * must not fork a duplicate on every save); otherwise — or when the id isn't
 * an editable row of the caller's — a new row is created.
 *
 * POST { title: string, dataUrl: string, id?: string }  →  { item, updated }
 */
export async function POST(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res

  const body = await req.json().catch(() => ({})) as { title?: string; dataUrl?: string; id?: string }
  const title = String(body.title ?? '').trim() || 'Untitled image'
  const dataUrl = typeof body.dataUrl === 'string' ? body.dataUrl : ''
  if (!dataUrl.startsWith('data:image/')) {
    return NextResponse.json({ error: 'A data:image/ export is required' }, { status: 400 })
  }

  const id = String(body.id ?? '').trim()
  if (id && id !== 'new') {
    const updated = await updateLibraryItem(id, auth.user.email, auth.user.role, { title, url: dataUrl })
    if (updated) {
      // The creator gets a copy in their inbox with the way back to the file —
      // an export should not live only in the tab it was made in.
      void sendDesignReadyEmail(auth.user.email, title)
      return NextResponse.json({ item: updated, updated: true })
    }
    // Not an editable row of the caller's → fall through to save-a-copy.
  }

  const item = await saveLibraryItem(auth.user.email, { kind: 'image', title, url: dataUrl })
  if (!item) return NextResponse.json({ error: 'Could not save' }, { status: 500 })
  void sendDesignReadyEmail(auth.user.email, title)
  return NextResponse.json({ item }, { status: 201 })
}
