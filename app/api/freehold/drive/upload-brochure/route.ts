import { NextRequest, NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { requireSession } from '@/lib/freehold/api-auth'
import { cloudConfigured } from '@/lib/freehold/cloud'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Signs a short-lived token so the browser uploads a brochure PDF DIRECTLY to
// Vercel Blob (bytes never pass through this function — the platform caps
// request bodies at ~4.5 MB, so 4.3–30 MB brochures can't ride a FormData
// POST). Auth-gated, same pattern as upload-video. The client then POSTs the
// returned blob URL to /api/dashboard/projects/parse-brochure as JSON {url}.
export async function POST(req: NextRequest) {
  if (!cloudConfigured()) {
    return NextResponse.json({ error: 'Large-PDF upload needs Blob storage — set BLOB_READ_WRITE_TOKEN.' }, { status: 503 })
  }

  const body = (await req.json()) as HandleUploadBody

  // Two callers, one route: the BROWSER asking for an upload token (cookie,
  // must be authenticated) and VERCEL BLOB reporting the bytes landed (a
  // server-to-server call with no cookie). Gating both meant the completion
  // callback got a 401 forever — the transfer finished but the flow never
  // closed, so the screen sat at "uploading" with nothing left to upload.
  // `handleUpload` verifies Blob's signature on that callback, which is a
  // stronger credential than a cookie and the only one it can carry.
  const fromBrowser = body.type === 'blob.generate-client-token'
  let uploader = 'blob-callback'
  if (fromBrowser) {
    const auth = await requireSession()
    if ('res' in auth) return auth.res
    uploader = auth.user.email
  }
  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ['application/pdf'],
        maximumSizeInBytes: 30 * 1024 * 1024, // 30MB per brochure
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({ email: uploader }),
      }),
      // The client immediately POSTs the URL to parse-brochure; nothing to do here.
      onUploadCompleted: async () => { /* client drives the parse step */ },
    })
    return NextResponse.json(json)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Upload failed' }, { status: 400 })
  }
}
