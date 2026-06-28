import { randomUUID } from "node:crypto"
import { query } from "@/lib/db"

export type TaskStatus = "open" | "in_progress" | "blocked" | "done"
export type TaskPriority = "critical" | "high" | "medium" | "low"

export interface WorkTask {
  id: string
  title: string
  description: string
  assignee: string
  priority: TaskPriority
  status: TaskStatus
  dueDate: string | null
  createdBy: string
  createdAt: string | null
}

export interface WorkTaskInput {
  title: string
  description?: string
  assignee?: string
  priority?: TaskPriority
  dueDate?: string
}

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v))

let ensurePromise: Promise<void> | null = null
const ensureSchema = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_site_tasks (
      id text PRIMARY KEY,
      title text NOT NULL,
      description text,
      assignee text,
      priority text DEFAULT 'medium',
      status text DEFAULT 'open',
      due_date date,
      created_by text,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )
  `)
}
const ensureSchemaOnce = async () => {
  if (!ensurePromise) ensurePromise = ensureSchema().catch((e) => { ensurePromise = null; throw e })
  await ensurePromise
}

const mapRow = (r: Record<string, unknown>): WorkTask => ({
  id: str(r.id),
  title: str(r.title),
  description: str(r.description),
  assignee: str(r.assignee),
  priority: (str(r.priority) || "medium") as TaskPriority,
  status: (str(r.status) || "open") as TaskStatus,
  dueDate: r.due_date ? String(r.due_date) : null,
  createdBy: str(r.created_by),
  createdAt: r.created_at ? String(r.created_at) : null,
})

const SELECT = `id, title, description, assignee, priority, status, due_date::text, created_by, created_at::text`

export async function listTasks(): Promise<WorkTask[]> {
  try {
    await ensureSchemaOnce()
    const rows = await query<Record<string, unknown>>(
      `SELECT ${SELECT} FROM freehold_site_tasks
       ORDER BY (status = 'done') ASC, created_at DESC NULLS LAST LIMIT 500`,
    )
    return rows.map(mapRow)
  } catch (error) {
    console.error("[tasks] list failed", error)
    return []
  }
}

export async function createTask(input: WorkTaskInput, creator: { id: string }): Promise<WorkTask> {
  await ensureSchemaOnce()
  const id = `task_${randomUUID()}`
  const rows = await query<Record<string, unknown>>(
    `INSERT INTO freehold_site_tasks (id, title, description, assignee, priority, status, due_date, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, 'open', $6, $7, now(), now()) RETURNING ${SELECT}`,
    [id, input.title, input.description || "", input.assignee || "", input.priority || "medium", input.dueDate || null, creator.id],
  )
  return mapRow(rows[0])
}

export async function updateTaskStatus(id: string, status: TaskStatus): Promise<WorkTask | null> {
  await ensureSchemaOnce()
  const rows = await query<Record<string, unknown>>(
    `UPDATE freehold_site_tasks SET status = $2, updated_at = now() WHERE id = $1 RETURNING ${SELECT}`,
    [id, status],
  )
  return rows[0] ? mapRow(rows[0]) : null
}
