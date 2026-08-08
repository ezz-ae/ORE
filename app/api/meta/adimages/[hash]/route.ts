import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'
import { getAdImageBytes, MetaApiError, MetaConfigError } from '@/lib/meta/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED = [...MANAGEMENT_ROLES, 'marketing'] as const

/**
 * Serve an already-uploaded ad image from OUR origin, by its Meta hash.
 *
 * The ad launcher's preview kept coming up blank. It showed whatever local
 * preview URL the browser happened to be holding — an in-memory blob: URL made
 * from the file the operator had just picked. That URL dies with the page, so
 * reloading the wizard, or resuming the same draft on another device, left an
 * empty frame under an image that had uploaded fine and would have launched
 * fine. The picture was there; only the way of looking at it was gone.
 *
 * The hash is the durable half — it is what launches. This route turns it back
 * into something an <img> can render: the server fetches the bytes from Meta
 * (where no browser hotlink rule applies) and streams them back. A hash is
 * content-addressed, so the answer can be cached hard and privately.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ hash: string }> },
) {
  const auth = await requireSession([...ALLOWED])
  if ('res' in auth) return auth.res

  const { hash } = await params
  // Meta image hashes are hex; anything else is not a hash we uploaded and is
  // never worth a round trip.
  if (!/^[a-f0-9]{8,64}$/i.test(hash)) {
    return NextResponse.json({ error: 'Not an image hash' }, { status: 400 })
  }

  try {
    const img = await getAdImageBytes(hash)
    if (!img) return NextResponse.json({ error: 'No such image' }, { status: 404 })
    return new NextResponse(img.body, {
      headers: {
        'Content-Type': img.contentType,
        // Same hash, same bytes, forever — but it is this tenant's creative,
        // so no shared/CDN cache.
        'Cache-Control': 'private, max-age=31536000, immutable',
      },
    })
  } catch (err) {
    if (err instanceof MetaConfigError) return NextResponse.json({ error: err.message }, { status: 409 })
    if (err instanceof MetaApiError) return NextResponse.json({ error: err.message }, { status: 400 })
    return NextResponse.json({ error: 'Could not load the image' }, { status: 500 })
  }
}
