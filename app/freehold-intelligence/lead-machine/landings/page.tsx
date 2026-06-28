import { getInventoryPropertiesFromDB } from '@/lib/inventory-data'
import { inventoryProperties } from '@/src/features/freehold-intelligence/inventory'
import LandingsClient from './_client'

export const dynamic = 'force-dynamic'

export default async function LandingsPage() {
  const dbProperties = await getInventoryPropertiesFromDB()
  const data = dbProperties.length > 0 ? dbProperties : inventoryProperties
  return <LandingsClient initialProperties={data} />
}
