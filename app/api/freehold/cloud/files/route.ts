import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { listCloudFiles, recordCloudFile, deleteCloudFile, moveCloudFile } from '@/lib/freehold/cloud'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET ?folder=            → files (omit folder = all; folder="" = root/unfiled)
// POST { name,url,pathname,mime?,size?,folder? } → record an uploaded file
// PATCH { id, folder }    → move to a folder (null/"" = root)
// DELETE ?id=             → remove file (Blob object + row)

export async function GET(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const sp = req.nextUrl.searchParams
  const folder = sp.has('folder') ? sp.get('folder') : undefined
  const files = await listCloudFiles(auth.user.email, folder as string | null | undefined)
  return NextResponse.json({ files })
}

export async function POST(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const b = await req.json().catch(() => ({})) as {
    name?: string; url?: string; pathname?: string; mime?: string; size?: number; folder?: string | null
  }
  if (!b.name || !b.url || !b.pathname) {
    return NextResponse.json({ error: 'name, url and pathname are required' }, { status: 400 })
  }
  const file = await recordCloudFile(auth.user.email, {
    name: b.name, url: b.url, pathname: b.pathname, mime: b.mime ?? null, size: b.size ?? 0, folder: b.folder ?? null,
  })
  return file ? NextResponse.json({ file }, { status: 201 }) : NextResponse.json({ error: 'Could not save' }, { status: 500 })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const b = await req.json().catch(() => ({})) as { id?: string; folder?: string | null }
  if (!b.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  const ok = await moveCloudFile(auth.user.email, b.id, b.folder ?? null)
  return NextResponse.json({ ok })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  const ok = await deleteCloudFile(auth.user.email, id)
  return NextResponse.json({ ok })
}
