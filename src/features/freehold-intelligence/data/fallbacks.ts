import type { DashboardSnapshot, Milestone, SystemModule } from "../types"

export const fallbackDashboard: DashboardSnapshot = {
  total_projects: 7015,
  total_developers: 669,
  total_areas: 384,
  active_users: 1,
  milestones_done: 0,
  milestones_total: 10,
  open_tasks: 0,
  audit_events_24h: 0,
}

export const fallbackSystems: SystemModule[] = [
  { module_id: "mod_data_eng", module_name: "Data Engineering", description: "Ingestion, validation and master inventory governance.", layer: "private", status: "in_progress", owner: "Data Manager", progress_pct: 35, health: "on_track" },
  { module_id: "mod_ai_learn", module_name: "AI Learning Agent", description: "Supervised training loop for lead, deal and market intelligence.", layer: "private", status: "planned", owner: "Data Manager", progress_pct: 5, health: "on_track" },
  { module_id: "mod_crm", module_name: "CRM Intelligence", description: "Lead pipeline, deal flow and conversation intelligence.", layer: "private", status: "planned", owner: "Sales Manager", progress_pct: 10, health: "on_track" },
  { module_id: "mod_leadgen", module_name: "Lead Generation Machine", description: "Campaign planning, landing paths, lead forms, routing and reporting.", layer: "both", status: "planned", owner: "Marketing", progress_pct: 10, health: "on_track" },
  { module_id: "mod_social", module_name: "Social Manager", description: "Publishing, creative review and channel analytics.", layer: "both", status: "planned", owner: "Marketing", progress_pct: 0, health: "on_track" },
  { module_id: "mod_reports", module_name: "Reports", description: "Standard reports, custom exports and investor packs.", layer: "private", status: "planned", owner: "Owner", progress_pct: 0, health: "on_track" },
  { module_id: "mod_public_web", module_name: "Public Website", description: "SEO catalog, projects, areas, developers and public lead capture.", layer: "public", status: "live", owner: "Marketing", progress_pct: 80, health: "on_track" },
]

export const fallbackMilestones: Milestone[] = [
  { code: "M0", title: "Activation", owner: "Entrestate Infra", deadline: "2026-05-28", status: "in_progress", progress_pct: 35, health: "at_risk", days_to_deadline: 6 },
  { code: "M1", title: "Data Engineering Bootstrap", owner: "Data Manager", deadline: "2026-06-10", status: "pending", progress_pct: 0, health: "on_track", days_to_deadline: 19 },
  { code: "M2", title: "RBAC + Role Switcher", owner: "Entrestate Backend", deadline: "2026-06-19", status: "pending", progress_pct: 0, health: "on_track", days_to_deadline: 28 },
  { code: "M3", title: "Public Website V1", owner: "Marketing + Frontend", deadline: "2026-07-13", status: "pending", progress_pct: 0, health: "on_track", days_to_deadline: 52 },
  { code: "M4", title: "CRM Intelligence V1", owner: "Sales Manager", deadline: "2026-08-02", status: "pending", progress_pct: 0, health: "on_track", days_to_deadline: 72 },
  { code: "M5", title: "Lead Generation Machine", owner: "Marketing", deadline: "2026-08-15", status: "pending", progress_pct: 0, health: "on_track", days_to_deadline: 85 },
  { code: "M6", title: "Social Manager", owner: "Marketing", deadline: "2026-08-24", status: "pending", progress_pct: 0, health: "on_track", days_to_deadline: 94 },
  { code: "M7", title: "AI Learning Agent", owner: "Data Manager", deadline: "2026-09-06", status: "pending", progress_pct: 0, health: "on_track", days_to_deadline: 107 },
  { code: "M8", title: "Reports + Investor Packs", owner: "Owner", deadline: "2026-09-19", status: "pending", progress_pct: 0, health: "on_track", days_to_deadline: 120 },
  { code: "M9", title: "Security & Hardening", owner: "Entrestate Security", deadline: "2026-09-30", status: "pending", progress_pct: 0, health: "on_track", days_to_deadline: 131 },
]
