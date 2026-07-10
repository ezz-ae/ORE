import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { saveLibraryItem } from '@/lib/freehold/library'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Dedicated Drive PDF save: stores a stamped PDF (pdf-lib output) as a new
 * Library pdf row. Like save-image, the generic library POST can't hold a
 * `data:application/pdf` URL. Always a NEW row (the source PDF is preserved).
 * POST { title, dataUrl }  →  { item }
 */
export async function POST(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const body = await req.json().catch(() => ({})) as { title?: string; dataUrl?: string }
  const title = String(body.title ?? '').trim() || 'Stamped PDF'
  const dataUrl = typeof body.dataUrl === 'string' ? body.dataUrl : ''
  if (!dataUrl.startsWith('data:application/pdf')) {
    return NextResponse.json({ error: 'A data:application/pdf export is required' }, { status: 400 })
  }
  const item = await saveLibraryItem(auth.user.email, { kind: 'pdf', title, url: dataUrl })
  if (!item) return NextResponse.json({ error: 'Could not save' }, { status: 500 })
  return NextResponse.json({ item }, { status: 201 })
}
