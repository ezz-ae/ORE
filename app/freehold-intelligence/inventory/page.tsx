import { getInventoryPropertiesFromDB } from '@/lib/inventory-data'
import InventoryClient from './inventory-client'

// Operational system: serve only real inventory from the database. No seed
// fallback — an empty database renders a clean empty state, never demo data.
export default async function InventoryPage() {
  const properties = await getInventoryPropertiesFromDB()
  return <InventoryClient initialProperties={properties} />
}
