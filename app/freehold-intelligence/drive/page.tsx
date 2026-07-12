'use client'

import { AssetBrowser } from '@/components/freehold/drive/asset-browser'

// Drive Home — everything you make: landing pages (as real-estate cards that
// open in their editor) alongside the Library store. Landings render inside
// the AssetBrowser now; the standalone strip was a duplicate and was removed.
export default function DriveHomePage() {
  return <AssetBrowser scope="all" />
}
