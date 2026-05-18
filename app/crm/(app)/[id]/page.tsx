import { notFound } from "next/navigation"
import { CommandShell } from "@/src/components/command/CommandShell"
import { LeadDetailClient } from "@/src/components/crm/LeadDetailClient"
import { leads } from "@/src/data/leads"
import { projects } from "@/src/data/projects"
import { buildMarketOpportunity } from "@/src/lib/crm/opportunities"
import { getHubSpotStatus } from "@/src/lib/hubspot/client"

export default async function CRMLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const marketProjectId = id.startsWith("l-market-") ? id.replace("l-market-", "") : null
  const marketProject = marketProjectId ? projects.find((item) => item.id === marketProjectId) : undefined
  const lead = leads.find((item) => item.id === id) || (marketProject ? buildMarketOpportunity(marketProject) : undefined)
  if (!lead) notFound()
  const project = projects.find((item) => item.id === lead.interestedProjectId)
  const hubspot = getHubSpotStatus()
  return (
    <CommandShell>
      <LeadDetailClient lead={lead} project={project} hubspotConnected={hubspot.connected} />
    </CommandShell>
  )
}
