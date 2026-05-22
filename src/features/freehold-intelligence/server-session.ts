export type ServerRole = "owner" | "admin" | "marketing" | "sales_manager" | "sales_agent" | "data_manager" | "viewer"

export type ServerCardType =
  | "urgent_task"
  | "crm_alert"
  | "listing"
  | "landing_review"
  | "ad_requirement"
  | "approval_request"
  | "notebook_output"
  | "milestone"
  | "server_warning"
  | "recommendation"
  | "matrix"

export type ServerSessionUser = {
  id: string
  name: string
  role: ServerRole
  accountLevel: "owner" | "admin" | "operator" | "agent" | "viewer"
  assignedModules: string[]
}

export type ServerActionCard = {
  id: string
  type: ServerCardType
  title: string
  body: string
  priority: "critical" | "high" | "medium" | "low"
  app: string
  owner: string
  status: string
  due?: string
}

export type ServerSessionSummary = {
  userId: string
  role: ServerRole
  accountLevel: string
  generatedAt: string
  period: "24h"
  greeting: string
  summaryText: string
  urgentTasks: ServerActionCard[]
  blockedItems: ServerActionCard[]
  pendingApprovals: ServerActionCard[]
  crmAlerts: ServerActionCard[]
  leadMachineAlerts: ServerActionCard[]
  notebookRecentOutputs: ServerActionCard[]
  recommendedActions: ServerActionCard[]
  askableQuestions: string[]
}

export type ServerApp = {
  id: string
  name: string
  description: string
  status: "live" | "in_progress" | "planned" | "blocked"
  visibleToRoles: ServerRole[]
  urgentCount: number
  blockedCount: number
  pendingApprovalCount: number
  latestActivity: string
  linkedMilestoneId: string
  nextAction: string
  openComments: number
  href: string
}

export type CRMLeadIntelligence = {
  id: string
  hubspotLeadId: string
  name: string
  phone: string
  email: string
  source: string
  landingId: string
  campaignId: string
  stage: string
  intentScore: number
  urgency: "critical" | "high" | "medium" | "low"
  duplicateRisk: boolean
  wrongNumberRisk: boolean
  assignedAgent: string
  lastContactAt: string
  nextBestAction: string
  suggestedMessage: string
  aiSummary: string
}

export type NotebookOutput = {
  id: string
  conversationId: string
  type: "message" | "brochure" | "offer" | "pdf" | "ad_copy" | "comparison" | "image_prompt" | "script" | "note"
  title: string
  content: string
  relatedProjectId?: string
  relatedLeadId?: string
  relatedCampaignId?: string
  exportType?: string
  status: "draft" | "saved" | "sent_for_review" | "approved"
  createdAt: string
  tags: string[]
  pinned: boolean
}

export type NotebookConversation = {
  id: string
  userId: string
  title: string
  relatedProjectIds: string[]
  relatedLeadIds: string[]
  relatedCampaignIds: string[]
  messages: { role: "user" | "assistant"; content: string; createdAt: string }[]
  savedOutputs: NotebookOutput[]
  createdAt: string
  updatedAt: string
}

export type LeadMachineListing = {
  id: string
  name: string
  area: string
  developer: string
  landingStatus: "ready" | "needs_review" | "missing" | "approved"
  adReadiness: "ready" | "blocked" | "needs_assets"
  requirements: string[]
  reviewStatus: "open" | "pending_approval" | "approved"
  comments: number
  tasks: number
  nextAction: string
}

export const currentServerUser: ServerSessionUser = {
  id: "usr_owner_mock",
  name: "Mahmoud",
  role: "owner",
  accountLevel: "owner",
  assignedModules: ["lead-machine", "crm-intelligence", "notebook", "server-status", "security"],
}

const allRoles: ServerRole[] = ["owner", "admin", "marketing", "sales_manager", "sales_agent", "data_manager", "viewer"]
const operatorRoles: ServerRole[] = ["owner", "admin", "marketing", "sales_manager", "data_manager"]

