import Link from 'next/link'
import { Zap, ArrowUpRight, AlertCircle, CheckCircle2, Clock, Sparkles, BarChart2, FileText, Megaphone, AlertOctagon } from 'lucide-react'
import {
  leadMachineListings,
  leadMachineRequirements,
  leadMachineAdRequests,
  leadMachineLandings,
  getLeadMachineSummary,
} from '@/src/features/freehold-intelligence/lead-machine'
import { AiPrompt } from '@/components/freehold/ai-prompt'
import { PageHeader, StatCard, Section, Panel, buttonClass } from '@/components/freehold/ui'

function scoreBg(score: number) {
  if (score >= 80) return 'bg-gold'
  if (score >= 50) return 'bg-gold'
  return 'bg-red-400'
}

function scoreText(score: number) {
  if (score >= 80) return 'text-gold'
  if (score >= 50) return 'text-[#F8E7AE]'
  return 'text-red-300'
}

function blockerDot(status: string) {
  if (status === 'Clear') return 'bg-gold'
  if (status === 'Needs Access') return 'bg-red-400'
  if (status === 'Needs Data') return 'bg-gold'
  return 'bg-orange-400'
}

function statusIcon(status: string) {
  const s = status.toLowerCase()
  if (s.includes('ready') || s.includes('approved') || s.includes('active')) return <CheckCircle2 className="h-3.5 w-3.5 text-gold" />
  if (s.includes('block') || s.includes('missing')) return <AlertCircle className="h-3.5 w-3.5 text-red-400" />
  return <Clock className="h-3.5 w-3.5 text-gold" />
}

const NAV_SECTIONS = [
  {
    label: 'Listings',
    href: '/freehold-intelligence/lead-machine/listings',
    icon: BarChart2,
    desc: 'All active listings with readiness scores, blockers, and next actions.',
    count: leadMachineListings.length,
    countLabel: 'listings',
  },
  {
    label: 'Landings',
    href: '/freehold-intelligence/lead-machine/landings',
    icon: FileText,
    desc: 'Landing page status, completion scores, and review queue.',
    count: leadMachineLandings.length,
    countLabel: 'pages',
  },
  {
    label: 'Ad Requests',
    href: '/freehold-intelligence/lead-machine/ad-requests',
    icon: Megaphone,
    desc: 'Campaign briefs, platform, budget, creative requirements.',
    count: leadMachineAdRequests.length,
    countLabel: 'requests',
  },
  {
    label: 'Requirements',
    href: '/freehold-intelligence/lead-machine/requirements',
    icon: AlertOctagon,
    desc: 'Every open requirement blocking landing generation or ad launch.',
    count: leadMachineRequirements.filter(r => r.status !== 'Done').length,
    countLabel: 'open',
  },
]

