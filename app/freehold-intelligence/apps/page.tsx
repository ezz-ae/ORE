import Link from 'next/link'
import { ArrowUpRight, Grid3x3 } from 'lucide-react'
import { currentServerUser, getVisibleServerApps } from '@/src/features/freehold-intelligence/server-session'

const statusTone: Record<string, { dot: string; text: string; label: string }> = {
  live:        { dot: 'bg-[#D4AF37]',   text: 'text-[#D4AF37]',  label: 'Live'        },
  in_progress: { dot: 'bg-slate-500',   text: 'text-slate-400',   label: 'In progress' },
  planned:     { dot: 'bg-slate-600',   text: 'text-slate-500',   label: 'Planned'     },
  blocked:     { dot: 'bg-red-400',     text: 'text-red-300',     label: 'Blocked'     },
}

export default function ServerAppsPage() {
  const apps = getVisibleServerApps(currentServerUser.role)

  return (
    <div className="mx-auto max-w-5xl px-6 pb-16 pt-6 sm:pt-16">

      <section>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#D4AF37]/85">
          <Grid3x3 className="h-3.5 w-3.5" /> All apps
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white">
          Every surface
          <br />
          <span className="text-slate-500">in the server.</span>
        </h1>
        <p className="mt-7 max-w-2xl text-lg leading-[1.6] text-slate-300">
          {apps.length} apps visible to a {currentServerUser.role.replace('_', ' ')}. Each one is a focused operating surface — open the one you need, the AI follows you between them.
        </p>
      </section>

      <section className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {apps.map((app) => {
          const tone = statusTone[app.status] ?? statusTone.planned
          return (
            <Link
              key={app.id}
              href={app.href}
              className="group relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 p-6 transition hover:border-[#D4AF37]/20 hover:bg-slate-800/50"
            >
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#D4AF37]/[0.06] to-transparent opacity-0 transition group-hover:opacity-100" />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{app.linkedMilestoneId}</span>
                  <span className={`flex items-center gap-1.5 text-sm ${tone.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                    {tone.label}
                  </span>
                </div>
                <div className="mt-7 text-lg font-semibold tracking-tight text-white">{app.name}</div>
                <p className="mt-1.5 text-sm leading-snug text-slate-400">{app.description}</p>
                <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-800 pt-4">
                  <div className="flex gap-3 text-sm text-slate-500">
                    {app.urgentCount > 0 && <span className="text-red-300/80">{app.urgentCount} urgent</span>}
                    {app.pendingApprovalCount > 0 && <span className="text-[#D4AF37]/80">{app.pendingApprovalCount} approval</span>}
                  </div>
                  <ArrowUpRight className="h-3.5 w-3.5 text-slate-600 transition group-hover:text-[#D4AF37]" />
                </div>
              </div>
            </Link>
          )
        })}
      </section>
    </div>
  )
}
