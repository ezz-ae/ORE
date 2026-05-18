import type { Lead } from "@/src/types/lead"
import type { Project } from "@/src/types/project"

export function buildMarketOpportunity(project: Project): Lead {
  return {
    id: `l-market-${project.id}`,
    leadName: "New Freehold Opportunity",
    phone: "+971 50 000 2026",
    email: "opportunity@freeholdproperty.ae",
    source: "Market Database",
    interestedProjectId: project.id,
    interestedProjectName: project.projectName,
    budget: project.startingPrice + 250000,
    buyerType: "Investor",
    stage: "New",
    leadTemperature: "Hot",
    lastContact: "2026-05-18",
    nextAction: "Attach campaign brief from Ads Studio and send first WhatsApp qualification.",
    aiSummary: `Created from ${project.projectName} market action. Best angle: ${project.adAngle}`,
    assignedAgent: "Mahmoud",
    notes: ["Created from Market Database action", project.roiNote],
    createdAt: "2026-05-18",
  }
}
