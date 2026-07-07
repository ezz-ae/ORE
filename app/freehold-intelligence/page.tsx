import { getInventoryPropertiesFromDB } from '@/lib/inventory-data'
import DashboardClient from './dashboard-client'

export default async function IntelligencePage() {
  // Live inventory only — the hub's widgets hide themselves when a source is
  // empty, so a fresh workspace shows a clean hub, never seed numbers.
  const dbProperties = await getInventoryPropertiesFromDB()
  return <DashboardClient inventoryData={dbProperties} />
}
