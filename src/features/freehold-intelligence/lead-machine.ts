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

export const leadMachineListings: LeadMachineListing[] = [
  {
    id: "lm_palm_001",
    projectId: "freehold-palm-jumeirah-0033",
    projectName: "Palm Jumeirah Investor Pack",
    area: "Palm Jumeirah",
    developer: "Nakheel",
    imageUrl: "/images/property-beach-villa.jpg",
    startingPrice: 3200000,
    paymentPlan: "60/40 post-handover",
    priceStatus: "Ready",
    paymentPlanStatus: "Ready",
    mediaStatus: "Ready",
    hasMedia: true,
    hasIntelligenceBlocks: true,
    intelligenceBlocksAvailable: 6,
    dataQualityScore: 91,
    landingReadinessScore: 84,
    adReadinessScore: 62,
    opportunityScore: 88,
    landingStatus: "Needs Review",
    adStatus: "Blocked",
    blockerStatus: "Needs Access",
    currentCampaignStatus: "Paused",
    leadFormStatus: "Ready",
    whatsappFlowStatus: "Ready",
    missingRequirements: ["Meta billing owner", "Final landing approval"],
    linkedMilestoneId: "M5",
    owner: "Marketing",
    nextAction: "Approve landing or request copy edits.",
  },
  {
    id: "lm_hills_002",
    projectId: "freehold-dubai-hills-0012",
    projectName: "Dubai Hills Yield Campaign",
    area: "Dubai Hills Estate",
    developer: "Emaar",
    imageUrl: "/images/property-city-loft.jpg",
    startingPrice: 1850000,
    paymentPlan: "70/30 construction-linked",
    priceStatus: "Ready",
    paymentPlanStatus: "Ready",
    mediaStatus: "Ready",
    hasMedia: true,
    hasIntelligenceBlocks: true,
    intelligenceBlocksAvailable: 6,
    dataQualityScore: 86,
    landingReadinessScore: 92,
    adReadinessScore: 81,
    opportunityScore: 83,
    landingStatus: "Landing Active",
    adStatus: "Ready for Ads",
    blockerStatus: "Clear",
    currentCampaignStatus: "Approved",
    leadFormStatus: "Ready",
    whatsappFlowStatus: "Ready",
    missingRequirements: ["Ad angle approval"],
    linkedMilestoneId: "M5",
    owner: "Marketing",
    nextAction: "Create ad request for investor angle.",
  },
  {
    id: "lm_bay_003",
    projectId: "freehold-business-bay-0008",
    projectName: "Business Bay Entry Offer",
    area: "Business Bay",
    developer: "Binghatti",
    imageUrl: "/images/property-city-loft.jpg",
    startingPrice: 1100000,
    paymentPlan: null,
    priceStatus: "Ready",
    paymentPlanStatus: "Missing",
    mediaStatus: "Weak",
    hasMedia: true,
    hasIntelligenceBlocks: true,
    intelligenceBlocksAvailable: 6,
    dataQualityScore: 64,
    landingReadinessScore: 28,
    adReadinessScore: 18,
    opportunityScore: 71,
    landingStatus: "Needs Landing",
    adStatus: "Missing Data",
    blockerStatus: "Needs Data",
    currentCampaignStatus: "Landing Draft",
    leadFormStatus: "Missing",
    whatsappFlowStatus: "Needs Review",
    missingRequirements: ["Landing page", "Hero media check", "Payment plan summary", "Lead form"],
    linkedMilestoneId: "M3",
    owner: "Data Manager",
    nextAction: "Request landing page generation.",
  },
]

