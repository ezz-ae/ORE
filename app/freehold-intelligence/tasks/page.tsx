import { CheckSquare } from 'lucide-react'
import { getReviewItems } from '@/src/features/freehold-intelligence/data-access'
import { TaskList } from '@/src/features/freehold-intelligence/components/task-list'
import { AiPrompt } from '@/components/freehold/ai-prompt'

export default async function TasksPage() {
  const tasks = await getReviewItems('task')

  return (
    <div className="mx-auto max-w-5xl px-6 pb-32 pt-12 sm:pt-16">

      <section>
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
          <CheckSquare className="h-3.5 w-3.5" /> Tasks
        </div>
        <h1 className="mt-5 text-[40px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[56px]">
          What's next
          <br />
          <span className="text-white/40">on the line.</span>
        </h1>
        <p className="mt-7 max-w-2xl text-[18px] leading-[1.6] text-white/65">
          Actionable work created from review comments, decision requests and internal implementation notes — owned, dated and tracked.
        </p>
      </section>

      <section className="mt-12">
        <AiPrompt
          placeholder="Ask about tasks, owners, deadlines…"
          suggestions={[
            'What is due this week?',
            'Show tasks blocked on access.',
            'Group tasks by milestone.',
          ]}
        />
      </section>

      <section className="mt-20">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">Open queue</div>
        <h2 className="mt-2 mb-6 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Live tasks</h2>
        <TaskList tasks={tasks} />
      </section>
    </div>
  )
}