export const serverApps: ServerApp[] = [
  { id: "lead-machine", name: "Lead Machine", description: "Listings, landings, ad requests, previews, approvals and launch readiness.", status: "in_progress", visibleToRoles: operatorRoles, urgentCount: 6, blockedCount: 2, pendingApprovalCount: 3, latestActivity: "Landing review queue refreshed 18 minutes ago.", linkedMilestoneId: "M5", nextAction: "Approve two campaign-ready listings.", openComments: 5, href: "/freehold-intelligence/apps/lead-machine" },
  { id: "integration-dashboard", name: "Integration Dashboard", description: "External data and service connection readiness.", status: "planned", visibleToRoles: ["owner", "admin", "data_manager"], urgentCount: 1, blockedCount: 1, pendingApprovalCount: 0, latestActivity: "HubSpot connector remains mocked for V1.", linkedMilestoneId: "M1", nextAction: "Confirm API credential owner.", openComments: 1, href: "/freehold-intelligence/apps/integration-dashboard" },
  { id: "ai-learning", name: "AI Learning", description: "Supervised training loop for market, CRM and operator decisions.", status: "planned", visibleToRoles: ["owner", "admin", "data_manager"], urgentCount: 0, blockedCount: 0, pendingApprovalCount: 1, latestActivity: "Prompt memory model drafted.", linkedMilestoneId: "M7", nextAction: "Approve safe learning boundaries.", openComments: 2, href: "/freehold-intelligence/apps/ai-learning" },
  { id: "data-engineering", name: "Data Engineering", description: "Project fields, media quality, area/developer profiles and readiness scores.", status: "in_progress", visibleToRoles: ["owner", "admin", "data_manager"], urgentCount: 4, blockedCount: 1, pendingApprovalCount: 0, latestActivity: "Real media replacement completed for live projects.", linkedMilestoneId: "M1", nextAction: "Review listings with weak payment plans.", openComments: 4, href: "/freehold-intelligence/apps/data-engineering" },
  { id: "lead-workflow", name: "Lead Workflow", description: "Lead intake, assignment, follow-up rules and task conversion.", status: "planned", visibleToRoles: ["owner", "admin", "sales_manager"], urgentCount: 3, blockedCount: 0, pendingApprovalCount: 1, latestActivity: "Three follow-ups flagged as delayed.", linkedMilestoneId: "M4", nextAction: "Assign overdue hot leads.", openComments: 3, href: "/freehold-intelligence/apps/lead-workflow" },
  { id: "crm-intelligence", name: "CRM Intelligence", description: "HubSpot-refined lead quality, agent delays, next actions and sales signals.", status: "in_progress", visibleToRoles: ["owner", "admin", "sales_manager", "sales_agent"], urgentCount: 8, blockedCount: 0, pendingApprovalCount: 2, latestActivity: "High-intent lead set updated from mock HubSpot structure.", linkedMilestoneId: "M4", nextAction: "Review eight leads requiring action today.", openComments: 6, href: "/freehold-intelligence/crm" },
  { id: "platform-manager", name: "Platform Manager", description: "Public site, route health, deployment readiness and content operations.", status: "live", visibleToRoles: ["owner", "admin", "data_manager"], urgentCount: 1, blockedCount: 0, pendingApprovalCount: 0, latestActivity: "Production route smoke checks passed.", linkedMilestoneId: "M3", nextAction: "Limit heavy area/developer listing payloads.", openComments: 1, href: "/freehold-intelligence/apps/platform-manager" },
  { id: "social-media-manager", name: "Social Media Manager", description: "Campaign angles, captions, creative requests and publishing review.", status: "planned", visibleToRoles: ["owner", "admin", "marketing"], urgentCount: 2, blockedCount: 1, pendingApprovalCount: 2, latestActivity: "Two launch angles need approval.", linkedMilestoneId: "M6", nextAction: "Select this week's investor angle.", openComments: 2, href: "/freehold-intelligence/apps/social-media-manager" },
  { id: "sales-performance", name: "Freehold Sales Performance", description: "Agent response time, lead quality, conversion signals and team risks.", status: "planned", visibleToRoles: ["owner", "admin", "sales_manager"], urgentCount: 5, blockedCount: 0, pendingApprovalCount: 0, latestActivity: "Agent delay model mocked for V1.", linkedMilestoneId: "M4", nextAction: "Review follow-up delays by agent.", openComments: 4, href: "/freehold-intelligence/apps/sales-performance" },
  { id: "freehold-ai", name: "Freehold AI", description: "Role-aware assistant, scoped answers and private server command layer.", status: "in_progress", visibleToRoles: allRoles, urgentCount: 2, blockedCount: 0, pendingApprovalCount: 1, latestActivity: "AI Home converted to server session entrance.", linkedMilestoneId: "M7", nextAction: "Connect approved backend actions.", openComments: 3, href: "/freehold-intelligence" },
  { id: "uae-market-data", name: "UAE Market Data", description: "Areas, developers, pricing, yield signals and investor comparisons.", status: "live", visibleToRoles: allRoles, urgentCount: 0, blockedCount: 0, pendingApprovalCount: 0, latestActivity: "933 live project-backed records available.", linkedMilestoneId: "M1", nextAction: "Add paginated internal market views.", openComments: 1, href: "/freehold-intelligence/apps/market" },
  { id: "milestones", name: "Milestones", description: "Delivery plan, ownership, deadlines and progress notes.", status: "in_progress", visibleToRoles: ["owner", "admin"], urgentCount: 1, blockedCount: 0, pendingApprovalCount: 2, latestActivity: "M5 and M4 moved into active UX build.", linkedMilestoneId: "M0", nextAction: "Confirm next acceptance checkpoint.", openComments: 2, href: "/freehold-intelligence/milestones" },
  { id: "review-requests", name: "Review Requests", description: "Approvals, comments, task conversion and stakeholder review flow.", status: "in_progress", visibleToRoles: operatorRoles, urgentCount: 4, blockedCount: 0, pendingApprovalCount: 6, latestActivity: "Comment-to-task workflow active.", linkedMilestoneId: "M0", nextAction: "Clear pending landing approvals.", openComments: 8, href: "/freehold-intelligence/review-requests" },
  { id: "screentime", name: "Screentime", description: "Operator activity patterns, response gaps and productivity signals.", status: "planned", visibleToRoles: ["owner", "admin"], urgentCount: 0, blockedCount: 0, pendingApprovalCount: 0, latestActivity: "No live telemetry connected in V1.", linkedMilestoneId: "M9", nextAction: "Define privacy-safe events.", openComments: 0, href: "/freehold-intelligence/apps/screentime" },
  { id: "server-status", name: "Server Status", description: "Production health, deployment state, database status and infrastructure notes.", status: "live", visibleToRoles: ["owner", "admin", "data_manager"], urgentCount: 1, blockedCount: 0, pendingApprovalCount: 0, latestActivity: "Production deploy completed and smoke-tested.", linkedMilestoneId: "M9", nextAction: "Add auth middleware before wider exposure.", openComments: 1, href: "/freehold-intelligence/server-status" },
  { id: "security", name: "Security", description: "Access model, route protection, permissions and audit readiness.", status: "planned", visibleToRoles: ["owner", "admin"], urgentCount: 2, blockedCount: 1, pendingApprovalCount: 1, latestActivity: "Private shell exists; real auth gate still required.", linkedMilestoneId: "M9", nextAction: "Add production auth middleware.", openComments: 2, href: "/freehold-intelligence/security" },
  { id: "learning", name: "Learning", description: "Training notes, SOPs and guided operator workflows.", status: "planned", visibleToRoles: allRoles, urgentCount: 0, blockedCount: 0, pendingApprovalCount: 0, latestActivity: "Initial playbook sections pending.", linkedMilestoneId: "M7", nextAction: "Attach sales and marketing SOPs.", openComments: 0, href: "/freehold-intelligence/apps/learning" },
  { id: "sales-team", name: "Sales Team", description: "Agents, assignment load, response delays and coaching actions.", status: "planned", visibleToRoles: ["owner", "admin", "sales_manager"], urgentCount: 3, blockedCount: 0, pendingApprovalCount: 0, latestActivity: "Mock agent queue prepared.", linkedMilestoneId: "M4", nextAction: "Connect CRM owner mapping.", openComments: 3, href: "/freehold-intelligence/apps/sales-team" },
]