export const leadMachineLandings: LeadMachineLanding[] = [
  {
    id: "landing_palm_investor",
    projectId: "freehold-palm-jumeirah-0033",
    landingUrl: "/lp/palm-investor-preview",
    status: "Pending Review",
    completion: 84,
    heroStatus: "Ready",
    projectInfoStatus: "Ready",
    paymentPlanStatus: "Ready",
    locationStatus: "Ready",
    leadFormStatus: "Ready",
    whatsappStatus: "Ready",
    agentCardStatus: "Ready",
    trackingStatus: "Needs Review",
    seoStatus: "Ready",
    mobileStatus: "Ready",
    imageQuality: "Strong",
    reviewerStatus: "Waiting owner approval",
    aiReviewSummary: "The landing is campaign usable. Tracking confirmation and owner approval are the two remaining launch gates.",
    recommendedEdits: ["Confirm Meta pixel event", "Tighten hero CTA around investor comparison", "Add payment-plan proof point above the lead form"],
  },
  {
    id: "landing_hills_yield",
    projectId: "freehold-dubai-hills-0012",
    landingUrl: "/lp/dubai-hills-yield-preview",
    status: "Approved",
    completion: 94,
    heroStatus: "Ready",
    projectInfoStatus: "Ready",
    paymentPlanStatus: "Ready",
    locationStatus: "Ready",
    leadFormStatus: "Ready",
    whatsappStatus: "Ready",
    agentCardStatus: "Ready",
    trackingStatus: "Ready",
    seoStatus: "Ready",
    mobileStatus: "Ready",
    imageQuality: "Strong",
    reviewerStatus: "Approved",
    aiReviewSummary: "Ready for paid traffic once the campaign angle is approved.",
    recommendedEdits: ["Approve investor yield angle", "Attach final creative"],
  },
]

export const leadMachineAdRequests: LeadMachineAdRequest[] = [
  {
    id: "adreq_hills_001",
    projectId: "freehold-dubai-hills-0012",
    platform: "Meta",
    campaignObjective: "Lead generation",
    campaignAngle: "Dubai Hills family-investor yield corridor",
    buyerIntent: "Investor comparing location quality and payment flexibility",
    budget: "AED 450/day",
    creativeRequirement: "Two static creatives and one short-form video hook",
    landingId: "landing_hills_yield",
    leadForm: "High-intent investor form",
    whatsappFlow: "Agent handoff with payment-plan prompt",
    status: "Pending Review",
    blockers: ["Campaign angle approval"],
    approvalStatus: "Waiting marketing review",
    owner: "Marketing",
    linkedMilestoneId: "M7",
  },
]

export const leadMachineRequirements: LeadMachineRequirement[] = [
  { id: "req_meta_billing", projectId: "freehold-palm-jumeirah-0033", adRequestId: "adreq_palm_001", type: "Meta billing issue", title: "Please fix Meta billing", description: "Campaign launch cannot proceed until the ad account billing owner is confirmed.", severity: "critical", owner: "Owner", status: "Needs Access", nextAction: "Assign billing owner and confirm payment method.", linkedTaskId: "task_meta_billing", linkedMilestoneId: "M9", dueDate: "2026-05-22" },
  { id: "req_tracking", projectId: "freehold-palm-jumeirah-0033", adRequestId: "adreq_palm_001", type: "Conversion event missing", title: "Confirm conversion event", description: "Pixel is present but lead event mapping needs review before launch.", severity: "high", owner: "MTC", status: "In Progress", nextAction: "Confirm Lead event and test form submission.", linkedTaskId: "task_tracking", linkedMilestoneId: "M5", dueDate: "2026-05-23" },
  { id: "req_payment_plan", projectId: "freehold-business-bay-0008", type: "Missing payment plan", title: "Payment plan incomplete", description: "Listing can receive a landing only after payment plan details are added.", severity: "medium", owner: "Data Manager", status: "Open", nextAction: "Add verified payment plan and handover context.", linkedTaskId: "task_payment_plan", linkedMilestoneId: "M3", dueDate: "2026-05-24" },
]

export const leadMachineComments: LeadMachineComment[] = [
  { id: "comment_landing_copy", type: "correction", source: "landing", projectId: "freehold-palm-jumeirah-0033", body: "Hero CTA should ask for investor comparison, not generic availability.", owner: "Marketing", priority: "medium", expectedOutput: "Updated hero CTA and reviewer note", successEvent: "Landing review moves to approved", linkedMilestoneId: "M5", createdAt: "2026-05-22T05:10:00+04:00" },
  { id: "comment_access", type: "access request", source: "requirement", projectId: "freehold-palm-jumeirah-0033", body: "Need Meta billing owner before launch approval.", owner: "Owner", priority: "critical", expectedOutput: "Billing access confirmed", successEvent: "Ad request can move to ready to launch", linkedMilestoneId: "M9", createdAt: "2026-05-22T05:25:00+04:00" },
]

