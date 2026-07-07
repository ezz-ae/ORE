export type LeadMachineStatus =
  | "Landing Active"
  | "Landing Draft"
  | "Needs Landing"
  | "Ready for Ads"
  | "Needs Review"
  | "Missing Data"
  | "Blocked"
  | "Approved"
  | "Campaign Running"
  | "Paused"

export type LeadMachineListing = {
  id: string
  projectId: string
  projectName: string
  area: string
  developer: string
  imageUrl: string
  startingPrice: number | null
  paymentPlan: string | null
  priceStatus: "Ready" | "Missing"
  paymentPlanStatus: "Ready" | "Needs Detail" | "Missing"
  mediaStatus: "Ready" | "Weak" | "Missing"
  hasMedia: boolean
  hasIntelligenceBlocks: boolean
  intelligenceBlocksAvailable: number
  dataQualityScore: number
  landingReadinessScore: number
  adReadinessScore: number
  opportunityScore: number
  landingStatus: LeadMachineStatus
  /** Full relative path to the live landing page, e.g. /lp/palm-investor-preview. Populated when landingStatus === "Landing Active". */
  landingUrl?: string
  adStatus: LeadMachineStatus
  blockerStatus: "Clear" | "Needs Access" | "Needs Data" | "Blocked"
  currentCampaignStatus: LeadMachineStatus
  leadFormStatus: "Ready" | "Missing" | "Needs Review"
  whatsappFlowStatus: "Ready" | "Missing" | "Needs Review"
  missingRequirements: string[]
  linkedMilestoneId: "M3" | "M5" | "M6" | "M7" | "M9"
  owner: string
  nextAction: string
}

export type LeadMachineLanding = {
  id: string
  projectId: string
  landingUrl: string
  status: string
  completion: number
  heroStatus: string
  projectInfoStatus: string
  paymentPlanStatus: string
  locationStatus: string
  leadFormStatus: string
  whatsappStatus: string
  agentCardStatus: string
  trackingStatus: string
  seoStatus: string
  mobileStatus: string
  imageQuality: string
  reviewerStatus: string
  aiReviewSummary: string
  recommendedEdits: string[]
}

export type LeadMachineAdRequest = {
  id: string
  projectId: string
  platform: "Meta" | "Google" | "Both"
  campaignObjective: string
  campaignAngle: string
  buyerIntent: string
  budget: number | string
  creativeRequirement: string
  landingId: string
  leadForm: string
  whatsappFlow: string
  status: "Draft" | "Pending Review" | "Approved" | "Needs Changes" | "Blocked" | "Ready to Launch" | "Running" | "Paused"
  blockers: string[]
  approvalStatus: string
  owner: string
  linkedMilestoneId: string
}

export type LeadMachineRequirement = {
  id: string
  projectId: string
  adRequestId?: string
  type: string
  title: string
  description: string
  severity: "critical" | "high" | "medium" | "low"
  owner: string
  status: "Open" | "In Progress" | "Needs Access" | "Needs Decision" | "Blocked" | "Done"
  nextAction: string
  linkedTaskId?: string
  linkedMilestoneId: string
  dueDate: string
}

export type LeadMachineComment = {
  id: string
  type: "suggestion" | "issue" | "correction" | "approval" | "question" | "access request" | "decision required"
  source: "listing" | "landing" | "ad_request" | "requirement"
  projectId: string
  body: string
  owner: string
  priority: "critical" | "high" | "medium" | "low"
  expectedOutput: string
  successEvent: string
  linkedMilestoneId: string
  createdAt: string
}

export type LeadMachineAIMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  cardType: "listing" | "landing_review" | "ad_request" | "requirement" | "matrix" | "approval" | "task" | "warning" | "recommendation"
  linkedProjectIds: string[]
  linkedRequestIds: string[]
  createdAt: string
}

// The seed data arrays (listings, landings, ad requests, requirements,
// comments, AI responses) and their getters were removed for handover:
// every consumer now reads live data. Only the shared types remain.
