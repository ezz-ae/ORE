import Link from 'next/link'
import { ArrowUpRight, Flag } from 'lucide-react'
import { getMilestones } from '@/src/features/freehold-intelligence/data-access'
import { AiPrompt } from '@/components/freehold/ai-prompt'

function healthTone(health?: string | null) {
  switch (health) {
    case 'complete':
    case 'on_track': return { dot: 'bg-emerald-400', text: 'text-emerald-300', bar: 'bg-emerald-400' }
    case 'at_risk':  return { dot: 'bg-[#D4AF37]',  text: 'text-[#F8E7AE]',  bar: 'bg-[#D4AF37]'  }
    case 'overdue':  return { dot: 'bg-red-400',    text: 'text-red-300',    bar: 'bg-red-400'    }
    default:         return { dot: 'bg-white/25',   text: 'text-white/55',   bar: 'bg-white/25'   }
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'done':
    case 'live':        return 'Done'
    case 'in_progress': return 'In progress'
    case 'blocked':     return 'Blocked'
    default:            return 'Planned'
  }
}

export default async function MilestonesPage() {
  const milestones = await getMilestones()
  const done = milestones.filter((m) => m.status === 'done' || m.status === 'live').length
  const overall = Math.round(milestones.reduce((s, m) => s + (m.progress_pct ?? 0), 0) / Math.max(1, milestones.length))

  return (
    <div className="mx-auto max-w-3xl px-6 pb-32 pt-12 sm:pt-16">

      <section>
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
          <Flag className="h-3.5 w-3.5" /> Milestones
        </div>
        <h1 className="mt-5 text-[40px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[56px]">
          The road
          <br />
          <span className="text-white/40">to September.</span>
        </h1>
        <p className="mt-7 max-w-2xl text-[18px] leading-[1.6] text-white/65">
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

      <section className="mt-20">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">All milestones</div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">M0 → M9</h2>

        <ol className="mt-8 grid gap-3">
          {milestones.map((m) => {
            const tone = healthTone(m.health)
            const pct = m.progress_pct ?? 0
            return (
              <li key={m.code}>
                <Link
                  href={`/freehold-intelligence/milestones/${m.code}`}
                  className="group flex items-stretch gap-5 rounded-2xl border border-white/[0.06] bg-[#0A0D10] p-5 transition hover:border-[#D4AF37]/20 hover:bg-[#0E1216] sm:p-6"
                >
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-[#D4AF37]/20 bg-[#D4AF37]/[0.06] text-sm font-semibold tracking-tight text-[#D4AF37]">
                    {m.code}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-lg font-semibold tracking-tight text-white">{m.title}</h3>
                      <span className={`flex items-center gap-1.5 text-[12px] ${tone.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                        {statusLabel(m.status)}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-white/45">
                      <span>{m.owner ?? 'Unassigned'}</span>
                      <span className="text-white/20">·</span>
                      <span>{m.deadline}</span>
                      {m.days_to_deadline != null && (
                        <>
                          <span className="text-white/20">·</span>
                          <span>{m.days_to_deadline}d remaining</span>
                        </>
                      )}
                    </div>
                    <div className="mt-4 h-[3px] overflow-hidden rounded-full bg-white/[0.06]">
                      <div className={`h-full transition-all ${tone.bar}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 self-center text-white/25 transition group-hover:text-[#D4AF37]" />
                </Link>
              </li>
            )
          })}
        </ol>
      </section>
    </div>
  )
}
