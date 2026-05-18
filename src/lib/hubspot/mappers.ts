import type { Lead } from "@/src/types/lead"

export function mapLeadToHubSpotContact(lead: Lead) {
  const [firstName, ...lastNameParts] = lead.leadName.split(" ")
  return {
    properties: {
      firstname: firstName,
      lastname: lastNameParts.join(" "),
      email: lead.email,
      phone: lead.phone,
      lead_source: lead.source,
      interested_project: lead.interestedProjectName,
      budget: String(lead.budget),
      lead_stage: lead.stage,
      lead_temperature: lead.leadTemperature,
      assigned_agent: lead.assignedAgent,
    },
  }
}
