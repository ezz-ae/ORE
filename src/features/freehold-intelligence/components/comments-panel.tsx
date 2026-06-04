"use client"

import type { ReviewItem } from "../types"
import { convertCommentToTask, createReviewComment } from "../actions"
import { StatusPill } from "./status-pill"
import { ArrowRight, MessageSquare } from "lucide-react"

export function CommentsPanel({ pageRef, items }: { pageRef: string; items: ReviewItem[] }) {
  return (
    <div className="space-y-5">
      {/* Add comment form */}
      <div className="rounded-[22px] border border-white/[0.06] bg-[#0A0D10] p-6">
        <div className="mb-4 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-white/35">
          <MessageSquare className="h-3.5 w-3.5" /> Add a comment
        </div>
        <form action={createReviewComment} className="space-y-3">
          <input type="hidden" name="page_ref" value={pageRef} />
          <input
            name="author"
            placeholder="Your name"
            className="w-full rounded-[12px] border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-[13px] text-white placeholder:text-white/25 outline-none focus:border-[#D4AF37]/30 transition"
          />
          <textarea
            name="body"
            placeholder="Add a review comment or decision request…"
            rows={3}
            className="w-full rounded-[12px] border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[13px] text-white placeholder:text-white/25 outline-none focus:border-[#D4AF37]/30 transition resize-none"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-[12px] bg-white px-5 py-2.5 text-[13px] font-semibold text-[#06080A] transition hover:bg-white/90"
          >
            Add comment <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>

      {/* Comment list */}
      {items.length === 0 ? (
        <div className="rounded-[20px] border border-white/[0.06] bg-[#0A0D10] px-6 py-10 text-center">
          <p className="text-[14px] text-white/40">No comments yet on this page.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <div
              key={item.item_id}
              className="rounded-[20px] border border-white/[0.06] bg-[#0A0D10] p-5 transition hover:border-white/10"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/30">
                  #{item.item_id} · {item.author || "Anonymous"} · <span className="text-white/20">{item.page_ref}</span>
                </div>
                <StatusPill value={item.status} />
              </div>

              <p className="mt-3 text-[14px] leading-relaxed text-white/85">{item.body}</p>

              {item.kind === "comment" && (
                <form action={convertCommentToTask} className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/[0.05] pt-3.5">
                  <input type="hidden" name="item_id" value={item.item_id} />
                  <input
                    name="assignee"
                    placeholder="Assign to…"
                    className="rounded-[10px] border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[12px] text-white placeholder:text-white/25 outline-none focus:border-[#D4AF37]/30 transition"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#D4AF37]/20 bg-[#D4AF37]/[0.06] px-3.5 py-1.5 text-[12px] font-medium text-[#F8E7AE] transition hover:border-[#D4AF37]/35 hover:bg-[#D4AF37]/10"
                  >
                    Convert to task
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
