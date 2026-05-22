import Link from 'next/link'
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
  Zap,
} from 'lucide-react'
import { ProgressFooter } from '@/src/features/freehold-intelligence/components/progress-footer'
import { getMilestones } from '@/src/features/freehold-intelligence/data-access'
import {
  getLeadMachineAdRequest,
  getLeadMachineComments,
  getLeadMachineLanding,
  getLeadMachineMatrix,
  getLeadMachineRequirements,
  leadMachineAIResponses,
  leadMachineListings,
  type LeadMachineListing,
} from '@/src/features/freehold-intelligence/lead-machine'
import { executeTool } from '@/lib/freehold/mcp/execute-tool'

function statusChip(value: string) {
  const v = value.toLowerCase()
  if (v.includes('ready') || v.includes('approved') || v.includes('active')) return 'border-emerald-300/25 bg-emerald-400/10 text-emerald-200'
  if (v.includes('block') || v.includes('missing')) return 'border-red-300/25 bg-red-500/10 text-red-100'
  if (v.includes('review') || v.includes('draft') || v.includes('access') || v.includes('pending')) return 'border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#F8E7AE]'
  return 'border-white/10 bg-white/[0.04] text-white/60'
}

function ScoreBar({ label, value, color = 'bg-[#D4AF37]' }: { label: string; value: number; color?: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[11px] uppercase tracking-[0.12em] text-white/35">
        <span>{label}</span>
        <span className="tabular-nums font-semibold text-white/60">{value}</span>
      </div>
      <div className="h-1.5 bg-white/[0.07]">
        <div className={`h-full transition-all ${color}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  )
}

function ListingCard({ listing, selected }: { listing: LeadMachineListing; selected?: boolean }) {
  const scoreColor = listing.opportunityScore >= 80 ? 'bg-emerald-400' : listing.opportunityScore >= 60 ? 'bg-[#D4AF37]' : 'bg-sky-400'
  return (
    <article className={`border transition ${selected ? 'border-[#D4AF37]/45 bg-[#D4AF37]/[0.06]' : 'border-white/10 bg-white/[0.025] hover:border-[#D4AF37]/20'}`}>
      <div className="flex gap-4 p-4">
        <div
          className="h-28 w-28 shrink-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${listing.imageUrl})` }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-white">{listing.projectName}</h2>
            <span className={`border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusChip(listing.landingStatus)}`}>
              {listing.landingStatus}
            </span>
          </div>
          <p className="mt-1 text-xs text-white/40">
            {listing.area} · {listing.developer}
            {listing.startingPrice && ` · AED ${Number(listing.startingPrice).toLocaleString()}`}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <ScoreBar label="Opportunity" value={listing.opportunityScore} color={scoreColor} />
            <ScoreBar label="Ad readiness" value={listing.adReadinessScore} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 border-t border-white/[0.07] px-4 py-3">
        <span className={`border px-2 py-1.5 text-center text-[11px] ${statusChip(listing.adStatus)}`}>{listing.adStatus}</span>
        <span className={`border px-2 py-1.5 text-center text-[11px] ${statusChip(listing.blockerStatus)}`}>{listing.blockerStatus}</span>
        <span className="border border-white/10 bg-black/15 px-2 py-1.5 text-center text-[11px] text-white/45">{listing.linkedMilestoneId} · {listing.owner}</span>
      </div>

      {listing.missingRequirements.length > 0 && (
        <div className="border-t border-white/[0.07] px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {listing.missingRequirements.map((req) => (
              <span key={req} className="border border-red-300/20 bg-red-500/[0.06] px-2 py-0.5 text-[11px] text-red-200">{req}</span>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] px-4 py-3">
        <p className="text-xs text-white/50">{listing.nextAction}</p>
        <div className="flex flex-wrap gap-1.5">
          {['Ask AI', 'Review Landing', 'Request Ad'].map((action) => (
            <button key={action} className="border border-white/10 px-2.5 py-1 text-[11px] text-white/45 transition hover:border-[#D4AF37]/30 hover:text-white">
              {action}
            </button>
          ))}
        </div>
      </div>
    </article>
  )
}

export default async function LeadMachinePage() {
  const [summaryRes, milestones] = await Promise.all([
    executeTool({ tool: 'lead_machine_summary', role: 'owner' }),
    getMilestones(),
  ])

  const liveSummary = summaryRes.data
  const selected = leadMachineListings[0]
  const landing = getLeadMachineLanding(selected.projectId)
  const adRequest = getLeadMachineAdRequest(selected.projectId)
  const requirements = getLeadMachineRequirements(selected.projectId)
  const comments = getLeadMachineComments(selected.projectId)
  const matrix = getLeadMachineMatrix()
  const m5 = milestones.find((m) => m.code === 'M5') ?? milestones[0]

  const kpis = liveSummary ? [
    { label: 'Total listings',    value: liveSummary.totalListings,       accent: 'text-white' },
    { label: 'Landing ready',     value: liveSummary.landingPagesReady,   accent: 'text-emerald-300' },
    { label: 'Missing landing',   value: liveSummary.missingLandingPages, accent: 'text-[#F8E7AE]' },
    { label: 'Ads ready',         value: liveSummary.adsReady,            accent: 'text-emerald-300' },
    { label: 'Pending requests',  value: liveSummary.pendingAdRequests,   accent: 'text-white' },
    { label: 'Landing reviews',   value: liveSummary.pendingLandingReviews, accent: 'text-[#D4AF37]' },
    { label: 'Blocked access',    value: liveSummary.blockedByAccess,     accent: liveSummary.blockedByAccess > 0 ? 'text-red-300' : 'text-white' },
    { label: 'Missing data',      value: liveSummary.missingData,         accent: 'text-[#F8E7AE]' },
    { label: 'Approved launch',   value: liveSummary.approvedForLaunch,   accent: 'text-emerald-300' },
    { label: 'AI actions',        value: liveSummary.aiRecommendedActions,accent: 'text-[#D4AF37]' },
  ] : []

  return (
    <div className="min-h-full px-4 py-5 sm:px-6 lg:px-8">

      {/* ── Header ─────────────────────────────────────────────── */}
      <section className="border border-white/10 bg-white/[0.03] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D4AF37]">Lead Machine</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Campaign and landing operating console</h1>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-white/55">
          Internal system for listings, landing paths, ad requests, WhatsApp flows, previews, approvals, requirements and comment-to-task execution.
          {summaryRes.fallbackStatus === 'live' && <span className="ml-2 text-emerald-300/70">· Live DB data</span>}
          {summaryRes.fallbackStatus === 'mock' && <span className="ml-2 text-[#D4AF37]/70">· Mock fallback</span>}
        </p>
      </section>

      {/* ── KPI grid ───────────────────────────────────────────── */}
      {kpis.length > 0 && (
        <section className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {kpis.map(({ label, value, accent }) => (
            <div key={label} className="border border-white/10 bg-white/[0.025] p-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30">{label}</div>
              <div className={`mt-2 text-2xl font-semibold tabular-nums ${accent}`}>
                {typeof value === 'number' ? value.toLocaleString() : value}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ── Three-panel layout ─────────────────────────────────── */}
      <section className="mt-5 grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)_380px]">

        {/* AI sidebar */}
        <aside className="border border-[#D4AF37]/20 bg-[#D4AF37]/[0.05] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Bot className="h-4 w-4 text-[#D4AF37]" />
            Lead Machine AI
          </div>
          <p className="mt-3 text-xs leading-5 text-white/55">
            Ask about listings, landing pages, ads, requirements, approvals or performance.
          </p>
          <div className="mt-4 border border-white/10 bg-black/20 p-3">
            <textarea
              className="min-h-24 w-full resize-none bg-transparent text-sm text-white outline-none placeholder:text-white/25"
              placeholder="Ask about listings, landing pages, ads, requirements, approvals..."
            />
            <button className="mt-2 flex w-full items-center justify-center gap-2 bg-[#D4AF37] px-4 py-2 text-sm font-semibold text-[#07110D]">
              <Send className="h-4 w-4" />
              Ask operator
            </button>
          </div>
          <div className="mt-3 grid gap-1.5">
            {[
              'Which listings are ready for ads?',
              'Review this landing page.',
              'What is blocking Meta launch?',
              'Give me a readiness matrix.',
              'Create an ad request.',
            ].map((prompt) => (
              <button key={prompt} className="border border-white/10 bg-black/15 px-3 py-2 text-left text-xs text-white/55 transition hover:border-[#D4AF37]/30 hover:text-white">
                {prompt}
              </button>
            ))}
          </div>
          <div className="mt-4 border border-[#D4AF37]/15 bg-black/20 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#D4AF37]">AI response</div>
            <p className="mt-2 text-xs leading-5 text-white/60">{leadMachineAIResponses[0].content}</p>
          </div>
        </aside>

        {/* Listing cards + matrix */}
        <main className="grid gap-4 content-start">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Featured listings</h2>
              <p className="mt-0.5 text-xs text-white/35">Selected listing drives the workspace →</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {['Area', 'Developer', 'Landing status', 'Ad ready', 'Blocked'].map((f) => (
                <button key={f} className="flex items-center gap-1 border border-white/10 px-2.5 py-1.5 text-[11px] text-white/40 transition hover:border-[#D4AF37]/25 hover:text-white">
                  <SlidersHorizontal className="h-3 w-3" />{f}
                </button>
              ))}
            </div>
          </div>

          {leadMachineListings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} selected={listing.id === selected.id} />
          ))}

          {/* Matrix */}
          <section className="mt-2 overflow-x-auto border border-white/10 bg-white/[0.02]">
            <div className="mb-3 flex items-center gap-2 px-4 pt-4 text-sm font-semibold text-white">
              <Rows3 className="h-4 w-4 text-[#D4AF37]" />
              Readiness matrix
            </div>
            <div className="min-w-[1100px] pb-2">
              <div className="grid grid-cols-[1.4fr_0.9fr_0.9fr_0.9fr_0.7fr_0.7fr_0.8fr_0.7fr_0.9fr_1fr] border-b border-white/10 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30">
                <span>Project</span><span>Area</span><span>Developer</span><span>Landing</span>
                <span>Data</span><span>Media</span><span>Payment</span><span>Blocks</span>
                <span>Opportunity</span><span>Next action</span>
              </div>
              {matrix.map((row) => (
                <div
                  key={row.project}
                  className="grid grid-cols-[1.4fr_0.9fr_0.9fr_0.9fr_0.7fr_0.7fr_0.8fr_0.7fr_0.9fr_1fr] border-b border-white/[0.06] px-4 py-3 text-xs text-white/60 transition hover:bg-white/[0.02]"
                >
                  <span className="font-semibold text-white">{row.project}</span>
                  <span>{row.area}</span>
                  <span>{row.developer}</span>
                  <span className={statusChip(row.landingStatus) + ' px-1.5 py-0.5 text-[10px]'}>{row.landingStatus}</span>
                  <span className="tabular-nums">{row.dataQuality}</span>
                  <span>{row.mediaQuality}</span>
                  <span>{row.paymentPlanReady ? '✓' : '—'}</span>
                  <span>{row.blocker}</span>
                  <span className="tabular-nums">{row.opportunityScore} · {row.opportunityBand}</span>
                  <span className="truncate">{row.nextAction}</span>
                </div>
              ))}
            </div>
          </section>
        </main>

        {/* Workspace sidebar */}
        <aside className="border border-white/10 bg-[#07110D]/85 p-4">
          {/* Selected listing */}
          <div className="flex gap-3">
            <div
              className="h-20 w-24 shrink-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${selected.imageUrl})` }}
            />
            <div>
              <div className="text-base font-semibold text-white">{selected.projectName}</div>
              <div className="mt-0.5 text-xs text-white/40">{selected.area} · {selected.developer}</div>
              <div className="mt-1.5 text-xs text-[#D4AF37]">{selected.linkedMilestoneId} · {selected.owner}</div>
            </div>
          </div>

          {/* Scores */}
          <div className="mt-4 grid gap-2.5">
            <ScoreBar label="Data quality" value={selected.dataQualityScore} />
            <ScoreBar label="Landing readiness" value={selected.landingReadinessScore} />
            <ScoreBar label="Ad readiness" value={selected.adReadinessScore} />
            <ScoreBar label="Opportunity" value={selected.opportunityScore} color="bg-emerald-400" />
          </div>

          {/* Tabs */}
          <div className="mt-5 flex flex-wrap gap-1">
            {['Landing', 'Ad Request', 'Requirements', 'Comments'].map((tab, i) => (
              <button key={tab} className={`border px-2.5 py-1.5 text-[11px] transition ${i === 0 ? 'border-[#D4AF37]/35 text-white' : 'border-white/10 text-white/40 hover:border-[#D4AF37]/25 hover:text-white'}`}>
                {tab}
              </button>
            ))}
          </div>

          {/* Landing section */}
          <section className="mt-4 border border-white/10 bg-black/15 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Eye className="h-4 w-4 text-[#D4AF37]" />
              Landing review
            </div>
            {landing ? (
              <>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className={`border px-2 py-0.5 text-[10px] ${statusChip(landing.status)}`}>{landing.status}</span>
                  <span className="text-white/35">{landing.completion}% complete</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-white/55">{landing.aiReviewSummary}</p>
                <div className="mt-2 grid gap-1.5">
                  {landing.recommendedEdits.map((edit) => (
                    <div key={edit} className="border border-white/[0.07] bg-white/[0.02] p-2 text-[11px] text-white/50">→ {edit}</div>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-2 text-xs text-white/40">No landing yet. Request landing generation.</p>
            )}
          </section>

          {/* Ad request */}
          <section className="mt-3 border border-white/10 bg-black/15 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <FilePlus2 className="h-4 w-4 text-[#D4AF37]" />
              Ad request
            </div>
            {adRequest ? (
              <div className="mt-2 text-xs text-white/55">
                <div>{adRequest.platform} · {adRequest.campaignObjective}</div>
                <div className="mt-0.5 text-white/35">Status: {adRequest.status}</div>
                <div className="mt-1 italic text-white/50">Angle: {adRequest.campaignAngle}</div>
              </div>
            ) : (
              <p className="mt-2 text-xs text-white/40">No ad request. Create one from this workspace.</p>
            )}
          </section>

          {/* Requirements */}
          <section className="mt-3 border border-white/10 bg-black/15 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <TriangleAlert className="h-4 w-4 text-[#D4AF37]" />
              Requirements
              {requirements.length > 0 && (
                <span className="ml-auto border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-1.5 py-0.5 text-[10px] text-[#F8E7AE]">{requirements.length}</span>
              )}
            </div>
            <div className="mt-2 grid gap-2">
              {requirements.map((req) => (
                <div key={req.id} className={`border p-2 text-xs ${statusChip(req.status)}`}>
                  <div className="font-semibold text-white">{req.title}</div>
                  <div className="mt-0.5 text-white/55">{req.nextAction}</div>
                  <div className="mt-0.5 text-white/30">{req.owner} · {req.dueDate}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Comments */}
          <section className="mt-3 border border-white/10 bg-black/15 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <MessageSquare className="h-4 w-4 text-[#D4AF37]" />
              Comments to tasks
            </div>
            <div className="mt-2 grid gap-2">
              {comments.map((comment) => (
                <div key={comment.id} className="border border-white/[0.07] bg-white/[0.02] p-2 text-xs text-white/55">
                  <div>{comment.body}</div>
                  <button className="mt-1.5 text-[#D4AF37]/70 transition hover:text-[#D4AF37]">Convert to task →</button>
                </div>
              ))}
            </div>
          </section>

          {/* Action buttons */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            {[
              [ClipboardCheck, 'Request Landing'],
              [FilePlus2,      'Request Ad'],
              [CheckCircle2,   'Approve'],
              [ListChecks,     'Open Milestone'],
              [Rows3,          'Matrix'],
              [MessageSquare,  'Create Task'],
            ].map(([Icon, label]) => {
              const ActionIcon = Icon as React.ElementType
              return (
                <button
                  key={String(label)}
                  className="flex items-center justify-center gap-1.5 border border-white/10 bg-white/[0.025] px-2 py-2.5 text-[11px] text-white/50 transition hover:border-[#D4AF37]/30 hover:text-white"
                >
                  <ActionIcon className="h-3.5 w-3.5 text-[#D4AF37]" />
                  {label}
                </button>
              )
            })}
          </div>

          <Link
            href="/freehold-intelligence/notebook"
            className="mt-4 flex items-center justify-between border border-[#D4AF37]/25 bg-[#D4AF37]/[0.07] px-4 py-3 text-sm text-[#F8E7AE] transition hover:bg-[#D4AF37]/12"
          >
            Generate campaign assets <ArrowRight className="h-4 w-4" />
          </Link>
        </aside>
      </section>

      <div className="mt-6">
        <ProgressFooter milestone={m5} />
      </div>
    </div>
  )
}