export default function LeadMachineOverviewPage() {
  const summary = getLeadMachineSummary()
  const criticalReqs = leadMachineRequirements.filter(r => r.severity === 'critical')
  const readyListings = leadMachineListings.filter(l => l.adReadinessScore >= 80 && l.landingReadinessScore >= 80)

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      {/* Header */}
      <PageHeader
        eyebrow="Lead Machine"
        Icon={Zap}
        title={readyListings.length > 0 ? `${readyListings.length} listings ready to launch` : 'Listings to campaigns'}
        subtitle={`${criticalReqs.length} blockers to resolve · full pipeline from raw data to live paid traffic`}
        actions={
          <>
            <Link href="/freehold-intelligence/lead-machine/campaigns/launch" className={buttonClass('primary', 'md')}>
              <Zap className="h-3.5 w-3.5" /> Launch Campaign
            </Link>
            <Link href="/freehold-intelligence/lead-machine/campaigns" className={buttonClass('secondary', 'md')}>
              All Campaigns <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </>
        }
      />

      {/* Stats row */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Active Listings" value={leadMachineListings.length} hint="tracked" />
        <StatCard label="Landings Ready" value={summary.landingPagesReady} hint="can launch" delta={{ value: 'ready', direction: 'up' }} />
        <StatCard label="Pending Requests" value={summary.pendingAdRequests} hint="awaiting launch" />
        <StatCard label="Blocked on Access" value={summary.blockedByAccess} hint="need credentials" delta={summary.blockedByAccess > 0 ? { value: 'action needed', direction: 'down' } : undefined} />
      </div>

      {/* Critical blockers */}
      {criticalReqs.length > 0 && (
        <section className="mt-8">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-red-300/80">Critical — blocks launch</div>
          <div className="space-y-3">
            {criticalReqs.map(req => (
              <div key={req.id} className="flex items-start gap-4 rounded-xl border border-red-400/20 bg-red-400/[0.05] p-5">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white">{req.title}</div>
                  <div className="mt-0.5 text-xs text-slate-400">{req.description}</div>
                  <div className="mt-2 text-xs font-medium text-red-300">→ {req.nextAction}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xs text-slate-500">Owner</div>
                  <div className="text-xs text-slate-300">{req.owner}</div>
                  <div className="mt-1 text-sm text-red-300/70">Due {req.dueDate}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Readiness matrix */}
      <Section
        className="mt-8"
        title="Readiness Matrix"
        description="Score by listing"
        action={
          <Link href="/freehold-intelligence/lead-machine/listings" className="inline-flex items-center gap-1 text-xs text-gold/70 hover:text-gold">
            All listings <ArrowUpRight className="h-3 w-3" />
          </Link>
        }
      >

        <Panel>
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_80px_80px_80px_80px] gap-4 border-b border-line px-6 py-3">
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Project</div>
            {['Data', 'Landing', 'Ads', 'Opp'].map(h => (
              <div key={h} className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 text-center">{h}</div>
            ))}
          </div>
          <div className="divide-y divide-line">
            {leadMachineListings.map(listing => (
              <div key={listing.id} className="grid grid-cols-[1fr_80px_80px_80px_80px] gap-4 items-center px-6 py-4">
                <div className="min-w-0">
                  <Link href={`/freehold-intelligence/lead-machine/listings/${listing.id}`} className="truncate text-sm font-semibold text-white hover:text-gold transition">
                    {listing.projectName}
                  </Link>
                  <div className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500">
                    <span className={`h-1.5 w-1.5 rounded-full ${blockerDot(listing.blockerStatus)}`} />
                    {listing.blockerStatus}
                  </div>
                </div>
                {[listing.dataQualityScore, listing.landingReadinessScore, listing.adReadinessScore, listing.opportunityScore].map((score, i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5">
                    <span className={`text-sm font-semibold tabular-nums ${scoreText(score)}`}>{score}</span>
                    <div className="w-full overflow-hidden rounded-full bg-surface-2 h-1">
                      <div className={`h-full rounded-full ${scoreBg(score)}`} style={{ width: `${score}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Panel>
      </Section>

      {/* Sub-section nav */}
      <section className="mt-8 grid gap-3 sm:grid-cols-2">
        {NAV_SECTIONS.map(({ label, href, icon: Icon, desc, count, countLabel }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-start gap-4 rounded-xl border border-line bg-surface p-5 transition hover:border-gold/25"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-surface-2 transition group-hover:border-gold/20">
              <Icon className="h-4 w-4 text-slate-300" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[14px] font-semibold text-white">{label}</span>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-500 transition group-hover:text-gold" />
              </div>
              <p className="mt-1 text-xs leading-snug text-slate-400">{desc}</p>
              <div className="mt-3 text-sm font-medium text-gold/70">
                {count} {countLabel}
              </div>
            </div>
          </Link>
        ))}
      </section>

      {/* Landing & ad status table */}
      <Section className="mt-8" title="Campaign readiness by listing">
        <Panel>
          <div className="divide-y divide-line">
            {leadMachineListings.map(listing => (
              <div key={listing.id} className="flex items-center gap-4 px-6 py-4">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white">{listing.projectName}</div>
                  <div className="mt-0.5 text-sm text-slate-400">{listing.area} · {listing.developer}</div>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    {statusIcon(listing.landingStatus)}
                    Landing
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-400">
                    {statusIcon(listing.adStatus)}
                    Ads
                  </span>
                </div>
                <Link href={`/freehold-intelligence/lead-machine/listings/${listing.id}`} className="hidden sm:inline-flex items-center gap-1 text-sm text-slate-500 hover:text-gold transition">
                  Open <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            ))}
          </div>
        </Panel>
      </Section>

      {/* AI take */}
      <section className="mt-8 rounded-xl border border-gold/15 bg-gold/[0.035] px-6 py-7">
        <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-gold/80">
          <Sparkles className="h-3 w-3" /> AI take
        </div>
        <p className="mt-3 text-sm font-medium leading-[1.65] text-slate-100">
          One listing is ready for paid traffic — the bottleneck is the Meta billing owner. Resolve that and Dubai Hills launches today. Palm needs a single landing approval. Business Bay needs payment-plan data before a landing can be generated.
        </p>
      </section>

      {/* AI prompt */}
      <section className="mt-8">
        <AiPrompt
          placeholder="Ask about listings, landings, blockers, campaign readiness…"
          suggestions={[
            'Which listings are ready for ads?',
            'What is blocking Meta launch today?',
            'Show the full readiness matrix.',
            'Draft a landing request for Business Bay.',
          ]}
        />
      </section>

    </div>
  )
}
