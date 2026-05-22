import Link from "next/link"
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  FilePlus2,
  ListChecks,
  MessageSquare,
  Rows3,
  Send,
  SlidersHorizontal,
  TriangleAlert,
} from "lucide-react"
import { ProgressFooter } from "@/src/features/freehold-intelligence/components/progress-footer"
import { getMilestones } from "@/src/features/freehold-intelligence/data-access"
import {
  getLeadMachineAdRequest,
  getLeadMachineComments,
  getLeadMachineLanding,
  getLeadMachineMatrix,
  getLeadMachineRequirements,
  getLeadMachineSummary,
  leadMachineAIResponses,
  leadMachineListings,
  type LeadMachineListing,
} from "@/src/features/freehold-intelligence/lead-machine"

const statusClass = (value: string) => {
  const normalized = value.toLowerCase()
  if (normalized.includes("ready") || normalized.includes("approved") || normalized.includes("active")) return "border-emerald-300/25 bg-emerald-400/10 text-emerald-200"
  if (normalized.includes("block") || normalized.includes("missing")) return "border-red-300/25 bg-red-500/10 text-red-100"
  if (normalized.includes("review") || normalized.includes("draft") || normalized.includes("access")) return "border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#F8E7AE]"
  return "border-white/10 bg-white/[0.04] text-white/60"
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.12em] text-white/40">
        <span>{label}</span>
        <span className="text-white/70">{value}</span>
      </div>
      <div className="mt-2 h-1.5 bg-white/10">
        <div className="h-full bg-[#D4AF37]" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  )
}

function ListingCard({ listing, selected }: { listing: LeadMachineListing; selected?: boolean }) {
  return (
    <article className={`border p-3 transition ${selected ? "border-[#D4AF37]/45 bg-[#D4AF37]/10" : "border-white/10 bg-white/[0.03] hover:border-[#D4AF37]/25"}`}>
      <div className="flex gap-3">
        <div className="h-24 w-28 shrink-0 bg-cover bg-center" style={{ backgroundImage: `url(${listing.imageUrl})` }} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold text-white">{listing.projectName}</h2>
            <span className={`border px-2 py-1 text-[10px] uppercase tracking-[0.12em] ${statusClass(listing.landingStatus)}`}>{listing.landingStatus}</span>
          </div>
          <p className="mt-1 text-xs text-white/45">{listing.area} / {listing.developer}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <ScoreBar label="Opportunity" value={listing.opportunityScore} />
            <ScoreBar label="Ad ready" value={listing.adReadinessScore} />
          </div>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <span className={`border px-2 py-1 text-xs ${statusClass(listing.adStatus)}`}>{listing.adStatus}</span>
        <span className={`border px-2 py-1 text-xs ${statusClass(listing.blockerStatus)}`}>{listing.blockerStatus}</span>
        <span className="border border-white/10 bg-black/15 px-2 py-1 text-xs text-white/55">{listing.linkedMilestoneId}</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-white/60">{listing.nextAction}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {["Ask AI", "Review Landing", "Preview", "Request Ad", "Create Task"].map((action) => (
          <button key={action} className="border border-white/10 px-2 py-1.5 text-[11px] text-white/50 transition hover:border-[#D4AF37]/35 hover:text-white">{action}</button>
        ))}
      </div>
    </article>
  )
}

