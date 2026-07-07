import { redirect } from 'next/navigation'

// The listings workspace was seed-data; projects live in Inventory. Old links
// carry seed ids that don't exist there, so land on the real projects list.
export default function LegacyListingRedirect() {
  redirect('/freehold-intelligence/inventory/projects')
}
