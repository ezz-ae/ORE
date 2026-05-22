import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Flag } from 'lucide-react'
import { getMilestone, getMilestones, getReviewItems } from '@/src/features/freehold-intelligence/data-access'
import { CommentsPanel } from '@/src/features/freehold-intelligence/components/comments-panel'

export async function generateStaticParams() {
  const milestones = await getMilestones()
  return milestones.map((m) => ({ milestoneId: m.code }))
}

function healthTone(health?: string | null) {
  switch (health) {
    case 'complete':
    case 'on_track': return { dot: 'bg-emerald-400', text: 'text-emerald-300', bar: 'bg-emerald-400' }
    case 'at_risk':  return { dot: 'bg-[#D4AF37]',  text: 'text-[#F8E7AE]',  bar: 'bg-[#D4AF37]'  }
    case 'overdue':  return { dot: 'bg-red-400',    text: 'text-red-300',    bar: 'bg-red-400'    }
    default:         return { dot: 'bg-white/25',   text: 'text-white/55',   bar: 'bg-white/25'   }
  }
}

export default async function MilestoneDetailPage({ params }: { params: Promise<{ milestoneId: string }> }) {
  const { milestoneId } = await params
  const [milestone, comments] = await Promise.all([getMilestone(milestoneId), getReviewItems('comment')])
  if (!milestone) notFound()
  const tone = healthTone(milestone.health)
  const pct = milestone.progress_pct ?? 0
  const pageRef = `freehold-intelligence/milestones/${milestone.code}`

  return (
    <div className="mx-auto max-w-3xl px-6 pb-32 pt-12 sm:pt-16">

      <Link href="/freehold-intelligence/milestones" className="inline-flex items-center gap-1.5 text-[12px] text-white/45 transition hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" />
        All milestones
      </Link>

      <section className="mt-7">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
          <Flag className="h-3.5 w-3.5" /> {milestone.code}
        </div>
        <h1 className="mt-5 text-[40px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[56px]">
          {milestone.title}
        </h1>
        <p className="mt-7 max-w-2xl text-[18px] leading-[1.6] text-white/65">
          {milestone.description || 'Execution milestone for the Freehold Intelligence V1 skeleton.'}
        </p>
      </section>

      <section className="mt-12 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.06] bg-[#0A0D10] p-5">
          <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/35">Owner</div>
          <div className="mt-2 text-lg font-semibold tracking-tight text-white">{milestone.owner}</div>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-[#0A0D10] p-5">
          <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/35">Deadline</div>
          <div className="mt-2 text-lg font-semibold tracking-tight text-white">{milestone.deadline}</div>
          {milestone.days_to_deadline != null && (
            <div className="mt-1 text-[12px] text-white/45">{milestone.days_to_deadline}d remaining</div>
          )}
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-[#0A0D10] p-5">
          <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/35">Health</div>
          <div className={`mt-2 flex items-center gap-1.5 text-lg font-semibold capitalize ${tone.text}`}>
            <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
            {(milestone.health ?? 'planned').replace('_', ' ')}
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-white/[0.06] bg-[#0A0D10] p-6">
        <div className="flex items-center justify-between text-[12px] text-white/55">
          <span>Progress</span>
          <span className="tabular-nums font-semibold text-white">{pct}%</span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div className={`h-full transition-all ${tone.bar}`} style={{ width: `${pct}%` }} />
        </div>
      </section>

      {milestone.success_event && (
        <section className="mt-12 rounded-3xl border border-[#D4AF37]/15 bg-[#D4AF37]/[0.04] px-7 py-7 sm:px-10 sm:py-9">
          <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">Success event</div>
          <p className="mt-3 text-[17px] font-medium leading-[1.65] text-white/85 sm:text-lg">{milestone.success_event}</p>
        </section>
      )}

      <section className="mt-16">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">Comments and decisions</div>
        <h2 className="mt-2 mb-6 text-2xl font-semibold tracking-tight text-white">Review on this milestone</h2>
        <CommentsPanel pageRef={pageRef} items={comments.filter((c) => c.page_ref === pageRef)} />
      </section>
    </div>
  )
}