export default async function LeadMachinePage() {
  const summary = getLeadMachineSummary()
  const selected = leadMachineListings[0]
  const landing = getLeadMachineLanding(selected.projectId)
  const adRequest = getLeadMachineAdRequest(selected.projectId)
  const requirements = getLeadMachineRequirements(selected.projectId)
  const comments = getLeadMachineComments(selected.projectId)
  const matrix = getLeadMachineMatrix()
  const milestones = await getMilestones()
  const m5 = milestones.find((milestone) => milestone.code === "M5") ?? milestones[0]

  const kpis = [
    ["Total Listings", summary.totalListings],
    ["Landing Ready", summary.landingPagesReady],
    ["Missing Landing", summary.missingLandingPages],
    ["Ads Ready", summary.adsReady],
    ["Pending Requests", summary.pendingAdRequests],
    ["Pending Reviews", summary.pendingLandingReviews],
    ["Blocked Access", summary.blockedByAccess],
    ["Missing Data", summary.missingData],
    ["Approved Launch", summary.approvedForLaunch],
    ["AI Actions", summary.aiRecommendedActions],
  ]

  return (
    <div className="min-h-full px-4 py-5 sm:px-6 lg:px-8">
      <section className="border border-white/10 bg-white/[0.03] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D4AF37]">Lead Machine</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Freehold campaign and landing operating console</h1>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-white/55">Internal system for listings, landing paths, ad requests, WhatsApp flows, previews, approvals, requirements and comment-to-task execution. No marketplace or LeadByLead logic.</p>
      </section>

      <section className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map(([label, value]) => (
          <div key={String(label)} className="border border-white/10 bg-white/[0.03] p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">{label}</div>
            <div className="mt-2 text-2xl font-semibold text-white">{Number(value).toLocaleString()}</div>
          </div>
        ))}
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)_380px]">
        <aside className="border border-[#D4AF37]/20 bg-[#D4AF37]/10 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Bot className="h-4 w-4 text-[#D4AF37]" />
            Lead Machine AI
          </div>
          <p className="mt-3 text-sm leading-6 text-white/65">Ask about listings, landing pages, ads, requirements, approvals or performance. V1 responses are structured mock operator cards.</p>
          <div className="mt-4 border border-white/10 bg-black/20 p-3">
            <textarea className="min-h-28 w-full resize-none bg-transparent text-sm text-white outline-none placeholder:text-white/30" placeholder="Ask about listings, landing pages, ads, requirements, approvals, or performance..." />
            <button className="mt-3 flex w-full items-center justify-center gap-2 bg-[#D4AF37] px-4 py-2 text-sm font-semibold text-[#07110D]">
              <Send className="h-4 w-4" />
              Ask operator
            </button>
          </div>
          <div className="mt-4 grid gap-2">
            {["Which listings are ready for ads?", "Review this landing page.", "Create an ad request.", "What is blocking Meta launch?", "Give me a matrix."].map((prompt) => (
              <button key={prompt} className="border border-white/10 bg-black/20 px-3 py-2 text-left text-xs text-white/60 hover:border-[#D4AF37]/35 hover:text-white">{prompt}</button>
            ))}
          </div>
          <div className="mt-4 border border-white/10 bg-black/20 p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#D4AF37]">AI response card</div>
            <p className="mt-2 text-xs leading-5 text-white/65">{leadMachineAIResponses[0].content}</p>
          </div>
        </aside>

        <main className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Listing / landing cards</h2>
              <p className="mt-1 text-xs text-white/45">Selected listing drives the workspace on the right.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {["Area", "Developer", "Landing Status", "Ready for Ads", "Blocked"].map((filter) => (
                <button key={filter} className="border border-white/10 px-3 py-2 text-xs text-white/50"><SlidersHorizontal className="mr-1 inline h-3.5 w-3.5" />{filter}</button>
              ))}
            </div>
          </div>
          {leadMachineListings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} selected={listing.id === selected.id} />
          ))}

          <section className="mt-2 overflow-x-auto border border-white/10 bg-white/[0.03]">
            <div className="min-w-[1180px]">
              <div className="grid grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_0.7fr_0.7fr_0.8fr_0.7fr_0.9fr_1.2fr] border-b border-white/10 px-3 py-3 text-[10px] uppercase tracking-[0.12em] text-white/35">
                <div>Project</div><div>Area</div><div>Developer</div><div>Landing</div><div>Data</div><div>Media</div><div>Payment</div><div>Blocks</div><div>Opportunity</div><div>Next Action</div>
              </div>
              {matrix.map((row) => (
                <div key={row.project} className="grid grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_0.7fr_0.7fr_0.8fr_0.7fr_0.9fr_1.2fr] border-b border-white/10 px-3 py-3 text-xs text-white/60">
                  <div className="font-semibold text-white">{row.project}</div><div>{row.area}</div><div>{row.developer}</div><div>{row.landingStatus}</div><div>{row.dataQuality}</div><div>{row.mediaQuality}</div><div>{row.paymentPlanReady ? "Ready" : "No"}</div><div>{row.blocker}</div><div>{row.opportunityScore} / {row.opportunityBand}</div><div>{row.nextAction}</div>
                </div>
              ))}
            </div>
          </section>
        </main>

        <aside className="border border-white/10 bg-[#07110D]/85 p-4">
          <div className="flex gap-3">
            <div className="h-20 w-24 shrink-0 bg-cover bg-center" style={{ backgroundImage: `url(${selected.imageUrl})` }} />
            <div>
              <div className="text-lg font-semibold text-white">{selected.projectName}</div>
              <div className="mt-1 text-xs text-white/45">{selected.area} / {selected.developer}</div>
              <div className="mt-2 text-xs text-[#D4AF37]">{selected.linkedMilestoneId} / {selected.owner}</div>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            <ScoreBar label="Data Quality" value={selected.dataQualityScore} />
            <ScoreBar label="Landing Readiness" value={selected.landingReadinessScore} />
            <ScoreBar label="Ad Readiness" value={selected.adReadinessScore} />
            <ScoreBar label="Opportunity" value={selected.opportunityScore} />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {["Overview", "Landing Review", "Ad Request", "Requirements", "Comments", "Tasks", "Preview"].map((tab) => (
              <button key={tab} className="border border-white/10 bg-black/15 px-2 py-1.5 text-[11px] text-white/50 first:border-[#D4AF37]/35 first:text-white">{tab}</button>
            ))}
          </div>

          <section className="mt-5 border border-white/10 bg-black/15 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white"><Eye className="h-4 w-4 text-[#D4AF37]" />Landing Review</div>
            {landing ? (
              <>
                <div className="mt-3 text-xs text-white/50">{landing.landingUrl} / {landing.status} / {landing.completion}% complete</div>
                <p className="mt-3 text-xs leading-5 text-white/60">{landing.aiReviewSummary}</p>
                <div className="mt-3 grid gap-2">
                  {landing.recommendedEdits.map((edit) => <div key={edit} className="border border-white/10 bg-white/[0.03] p-2 text-xs text-white/55">{edit}</div>)}
                </div>
              </>
            ) : <p className="mt-3 text-xs text-white/50">No landing exists yet. Request landing generation.</p>}
          </section>

          <section className="mt-3 border border-white/10 bg-black/15 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white"><FilePlus2 className="h-4 w-4 text-[#D4AF37]" />Ad Request</div>
            {adRequest ? (
              <p className="mt-3 text-xs leading-5 text-white/60">{adRequest.platform} / {adRequest.campaignObjective} / {adRequest.status}. Angle: {adRequest.campaignAngle}</p>
            ) : <p className="mt-3 text-xs text-white/50">No ad request exists. Create one from this workspace.</p>}
          </section>

          <section className="mt-3 border border-white/10 bg-black/15 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white"><TriangleAlert className="h-4 w-4 text-[#D4AF37]" />Requirements</div>
            <div className="mt-3 grid gap-2">
              {requirements.map((requirement) => (
                <div key={requirement.id} className={`border p-2 text-xs ${statusClass(requirement.status)}`}>
                  <div className="font-semibold text-white">{requirement.title}</div>
                  <div className="mt-1 text-white/60">{requirement.nextAction}</div>
                  <div className="mt-1 text-white/40">{requirement.owner} / {requirement.linkedMilestoneId} / {requirement.dueDate}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-3 border border-white/10 bg-black/15 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white"><MessageSquare className="h-4 w-4 text-[#D4AF37]" />Comments to tasks</div>
            <div className="mt-3 grid gap-2">
              {comments.map((comment) => (
                <div key={comment.id} className="border border-white/10 bg-white/[0.03] p-2 text-xs text-white/60">
                  <div>{comment.body}</div>
                  <button className="mt-2 text-[#D4AF37]">Convert to task</button>
                </div>
              ))}
            </div>
          </section>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {[
              [ClipboardCheck, "Request Landing"],
              [FilePlus2, "Request Ad"],
              [CheckCircle2, "Approve"],
              [ListChecks, "Open Milestone"],
              [Rows3, "Matrix"],
              [MessageSquare, "Create Task"],
            ].map(([Icon, label]) => {
              const ActionIcon = Icon
              return <button key={String(label)} className="flex items-center justify-center gap-2 border border-white/10 bg-white/[0.03] px-2 py-2 text-xs text-white/60 hover:border-[#D4AF37]/35 hover:text-white"><ActionIcon className="h-3.5 w-3.5 text-[#D4AF37]" />{label}</button>
            })}
          </div>

          <Link href="/freehold-intelligence/notebook" className="mt-4 flex items-center justify-between border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-4 py-3 text-sm text-[#F8E7AE]">
            Generate campaign assets <ArrowRight className="h-4 w-4" />
          </Link>
        </aside>
      </section>

      <div className="mt-5">
        <ProgressFooter milestone={m5} />
      </div>
    </div>
  )
}
