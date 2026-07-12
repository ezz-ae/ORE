import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { listCloudFolders, createCloudFolder, deleteCloudFolder } from '@/lib/freehold/cloud'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET                → folders with file counts
// POST { name }      → create an (empty) folder
// DELETE ?name=      → remove folder (its files fall back to root)

export async function GET() {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const folders = await listCloudFolders(auth.user.email)
  return NextResponse.json({ folders })
}

export async function POST(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const b = await req.json().catch(() => ({})) as { name?: string }
  if (!b.name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  const ok = await createCloudFolder(auth.user.email, b.name)
  return ok ? NextResponse.json({ ok }, { status: 201 }) : NextResponse.json({ error: 'Invalid name' }, { status: 400 })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const name = req.nextUrl.searchParams.get('name')
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  const ok = await deleteCloudFolder(auth.user.email, name)
  return NextResponse.json({ ok })
}
