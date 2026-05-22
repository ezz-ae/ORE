import { CheckSquare } from 'lucide-react'
import { getReviewItems } from '@/src/features/freehold-intelligence/data-access'
import { CommentsPanel } from '@/src/features/freehold-intelligence/components/comments-panel'
import { AiPrompt } from '@/components/freehold/ai-prompt'

export default async function ReviewRequestsPage() {
  const comments = await getReviewItems('comment')

  return (
    <div className="mx-auto max-w-5xl px-6 pb-32 pt-12 sm:pt-16">

      <section>
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
          <CheckSquare className="h-3.5 w-3.5" /> Reviews
        </div>
        <h1 className="mt-5 text-[40px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[56px]">
          Decisions waiting on
          <br />
          <span className="text-white/40">a human.</span>
        </h1>
        <p className="mt-7 max-w-2xl text-[18px] leading-[1.6] text-white/65">
          Comments stay lightweight. The moment a decision or action is required, convert them into tasks — the AI tracks the conversion and the success event.
        </p>
      </section>

      <section className="mt-12">
        <AiPrompt
          placeholder="Ask about approvals, reviews, blockers…"
          suggestions={[
            'What needs my approval today?',
            'Show landing reviews pending.',
            'Which approvals are time-sensitive?',
          ]}
        />
      </section>

      <section className="mt-20">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">Review queue</div>
        <h2 className="mt-2 mb-6 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Comments and pending decisions</h2>
        <CommentsPanel pageRef="freehold-intelligence/review-requests" items={comments} />
      </section>
    </div>
  )
}
