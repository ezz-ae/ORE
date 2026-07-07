import { redirect } from 'next/navigation'

// Listings was a seed-data duplicate of Inventory. One source of truth:
// Inventory IS the projects on the front-end site.
export default function LegacyListingsRedirect() {
  redirect('/freehold-intelligence/inventory/projects')
}
