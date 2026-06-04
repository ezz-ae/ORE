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
  { id: "lead-machine", name: "Lead Machine", description: "Listings, landings, ad requests, previews, approvals and launch readiness.", status: "in_progress", visibleToRoles: operatorRoles, urgentCount: 6, blockedCount: 2, pendingApprovalCount: 3, latestActivity: "Landing review queue refreshed 18 minutes ago.", linkedMilestoneId: "M5", nextAction: "Approve two campaign-ready listings.", openComments: 5, href: "/freehold-intelligence/lead-machine" },
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
  { id: "lead_004", hubspotLeadId: "hs_904", name: "Abdullah Al-Mansoori", phone: "+971500000004", email: "amansoori@example.com", source: "Dubai Hills landing", landingId: "landing_hills_yield", campaignId: "cmp_hills_q2", stage: "New", intentScore: 71, urgency: "medium", duplicateRisk: false, wrongNumberRisk: false, assignedAgent: "Ahmad K.", lastContactAt: "2026-05-21T09:30:00+04:00", nextBestAction: "Send Dubai Hills brochure with payment plan and handover date.", suggestedMessage: "Hi Abdullah, I've put together the Dubai Hills investment summary you requested — including the 70/30 payment plan and projected rental yield. Shall I send it now?", aiSummary: "New enquiry from Dubai Hills landing. Interested in payment flexibility and ROI. No callback yet." },
  { id: "lead_005", hubspotLeadId: "hs_905", name: "Priya Nair", phone: "+971500000005", email: "priya.nair@example.com", source: "Golden Visa inquiry form", landingId: "landing_golden_visa", campaignId: "cmp_gv_2026", stage: "Qualified", intentScore: 88, urgency: "high", duplicateRisk: false, wrongNumberRisk: false, assignedAgent: "Sara M.", lastContactAt: "2026-05-21T14:45:00+04:00", nextBestAction: "Confirm eligibility threshold, then present Creek Beach and Emaar Beachfront options.", suggestedMessage: "Hi Priya, I have two properties above the AED 2M threshold for the Golden Visa. Both are freehold and ready for ownership transfer. Would you like the eligibility guide along with the property comparison?", aiSummary: "Explicitly interested in Golden Visa eligibility. Budget above AED 2M. High close probability if visa path is clearly explained." },
  { id: "lead_006", hubspotLeadId: "hs_906", name: "James Whitfield", phone: "+971500000006", email: "jwhitfield@example.com", source: "Secondary market mailer", landingId: "landing_secondary", campaignId: "cmp_secondary_q2", stage: "Follow-up", intentScore: 59, urgency: "medium", duplicateRisk: false, wrongNumberRisk: true, assignedAgent: "Rami T.", lastContactAt: "2026-05-19T11:00:00+04:00", nextBestAction: "Verify contact number before next follow-up attempt.", suggestedMessage: "Hi, I'm following up regarding your secondary market enquiry. Could you confirm you're the right person to speak to about Dubai property investment?", aiSummary: "Contact flag: WhatsApp delivered but no read receipt in 48 hours. Possible wrong number. Verify before next follow-up." },
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
      { role: "assistant", content: "Priority order for today: 1) Confirm Meta billing owner — this unblocks the entire Palm campaign. 2) Approve or reject the Palm investor landing — one decision removes the highest-value blocker. 3) Review the eight CRM leads flagged as high-intent before new leads are assigned to agents. This sequence gives you the highest campaign leverage before 12:00.", createdAt: "2026-05-22T05:49:00+04:00" },
    ],
    savedOutputs: [
      { id: "out_001", conversationId: "conv_owner_24h", type: "message", title: "Palm investor follow-up — Rami Haddad", content: "Hi Rami, I prepared the Palm payment plan comparison you asked for. The 60/40 post-handover plan means AED 1.92M now and AED 1.28M at handover in Q4 2027. Rental yield on comparable units is currently 5.2–6.1% net. Would you like the full investor breakdown?", relatedProjectId: "freehold-palm-jumeirah-0033", relatedLeadId: "lead_001", relatedCampaignId: "cmp_palm_q2", exportType: "copy", status: "saved", createdAt: "2026-05-22T05:50:00+04:00", tags: ["whatsapp", "palm", "investor"], pinned: true },
      { id: "out_002", conversationId: "conv_owner_24h", type: "ad_copy", title: "Investor campaign angle — Palm Q2", content: "Lead with scarcity, payment-plan clarity and Palm supply comparison. Headline: 'Palm Jumeirah — AED 3.2M, 60/40, 5.8% yield. Last 12 units at this price.' Hook: investor comparison card showing 3 comparable properties. CTA: 'Get the investor summary now'.", relatedProjectId: "freehold-palm-jumeirah-0033", relatedCampaignId: "cmp_palm_q2", exportType: "review", status: "draft", createdAt: "2026-05-22T05:30:00+04:00", tags: ["ad", "landing"], pinned: false },
    ],
    createdAt: "2026-05-22T05:30:00+04:00",
    updatedAt: "2026-05-22T05:50:00+04:00",
  },
  {
    id: "conv_hills_ad_copy",
    userId: currentServerUser.id,
    title: "Dubai Hills — ad angles & copy",
    relatedProjectIds: ["freehold-dubai-hills-0012"],
    relatedLeadIds: [],
    relatedCampaignIds: ["cmp_hills_q2"],
    messages: [
      { role: "user", content: "Give me three ad angles for Dubai Hills targeting family investors.", createdAt: "2026-05-21T18:10:00+04:00" },
      { role: "assistant", content: "Three angles for Dubai Hills family-investor traffic:\n\n1. Yield Corridor — 6.4% net yield, 70/30 plan, handover Q3 2027. Target: investors who want cash flow with deferred payment.\n\n2. Lifestyle + Yield — 'Your family lives in it, it pays you back.' Townhouses from AED 1.85M in an established district. Target: end-users who also want a yield story.\n\n3. Supply scarcity — Only 14 remaining at this phase price. Comparison against Beach and Downtown at equivalent budget. Target: FOMO-motivated investor.", createdAt: "2026-05-21T18:11:00+04:00" },
      { role: "user", content: "Write the Facebook headline and primary text for angle 1.", createdAt: "2026-05-21T18:14:00+04:00" },
      { role: "assistant", content: "Headline: Dubai Hills — 6.4% net yield. AED 1.85M, 70/30 payment plan.\n\nPrimary text: Investors are choosing Dubai Hills for one reason: the numbers work. 6.4% net yield. 70/30 construction-linked payment plan. Handover Q3 2027. Starting from AED 1.85M in Emaar's most established family district.\n\n→ Get the investor summary. Limited units at this phase price.", createdAt: "2026-05-21T18:15:00+04:00" },
    ],
    savedOutputs: [
      { id: "out_003", conversationId: "conv_hills_ad_copy", type: "ad_copy", title: "Dubai Hills — Meta primary text (yield angle)", content: "Investors are choosing Dubai Hills for one reason: the numbers work. 6.4% net yield. 70/30 construction-linked payment plan. Handover Q3 2027. Starting from AED 1.85M in Emaar's most established family district.\n\n→ Get the investor summary. Limited units at this phase price.", relatedProjectId: "freehold-dubai-hills-0012", relatedCampaignId: "cmp_hills_q2", exportType: "review", status: "sent_for_review", createdAt: "2026-05-21T18:16:00+04:00", tags: ["meta", "dubai-hills", "yield", "ad"], pinned: true },
      { id: "out_004", conversationId: "conv_hills_ad_copy", type: "script", title: "Dubai Hills — 3 ad angle brief", content: "Angle 1: Yield Corridor. Angle 2: Lifestyle + Yield. Angle 3: Supply scarcity. Full copy for Angle 1 ready for review. Angles 2 and 3 need creative brief confirmation before copy is written.", relatedProjectId: "freehold-dubai-hills-0012", exportType: "brief", status: "draft", createdAt: "2026-05-21T18:12:00+04:00", tags: ["brief", "dubai-hills", "angles"], pinned: false },
    ],
    createdAt: "2026-05-21T18:10:00+04:00",
    updatedAt: "2026-05-21T18:16:00+04:00",
  },
  {
    id: "conv_palm_hills_comparison",
    userId: currentServerUser.id,
    title: "Palm vs Hills — investor comparison",
    relatedProjectIds: ["freehold-palm-jumeirah-0033", "freehold-dubai-hills-0012"],
    relatedLeadIds: ["lead_001", "lead_005"],
    relatedCampaignIds: [],
    messages: [
      { role: "user", content: "Compare Palm Jumeirah and Dubai Hills for an investor with AED 2.5M budget and 5-year horizon.", createdAt: "2026-05-21T11:00:00+04:00" },
      { role: "assistant", content: "Palm Jumeirah vs Dubai Hills — AED 2.5M investor, 5-year horizon:\n\nPalm: Entry AED 3.2M (above budget — would need financing or smaller unit). Net yield 5.2–6.1%. High liquidity, strong resale premium. Trophy address.\n\nDubai Hills: Entry AED 1.85M (within budget with reserve). Net yield 5.8–6.4%. Growing district, family demand, Emaar developer premium. 70/30 plan available.\n\nRecommendation at AED 2.5M: Dubai Hills gives full ownership, positive cashflow from year 1, and a cleaner resale story at year 5. Palm makes sense if the budget stretches to AED 3.2M with the 60/40 plan.", createdAt: "2026-05-21T11:01:00+04:00" },
      { role: "user", content: "Turn this into a WhatsApp message for Rami.", createdAt: "2026-05-21T11:05:00+04:00" },
      { role: "assistant", content: "Hi Rami — here's the quick comparison you asked for:\n\nDubai Hills (AED 1.85M): 6.4% yield · 70/30 plan · Handover Q3 2027\nPalm Jumeirah (AED 3.2M): 5.8% yield · 60/40 plan · Q4 2027\n\nAt your budget, Dubai Hills gives you full ownership with cash reserve. Palm becomes more interesting if you want to stretch with the deferred payment plan.\n\nWant me to send the full investor sheet for both?", createdAt: "2026-05-21T11:06:00+04:00" },
    ],
    savedOutputs: [
      { id: "out_005", conversationId: "conv_palm_hills_comparison", type: "comparison", title: "Palm vs Hills — investor comparison card", content: "Dubai Hills (AED 1.85M): 6.4% yield · 70/30 · Q3 2027 handover\nPalm Jumeirah (AED 3.2M): 5.8% yield · 60/40 · Q4 2027 handover\n\nAt AED 2.5M budget: Dubai Hills gives full ownership + cash reserve. Palm viable with 60/40 deferred plan.", relatedProjectId: "freehold-palm-jumeirah-0033", relatedLeadId: "lead_001", exportType: "copy", status: "saved", createdAt: "2026-05-21T11:07:00+04:00", tags: ["comparison", "palm", "hills", "investor"], pinned: true },
      { id: "out_006", conversationId: "conv_palm_hills_comparison", type: "message", title: "WhatsApp — Rami comparison message", content: "Hi Rami — here's the quick comparison you asked for:\n\nDubai Hills (AED 1.85M): 6.4% yield · 70/30 plan · Handover Q3 2027\nPalm Jumeirah (AED 3.2M): 5.8% yield · 60/40 plan · Q4 2027\n\nAt your budget, Dubai Hills gives you full ownership with cash reserve. Palm becomes more interesting if you want to stretch with the deferred payment plan.\n\nWant me to send the full investor sheet for both?", relatedProjectId: "freehold-dubai-hills-0012", relatedLeadId: "lead_001", exportType: "copy", status: "saved", createdAt: "2026-05-21T11:06:00+04:00", tags: ["whatsapp", "rami", "comparison"], pinned: false },
    ],
    createdAt: "2026-05-21T11:00:00+04:00",
    updatedAt: "2026-05-21T11:07:00+04:00",
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

// ─── Lead Operations ──────────────────────────────────────────────────────────

export type CRMActivityEvent = {
  id: string
  leadId: string
  leadName: string
  type: "call" | "whatsapp" | "note" | "stage_change" | "assignment" | "follow_up" | "system"
  actor: string
  content: string
  outcome?: "connected" | "no_answer" | "callback_requested" | "not_interested" | "progressed"
  durationMin?: number
  createdAt: string
}

export type CRMFollowUpItem = {
  leadId: string
  leadName: string
  phone: string
  assignedAgent: string
  urgency: "critical" | "high" | "medium" | "low"
  intentScore: number
  stage: string
  source: string
  lastContactAt: string
  dueAt: string
  overdueHours: number
  nextBestAction: string
  duplicateRisk: boolean
  wrongNumberRisk: boolean
}

export type CRMAgentCapacity = {
  id: string
  name: string
  initials: string
  role: string
  totalLeads: number
  hotLeads: number
  overdueFollowUps: number
  utilization: number
  status: "available" | "at_capacity" | "overloaded"
  specialty: string
  recentWins: number
}

export type CRMInboxLead = {
  id: string
  name: string
  phone: string
  email: string
  source: string
  intentScore: number
  urgency: "critical" | "high" | "medium" | "low"
  arrivedAt: string
  assignedAgent?: string
  status: "unassigned" | "assigned" | "contacted"
  aiNote: string
}

export const crmActivityLog: CRMActivityEvent[] = [
  { id: "act_001", leadId: "lead_001", leadName: "Rami Haddad", type: "call", actor: "Noura", content: "Discussed Palm payment plan options and investment timeline.", outcome: "connected", durationMin: 12, createdAt: "2026-06-04T09:15:00+04:00" },
  { id: "act_002", leadId: "lead_001", leadName: "Rami Haddad", type: "whatsapp", actor: "Noura", content: "Sent Palm payment plan comparison — 60/40 breakdown with yield projection.", createdAt: "2026-06-04T09:30:00+04:00" },
  { id: "act_003", leadId: "lead_005", leadName: "Priya Nair", type: "note", actor: "Sara M.", content: "Budget confirmed at AED 2.5M. Golden Visa path is primary driver. Creek Beach and Emaar Beachfront shortlisted.", createdAt: "2026-06-04T08:45:00+04:00" },
  { id: "act_004", leadId: "lead_002", leadName: "Sara Khan", type: "stage_change", actor: "Omar", content: "Stage moved: New → Follow-up after duplicate risk review.", createdAt: "2026-06-03T17:00:00+04:00" },
  { id: "act_005", leadId: "lead_002", leadName: "Sara Khan", type: "call", actor: "Omar", content: "Call attempt — no answer. Second attempt scheduled.", outcome: "no_answer", durationMin: 0, createdAt: "2026-06-03T14:30:00+04:00" },
  { id: "act_006", leadId: "lead_003", leadName: "Michael Reed", type: "whatsapp", actor: "Layla", content: "Sent two-project comparison: JVC vs Dubai Hills with payment plans and handover dates.", createdAt: "2026-06-03T11:20:00+04:00" },
  { id: "act_007", leadId: "lead_003", leadName: "Michael Reed", type: "follow_up", actor: "system", content: "Automated reminder: 14 days since last direct contact. Escalated to high priority.", createdAt: "2026-06-03T09:00:00+04:00" },
  { id: "act_008", leadId: "lead_006", leadName: "James Whitfield", type: "call", actor: "Rami T.", content: "Call attempt — no response. WhatsApp sent 48h ago with no read receipt.", outcome: "no_answer", durationMin: 0, createdAt: "2026-06-02T15:00:00+04:00" },
  { id: "act_009", leadId: "lead_006", leadName: "James Whitfield", type: "note", actor: "Rami T.", content: "Flagged as possible wrong number. WhatsApp delivered but unread for 5 days. Recommend verification before next attempt.", createdAt: "2026-06-02T15:05:00+04:00" },
  { id: "act_010", leadId: "lead_004", leadName: "Abdullah Al-Mansoori", type: "assignment", actor: "system", content: "Lead assigned to Ahmad K. from unassigned pool. Source: Dubai Hills landing.", createdAt: "2026-06-01T10:00:00+04:00" },
  { id: "act_011", leadId: "lead_004", leadName: "Abdullah Al-Mansoori", type: "call", actor: "Ahmad K.", content: "First contact call connected. Confirmed interest in Dubai Hills. Budget AED 1.8M. Wants 70/30 plan.", outcome: "connected", durationMin: 8, createdAt: "2026-06-01T10:30:00+04:00" },
  { id: "act_012", leadId: "lead_001", leadName: "Rami Haddad", type: "stage_change", actor: "Noura", content: "Stage moved: Qualified → Hot after payment plan discussion confirmed serious intent.", createdAt: "2026-05-28T14:00:00+04:00" },
  { id: "act_013", leadId: "lead_005", leadName: "Priya Nair", type: "call", actor: "Sara M.", content: "Initial qualification call. Confirmed Golden Visa goal and AED 2.5M+ budget.", outcome: "connected", durationMin: 22, createdAt: "2026-05-27T16:00:00+04:00" },
  { id: "act_014", leadId: "lead_003", leadName: "Michael Reed", type: "assignment", actor: "system", content: "Lead reassigned from Ahmad K. to Layla due to capacity constraint.", createdAt: "2026-05-24T11:00:00+04:00" },
]

export const crmFollowUpQueue: CRMFollowUpItem[] = [
  { leadId: "lead_001", leadName: "Rami Haddad", phone: "+971500000001", assignedAgent: "Noura", urgency: "critical", intentScore: 92, stage: "Hot", source: "Palm investor landing", lastContactAt: "2026-05-21T16:20:00+04:00", dueAt: "2026-05-24T16:20:00+04:00", overdueHours: 276, nextBestAction: "Call now, then send payment plan comparison.", duplicateRisk: false, wrongNumberRisk: false },
  { leadId: "lead_005", leadName: "Priya Nair", phone: "+971500000005", assignedAgent: "Sara M.", urgency: "high", intentScore: 88, stage: "Qualified", source: "Golden Visa inquiry form", lastContactAt: "2026-05-21T14:45:00+04:00", dueAt: "2026-05-24T14:45:00+04:00", overdueHours: 278, nextBestAction: "Confirm Golden Visa eligibility threshold, then present Creek Beach and Emaar Beachfront.", duplicateRisk: false, wrongNumberRisk: false },
  { leadId: "lead_003", leadName: "Michael Reed", phone: "+971500000003", assignedAgent: "Layla", urgency: "high", intentScore: 84, stage: "Follow-up", source: "WhatsApp", lastContactAt: "2026-05-20T20:15:00+04:00", dueAt: "2026-05-23T20:15:00+04:00", overdueHours: 302, nextBestAction: "Send two-project comparison with handover timeline.", duplicateRisk: false, wrongNumberRisk: false },
  { leadId: "lead_002", leadName: "Sara Khan", phone: "+971500000002", assignedAgent: "Omar", urgency: "high", intentScore: 78, stage: "New", source: "Market tracker", lastContactAt: "2026-05-21T12:05:00+04:00", dueAt: "2026-05-24T12:05:00+04:00", overdueHours: 280, nextBestAction: "Review duplicate risk before assignment.", duplicateRisk: true, wrongNumberRisk: false },
  { leadId: "lead_004", leadName: "Abdullah Al-Mansoori", phone: "+971500000004", assignedAgent: "Ahmad K.", urgency: "medium", intentScore: 71, stage: "New", source: "Dubai Hills landing", lastContactAt: "2026-05-21T09:30:00+04:00", dueAt: "2026-05-24T09:30:00+04:00", overdueHours: 283, nextBestAction: "Send Dubai Hills brochure with payment plan and handover date.", duplicateRisk: false, wrongNumberRisk: false },
  { leadId: "lead_006", leadName: "James Whitfield", phone: "+971500000006", assignedAgent: "Rami T.", urgency: "medium", intentScore: 59, stage: "Follow-up", source: "Secondary market mailer", lastContactAt: "2026-05-19T11:00:00+04:00", dueAt: "2026-05-22T11:00:00+04:00", overdueHours: 324, nextBestAction: "Verify contact number before next follow-up attempt.", duplicateRisk: false, wrongNumberRisk: true },
]

export const crmAgentRoster: CRMAgentCapacity[] = [
  { id: "agent_noura", name: "Noura", initials: "NO", role: "Senior Investment Advisor", totalLeads: 8, hotLeads: 2, overdueFollowUps: 1, utilization: 80, status: "at_capacity", specialty: "Palm · Off-plan · High-net-worth", recentWins: 3 },
  { id: "agent_omar", name: "Omar", initials: "OM", role: "Sales Advisor", totalLeads: 6, hotLeads: 1, overdueFollowUps: 2, utilization: 62, status: "available", specialty: "Market tracker · JLT · JVC", recentWins: 2 },
  { id: "agent_layla", name: "Layla", initials: "LA", role: "Investment Advisor", totalLeads: 5, hotLeads: 1, overdueFollowUps: 1, utilization: 50, status: "available", specialty: "Family districts · Dubai Hills · JVC", recentWins: 1 },
  { id: "agent_ahmad", name: "Ahmad K.", initials: "AK", role: "Senior Advisor", totalLeads: 12, hotLeads: 3, overdueFollowUps: 1, utilization: 92, status: "overloaded", specialty: "Off-plan · Damac · Sobha", recentWins: 4 },
  { id: "agent_sara", name: "Sara M.", initials: "SM", role: "Investment Advisor", totalLeads: 9, hotLeads: 2, overdueFollowUps: 0, utilization: 81, status: "at_capacity", specialty: "Beachfront · Golden Visa", recentWins: 3 },
  { id: "agent_rami_t", name: "Rami T.", initials: "RT", role: "Brokerage Associate", totalLeads: 7, hotLeads: 1, overdueFollowUps: 3, utilization: 72, status: "at_capacity", specialty: "Secondary · Marina · JVC", recentWins: 2 },
]

export const crmInboxLeads: CRMInboxLead[] = [
  { id: "inbox_001", name: "Fatima Al-Rashidi", phone: "+971500000101", email: "fatima.r@example.com", source: "Emaar Beachfront landing", intentScore: 81, urgency: "high", arrivedAt: "2026-06-04T07:12:00+04:00", status: "unassigned", aiNote: "Asking about beachfront ROI and family-suitable units. Likely Golden Visa eligible at budget mentioned." },
  { id: "inbox_002", name: "Dominic Okafor", phone: "+971500000102", email: "d.okafor@example.com", source: "Meta Ads — Palm Q2", intentScore: 74, urgency: "medium", arrivedAt: "2026-06-04T04:38:00+04:00", status: "unassigned", aiNote: "Clicked Palm ad. Form filled at 04:38 — likely international timezone. First outreach should be WhatsApp, not a call." },
  { id: "inbox_003", name: "Anita Sharma", phone: "+971500000103", email: "anita.s@example.com", source: "WhatsApp inbound", intentScore: 68, urgency: "medium", arrivedAt: "2026-06-03T22:55:00+04:00", assignedAgent: "Layla", status: "assigned", aiNote: "Enquired about JVC vs Dubai Hills for end-user with kids. School proximity is a deciding factor." },
  { id: "inbox_004", name: "Mohammed Al-Farsi", phone: "+971500000104", email: "m.alfarsi@example.com", source: "Referral — Ahmad K.", intentScore: 91, urgency: "critical", arrivedAt: "2026-06-03T19:45:00+04:00", assignedAgent: "Ahmad K.", status: "assigned", aiNote: "Referral from Ahmad's existing client. AED 3M+ budget. Wants Palm or Creek — fast decision maker. Priority contact." },
]
