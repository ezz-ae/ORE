'use client'

import { AssetBrowser } from '@/components/freehold/drive/asset-browser'
import { DraftsShelf } from '@/components/freehold/drive/drafts-shelf'

// Drive Home — everything you make: a "Continue editing" shelf of autosaved
// drafts, then landing pages (as real-estate cards that open in their editor)
// alongside the Library store.
export default function DriveHomePage() {
  return (
    <>
      <DraftsShelf />
      <AssetBrowser scope="all" />
    </>
  )
}
