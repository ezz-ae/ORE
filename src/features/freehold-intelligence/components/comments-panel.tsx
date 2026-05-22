import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { ReviewItem } from "../types"
import { convertCommentToTask, createReviewComment } from "../actions"
import { StatusPill } from "./status-pill"

export function CommentsPanel({ pageRef, items }: { pageRef: string; items: ReviewItem[] }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-[0.25em] text-[#D4AF37]">Review requests</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Comments → tasks</h2>
        <p className="mt-2 text-sm text-white/60">Capture stakeholder feedback and convert anything actionable into a trackable task.</p>
      </div>

      <form action={createReviewComment} className="space-y-3">
        <input type="hidden" name="page_ref" value={pageRef} />
        <input name="author" placeholder="Author" className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/35" />
        <Textarea name="body" placeholder="Add a review comment or decision request…" className="border-white/10 bg-black/30 text-white placeholder:text-white/35" />
        <Button className="bg-[#D4AF37] text-black hover:bg-[#AA8122]">Add comment</Button>
      </form>

      <div className="mt-6 space-y-3">
        {items.length === 0 ? <p className="text-sm text-white/50">No comments yet.</p> : null}
        {items.map((item) => (
          <div key={item.item_id} className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-white/50">#{item.item_id} · {item.author || "Anonymous"} · {item.page_ref}</div>
              <StatusPill value={item.status} />
            </div>
            <p className="text-sm leading-6 text-white/80">{item.body}</p>
            {item.kind === "comment" ? (
              <form action={convertCommentToTask} className="mt-3 flex flex-wrap gap-2">
                <input type="hidden" name="item_id" value={item.item_id} />
                <input name="assignee" placeholder="Assignee" className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/35" />
                <Button variant="outline" className="border-white/15 bg-transparent text-white hover:bg-white/10">Convert to task</Button>
              </form>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  )
}
