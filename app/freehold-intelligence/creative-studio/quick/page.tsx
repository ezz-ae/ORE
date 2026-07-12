import { getInventoryPropertiesFromDB } from '@/lib/inventory-data'
import QuickClient from './_client'

export const dynamic = 'force-dynamic'

export default async function QuickGeneratePage() {
  const properties = await getInventoryPropertiesFromDB()
  return <QuickClient properties={properties} />
}