export const serverSummary: ServerSessionSummary = {
  userId: currentServerUser.id,
  role: currentServerUser.role,
  accountLevel: currentServerUser.accountLevel,
  generatedAt: new Date("2026-05-22T05:45:00+04:00").toISOString(),
  period: "24h",
  greeting: "Good evening. I reviewed the last 24 hours across Lead Machine, CRM, Notebook and server readiness.",
  summaryText: "There are 6 urgent items: 2 ad launch blockers, 1 billing requirement, 3 landing reviews waiting for approval. Lead Machine has campaign-ready listings, CRM has high-intent leads needing follow-up, and the server has one launch hardening item around private route protection.",
  urgentTasks: [
    { id: "task_meta_billing", type: "ad_requirement", title: "Meta launch blocked by billing requirement", body: "Campaign launch cannot move until billing ownership is confirmed.", priority: "critical", app: "Lead Machine", owner: "Marketing", status: "blocked", due: "Today" },
    { id: "task_followups", type: "crm_alert", title: "Eight CRM leads need action today", body: "Three have delayed follow-up and two show high investor intent.", priority: "high", app: "CRM", owner: "Sales Manager", status: "open", due: "Today" },
    { id: "task_auth", type: "server_warning", title: "Private route protection is still placeholder", body: "The private shell is visually isolated, but production auth middleware still needs final wiring.", priority: "high", app: "Security", owner: "Admin", status: "open" },
  ],
  blockedItems: [
    { id: "block_meta", type: "ad_requirement", title: "Meta billing owner missing", body: "Assign billing owner before ad launch approval.", priority: "critical", app: "Lead Machine", owner: "Owner", status: "blocked" },
    { id: "block_auth", type: "server_warning", title: "Auth middleware required", body: "Do not widen control-room exposure until role gate is connected.", priority: "high", app: "Security", owner: "Admin", status: "blocked" },
  ],
  pendingApprovals: [
    { id: "approval_landing_1", type: "landing_review", title: "Palm investor landing review", body: "Landing copy and preview are ready for owner approval.", priority: "high", app: "Lead Machine", owner: "Marketing", status: "pending approval" },
    { id: "approval_angle", type: "approval_request", title: "Investor campaign angle", body: "Marketing needs approval on the strongest area angle for this week.", priority: "medium", app: "Social Media Manager", owner: "Marketing", status: "pending approval" },
  ],
  crmAlerts: [
    { id: "crm_hot_1", type: "crm_alert", title: "High-intent buyer waiting", body: "Client asked for payment plan comparison and has not been called back.", priority: "critical", app: "CRM", owner: "Sales Agent", status: "open" },
    { id: "crm_dup", type: "crm_alert", title: "Duplicate lead risk", body: "Two records share the same phone with different campaign sources.", priority: "medium", app: "CRM", owner: "Sales Manager", status: "review" },
  ],
  leadMachineAlerts: [
    { id: "lm_ready", type: "listing", title: "14 listings ready for campaign preparation", body: "Media and core project fields are sufficient for landing/ad packaging.", priority: "high", app: "Lead Machine", owner: "Marketing", status: "ready" },
    { id: "lm_missing", type: "matrix", title: "Readiness matrix needs review", body: "Six listings need stronger payment plan or handover context.", priority: "medium", app: "Lead Machine", owner: "Data Manager", status: "open" },
  ],
  notebookRecentOutputs: [
    { id: "note_offer", type: "notebook_output", title: "Investor WhatsApp offer draft", body: "Saved output for Palm-focused investor follow-up.", priority: "medium", app: "Notebook", owner: "Sales Manager", status: "saved" },
    { id: "note_caption", type: "notebook_output", title: "Social caption set", body: "Three ad copy angles generated for review.", priority: "low", app: "Notebook", owner: "Marketing", status: "draft" },
  ],
  recommendedActions: [
    { id: "rec_approve", type: "recommendation", title: "Approve the landing review queue first", body: "This unlocks campaign packaging and removes the highest-value blocker.", priority: "high", app: "Lead Machine", owner: "Owner", status: "recommended" },
    { id: "rec_sales", type: "recommendation", title: "Push high-intent follow-ups before new assignments", body: "The strongest CRM signal is delayed response, not lead volume.", priority: "high", app: "CRM", owner: "Sales Manager", status: "recommended" },
  ],
  askableQuestions: [
    "What needs my approval today?",
    "Which listings are ready for ads?",
    "Which CRM leads need urgent follow-up?",
    "What is blocking Meta launch?",
    "Draft a WhatsApp message for the hottest lead.",
    "Give me a readiness matrix for campaign listings.",
  ],
}

