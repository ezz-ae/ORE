import { query } from "@/lib/db"
import type { AuditEvent, DashboardSnapshot, Milestone, RbacRow, ReviewItem, SystemModule } from "./types"
import { fallbackDashboard, fallbackMilestones, fallbackSystems } from "./data/fallbacks"

const safeQuery = async <T,>(sql: string, params: unknown[] = [], fallback: T[] = []): Promise<T[]> => {
  try {
    return await query(sql, params) as T[]
  } catch (error) {
    console.error("Freehold Intelligence query failed", error)
    return fallback
  }
}

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  const rows = await safeQuery<DashboardSnapshot>("SELECT * FROM freehold_private_dashboard", [], [fallbackDashboard])
  return rows[0] ?? fallbackDashboard
}

export async function getSystems(): Promise<SystemModule[]> {
  const rows = await safeQuery<SystemModule>(`
    SELECT
      m.module_id,
      m.module_name,
      m.description,
      m.layer,
      m.status,
      m.owner,
      CASE m.module_id
        WHEN 'mod_data_eng' THEN 'M1'
        WHEN 'mod_ai_learn' THEN 'M7'
        WHEN 'mod_crm' THEN 'M4'
        WHEN 'mod_leadgen' THEN 'M5'
        WHEN 'mod_social' THEN 'M6'
        WHEN 'mod_reports' THEN 'M8'
        WHEN 'mod_public_web' THEN 'M3'
        ELSE NULL
      END AS milestone_code,
      mp.progress_pct,
      mp.health
    FROM freehold_modules m
    LEFT JOIN freehold_milestone_progress mp ON mp.code = CASE m.module_id
      WHEN 'mod_data_eng' THEN 'M1'
      WHEN 'mod_ai_learn' THEN 'M7'
      WHEN 'mod_crm' THEN 'M4'
      WHEN 'mod_leadgen' THEN 'M5'
      WHEN 'mod_social' THEN 'M6'
      WHEN 'mod_reports' THEN 'M8'
      WHEN 'mod_public_web' THEN 'M3'
      ELSE NULL
    END
    ORDER BY m.layer, m.module_name
  `, [], fallbackSystems)
  return rows.length ? rows : fallbackSystems
}

export async function getSystem(systemId: string): Promise<SystemModule | null> {
  const systems = await getSystems()
  return systems.find((system) => system.module_id === systemId) ?? null
}

export async function getMilestones(): Promise<Milestone[]> {
  const rows = await safeQuery<Milestone>("SELECT * FROM freehold_milestone_progress ORDER BY deadline", [], fallbackMilestones)
  return rows.length ? rows : fallbackMilestones
}

export async function getMilestone(code: string): Promise<Milestone | null> {
  const milestones = await getMilestones()
  return milestones.find((milestone) => milestone.code === code) ?? null
}

export async function getRbacMatrix(): Promise<RbacRow[]> {
  return safeQuery<RbacRow>("SELECT * FROM freehold_role_module_matrix ORDER BY role_name, module_name")
}

export async function getReviewItems(kind?: "comment" | "task"): Promise<ReviewItem[]> {
  const filter = kind ? "WHERE kind = $1" : ""
  const params = kind ? [kind] : []
  return safeQuery<ReviewItem>(`
    SELECT item_id, kind, page_ref, body, author, assignee, status, converted_from, created_at, resolved_at
    FROM freehold_comments_tasks
    ${filter}
    ORDER BY created_at DESC, item_id DESC
    LIMIT 100
  `, params)
}

export async function getAuditEvents(): Promise<AuditEvent[]> {
  return safeQuery<AuditEvent>(`
    SELECT log_id, actor, role_id, action, target_table, target_id, created_at
    FROM freehold_audit_log
    ORDER BY created_at DESC
    LIMIT 50
  `)
}
