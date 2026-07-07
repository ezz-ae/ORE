import { getInventoryPropertiesFromDB } from '@/lib/inventory-data'
import ListingsClient from './listings-client'

export default async function AiManagerListingsPage() {
  const dbProperties = await getInventoryPropertiesFromDB()
  const properties = dbProperties
  return <ListingsClient initialProperties={properties} />
}
