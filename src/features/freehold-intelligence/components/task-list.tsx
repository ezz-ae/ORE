"use client"

import type { ReviewItem } from "../types"
import { closeTask } from "../actions"
import { StatusPill } from "./status-pill"
import { CheckCircle2, User } from "lucide-react"

export function TaskList({ tasks }: { tasks: ReviewItem[] }) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-[20px] border border-white/[0.06] bg-[#0A0D10] px-6 py-10 text-center">
        <p className="text-[14px] text-white/40">No tasks yet. Convert comments into tasks from Review Requests.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      {tasks.map((task) => (
        <div
          key={task.item_id}
          className="rounded-[20px] border border-white/[0.06] bg-[#0A0D10] p-5 transition hover:border-white/10"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-white/30">
              <span>Task #{task.item_id}</span>
              {task.page_ref && <><span>·</span><span className="text-white/20">{task.page_ref}</span></>}
            </div>
            <StatusPill value={task.status} />
          </div>

          <p className="mt-3 text-[14px] leading-relaxed text-white/85">{task.body}</p>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.05] pt-3.5">
            <div className="flex items-center gap-2 text-[12px] text-white/40">
              <User className="h-3.5 w-3.5" />
              {task.assignee || "Unassigned"}
            </div>

            {task.status !== "resolved" && (
              <form action={closeTask}>
                <input type="hidden" name="item_id" value={task.item_id} />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-[10px] border border-emerald-400/20 bg-emerald-400/[0.06] px-3.5 py-1.5 text-[12px] font-medium text-emerald-300 transition hover:border-emerald-400/35 hover:bg-emerald-400/10"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Mark resolved
                </button>
              </form>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
