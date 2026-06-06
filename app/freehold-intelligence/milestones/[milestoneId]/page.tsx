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
    case 'on_track': return { dot: 'bg-[#D4AF37]', text: 'text-[#D4AF37]', bar: 'bg-[#D4AF37]' }
    case 'at_risk':  return { dot: 'bg-[#D4AF37]',  text: 'text-[#F8E7AE]',  bar: 'bg-[#D4AF37]'  }
    case 'overdue':  return { dot: 'bg-red-400',    text: 'text-red-300',    bar: 'bg-red-400'    }
    default:         return { dot: 'bg-slate-500',  text: 'text-slate-400',  bar: 'bg-slate-500'  }
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
    <div className="mx-auto max-w-3xl px-6 pb-16 pt-6 sm:pt-16">

      <Link href="/freehold-intelligence/milestones" className="inline-flex items-center gap-1.5 text-xs text-slate-400 transition hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" />
        All milestones
      </Link>

      <section className="mt-7">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#D4AF37]/85">
          <Flag className="h-3.5 w-3.5" /> {milestone.code}
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white">
          {milestone.title}
        </h1>
        <p className="mt-7 max-w-2xl text-lg leading-[1.6] text-slate-300">
          {milestone.description || 'Execution milestone for the Freehold Intelligence V1 skeleton.'}
        </p>
      </section>

      <section className="mt-12 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Owner</div>
          <div className="mt-2 text-lg font-semibold tracking-tight text-white">{milestone.owner}</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Deadline</div>
          <div className="mt-2 text-lg font-semibold tracking-tight text-white">{milestone.deadline}</div>
          {milestone.days_to_deadline != null && (
            <div className="mt-1 text-xs text-slate-400">{milestone.days_to_deadline}d remaining</div>
          )}
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Health</div>
          <div className={`mt-2 flex items-center gap-1.5 text-lg font-semibold capitalize ${tone.text}`}>
            <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
            {(milestone.health ?? 'planned').replace('_', ' ')}
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="flex items-center justify-between text-sm text-slate-400">
          <span>Progress</span>
          <span className="tabular-nums font-semibold text-white">{pct}%</span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800/60">
          <div className={`h-full transition-all ${tone.bar}`} style={{ width: `${pct}%` }} />
        </div>
      </section>

      {milestone.success_event && (
        <section className="mt-12 rounded-3xl border border-[#D4AF37]/15 bg-[#D4AF37]/[0.04] px-7 py-7 sm:px-10 sm:py-9">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#D4AF37]/85">Success event</div>
          <p className="mt-3 text-base font-medium leading-[1.65] text-slate-100 sm:text-lg">{milestone.success_event}</p>
        </section>
      )}

      <section className="mt-16">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Comments and decisions</div>
        <h2 className="mt-2 mb-6 text-2xl font-semibold tracking-tight text-white">Review on this milestone</h2>
        <CommentsPanel pageRef={pageRef} items={comments.filter((c) => c.page_ref === pageRef)} />
      </section>
    </div>
  )
}
