import { Flag } from 'lucide-react'
import { getMilestones } from '@/src/features/freehold-intelligence/data-access'
import { AiPrompt } from '@/components/freehold/ai-prompt'
import { MilestonesList } from './_components/MilestonesList'

export default async function MilestonesPage() {
  const milestones = await getMilestones()
  const done = milestones.filter((m) => m.status === 'done' || m.status === 'live').length
  const overall = Math.round(milestones.reduce((s, m) => s + (m.progress_pct ?? 0), 0) / Math.max(1, milestones.length))

  return (
    <div className="mx-auto max-w-5xl px-6 pb-16 pt-6 sm:pt-16">

      <section>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold/85">
          <Flag className="h-3.5 w-3.5" /> Milestones
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white">
          The road
          <br />
          <span className="text-slate-400">to September.</span>
        </h1>
        <p className="mt-7 max-w-2xl text-lg leading-[1.6] text-slate-300">
          <span className="text-white">{overall}% overall</span> across {milestones.length} milestones, with {done} {done === 1 ? 'complete' : 'completed'}. Each milestone carries an owner, a deadline and a clear success event.
        </p>
      </section>

      <section className="mt-12">
        <AiPrompt
          placeholder="Ask about milestones, deadlines, owners…"
          suggestions={[
            'Which milestones are at risk?',
            'What is M5 waiting on?',
            'Show milestones due in 30 days.',
          ]}
        />
      </section>

      <section className="mt-16">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">All milestones</div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">M0 → M9</h2>
        <MilestonesList milestones={milestones} />
      </section>
    </div>
  )
}
