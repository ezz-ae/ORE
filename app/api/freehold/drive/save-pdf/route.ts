import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { saveLibraryItem } from '@/lib/freehold/library'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Dedicated Drive PDF save: stores a stamped PDF (pdf-lib output) as a new
 * Library pdf row. Like save-image, the generic library POST can't hold a
 * `data:application/pdf` URL. Always a NEW row (the source PDF is preserved).
 * POST { title, dataUrl }  →  { item }   (stamped export from the editor)
 * POST { title, url }      →  { item }   (register an ALREADY-uploaded PDF)
 *
 * The second shape exists because an uploaded brochure lands in cloud storage,
 * not the Library — and the PDF editor only resolves Library ids. Without it
 * an uploaded brochure could never be opened in the editor at all, which is
 * the "brochure editor has no way to upload a brochure" report.
 */
export async function POST(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const body = await req.json().catch(() => ({})) as { title?: string; dataUrl?: string; url?: string }
  const title = String(body.title ?? '').trim() || 'Stamped PDF'
  const dataUrl = typeof body.dataUrl === 'string' ? body.dataUrl : ''
  const href = typeof body.url === 'string' ? body.url.trim() : ''

  let stored = ''
  if (dataUrl) {
    if (!dataUrl.startsWith('data:application/pdf')) {
      return NextResponse.json({ error: 'A data:application/pdf export is required' }, { status: 400 })
    }
    stored = dataUrl
  } else if (href) {
    // Only our own storage — this must not become an open URL-registration
    // endpoint that lets anyone stash arbitrary links in the Library.
    let host = ''
    try { host = new URL(href).hostname } catch { /* handled below */ }
    const ours = host === 'blob.vercel-storage.com' || host.endsWith('.blob.vercel-storage.com')
    if (!/^https:\/\//.test(href) || !ours) {
      return NextResponse.json({ error: 'Only an https Vercel Blob URL can be registered' }, { status: 400 })
    }
    stored = href
  } else {
    return NextResponse.json({ error: 'Either dataUrl or url is required' }, { status: 400 })
  }

  const item = await saveLibraryItem(auth.user.email, { kind: 'pdf', title, url: stored })
  if (!item) return NextResponse.json({ error: 'Could not save' }, { status: 500 })
  return NextResponse.json({ item }, { status: 201 })
}
