import { getInventoryPropertiesFromDB } from '@/lib/inventory-data'
import LandingsClient from './_client'

export const dynamic = 'force-dynamic'

export default async function LandingsPage() {
  const dbProperties = await getInventoryPropertiesFromDB()
  const data = dbProperties
  return <LandingsClient initialProperties={data} />
}