export const crmLeads: CRMLeadIntelligence[] = [
  { id: "lead_001", hubspotLeadId: "hs_901", name: "Rami Haddad", phone: "+971500000001", email: "rami@example.com", source: "Palm investor landing", landingId: "landing_palm_investor", campaignId: "cmp_palm_q2", stage: "Hot", intentScore: 92, urgency: "critical", duplicateRisk: false, wrongNumberRisk: false, assignedAgent: "Noura", lastContactAt: "2026-05-21T16:20:00+04:00", nextBestAction: "Call now, then send payment plan comparison.", suggestedMessage: "Hi Rami, I prepared the Palm payment plan comparison you asked for. Would you like the strongest investor option first or the lowest entry option?", aiSummary: "Asked about ROI, service charges and payment plan. High purchase intent if financing path is clear." },
  { id: "lead_002", hubspotLeadId: "hs_902", name: "Sara Khan", phone: "+971500000002", email: "sara@example.com", source: "Market tracker", landingId: "landing_market_tracker", campaignId: "cmp_market_weekly", stage: "New", intentScore: 78, urgency: "high", duplicateRisk: true, wrongNumberRisk: false, assignedAgent: "Omar", lastContactAt: "2026-05-21T12:05:00+04:00", nextBestAction: "Review duplicate risk before assignment.", suggestedMessage: "Hi Sara, I saw your enquiry on Dubai investment options. Are you comparing for rental yield, capital growth, or Golden Visa eligibility?", aiSummary: "Same phone appears with two sources. Needs merge decision before sales sequence." },
  { id: "lead_003", hubspotLeadId: "hs_903", name: "Michael Reed", phone: "+971500000003", email: "michael@example.com", source: "WhatsApp", landingId: "direct_whatsapp", campaignId: "organic", stage: "Follow-up", intentScore: 84, urgency: "high", duplicateRisk: false, wrongNumberRisk: false, assignedAgent: "Layla", lastContactAt: "2026-05-20T20:15:00+04:00", nextBestAction: "Send two-project comparison with handover timeline.", suggestedMessage: "Hi Michael, I narrowed this to two options based on your timeline. I can send the comparison with payment plan, handover and expected yield now.", aiSummary: "Delayed follow-up. Asked for handover timing and family-friendly areas." },
]

