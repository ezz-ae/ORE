import { getInventoryPropertiesFromDB } from '@/lib/inventory-data'
import { readOpportunityScores } from '@/lib/freehold/opportunity'
import InventoryClient from './inventory-client'

// Operational system: serve only real inventory from the database. No seed
// fallback — an empty database renders a clean empty state, never demo data.
export default async function InventoryPage() {
  const [properties, opportunityScores] = await Promise.all([
    getInventoryPropertiesFromDB(),
    // Stored Opportunity Engine scores (Layer 3) — served as-is from the table;
    // a project with no stored score (or an honest null) renders a dash.
    readOpportunityScores(),
  ])
  const opportunityBySlug: Record<string, number | null> = {}
  for (const s of opportunityScores) opportunityBySlug[s.projectSlug] = s.score
  return <InventoryClient initialProperties={properties} opportunityBySlug={opportunityBySlug} />
}
