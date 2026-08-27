import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'
import { uploadAdImage, ingestImageFromUrl, MetaApiError, MetaConfigError } from '@/lib/meta/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED = [...MANAGEMENT_ROLES, 'marketing'] as const
// Meta ad images should be well under a few MB; cap the base64 payload.
const MAX_BASE64 = 10 * 1024 * 1024

/**
 * Upload an ad image to the connected Meta ad account.
 * Body: { image: "<base64>" | "data:image/png;base64,..." }
 * Returns: { hash, url } — pass hash to the campaign creative as imageHash.
 */
export async function POST(req: NextRequest) {
  const auth = await requireSession([...ALLOWED])
  if ('res' in auth) return auth.res

  const body = await req.json().catch(() => ({})) as { image?: string; imageUrl?: string }

  // A URL IS INGESTED SERVER-SIDE. A generated image comes back as a URL on
  // the provider's host, and a browser cannot turn that into base64 — the
  // fetch is cross-origin and the canvas would taint. So the URL is handed
  // over and fetched here, which is also where the size and timeout limits
  // already live. Same path the creative variants use.
  const fromUrl = String(body.imageUrl ?? '').trim()
  if (fromUrl && !body.image) {
    if (!/^https:\/\//i.test(fromUrl)) {
      return NextResponse.json({ error: 'imageUrl must be https' }, { status: 400 })
    }
    const hash = await ingestImageFromUrl(fromUrl)
    // Named, never silent: an image that could not be fetched is a different
    // problem from one Meta rejected, and the screen says which.
    return hash
      ? NextResponse.json({ hash, url: fromUrl })
      : NextResponse.json({ error: 'That image could not be fetched or Meta refused it.' }, { status: 502 })
  }

  const raw = String(body.image ?? '')
  // Accept a data-URL or bare base64.
  const base64 = raw.includes(',') ? raw.slice(raw.indexOf(',') + 1) : raw
  if (!base64) return NextResponse.json({ error: 'No image provided' }, { status: 400 })
  if (base64.length > MAX_BASE64) return NextResponse.json({ error: 'Image is too large (max ~7MB).' }, { status: 413 })

  try {
    const { hash, url } = await uploadAdImage(base64)
    return NextResponse.json({ hash, url })
  } catch (err) {
    if (err instanceof MetaConfigError) {
      return NextResponse.json(
        { error: 'Connect Meta Ads first (Integrations → Meta Ads), then upload.', connected: false },
        { status: 409 },
      )
    }
    if (err instanceof MetaApiError) {
      return NextResponse.json({ error: `Meta rejected the image: ${err.message}` }, { status: 400 })
    }
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
