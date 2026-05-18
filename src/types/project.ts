export type ProjectStatus = "Ready" | "Off-plan" | "Under construction" | "Secondary" | "Rental"

export type Project = {
  id: string
  projectName: string
  developer: string
  emirate: string
  area: string
  startingPrice: number
  unitTypes: string[]
  paymentPlan: string
  handover: string
  status: ProjectStatus
  campaignReadiness: number
  salesAngle: string
  adAngle: string
  buyerProfile: string
  roiNote: string
  confidence: number
  lastUpdated: string
  tags: string[]
}
