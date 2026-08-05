import { getInventoryPropertiesFromDB } from '@/lib/inventory-data'
import QuickClient from '../quick/_client'
import { PresentersHeader } from '../_home-header'

export const dynamic = 'force-dynamic'

// Presenters — the smart-form creator (presenter · property · format · brief →
// generate) that used to be the Creative Studio home surface. The home is now
// the suite's tool grid; this keeps its own room.
export default async function PresentersPage() {
  const properties = await getInventoryPropertiesFromDB()
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
      <PresentersHeader />
      <QuickClient properties={properties} embedded />
    </div>
  )
}
