import Link from "next/link"
import { ArrowRight, Bot, CheckCircle2, ClipboardCheck, FilePlus2, MessageSquare, Rows3, Send, TriangleAlert } from "lucide-react"
import { leadMachineListings, serverSummary } from "@/src/features/freehold-intelligence/server-session"

const readinessClass: Record<string, string> = {
  ready: "text-emerald-200",
  approved: "text-emerald-200",
  needs_review: "text-[#F8E7AE]",
  pending_approval: "text-[#F8E7AE]",
  missing: "text-red-100",
  blocked: "text-red-100",
  needs_assets: "text-sky-100",
  open: "text-white/65",
}

export default function LeadMachinePage() {
  return (
    <div className="grid min-h-full gap-0 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="px-4 py-5 sm:px-6 lg:px-8">
        <div className="border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D4AF37]">Lead Machine</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">Listings, landings, ad requests and launch readiness</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/55">V1 uses mock structures shaped for future project media, landing status, ad request status, comments, tasks, milestones and requirements.</p>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <div className="border border-[#D4AF37]/20 bg-[#D4AF37]/10 p-4 lg:col-span-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Bot className="h-4 w-4 text-[#D4AF37]" />
              Lead Machine AI
            </div>
            <p className="mt-3 text-sm leading-6 text-white/65">Ask which listings are ready for ads, what blocks Meta launch, whether a landing needs review, or request an ad/landing task.</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {["Which listings are ready for ads?", "What is blocking Meta launch?", "Give me a matrix of readiness.", "Request a landing for this project."].map((prompt) => (
                <button key={prompt} className="border border-white/10 bg-black/20 px-3 py-2 text-left text-xs text-white/60 hover:border-[#D4AF37]/35 hover:text-white">{prompt}</button>
              ))}
            </div>
          </div>
          <div className="border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <TriangleAlert className="h-4 w-4 text-[#D4AF37]" />
              Launch blockers
            </div>
            <div className="mt-4 grid gap-2">
              {serverSummary.blockedItems.map((item) => (
                <div key={item.id} className="border border-red-300/20 bg-red-500/10 p-3 text-xs leading-5 text-white/65">{item.title}</div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto border border-white/10 bg-white/[0.03]">
          <div className="min-w-[980px]">
            <div className="grid grid-cols-[1.35fr_0.9fr_0.8fr_0.8fr_0.9fr_1.2fr] border-b border-white/10 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
              <div>Listing</div>
              <div>Landing</div>
              <div>Ad readiness</div>
              <div>Review</div>
              <div>Comments / tasks</div>
              <div>Next action</div>
            </div>
            {leadMachineListings.map((listing) => (
              <div key={listing.id} className="grid grid-cols-[1.35fr_0.9fr_0.8fr_0.8fr_0.9fr_1.2fr] border-b border-white/10 px-4 py-4 text-sm">
                <div>
                  <div className="font-semibold text-white">{listing.name}</div>
                  <div className="mt-1 text-xs text-white/45">{listing.area} / {listing.developer}</div>
                </div>
                <div className={readinessClass[listing.landingStatus]}>{listing.landingStatus.replace("_", " ")}</div>
                <div className={readinessClass[listing.adReadiness]}>{listing.adReadiness.replace("_", " ")}</div>
                <div className={readinessClass[listing.reviewStatus]}>{listing.reviewStatus.replace("_", " ")}</div>
                <div className="text-white/60">{listing.comments} comments / {listing.tasks} tasks</div>
                <div className="text-white/70">{listing.nextAction}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <aside className="border-l border-white/10 bg-[#07110D]/85 p-4">
        <div className="grid gap-3">
          {[
            [FilePlus2, "Create ad request"],
            [ClipboardCheck, "Create landing request"],
            [CheckCircle2, "Approve selected"],
            [MessageSquare, "Convert comment to task"],
            [Rows3, "Open readiness matrix"],
          ].map(([Icon, label]) => {
            const ActionIcon = Icon
            return (
              <button key={String(label)} className="flex items-center justify-between border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm text-white/70 transition hover:border-[#D4AF37]/35 hover:text-white">
                <span className="flex items-center gap-2"><ActionIcon className="h-4 w-4 text-[#D4AF37]" />{label}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )
          })}
        </div>
        <Link href="/freehold-intelligence/notebook" className="mt-4 flex items-center justify-between border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-4 py-3 text-sm text-[#F8E7AE]">
          Generate campaign assets <Send className="h-4 w-4" />
        </Link>
      </aside>
    </div>
  )
}
