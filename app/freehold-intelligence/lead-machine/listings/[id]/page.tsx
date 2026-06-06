import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft, ArrowUpRight, AlertCircle, CheckCircle2, Clock,
  BarChart2, Megaphone, Globe, MessageSquare, Play, BookOpen, Sparkles
} from 'lucide-react'
import {
  leadMachineListings, leadMachineLandings, leadMachineAdRequests,
  getLeadMachineRequirements, getLeadMachineComments
} from '@/src/features/freehold-intelligence/lead-machine'
import { AiPrompt } from '@/components/freehold/ai-prompt'
import { ListingWorkspace } from './_components/ListingWorkspace'

function scoreTone(n: number) {
  if (n >= 80) return { bar: 'bg-[#D4AF37]', text: 'text-[#D4AF37]' }
  if (n >= 50) return { bar: 'bg-[#D4AF37]', text: 'text-[#F8E7AE]' }
  return { bar: 'bg-red-400', text: 'text-red-300' }
}

function blockerTone(s: string) {
  if (s === 'Clear') return { dot: 'bg-[#D4AF37]', text: 'text-[#D4AF37]', label: 'Clear' }
  if (s === 'Needs Access') return { dot: 'bg-red-400', text: 'text-red-300', label: 'Needs access' }
  if (s === 'Needs Data') return { dot: 'bg-[#D4AF37]', text: 'text-[#F8E7AE]', label: 'Needs data' }
  return { dot: 'bg-red-400', text: 'text-red-300', label: 'Blocked' }
}

function statusChip(s: string) {
  const green = ['Ready', 'Approved', 'Landing Active', 'Campaign Running', 'Ready for Ads']
  const gold = ['Needs Review', 'Pending Review', 'Paused']
  const red = ['Blocked', 'Missing Data', 'Needs Landing', 'Missing', 'Needs Assets']
  if (green.some(g => s.includes(g) || s === g)) return 'border-[#D4AF37]/25 bg-[#D4AF37]/10 text-[#D4AF37]'
  if (gold.some(g => s.includes(g) || s === g)) return 'border-[#D4AF37]/25 bg-[#D4AF37]/10 text-[#F8E7AE]'
  if (red.some(r => s.includes(r) || s === r)) return 'border-red-400/25 bg-red-400/10 text-red-300'
  return 'border-slate-700 bg-slate-800/50 text-slate-400'
}

export async function generateStaticParams() {
  return leadMachineListings.map((l) => ({ id: l.id }))
}

