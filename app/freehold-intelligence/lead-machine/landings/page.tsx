import { redirect } from 'next/navigation'

// Landing Pages now live with the inventory they advertise — Inventory is the
// one home. Old Ads links keep working via this redirect.
export default function LegacyLandingsPage() {
  redirect('/freehold-intelligence/inventory/landings')
}
