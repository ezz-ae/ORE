'use client'

import { AssetBrowser } from '@/components/freehold/drive/asset-browser'

// Drive Home — the unified asset browser. Rides on the real Library store
// (/api/freehold/library). Landing + notebook aggregation is a fast-follow.
export default function DriveHomePage() {
  return <AssetBrowser scope="all" />
}