export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const listing = leadMachineListings.find((l) => l.id === id)
  if (!listing) notFound()

  const landing = leadMachineLandings.find((l) => l.projectId === listing.projectId)
  const adRequest = leadMachineAdRequests.find((a) => a.projectId === listing.projectId)
  const requirements = getLeadMachineRequirements(listing.projectId)
  const comments = getLeadMachineComments(listing.projectId)
  const bt = blockerTone(listing.blockerStatus)

  const scoreItems = [
    { label: 'Data quality', score: listing.dataQualityScore },
    { label: 'Landing ready', score: listing.landingReadinessScore },
    { label: 'Ad ready', score: listing.adReadinessScore },
    { label: 'Opportunity', score: listing.opportunityScore },
  ]

  const componentChecks = [
    { label: 'Price', status: listing.priceStatus },
    { label: 'Payment plan', status: listing.paymentPlanStatus },
    { label: 'Media', status: listing.mediaStatus },
    { label: 'Lead form', status: listing.leadFormStatus },
    { label: 'WhatsApp flow', status: listing.whatsappFlowStatus },
  ]

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
      <Link href="/freehold-intelligence/lead-machine/listings" className="inline-flex items-center gap-1.5 text-xs text-slate-400 transition hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> All listings
      </Link>

      {/* Header */}
      <section className="mt-7">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-medium ${bt.text} border-current/20`}>
            <span className={`h-1.5 w-1.5 rounded-full ${bt.dot}`} />
            {bt.label}
          </span>
          <span className="text-sm text-slate-400">{listing.area} · {listing.developer}</span>
          <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-sm font-medium ${statusChip(listing.landingStatus)}`}>
            {listing.landingStatus}
          </span>
        </div>
        <h1 className="mt-4 text-[34px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[48px]">
          {listing.projectName}
        </h1>
        {listing.startingPrice && (
          <p className="mt-3 text-base text-slate-400">
            AED {Number(listing.startingPrice).toLocaleString()} · {listing.paymentPlan || 'Payment plan TBC'}
          </p>
        )}
      </section>

      {/* Readiness scorecards */}
      <section className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {scoreItems.map((item) => {
          const t = scoreTone(item.score)
          return (
            <div key={item.label} className="rounded-[18px] border border-slate-800 bg-slate-900 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{item.label}</p>
              <p className={`mt-1.5 text-[28px] font-semibold leading-none tabular-nums ${t.text}`}>{item.score}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${item.score}%` }} />
              </div>
            </div>
          )
        })}
      </section>

      {/* Component checks */}
      <section className="mt-5 overflow-hidden rounded-[22px] border border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Component readiness
        </div>
        <div className="divide-y divide-white/[0.04]">
          {componentChecks.map(({ label, status }) => {
            const isReady = status === 'Ready'
            return (
              <div key={label} className="flex items-center justify-between gap-4 px-6 py-3.5">
                <span className="text-sm text-slate-300">{label}</span>
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${isReady ? 'text-[#D4AF37]' : 'text-[#F8E7AE]'}`}>
                  {isReady
                    ? <CheckCircle2 className="h-3.5 w-3.5" />
                    : <Clock className="h-3.5 w-3.5" />}
                  {status}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {/* Missing requirements */}
      {listing.missingRequirements.length > 0 && (
        <section className="mt-5 rounded-[22px] border border-red-400/15 bg-red-400/[0.04] p-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-red-300/80">
            <AlertCircle className="h-3.5 w-3.5" /> Blocking requirements
          </div>
          <ul className="mt-4 space-y-2">
            {listing.missingRequirements.map((req) => (
              <li key={req} className="flex items-start gap-2.5 text-sm text-red-200/80">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-red-400/70" />
                {req}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Landing status */}
      {landing && (
        <section className="mt-5">
          <div className="overflow-hidden rounded-[22px] border border-slate-800 bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-semibold text-white">Landing page</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-[#D4AF37]" style={{ width: `${landing.completion}%` }} />
                </div>
                <span className="text-xs tabular-nums text-slate-400">{landing.completion}%</span>
                <span className={`inline-flex rounded-full border px-2 py-0.5 text-sm ${statusChip(landing.status)}`}>{landing.status}</span>
              </div>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm leading-relaxed text-slate-300">{landing.aiReviewSummary}</p>
              {landing.recommendedEdits.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {landing.recommendedEdits.map((edit) => (
                    <li key={edit} className="flex items-start gap-2 text-xs text-[#F8E7AE]/70">
                      <Sparkles className="mt-[3px] h-3 w-3 shrink-0 text-[#D4AF37]/60" />
                      {edit}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Ad Request */}
      {adRequest && (
        <section className="mt-5 overflow-hidden rounded-[22px] border border-slate-800 bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-[#D4AF37]" />
              <span className="text-sm font-semibold text-white">Ad request</span>
            </div>
            <span className={`inline-flex rounded-full border px-2 py-0.5 text-sm ${statusChip(adRequest.status)}`}>{adRequest.status}</span>
          </div>
          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-[0.14em]">Platform</p>
              <p className="mt-1 text-sm font-medium text-white">{adRequest.platform}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-[0.14em]">Budget</p>
              <p className="mt-1 text-sm font-medium text-white">{adRequest.budget}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-slate-500 uppercase tracking-[0.14em]">Campaign angle</p>
              <p className="mt-1 text-sm text-slate-300">{adRequest.campaignAngle}</p>
            </div>
            {adRequest.blockers.length > 0 && (
              <div className="sm:col-span-2">
                <p className="text-xs text-slate-500 uppercase tracking-[0.14em]">Blockers</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {adRequest.blockers.map((b) => (
                    <span key={b} className="rounded-full border border-red-400/25 bg-red-400/10 px-2.5 py-0.5 text-sm text-red-300">{b}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Interactive requirements + comments workspace */}
      <ListingWorkspace
        requirements={requirements}
        comments={comments}
        projectName={listing.projectName}
      />

      {/* Action bar */}
      <section className="mt-10 flex flex-wrap gap-3">
        <Link
          href={`/freehold-intelligence/review-requests?project=${listing.projectId}`}
          className="inline-flex items-center gap-2 rounded-[12px] bg-white px-5 py-2.5 text-[13px] font-semibold text-[#06080A] transition hover:bg-white/90"
        >
          <Play className="h-3.5 w-3.5" />
          Open workspace
        </Link>
        <Link
          href="/freehold-intelligence/lead-machine/ad-requests"
          className="inline-flex items-center gap-2 rounded-[12px] border border-[#D4AF37]/20 bg-[#D4AF37]/[0.06] px-5 py-2.5 text-[13px] font-medium text-[#F8E7AE] transition hover:border-[#D4AF37]/35"
        >
          <Megaphone className="h-3.5 w-3.5" />
          Create ad request
        </Link>
        <Link
          href={`/freehold-intelligence/notebook?listing=${listing.id}`}
          className="inline-flex items-center gap-2 rounded-[12px] border border-slate-800 bg-white/[0.025] px-5 py-2.5 text-[13px] text-white/65 transition hover:border-white/20 hover:text-white"
        >
          <BookOpen className="h-3.5 w-3.5" />
          Open in Notebook
        </Link>
      </section>

      {/* AI Prompt */}
      <section className="mt-8">
        <AiPrompt
          placeholder={`Ask about ${listing.projectName}…`}
          suggestions={[
            `What is blocking ${listing.projectName} from launch?`,
            `Draft a landing brief for ${listing.projectName}.`,
            `Best ad angle for ${listing.area} campaign.`,
          ]}
        />
      </section>
    </div>
  )
}
