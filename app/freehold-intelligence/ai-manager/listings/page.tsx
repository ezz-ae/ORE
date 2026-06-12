import { getInventoryPropertiesFromDB } from '@/lib/inventory-data'
import { inventoryProperties } from '@/src/features/freehold-intelligence/inventory'
import ListingsClient from './listings-client'

export default async function AiManagerListingsPage() {
  const dbProperties = await getInventoryPropertiesFromDB()
  const properties = dbProperties.length > 0 ? dbProperties : inventoryProperties
  return <ListingsClient initialProperties={properties} />
}
