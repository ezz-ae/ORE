import { getInventoryPropertiesFromDB } from '@/lib/inventory-data'
import { inventoryProperties } from '@/src/features/freehold-intelligence/inventory'
import ProjectsClient from './projects-client'

export default async function ProjectsPage() {
  const dbProperties = await getInventoryPropertiesFromDB()
  const properties = dbProperties.length > 0 ? dbProperties : inventoryProperties
  return <ProjectsClient initialProperties={properties} />
}