export const leadMachineListings: LeadMachineListing[] = [
  { id: "lm_001", name: "Palm Jumeirah Investor Pack", area: "Palm Jumeirah", developer: "Nakheel", landingStatus: "needs_review", adReadiness: "blocked", requirements: ["Meta billing owner", "Final landing approval"], reviewStatus: "pending_approval", comments: 3, tasks: 2, nextAction: "Approve landing or request copy edits." },
  { id: "lm_002", name: "Dubai Hills Yield Campaign", area: "Dubai Hills Estate", developer: "Emaar", landingStatus: "ready", adReadiness: "ready", requirements: ["Ad angle approval"], reviewStatus: "open", comments: 2, tasks: 1, nextAction: "Create ad request for investor angle." },
  { id: "lm_003", name: "Business Bay Entry Offer", area: "Business Bay", developer: "Binghatti", landingStatus: "missing", adReadiness: "needs_assets", requirements: ["Landing page", "Hero media check", "Payment plan summary"], reviewStatus: "open", comments: 4, tasks: 3, nextAction: "Request landing page generation." },
]

export const notebookConversations: NotebookConversation[] = [
  {
    id: "conv_owner_24h",
    userId: currentServerUser.id,
    title: "Owner 24-hour briefing",
    relatedProjectIds: ["freehold-palm-jumeirah-0033"],
    relatedLeadIds: ["lead_001"],
    relatedCampaignIds: ["cmp_palm_q2"],
    messages: [
      { role: "assistant", content: serverSummary.summaryText, createdAt: serverSummary.generatedAt },
      { role: "user", content: "Prepare the approval order for today.", createdAt: "2026-05-22T05:48:00+04:00" },
    ],
    savedOutputs: [
      { id: "out_001", conversationId: "conv_owner_24h", type: "message", title: "Palm investor follow-up", content: "Hi Rami, I prepared the Palm payment plan comparison you asked for...", relatedProjectId: "freehold-palm-jumeirah-0033", relatedLeadId: "lead_001", relatedCampaignId: "cmp_palm_q2", exportType: "copy", status: "saved", createdAt: "2026-05-22T05:50:00+04:00", tags: ["whatsapp", "palm", "investor"], pinned: true },
      { id: "out_002", conversationId: "conv_owner_24h", type: "ad_copy", title: "Investor campaign angle", content: "Lead with scarcity, payment-plan clarity and Palm supply comparison.", relatedProjectId: "freehold-palm-jumeirah-0033", relatedCampaignId: "cmp_palm_q2", exportType: "review", status: "draft", createdAt: "2026-05-22T05:30:00+04:00", tags: ["ad", "landing"], pinned: false },
    ],
    createdAt: "2026-05-22T05:30:00+04:00",
    updatedAt: "2026-05-22T05:50:00+04:00",
  },
]

