import { redirect } from 'next/navigation'

// Landing Pages moved to Inventory — old edit-requests links keep working.
export default function LegacyLandingRequestsPage() {
  redirect('/freehold-intelligence/inventory/landings/requests')
}
