'use client'

import { AssetBrowser } from '@/components/freehold/drive/asset-browser'

// Library — the canonical home for the freehold_site_library store, relocated
// under Drive. Same component as Drive Home, scoped to the Library.
export default function DriveLibraryPage() {
  return <AssetBrowser scope="library" />
}