export const leadMachineAIResponses: LeadMachineAIMessage[] = [
  {
    id: "lm_ai_ready_ads",
    role: "assistant",
    content: "Found one listing ready for ads and two high-opportunity listings needing approval or data fixes. Dubai Hills is ready once the campaign angle is approved.",
    cardType: "matrix",
    linkedProjectIds: ["freehold-dubai-hills-0012", "freehold-palm-jumeirah-0033", "freehold-business-bay-0008"],
    linkedRequestIds: ["adreq_hills_001"],
    createdAt: "2026-05-22T05:45:00+04:00",
  },
]

const scoreBand = (score: number) => {
  if (score >= 81) return "Ready for Campaign"
  if (score >= 61) return "Good"
  if (score >= 31) return "Needs Work"
  return "Weak"
}

export function getLeadMachineSummary() {
  return {
    totalListings: 933,
    landingPagesReady: 126,
    missingLandingPages: leadMachineListings.filter((listing) => listing.landingStatus === "Needs Landing").length,
    adsReady: 42,
    pendingAdRequests: leadMachineAdRequests.filter((request) => request.status === "Pending Review").length,
    pendingLandingReviews: leadMachineLandings.filter((landing) => landing.status === "Pending Review").length,
    blockedByAccess: leadMachineRequirements.filter((requirement) => requirement.status === "Needs Access").length,
    missingData: leadMachineListings.filter((listing) => listing.blockerStatus === "Needs Data").length,
    approvedForLaunch: leadMachineListings.filter((listing) => listing.adStatus === "Ready for Ads").length,
    aiRecommendedActions: 6,
  }
}

export function getLeadMachineListing(projectId: string) {
  return leadMachineListings.find((listing) => listing.projectId === projectId || listing.id === projectId) ?? null
}

export function getLeadMachineLanding(projectId: string) {
  return leadMachineLandings.find((landing) => landing.projectId === projectId) ?? null
}

export function getLeadMachineAdRequest(projectId: string) {
  return leadMachineAdRequests.find((request) => request.projectId === projectId) ?? null
}

export function getLeadMachineRequirements(projectId?: string) {
  return projectId ? leadMachineRequirements.filter((requirement) => requirement.projectId === projectId) : leadMachineRequirements
}

export function getLeadMachineComments(projectId?: string) {
  return projectId ? leadMachineComments.filter((comment) => comment.projectId === projectId) : leadMachineComments
}

export function getLeadMachineMatrix() {
  return leadMachineListings.map((listing) => ({
    project: listing.projectName,
    area: listing.area,
    developer: listing.developer,
    landingStatus: listing.landingStatus,
    dataQuality: listing.dataQualityScore,
    mediaQuality: listing.mediaStatus,
    paymentPlanReady: listing.paymentPlanStatus === "Ready",
    intelligenceBlocks: listing.intelligenceBlocksAvailable,
    adReadiness: listing.adReadinessScore,
    opportunityScore: listing.opportunityScore,
    opportunityBand: scoreBand(listing.opportunityScore),
    blocker: listing.missingRequirements[0] ?? "None",
    nextAction: listing.nextAction,
  }))
}

export function createLeadMachineAiResponse(prompt: string) {
  const normalized = prompt.toLowerCase()
  const readyListings = leadMachineListings.filter((listing) => listing.adReadinessScore >= 70 && listing.landingReadinessScore >= 80)
  const blocked = leadMachineRequirements.filter((requirement) => requirement.status !== "Done")

  if (normalized.includes("matrix")) {
    return {
      answer: "Here is the readiness matrix. Use it to prioritize campaign launch decisions by opportunity, landing readiness and blockers.",
      cardType: "matrix",
      matrix: getLeadMachineMatrix(),
    }
  }

  if (normalized.includes("block") || normalized.includes("requirement")) {
    return {
      answer: "The main launch blocker is Meta billing access. Tracking and missing payment plan data are secondary blockers.",
      cardType: "requirement",
      requirements: blocked,
    }
  }

  return {
    answer: `Found ${readyListings.length} listing ready for ads. Dubai Hills is the cleanest launch candidate; Palm is high opportunity but blocked by access and approval.`,
    cardType: "listing",
    listings: readyListings.length ? readyListings : leadMachineListings,
  }
}
