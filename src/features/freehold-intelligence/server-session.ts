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

export type PipelineStage = "new" | "contacted" | "qualified" | "viewing" | "negotiation" | "closed" | "lost"
export type LeadTemperature = "cold" | "warm" | "hot" | "priority"

export type IntegrationSyncStatus = {
  id: string
  name: string
  status: "synced" | "syncing" | "error" | "not_connected"
  lastSyncAt: string | null
  leadsIn: number
  errorMessage?: string
}

export type CRMLeadIntelligence = {
  /**
   * When the lead actually arrived, as a true instant (created_at is
   * timestamptz). Rendered through clock.ts so the hour shown is the
   * operation's, not the reader's browser's — see lib/freehold/clock.ts.
   */
  createdAt?: string
  id: string
  hubspotLeadId: string
  name: string
  phone: string
  email: string
  source: string
  landingId: string
  campaignId: string
  /** The campaign's NAME, resolved server-side. A broker reading a row wants
   *  to know which campaign brought this person; the id is a number nobody
   *  recognises, and an ad set's name is an implementation detail of one. */
  campaignName?: string
  /** The ad this lead actually saw — stored on every synced Meta lead since
   *  the sync existed (freehold_site_leads.meta_ad_id) and never surfaced, so
   *  "what did they see before they gave us their number" was unanswerable
   *  from the CRM. */
  adId?: string
  stage: string
  pipelineStage: PipelineStage
  temperature: LeadTemperature
  budgetAED: string
  projectInterest: string
  intentScore: number
  urgency: "critical" | "high" | "medium" | "low"
  duplicateRisk: boolean
  wrongNumberRisk: boolean
  assignedAgent: string
  lastContactAt: string
  nextBestAction: string
  suggestedMessage: string
  aiSummary: string
  /** ISO timestamp until which this lead is snoozed (hidden from follow-up queue). */
  snoozeUntil?: string | null
  /** Sequential lead code / serial number, e.g. FH-0001. */
  leadCode?: string | null
  /** Layer 8/9 — read from the lead's landing session; null when there wasn't one. */
  behaviourScore?: number | null
  buyerIntent?: string | null
  purchaseProbability?: number | null
  budgetConfidence?: string | null
  /** Layer 4 — declared intent from the ad clicked (?intent= on the landing
      URL). Distinct from buyerIntent, which is derived from observed
      behaviour; null when the visit carried no intent. */
  clickIntent?: string | null
  /** One-click human 0–10 value judgment. The bottom of the scale is training
      signal (what the machine should stop buying); null = never judged. */
  valueRating?: number | null
  /** Someone put this lead away. Both columns have existed since the schema
      was written and neither reached the client, so every screen behaved as
      though nobody had ever archived or blocked anything. */
  archived?: boolean
  blocked?: boolean
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
  email?: string
  phone?: string
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

export function getRoleScope(role: ServerRole) {
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

// The seed session/user/summary/CRM arrays and the mock AI answer were
// removed for handover — every consumer reads live data now. This module
// keeps only the shared types and the role-scope helper above.
