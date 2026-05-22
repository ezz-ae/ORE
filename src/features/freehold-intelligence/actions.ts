"use server"

import { revalidatePath } from "next/cache"
import { query } from "@/lib/db"

const asText = (value: FormDataEntryValue | null) => String(value ?? "").trim()

export async function createReviewComment(formData: FormData) {
  const pageRef = asText(formData.get("page_ref")) || "freehold-intelligence"
  const body = asText(formData.get("body"))
  const author = asText(formData.get("author")) || "Freehold stakeholder"

  if (!body) return

  await query(
    `INSERT INTO freehold_comments_tasks (kind, page_ref, body, author, status)
     VALUES ('comment', $1, $2, $3, 'open')`,
    [pageRef, body, author]
  )

  revalidatePath("/freehold-intelligence")
  revalidatePath("/freehold-intelligence/review-requests")
}

export async function convertCommentToTask(formData: FormData) {
  const itemId = Number(asText(formData.get("item_id")))
  const assignee = asText(formData.get("assignee")) || "Unassigned"
  if (!Number.isFinite(itemId)) return

  const rows = await query<{ body: string; page_ref: string | null; author: string | null }>(
    "SELECT body, page_ref, author FROM freehold_comments_tasks WHERE item_id = $1 LIMIT 1",
    [itemId]
  )
  const source = rows[0]
  if (!source) return

  await query(
    `INSERT INTO freehold_comments_tasks (kind, page_ref, body, author, assignee, status, converted_from)
     VALUES ('task', $1, $2, $3, $4, 'open', $5)`,
    [source.page_ref, source.body, source.author, assignee, itemId]
  )

  revalidatePath("/freehold-intelligence/review-requests")
  revalidatePath("/freehold-intelligence/tasks")
}

export async function closeTask(formData: FormData) {
  const itemId = Number(asText(formData.get("item_id")))
  if (!Number.isFinite(itemId)) return

  await query(
    "UPDATE freehold_comments_tasks SET status = 'resolved', resolved_at = NOW() WHERE item_id = $1",
    [itemId]
  )

  revalidatePath("/freehold-intelligence/tasks")
}
