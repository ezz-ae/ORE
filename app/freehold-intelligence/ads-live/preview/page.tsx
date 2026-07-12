import { redirect } from 'next/navigation'

// The standalone ad-preview page is retired: placement previews live inside
// the campaign wizard now (the "Preview placements" popup on the creative
// step), where they're actually needed. Old bookmarks land there too.
export default function RetiredAdPreviewPage() {
  redirect('/freehold-intelligence/lead-machine/campaigns/new')
}
