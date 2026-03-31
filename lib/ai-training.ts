import { randomBytes } from "crypto"
import { query } from "@/lib/db"

export type AiTrainingStatus = "pending" | "trained"

export interface AiTrainingRequest {
  id: string
  project_slug: string | null
  project_name: string | null
  notes: string | null
  tags: string[] | null
  status: AiTrainingStatus
  created_by: string | null
  trained_by: string | null
  created_at: string
  trained_at: string | null
  payload: Record<string, unknown> | null
}

async function ensureAiTrainingTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS gc_ai_training_requests (
      id text PRIMARY KEY,
      project_slug text,
      project_name text,
      notes text,
      tags text[],
      status text DEFAULT 'pending',
      created_by text,
      trained_by text,
      created_at timestamptz DEFAULT now(),
      trained_at timestamptz,
      payload jsonb
    )
  `)
  await query(`
    ALTER TABLE gc_ai_training_requests
      ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS trained_by text,
      ADD COLUMN IF NOT EXISTS trained_at timestamptz DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS payload jsonb
  `)
}

export async function getAiTrainingRequests(limit = 6) {
  await ensureAiTrainingTable()
  return query<AiTrainingRequest>(
    `SELECT id, project_slug, project_name, notes, tags, status, created_by, trained_by, created_at, trained_at, payload
     FROM gc_ai_training_requests
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit],
  )
}

export async function createAiTrainingRequest({
  projectSlug,
  projectName,
  notes,
  tags,
  createdBy,
  payload,
}: {
  projectSlug: string | null
  projectName: string | null
  notes: string
  tags?: string[]
  createdBy?: string | null
  payload?: Record<string, unknown>
}) {
  await ensureAiTrainingTable()
  const id = randomBytes(8).toString("hex")
  const rows = await query<AiTrainingRequest>(
    `INSERT INTO gc_ai_training_requests (id, project_slug, project_name, notes, tags, created_by, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, project_slug, project_name, notes, tags, status, created_by, trained_by, created_at, trained_at, payload`,
    [id, projectSlug, projectName, notes, tags ?? null, createdBy ?? null, payload ?? null],
  )
  return rows[0]
}

export async function markAiTrainingRequestTrained(id: string, trainedBy?: string | null) {
  await ensureAiTrainingTable()
  const rows = await query<AiTrainingRequest>(
    `UPDATE gc_ai_training_requests
     SET status = 'trained',
         trained_by = $2,
         trained_at = now()
     WHERE id = $1
     RETURNING id, project_slug, project_name, notes, tags, status, created_by, trained_by, created_at, trained_at, payload`,
    [id, trainedBy ?? null],
  )
  return rows[0] || null
}
