import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { saveLibraryItem } from '@/lib/freehold/library'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Dedicated Drive image save: stores an EXPORTED canvas PNG as a new Library
 * image row. The generic library POST rejects non-https urls and truncates to
 * 2000 chars, so it cannot hold a `data:image/…` export — this endpoint can.
 * Always writes a NEW row (the original asset is preserved).
 *
 * POST { title: string, dataUrl: string }  →  { item }
 */
export async function POST(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res

  const body = await req.json().catch(() => ({})) as { title?: string; dataUrl?: string }
  const title = String(body.title ?? '').trim() || 'Untitled image'
  const dataUrl = typeof body.dataUrl === 'string' ? body.dataUrl : ''
  if (!dataUrl.startsWith('data:image/')) {
    return NextResponse.json({ error: 'A data:image/ export is required' }, { status: 400 })
  }

  const item = await saveLibraryItem(auth.user.email, { kind: 'image', title, url: dataUrl })
  if (!item) return NextResponse.json({ error: 'Could not save' }, { status: 500 })
  return NextResponse.json({ item }, { status: 201 })
}
