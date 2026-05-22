import Link from 'next/link'
import { ArrowUpRight, Grid3x3 } from 'lucide-react'
import { currentServerUser, getVisibleServerApps } from '@/src/features/freehold-intelligence/server-session'

const statusTone: Record<string, { dot: string; text: string; label: string }> = {
  live:        { dot: 'bg-emerald-400', text: 'text-emerald-300', label: 'Live' },
  in_progress: { dot: 'bg-[#D4AF37]',   text: 'text-[#F8E7AE]',   label: 'In progress' },
  planned:     { dot: 'bg-sky-400',     text: 'text-sky-200',     label: 'Planned' },
  blocked:     { dot: 'bg-red-400',     text: 'text-red-300',     label: 'Blocked' },
}

const TINTS = [
  'from-[#D4AF37]/20 via-[#D4AF37]/[0.05] to-transparent',
  'from-emerald-500/20 via-emerald-500/[0.05] to-transparent',
  'from-sky-500/20 via-sky-500/[0.05] to-transparent',
  'from-rose-500/20 via-rose-500/[0.05] to-transparent',
  'from-violet-500/20 via-violet-500/[0.05] to-transparent',
  'from-orange-500/20 via-orange-500/[0.05] to-transparent',
  'from-cyan-500/20 via-cyan-500/[0.05] to-transparent',
]

export default function ServerAppsPage() {
  const apps = getVisibleServerApps(currentServerUser.role)

  return (
    <div className="mx-auto max-w-5xl px-6 pb-32 pt-12 sm:pt-16">

      <section>
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
          <Grid3x3 className="h-3.5 w-3.5" /> All apps
        </div>
        <h1 className="mt-5 text-[40px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[56px]">
          Every surface
          <br />
          <span className="text-white/40">in the server.</span>
        </h1>
        <p className="mt-7 max-w-2xl text-[18px] leading-[1.6] text-white/65">
          {apps.length} apps visible to a {currentServerUser.role.replace('_', ' ')}. Each one is a focused operating surface — open the one you need, the AI follows you between them.
        </p>
      </section>

      <section className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {apps.map((app, i) => {
          const tone = statusTone[app.status] ?? statusTone.planned
          const tint = TINTS[i % TINTS.length]
          return (
            <Link
              key={app.id}
              href={app.href}
              className="group relative overflow-hidden rounded-3xl border border-white/[0.06] bg-[#0A0D10] p-6 transition hover:border-[#D4AF37]/25"
            >
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${tint} opacity-70 transition group-hover:opacity-100`} />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/45">{app.linkedMilestoneId}</span>
                  <span className={`flex items-center gap-1.5 text-[11px] ${tone.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                    {tone.label}
                  </span>
                </div>
                <div className="mt-7 text-lg font-semibold tracking-tight text-white">{app.name}</div>
                <p className="mt-1.5 text-[13px] leading-snug text-white/55">{app.description}</p>
                <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/[0.05] pt-4">
                  <div className="flex gap-3 text-[11px] text-white/45">
                    {app.urgentCount > 0 && <span className="text-red-300/80">{app.urgentCount} urgent</span>}
                    {app.pendingApprovalCount > 0 && <span className="text-[#D4AF37]/80">{app.pendingApprovalCount} approval</span>}
                  </div>
                  <ArrowUpRight className="h-3.5 w-3.5 text-white/30 transition group-hover:text-[#D4AF37]" />
                </div>
              </div>
            </Link>
          )
        })}
      </section>
    </div>
  )
}
