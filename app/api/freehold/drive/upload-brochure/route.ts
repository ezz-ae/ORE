import { NextRequest, NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { requireSession } from '@/lib/freehold/api-auth'
import { cloudConfigured } from '@/lib/freehold/cloud'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Signs a short-lived token so the browser uploads a brochure PDF DIRECTLY to
// Vercel Blob (bytes never pass through this function — the platform caps
// request bodies at ~4.5 MB, so 4.3–12 MB brochures can't ride a FormData
// POST). Auth-gated, same pattern as upload-video. The client then POSTs the
// returned blob URL to /api/dashboard/projects/parse-brochure as JSON {url}.
export async function POST(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  if (!cloudConfigured()) {
    return NextResponse.json({ error: 'Large-PDF upload needs Blob storage — set BLOB_READ_WRITE_TOKEN.' }, { status: 503 })
  }

  const body = (await req.json()) as HandleUploadBody
  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ['application/pdf'],
        maximumSizeInBytes: 12 * 1024 * 1024, // 12MB per brochure
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({ email: auth.user.email }),
      }),
      // The client immediately POSTs the URL to parse-brochure; nothing to do here.
      onUploadCompleted: async () => { /* client drives the parse step */ },
    })
    return NextResponse.json(json)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Upload failed' }, { status: 400 })
  }
}
