import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { listExtensions } from '@/lib/google/client'
import { GoogleConfigError, GoogleApiError, type GoogleExtension } from '@/lib/google/types'
import { demoExtensions } from '@/lib/google/demo-data'
import { listLocalEntities, createLocalEntity, removeLocalEntity, localId } from '@/lib/google/local-store'

const KIND = 'extension'

export async function GET() {
  const __auth = await requireSession()
  if ('res' in __auth) return __auth.res
  try {
    const extensions = await listExtensions()
    return NextResponse.json({ extensions })
  } catch (e) {
    if (e instanceof GoogleConfigError) {
      const local = await listLocalEntities<GoogleExtension>(KIND)
      return NextResponse.json({ extensions: [...local, ...demoExtensions], demo: true })
    }
    if (e instanceof GoogleApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}

// Create a SITELINK (link text + URL) or CALLOUT (text only) extension.
export async function POST(req: Request) {
  const __auth = await requireSession()
  if ('res' in __auth) return __auth.res
  const body = await req.json().catch(() => null) as { type?: string; text?: string; finalUrl?: string } | null
  const text = body?.text?.trim()
  if (!text) return NextResponse.json({ error: 'text is required' }, { status: 400 })
  const id = localId('ext')
  let extension: GoogleExtension
  if (body?.type === 'CALLOUT') {
    extension = { type: 'CALLOUT', id, calloutText: text }
  } else {
    extension = {
      type: 'SITELINK',
      id,
      linkText: text,
      finalUrls: [body?.finalUrl?.trim() || 'https://freeholdproperty.ae'],
    }
  }
  await createLocalEntity(KIND, extension)
  return NextResponse.json({ extension, demo: true }, { status: 201 })
}

export async function DELETE(req: Request) {
  const __auth = await requireSession()
  if ('res' in __auth) return __auth.res
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  await removeLocalEntity(KIND, id)
  return NextResponse.json({ ok: true })
}
