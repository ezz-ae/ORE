import { notFound } from "next/navigation"
import { getMilestone, getMilestones, getReviewItems } from "@/src/features/freehold-intelligence/data-access"
import { CommentsPanel } from "@/src/features/freehold-intelligence/components/comments-panel"
import { DeveloperNotes } from "@/src/features/freehold-intelligence/components/developer-notes"
import { ProgressFooter } from "@/src/features/freehold-intelligence/components/progress-footer"
import { StatusPill } from "@/src/features/freehold-intelligence/components/status-pill"

export async function generateStaticParams() {
  const milestones = await getMilestones()
  return milestones.map((milestone) => ({ milestoneId: milestone.code }))
}

export default async function MilestoneDetailPage({ params }: { params: Promise<{ milestoneId: string }> }) {
  const { milestoneId } = await params
  const [milestone, comments] = await Promise.all([getMilestone(milestoneId), getReviewItems("comment")])
  if (!milestone) notFound()
  const pageRef = `freehold-intelligence/milestones/${milestone.code}`

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-[#D4AF37]">Milestone detail</p>
            <h1 className="mt-3 font-serif text-5xl font-semibold">{milestone.code} · {milestone.title}</h1>
            <p className="mt-4 max-w-3xl text-white/65">{milestone.description || "Execution milestone for the Freehold Intelligence V1 skeleton."}</p>
          </div>
          <div className="flex gap-2"><StatusPill value={milestone.status} /><StatusPill value={milestone.health} /></div>
        </div>
      </section>
      <section className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><p className="text-sm text-white/50">Owner</p><p className="mt-2 text-2xl font-semibold">{milestone.owner}</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><p className="text-sm text-white/50">Deadline</p><p className="mt-2 text-2xl font-semibold">{milestone.deadline}</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><p className="text-sm text-white/50">Success event</p><p className="mt-2 text-base text-white/80">{milestone.success_event || "Success event pending."}</p></div>
      </section>
      <CommentsPanel pageRef={pageRef} items={comments.filter((item) => item.page_ref === pageRef)} />
      <ProgressFooter milestone={milestone} />
      <DeveloperNotes title={milestone.code} notes={["Acceptance criteria should remain binary and tied to a visible success event.", "Use comments for stakeholder review; convert anything actionable into a task."]} />
    </div>
  )
}
