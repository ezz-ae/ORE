import { query } from "@/lib/db"
import { randomUUID } from "crypto"

export type ProjectUpdateType = "expired" | "status" | "update" | "new"

export interface AiProjectUpdateRecord {
  id: string
  project_slug: string
  project_name: string | null
  update_type: ProjectUpdateType
  target_status: string | null
  notes: string | null
  processed: boolean
  processed_at: string | null
  created_by: string | null
  created_at: string
}

async function ensureAiProjectUpdatesTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS gc_ai_project_updates (
      id text PRIMARY KEY,
      project_slug text NOT NULL,
      project_name text,
      update_type text NOT NULL,
      target_status text,
      notes text,
      processed boolean DEFAULT false,
      processed_at timestamptz,
      created_by text,
      created_at timestamptz DEFAULT now()
    )
  `)
  await query(`
    ALTER TABLE gc_ai_project_updates
      ADD COLUMN IF NOT EXISTS processed boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS target_status text,
      ADD COLUMN IF NOT EXISTS processed_at timestamptz
  `)
}

export async function logAiProjectUpdate({
  projectSlug,
  projectName,
  updateType,
  targetStatus,
  notes,
  createdBy,
}: {
  projectSlug: string
  projectName?: string | null
  updateType: ProjectUpdateType
  targetStatus?: string | null
  notes?: string | null
  createdBy?: string | null
}) {
  await ensureAiProjectUpdatesTable()
  const id = randomUUID()
  const rows = await query<AiProjectUpdateRecord>(
    `INSERT INTO gc_ai_project_updates (id, project_slug, project_name, update_type, target_status, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, project_slug, project_name, update_type, target_status, notes, processed, processed_at, created_by, created_at`,
    [id, projectSlug, projectName || null, updateType, targetStatus || null, notes || null, createdBy || null],
  )
  return rows[0]
}

export async function updateProjectStatus(slug: string, status: string) {
  await ensureAiProjectUpdatesTable()
  await query(
    `UPDATE gc_projects
     SET status = $2
     WHERE slug = $1
        OR payload->>'slug' = $1
     RETURNING slug`,
    [slug, status],
  )
}

export async function markProjectAsProcessed(id: string) {
  await ensureAiProjectUpdatesTable()
  const rows = await query<AiProjectUpdateRecord>(
    `UPDATE gc_ai_project_updates
     SET processed = true,
         processed_at = now()
     WHERE id = $1
     RETURNING id, project_slug, project_name, update_type, target_status, notes, processed, processed_at, created_by, created_at`,
    [id],
  )
  return rows[0] || null
}

export async function getAiProjectUpdates(limit = 6) {
  await ensureAiProjectUpdatesTable()
  return query<AiProjectUpdateRecord>(
    `SELECT id, project_slug, project_name, update_type, target_status, notes, processed, processed_at, created_by, created_at
     FROM gc_ai_project_updates
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit],
  )
}
