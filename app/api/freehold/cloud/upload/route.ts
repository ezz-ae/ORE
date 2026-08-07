import { NextRequest, NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { requireSession } from '@/lib/freehold/api-auth'
import { cloudConfigured } from '@/lib/freehold/cloud'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Signs a short-lived token so the browser can upload a file DIRECTLY to Vercel
// Blob (bytes never pass through this function — that's what makes 20-image
// bulk uploads viable). Auth-gated: only a valid session can obtain a token.
// The client records the returned URL via /api/freehold/cloud/files afterward.
export async function POST(req: NextRequest) {
  if (!cloudConfigured()) {
    return NextResponse.json({ error: 'Cloud storage is not configured — set BLOB_READ_WRITE_TOKEN.' }, { status: 503 })
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
        // Real-estate working files: images, PDFs, office docs, CSV, plain text.
        allowedContentTypes: [
          'image/*', 'application/pdf',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword', 'text/csv', 'text/plain', 'application/zip',
        ],
        maximumSizeInBytes: 50 * 1024 * 1024, // 50MB per file
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({ email: uploader }),
      }),
      // Fires server-to-server in production. Metadata is also recorded by the
      // client after upload(), so this is a best-effort backstop only.
      onUploadCompleted: async () => { /* client records via /files */ },
    })
    return NextResponse.json(json)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Upload failed' }, { status: 400 })
  }
}
