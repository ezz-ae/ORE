import { getInventoryPropertiesFromDB } from '@/lib/inventory-data'
import ProjectsClient from './projects-client'

// Real DB inventory only — no seed fallback.
export default async function ProjectsPage() {
  const properties = await getInventoryPropertiesFromDB()
  return <ProjectsClient initialProperties={properties} />
}
