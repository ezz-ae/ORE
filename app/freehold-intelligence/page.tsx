import Link from "next/link"
import { ArrowRight, Bot, CheckCircle2, Clock3, LockKeyhole, MessageSquare, Send, Sparkles, TriangleAlert } from "lucide-react"
import { currentServerUser, getRoleScope, serverSummary, type ServerActionCard } from "@/src/features/freehold-intelligence/server-session"
import { ProgressFooter } from "@/src/features/freehold-intelligence/components/progress-footer"
import { getMilestones } from "@/src/features/freehold-intelligence/data-access"

const priorityClass: Record<ServerActionCard["priority"], string> = {
  critical: "border-red-400/35 bg-red-500/10 text-red-100",
  high: "border-[#D4AF37]/35 bg-[#D4AF37]/10 text-[#F8E7AE]",
  medium: "border-sky-300/25 bg-sky-400/10 text-sky-100",
  low: "border-white/10 bg-white/[0.035] text-white/70",
}

function ActionCard({ item }: { item: ServerActionCard }) {
  return (
    <article className={`border p-4 ${priorityClass[item.priority]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-70">{item.app} / {item.type.replace("_", " ")}</div>
          <h3 className="mt-2 text-sm font-semibold text-white">{item.title}</h3>
        </div>
        <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] opacity-75">{item.priority}</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-white/65">{item.body}</p>
      <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-white/45">
        <span>Owner: {item.owner}</span>
        <span>Status: {item.status}</span>
        {item.due ? <span>Due: {item.due}</span> : null}
      </div>
    </article>
  )
}

export default async function FreeholdIntelligencePage() {
  const milestones = await getMilestones()
  const activeMilestone = milestones.find((milestone) => milestone.status === "in_progress") ?? milestones[0]
  const roleScope = getRoleScope(currentServerUser.role)

  return (
    <div className="grid min-h-full gap-0 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="min-w-0 px-4 py-5 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border border-white/10 bg-white/[0.03] px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center border border-[#D4AF37]/35 bg-[#D4AF37]/10">
              <Bot className="h-4 w-4 text-[#D4AF37]" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">AI Home</div>
              <div className="text-xs text-white/45">Role-aware private operating session</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-emerald-300">
            <LockKeyhole className="h-3.5 w-3.5" />
            {currentServerUser.accountLevel} access / mock V1 session
          </div>
        </div>

        <div className="border border-[#D4AF37]/15 bg-[radial-gradient(circle_at_top_left,rgba(212,175,55,0.10),transparent_34rem),rgba(255,255,255,0.035)] p-5 sm:p-6 lg:p-7">
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center border border-[#D4AF37]/35 bg-[#D4AF37]/10">
              <Sparkles className="h-5 w-5 text-[#D4AF37]" />
            </div>
            <div className="max-w-4xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D4AF37]">Generated 24-hour briefing</p>
              <h1 className="mt-3 text-2xl font-semibold leading-tight text-white sm:text-4xl">{serverSummary.greeting}</h1>
              <p className="mt-4 text-sm leading-7 text-white/65 sm:text-base">{serverSummary.summaryText}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
              <TriangleAlert className="h-4 w-4 text-[#D4AF37]" />
              Urgent operating cards
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {[...serverSummary.urgentTasks, ...serverSummary.blockedItems, ...serverSummary.pendingApprovals].map((item) => (
                <ActionCard key={item.id} item={item} />
              ))}
            </div>
          </div>

          <aside className="border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <MessageSquare className="h-4 w-4 text-[#D4AF37]" />
              Ask the server
            </div>
            <div className="mt-4 grid gap-2">
              {serverSummary.askableQuestions.map((question) => (
                <button key={question} className="border border-white/10 bg-black/15 px-3 py-2 text-left text-xs leading-5 text-white/65 transition hover:border-[#D4AF37]/40 hover:text-white">
                  {question}
                </button>
              ))}
            </div>
            <div className="mt-4 flex gap-2 border border-white/10 bg-black/20 p-2">
              <input className="min-w-0 flex-1 bg-transparent px-2 text-sm text-white outline-none placeholder:text-white/30" placeholder="Ask within your role scope..." />
              <button className="grid h-9 w-9 place-items-center bg-[#D4AF37] text-[#07110D]">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </aside>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {serverSummary.crmAlerts.map((item) => <ActionCard key={item.id} item={item} />)}
          {serverSummary.leadMachineAlerts.map((item) => <ActionCard key={item.id} item={item} />)}
          {serverSummary.notebookRecentOutputs.map((item) => <ActionCard key={item.id} item={item} />)}
        </div>

        <div className="mt-6 border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-white">Role answer scope</div>
              <p className="mt-1 text-xs text-white/45">The AI should answer only inside this account level until real auth and approvals are connected.</p>
            </div>
            <Link href="/freehold-intelligence/security" className="inline-flex items-center gap-2 text-xs text-[#D4AF37]">
              Security model <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {roleScope.map((scope) => (
              <span key={scope} className="border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/60">{scope}</span>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <ProgressFooter milestone={activeMilestone} />
        </div>
      </section>

      <aside className="border-l border-white/10 bg-[#07110D]/85 p-4 xl:min-h-full">
        <div className="grid gap-4">
          <section className="border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Clock3 className="h-4 w-4 text-[#D4AF37]" />
              Today's actions
            </div>
            <div className="mt-4 grid gap-3">
              {serverSummary.recommendedActions.map((item) => (
                <div key={item.id} className="border border-white/10 bg-black/15 p-3">
                  <div className="text-sm font-semibold text-white">{item.title}</div>
                  <p className="mt-2 text-xs leading-5 text-white/55">{item.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              Pending approvals
            </div>
            <div className="mt-4 grid gap-2">
              {serverSummary.pendingApprovals.map((item) => (
                <Link key={item.id} href="/freehold-intelligence/review-requests" className="block border border-white/10 bg-black/15 p-3 text-xs text-white/60 transition hover:border-[#D4AF37]/35 hover:text-white">
                  {item.title}
                </Link>
              ))}
            </div>
          </section>
        </div>
      </aside>
    </div>
  )
}
