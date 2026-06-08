import { getInventoryPropertiesFromDB } from '@/lib/inventory-data'
import { inventoryProperties } from '@/src/features/freehold-intelligence/inventory'
import DashboardClient from './dashboard-client'

export default async function IntelligencePage() {
  const dbProperties = await getInventoryPropertiesFromDB()
  const data = dbProperties.length > 0 ? dbProperties : inventoryProperties
  return <DashboardClient inventoryData={data} />
}
