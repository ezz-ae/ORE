import Link from "next/link"
import { ArrowRight, Boxes, MessageSquareWarning } from "lucide-react"
import { currentServerUser, getVisibleServerApps } from "@/src/features/freehold-intelligence/server-session"

const statusClass: Record<string, string> = {
  live: "border-emerald-300/25 bg-emerald-400/10 text-emerald-200",
  in_progress: "border-[#D4AF37]/35 bg-[#D4AF37]/10 text-[#F8E7AE]",
  planned: "border-sky-300/25 bg-sky-400/10 text-sky-100",
  blocked: "border-red-300/30 bg-red-500/10 text-red-100",
}

export default function ServerAppsPage() {
  const apps = getVisibleServerApps(currentServerUser.role)

  return (
    <div className="min-h-full px-4 py-5 sm:px-6 lg:px-8">
      <section className="border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D4AF37]">Private server apps</p>
            <h1 className="mt-3 text-3xl font-semibold text-white">Operating systems inside Freehold Intelligence</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/55">Each app is an internal work surface with visibility, activity, blockers, approvals, milestones and comments. No public website visual language is used here.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/45">
            <Boxes className="h-4 w-4 text-[#D4AF37]" />
            {apps.length} visible apps for {currentServerUser.role.replace("_", " ")}
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {apps.map((app) => (
          <Link key={app.id} href={app.href} className="group border border-white/10 bg-white/[0.035] p-4 transition hover:border-[#D4AF37]/35 hover:bg-white/[0.055]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">{app.linkedMilestoneId}</div>
                <h2 className="mt-2 text-lg font-semibold text-white">{app.name}</h2>
              </div>
              <span className={`border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${statusClass[app.status] ?? statusClass.planned}`}>
                {app.status.replace("_", " ")}
              </span>
            </div>
            <p className="mt-3 min-h-12 text-sm leading-6 text-white/55">{app.description}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="border border-white/10 bg-black/15 p-2">
                <div className="text-lg font-semibold text-white">{app.urgentCount}</div>
                <div className="text-white/35">urgent</div>
              </div>
              <div className="border border-white/10 bg-black/15 p-2">
                <div className="text-lg font-semibold text-white">{app.blockedCount}</div>
                <div className="text-white/35">blocked</div>
              </div>
              <div className="border border-white/10 bg-black/15 p-2">
                <div className="text-lg font-semibold text-white">{app.pendingApprovalCount}</div>
                <div className="text-white/35">approval</div>
              </div>
            </div>
            <div className="mt-4 border-t border-white/10 pt-4">
              <div className="flex items-center gap-2 text-xs text-white/45">
                <MessageSquareWarning className="h-3.5 w-3.5 text-[#D4AF37]" />
                {app.latestActivity}
              </div>
              <div className="mt-3 text-sm text-white/70">{app.nextAction}</div>
            </div>
            <div className="mt-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#D4AF37]">
              Open app <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
            </div>
          </Link>
        ))}
      </section>
    </div>
  )
}
