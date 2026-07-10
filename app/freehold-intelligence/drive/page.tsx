'use client'

import { AssetBrowser } from '@/components/freehold/drive/asset-browser'
import { LandingsStrip } from '@/components/freehold/drive/landings-strip'

// Drive Home — everything you make: landing pages (their own editor) + the
// Library store, each opening in the right editor.
export default function DriveHomePage() {
  return (
    <>
      <LandingsStrip />
      <AssetBrowser scope="all" />
    </>
  )
}
