import { Button } from "@/components/ui/button"
import type { ReviewItem } from "../types"
import { closeTask } from "../actions"
import { StatusPill } from "./status-pill"

export function TaskList({ tasks }: { tasks: ReviewItem[] }) {
  return (
    <div className="space-y-3">
      {tasks.length === 0 ? <p className="text-white/50">No tasks yet. Convert comments into tasks from Review Requests.</p> : null}
      {tasks.map((task) => (
        <div key={task.item_id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-white/50">Task #{task.item_id} · {task.page_ref || "General"}</div>
            <StatusPill value={task.status} />
          </div>
          <p className="text-white">{task.body}</p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-white/55">
            <span>Assignee: {task.assignee || "Unassigned"}</span>
            {task.status !== "resolved" ? (
              <form action={closeTask}>
                <input type="hidden" name="item_id" value={task.item_id} />
                <Button className="bg-[#D4AF37] text-black hover:bg-[#C69B3E]">Mark resolved</Button>
              </form>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}
