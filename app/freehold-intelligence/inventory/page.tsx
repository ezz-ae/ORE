import { getInventoryPropertiesFromDB } from '@/lib/inventory-data'
import { inventoryProperties } from '@/src/features/freehold-intelligence/inventory'
import InventoryClient from './inventory-client'

export default async function InventoryPage() {
  const dbProperties = await getInventoryPropertiesFromDB()
  const properties = dbProperties.length > 0 ? dbProperties : inventoryProperties
  return <InventoryClient initialProperties={properties} />
}
