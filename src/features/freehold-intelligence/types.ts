export type Status = "planned" | "pending" | "in_progress" | "live" | "done" | "blocked" | "open" | "resolved"
export type Health = "complete" | "overdue" | "at_risk" | "on_track"
export type Layer = "public" | "private" | "both"

export type DashboardSnapshot = {
  total_projects: number
  total_developers: number
  total_areas: number
  active_users: number
  milestones_done: number
  milestones_total: number
  open_tasks: number
  audit_events_24h: number
}

export type SystemModule = {
  module_id: string
  module_name: string
  description: string | null
  layer: Layer
  status: Status | string
  owner: string | null
  milestone_code?: string | null
  progress_pct?: number | null
  health?: Health | string | null
}

export type Milestone = {
  milestone_id?: string
  code: string
  title: string
  description?: string | null
  success_event?: string | null
  owner?: string | null
  deadline: string
  status: Status | string
  progress_pct: number
  days_to_deadline?: number | null
  health?: Health | string | null
}

export type RbacRow = {
  role_name: string
  module_name: string
  layer: Layer
  can_view: boolean
  can_edit: boolean
  can_delete: boolean
  can_admin: boolean
}

export type ReviewItem = {
  item_id: number
  kind: "comment" | "task"
  page_ref: string | null
  body: string
  author: string | null
  assignee: string | null
  status: Status | string
  converted_from: number | null
  created_at: string
  resolved_at: string | null
}

export type AuditEvent = {
  log_id: string | number
  actor: string | null
  role_id: string | null
  action: string | null
  target_table: string | null
  target_id: string | null
  created_at: string
}
