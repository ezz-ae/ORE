import type { DashboardSnapshot } from "../types"

// When the DB is unreachable we must not invent catalog counts — show 0/"—"
// rather than fabricated totals. Real numbers come from the live query.
export const fallbackDashboard: DashboardSnapshot = {
  total_projects: 0,
  total_developers: 0,
  total_areas: 0,
  active_users: 0,
  milestones_done: 0,
  milestones_total: 10,
  open_tasks: 0,
  audit_events_24h: 0,
}