export function getVisibleServerApps(role: ServerRole = currentServerUser.role) {
  return serverApps.filter((app) => app.visibleToRoles.includes(role))
}

export function getServerApp(appId: string) {
  return serverApps.find((app) => app.id === appId) ?? null
}

export function getRoleScope(role: ServerRole = currentServerUser.role) {
  const scopes: Record<ServerRole, string[]> = {
    owner: ["Company performance", "Ads", "Leads", "CRM", "Sales team", "Blocked items", "Campaign readiness", "Project opportunities", "System progress", "User performance"],
    admin: ["Operations", "Users", "Tasks", "Requirements", "CRM", "Apps", "Approvals"],
    marketing: ["Ads", "Landing pages", "Creatives", "Campaign angles", "Social media", "Lead Machine"],
    sales_manager: ["Leads", "Follow-ups", "Team performance", "CRM stages", "Hot leads", "Agent delays"],
    sales_agent: ["Assigned leads", "Client message drafts", "Project details", "Area comparisons", "Follow-up scripts"],
    data_manager: ["Missing fields", "Project data", "Media", "Areas", "Developers", "Readiness scores"],
    viewer: ["Approved information", "Reports", "Read-only summaries"],
  }
  return scopes[role]
}

export function createMockAiAnswer(prompt: string, role: ServerRole = currentServerUser.role) {
  const scope = getRoleScope(role).slice(0, 4).join(", ")
  return {
    role,
    prompt,
    answer: `I can answer this inside your ${role.replace("_", " ")} scope: ${scope}. For V1 this is a structured mock response; production will route this through approved AI actions and role-gated data.`,
    cards: serverSummary.recommendedActions,
  }
}
