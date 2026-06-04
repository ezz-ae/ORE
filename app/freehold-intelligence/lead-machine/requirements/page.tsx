import Link from 'next/link'
import { AlertCircle, CheckCircle2, Clock, ArrowUpRight } from 'lucide-react'
import { leadMachineRequirements, leadMachineListings } from '@/src/features/freehold-intelligence/lead-machine'
import { AiPrompt } from '@/components/freehold/ai-prompt'

function severityTone(s: string) {
  if (s === 'critical') return { ring: 'border-red-400/25', bg: 'bg-red-400/[0.06]', text: 'text-red-300', dot: 'bg-red-400', label: 'Critical' }
  if (s === 'high')     return { ring: 'border-[#D4AF37]/25', bg: 'bg-[#D4AF37]/[0.05]', text: 'text-[#F8E7AE]', dot: 'bg-[#D4AF37]', label: 'High' }
  if (s === 'medium')   return { ring: 'border-sky-400/20', bg: 'bg-sky-400/[0.05]', text: 'text-sky-200', dot: 'bg-sky-400', label: 'Medium' }
  return                       { ring: 'border-white/[0.06]', bg: 'bg-[#0A0D10]', text: 'text-white/50', dot: 'bg-white/30', label: 'Low' }
}

function statusIcon(s: string) {
  if (s === 'Done') return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
  if (s === 'Needs Access' || s === 'Blocked') return <AlertCircle className="h-3.5 w-3.5 text-red-400" />
  return <Clock className="h-3.5 w-3.5 text-[#D4AF37]" />
}

const projectName = (id: string) => leadMachineListings.find((l) => l.projectId === id)?.projectName || id

const criticalCount = leadMachineRequirements.filter((r) => r.severity === 'critical').length
const openCount = leadMachineRequirements.filter((r) => r.status !== 'Done').length

export default function RequirementsPage() {
  const sorted = [...leadMachineRequirements].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 }
    return (order[a.severity as keyof typeof order] ?? 3) - (order[b.severity as keyof typeof order] ?? 3)
  })

  return (
    <div className="mx-auto max-w-4xl px-4 pb-32 pt-10 sm:px-6 sm:pt-14">

      {/* Header */}
      <section>
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
          <AlertCircle className="h-3.5 w-3.5" /> Requirements
        </div>
        <h1 className="mt-4 text-[36px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[48px]">
          {openCount} open.
          <br />
          <span className="text-white/35">{criticalCount} critical.</span>
        </h1>
        <p className="mt-5 max-w-xl text-[16px] leading-[1.65] text-white/60">
          Everything blocking landing generation, ad launch, and campaign go-live. Resolve in priority order.
        </p>
      </section>

      {/* Stat tiles */}
      <section className="mt-8 grid grid-cols-3 gap-3">
        <div className="rounded-[18px] border border-red-400/20 bg-red-400/[0.06] p-4 text-center">
          <p className="text-[26px] font-semibold text-red-300">{criticalCount}</p>
          <p className="text-[10px] text-red-400/60 mt-1">Critical</p>
        </div>
        <div className="rounded-[18px] border border-[#D4AF37]/20 bg-[#D4AF37]/[0.05] p-4 text-center">
          <p className="text-[26px] font-semibold text-[#F8E7AE]">{leadMachineRequirements.filter(r => r.severity === 'high').length}</p>
          <p className="text-[10px] text-[#D4AF37]/60 mt-1">High</p>
        </div>
        <div className="rounded-[18px] border border-white/[0.06] bg-[#0A0D10] p-4 text-center">
          <p className="text-[26px] font-semibold text-white">{openCount}</p>
          <p className="text-[10px] text-white/35 mt-1">Total open</p>
        </div>
      </section>

      {/* Requirements list */}
      <section className="mt-8 space-y-4">
        {sorted.map((req) => {
          const tone = severityTone(req.severity)
          return (
            <div key={req.id} className={`rounded-[22px] border p-6 ${tone.ring} ${tone.bg}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${tone.ring} ${tone.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                    {tone.label}
                  </span>
                  <span className="text-[11px] text-white/30">{req.type}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[12px]">
                  {statusIcon(req.status)}
                  <span className="text-white/55">{req.status}</span>
                </div>
              </div>

              <h3 className="mt-3 text-[15px] font-semibold text-white">{req.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-white/65">{req.description}</p>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.05] pt-4">
                <div className="flex flex-wrap gap-4 text-[12px] text-white/35">
                  <span>Project: <span className="text-white/55">{projectName(req.projectId)}</span></span>
                  <span>Owner: <span className="text-white/55">{req.owner}</span></span>
                  <span>Due: <span className="text-white/55">{req.dueDate}</span></span>
                </div>
                <div className={`text-[12px] font-medium ${tone.text}`}>→ {req.nextAction}</div>
              </div>

              <Link
                href={`/freehold-intelligence/lead-machine/listings/${leadMachineListings.find(l => l.projectId === req.projectId)?.id || ''}`}
                className="mt-3 inline-flex items-center gap-1 text-[11px] text-white/30 transition hover:text-[#D4AF37]"
              >
                View listing <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          )
        })}
      </section>

      {/* AI */}
      <section className="mt-10">
        <AiPrompt
          placeholder="Ask about launch blockers, access requirements…"
          suggestions={[
            'What is the fastest path to unblocking Meta launch?',
            'Who needs to action the critical requirements?',
            'Which requirement is easiest to resolve today?',
          ]}
        />
      </section>

    </div>
  )
}
