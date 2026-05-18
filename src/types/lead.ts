export type LeadStage = "New" | "Contacted" | "Qualified" | "Viewing" | "Negotiation" | "Closed" | "Lost"
export type LeadTemperature = "Cold" | "Warm" | "Hot" | "Priority"

export type Lead = {
  id: string
  leadName: string
  phone: string
  email: string
  source: string
  interestedProjectId: string
  interestedProjectName: string
  budget: number
  buyerType: string
  stage: LeadStage
  leadTemperature: LeadTemperature
  lastContact: string
  nextAction: string
  aiSummary: string
  assignedAgent: string
  notes: string[]
  createdAt: string
}
