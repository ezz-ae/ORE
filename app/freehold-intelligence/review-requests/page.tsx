import { getReviewItems } from "@/src/features/freehold-intelligence/data-access"
import { CommentsPanel } from "@/src/features/freehold-intelligence/components/comments-panel"
import { DeveloperNotes } from "@/src/features/freehold-intelligence/components/developer-notes"

export default async function ReviewRequestsPage() {
  const comments = await getReviewItems("comment")
  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs uppercase tracking-[0.35em] text-[#D4AF37]">Stakeholder review loop</p>
        <h1 className="mt-3 font-serif text-5xl font-semibold">Review requests</h1>
        <p className="mt-4 max-w-3xl text-white/65">Comments are intentionally lightweight; once a decision or action is required, convert them into tasks.</p>
      </section>
      <CommentsPanel pageRef="freehold-intelligence/review-requests" items={comments} />
      <DeveloperNotes title="Review Requests" notes={["This page writes to freehold_comments_tasks with kind='comment'.", "Conversion creates a second row with kind='task' and converted_from pointing to the original comment."]} />
    </div>
  )
}
