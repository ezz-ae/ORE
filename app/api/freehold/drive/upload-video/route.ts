import { NextRequest, NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { requireSession } from '@/lib/freehold/api-auth'
import { cloudConfigured } from '@/lib/freehold/cloud'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Signs a short-lived token so the browser uploads a video DIRECTLY to Vercel
// Blob (bytes never pass through this function — essential for large clips).
// Auth-gated. The client creates the library row from the returned URL via
// /api/freehold/library afterward, then opens the video editor on it.
export async function POST(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  if (!cloudConfigured()) {
    return NextResponse.json({ error: 'Video upload needs Blob storage — set BLOB_READ_WRITE_TOKEN.' }, { status: 503 })
  }

  const body = (await req.json()) as HandleUploadBody
  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ['video/mp4', 'video/webm', 'video/quicktime', 'video/*'],
        // 2GB. The old 200MB cap turned an ordinary phone clip into a dead end:
        // the file uploaded for minutes and was then refused, with the only way
        // forward being another website. Bytes go browser → Blob directly and
        // the client uploads large files in parallel parts, so a bigger ceiling
        // costs this function nothing. The client checks the size BEFORE
        // starting and offers to compress, so nobody waits to be told no.
        maximumSizeInBytes: 2 * 1024 * 1024 * 1024,
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({ email: auth.user.email }),
      }),
      // The client records the library row after upload(); nothing to do here.
      onUploadCompleted: async () => { /* client creates the library item */ },
    })
    return NextResponse.json(json)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Upload failed' }, { status: 400 })
  }
}
