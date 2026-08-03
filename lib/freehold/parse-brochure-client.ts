'use client'
import { upload } from '@vercel/blob/client'

/**
 * The hosting platform hard-rejects request bodies over ~4.5 MB before our
 * code runs, so brochures above this ride a direct browser → Vercel Blob
 * upload instead of a multipart POST.
 */
export const BROCHURE_INLINE_LIMIT = 4_300_000
/** Absolute brochure ceiling — enforced client-side here, in the Blob token
 *  route, and again on the fetched bytes server-side. */
export const BROCHURE_MAX_BYTES = 12 * 1024 * 1024

/**
 * POST a brochure PDF to /api/dashboard/projects/parse-brochure, picking the
 * transport by size: small files go as FormData (unchanged fast path); files
 * between the platform body cap and 12 MB are uploaded by the browser directly
 * to Vercel Blob (same token route pattern as reel videos) and referenced as
 * JSON {url}. Callers must reject files over BROCHURE_MAX_BYTES beforehand.
 *
 * Throws with the REAL error message when the Blob upload fails (e.g. missing
 * BLOB_READ_WRITE_TOKEN) — callers surface it verbatim, never a generic one.
 */
export async function postBrochureForParse(file: File): Promise<Response> {
  if (file.size <= BROCHURE_INLINE_LIMIT) {
    const fd = new FormData()
    fd.append('file', file)
    return fetch('/api/dashboard/projects/parse-brochure', { method: 'POST', body: fd })
  }
  const put = await upload(file.name, file, {
    access: 'public',
    handleUploadUrl: '/api/freehold/drive/upload-brochure',
  })
  return fetch('/api/dashboard/projects/parse-brochure', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: put.url }),
  })
}
