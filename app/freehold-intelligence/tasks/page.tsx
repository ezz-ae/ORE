import { getReviewItems } from "@/src/features/freehold-intelligence/data-access"
import { DeveloperNotes } from "@/src/features/freehold-intelligence/components/developer-notes"
import { TaskList } from "@/src/features/freehold-intelligence/components/task-list"

export default async function TasksPage() {
  const tasks = await getReviewItems("task")
  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs uppercase tracking-[0.35em] text-[#D4AF37]">Execution queue</p>
        <h1 className="mt-3 font-serif text-5xl font-semibold">Tasks</h1>
        <p className="mt-4 max-w-3xl text-white/65">Actionable work created from review comments, decision requests and internal implementation notes.</p>
      </section>
      <TaskList tasks={tasks} />
      <DeveloperNotes title="Tasks" notes={["Status changes update freehold_comments_tasks.status and resolved_at.", "Next enhancement: add assignee dropdown from freehold_users and priority field."]} />
    </div>
  )
}
