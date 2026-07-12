import { getStoredCreds, setStoredCreds } from '@/lib/freehold/integration-credentials'

// ─── Global tracking pixels ───────────────────────────────────────────────────
// Set once under Integrations → Tracking, applied to EVERY landing page — so a
// broker never re-types the Meta/Google/TikTok ids per page. A landing page may
// still override an individual id, but blank falls back to these globals.

export interface TrackingPixels {
  metaPixelId: string
  googleTagId: string
  googleConversionId: string
  tiktokPixelId: string
}

const EMPTY: TrackingPixels = { metaPixelId: '', googleTagId: '', googleConversionId: '', tiktokPixelId: '' }
const PROVIDER = 'tracking'

const clean = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

export async function getGlobalPixels(): Promise<TrackingPixels> {
  const stored = await getStoredCreds<Partial<TrackingPixels>>(PROVIDER).catch(() => null)
  if (!stored) return EMPTY
  return {
    metaPixelId: clean(stored.metaPixelId),
    googleTagId: clean(stored.googleTagId),
    googleConversionId: clean(stored.googleConversionId),
    tiktokPixelId: clean(stored.tiktokPixelId),
  }
}

export async function saveGlobalPixels(p: Partial<TrackingPixels>, updatedBy: string): Promise<void> {
  await setStoredCreds(PROVIDER, {
    metaPixelId: clean(p.metaPixelId),
    googleTagId: clean(p.googleTagId),
    googleConversionId: clean(p.googleConversionId),
    tiktokPixelId: clean(p.tiktokPixelId),
  }, updatedBy)
}

/** Per-page override wins when set; blank falls back to the global pixel. */
export function mergePixels(global: TrackingPixels, page: Partial<TrackingPixels>): TrackingPixels {
  return {
    metaPixelId: clean(page.metaPixelId) || global.metaPixelId,
    googleTagId: clean(page.googleTagId) || global.googleTagId,
    googleConversionId: clean(page.googleConversionId) || global.googleConversionId,
    tiktokPixelId: clean(page.tiktokPixelId) || global.tiktokPixelId,
  }
}
