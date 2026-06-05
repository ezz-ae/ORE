import Link from 'next/link'
import { ArrowLeft, FolderKanban, ArrowUpRight, AlertCircle } from 'lucide-react'
import { leadMachineListings } from '@/src/features/freehold-intelligence/server-session'
import { AiPrompt } from '@/components/freehold/ai-prompt'

function landingTone(s: string) {
  if (s === 'ready' || s === 'approved') return { dot: 'bg-emerald-400', text: 'text-emerald-300', label: s === 'approved' ? 'Approved' : 'Ready' }
  if (s === 'needs_review')              return { dot: 'bg-[#D4AF37]', text: 'text-[#F8E7AE]', label: 'Review' }
  return                                        { dot: 'bg-red-400',   text: 'text-red-300',   label: 'Missing' }
}

function adTone(s: string) {
  if (s === 'ready')        return { dot: 'bg-emerald-400', text: 'text-emerald-300', label: 'Ready' }
  if (s === 'blocked')      return { dot: 'bg-red-400',     text: 'text-red-300',     label: 'Blocked' }
  return                           { dot: 'bg-[#D4AF37]',   text: 'text-[#F8E7AE]',  label: 'Needs assets' }
}

function reviewTone(s: string) {
  if (s === 'approved')        return { dot: 'bg-emerald-400', text: 'text-emerald-300', label: 'Approved' }
  if (s === 'pending_approval') return { dot: 'bg-[#D4AF37]', text: 'text-[#F8E7AE]',   label: 'Pending' }
  return                               { dot: 'bg-white/30',   text: 'text-white/45',    label: 'Open' }
}

export default function DashboardProjectsPage() {
  const ready    = leadMachineListings.filter((l) => l.adReadiness === 'ready').length
  const blocked  = leadMachineListings.filter((l) => l.adReadiness === 'blocked').length
  const pending  = leadMachineListings.filter((l) => l.landingStatus === 'needs_review').length
  const totalReqs = leadMachineListings.reduce((s, l) => s + l.requirements.length, 0)

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-10 sm:px-6 sm:pt-14">

      <Link href="/freehold-intelligence/apps/dashboard" className="inline-flex items-center gap-1.5 text-[12px] text-white/40 transition hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> Dashboard App
      </Link>

      <section className="mt-7">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
          <FolderKanban className="h-3.5 w-3.5" /> Projects Admin
        </div>
        <h1 className="mt-4 text-[36px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[52px]">
          Project inventory<br /><span className="text-white/35">and readiness.</span>
        </h1>
        <p className="mt-5 max-w-xl text-[17px] leading-[1.65] text-white/60">
          {leadMachineListings.length} active campaign projects. Full status control, editorial review, and launch readiness.
        </p>
      </section>

      <section className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Ad ready',      value: ready,      tone: 'text-emerald-300' },
          { label: 'Blocked',       value: blocked,    tone: 'text-red-400' },
          { label: 'Review pending', value: pending,   tone: 'text-[#D4AF37]' },
          { label: 'Open requirements', value: totalReqs, tone: 'text-sky-300' },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-[18px] border border-white/[0.06] bg-[#0A0D10] p-5">
            <div className={`text-[28px] font-semibold ${kpi.tone}`}>{kpi.value}</div>
            <div className="mt-0.5 text-[11px] text-white/40">{kpi.label}</div>
          </div>
        ))}
      </section>

      <section className="mt-14">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">Campaign projects</div>
        <h2 className="mt-2 text-xl font-semibold text-white">Full inventory</h2>

        <div className="mt-5 space-y-3">
          {leadMachineListings.map((listing) => {
            const land = landingTone(listing.landingStatus)
            const ad   = adTone(listing.adReadiness)
            const rev  = reviewTone(listing.reviewStatus)
            return (
              <div key={listing.id} className="rounded-[22px] border border-white/[0.06] bg-[#0A0D10] p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <Link
                        href={`/freehold-intelligence/lead-machine/listings/${listing.id}`}
                        className="text-[17px] font-semibold text-white transition hover:text-[#D4AF37]"
                      >
                        {listing.name}
                      </Link>
                      {listing.adReadiness === 'blocked' && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-red-300/70">
                          <AlertCircle className="h-3 w-3" /> Blocked
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-[12px] text-white/40">{listing.area} · {listing.developer}</div>
                    <p className="mt-2 text-[13px] text-white/60">{listing.nextAction}</p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-medium border-current/20 ${land.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${land.dot}`} /> Landing: {land.label}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-medium border-current/20 ${ad.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${ad.dot}`} /> Ads: {ad.label}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-medium border-current/20 ${rev.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${rev.dot}`} /> Review: {rev.label}
                      </span>
                    </div>

                    {listing.requirements.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {listing.requirements.map((req) => (
                          <div key={req} className="flex items-center gap-2 text-[12px] text-white/45">
                            <span className="h-1 w-1 shrink-0 rounded-full bg-white/20" /> {req}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-[12px] text-white/35 sm:shrink-0 sm:flex-col sm:items-end sm:gap-2">
                    <span>{listing.comments} comments</span>
                    <span>{listing.tasks} tasks</span>
                    <Link
                      href={`/freehold-intelligence/lead-machine/listings/${listing.id}`}
                      className="inline-flex items-center gap-1 text-[12px] text-white/30 transition hover:text-[#D4AF37]"
                    >
                      Open workspace <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="mt-12">
        <AiPrompt
          placeholder="Ask about projects, readiness, status…"
          suggestions={[
            'Which projects are ready to launch ads right now?',
            'What is blocking the Palm Jumeirah campaign?',
            'List all projects missing landing pages.',
          ]}
        />
      </section>

      <section className="mt-6 flex flex-wrap gap-3">
        {[
          { label: 'Lead Machine', href: '/freehold-intelligence/lead-machine' },
          { label: 'Listings', href: '/freehold-intelligence/lead-machine/listings' },
          { label: 'Ad Requests', href: '/freehold-intelligence/lead-machine/ad-requests' },
          { label: 'Requirements', href: '/freehold-intelligence/lead-machine/requirements' },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-white/[0.08] bg-white/[0.025] px-4 py-2 text-[13px] text-white/60 transition hover:border-[#D4AF37]/30 hover:text-white"
          >
            {link.label} <ArrowUpRight className="h-3 w-3" />
          </Link>
        ))}
      </section>

    </div>
  )
}
