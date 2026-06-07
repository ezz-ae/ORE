import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowUpRight, Building2, MapPin, Calendar, CreditCard, Users, Megaphone, TrendingUp, BookOpen, Target } from 'lucide-react'
import { projects } from '@/src/data/projects'
import { AiPrompt } from '@/components/freehold/ai-prompt'

function statusTone(s: string) {
  if (s === 'Ready') return { dot: 'bg-gold', text: 'text-gold', bg: 'bg-gold/10 border-gold/20' }
  if (s === 'Under construction') return { dot: 'bg-gold', text: 'text-[#F8E7AE]', bg: 'bg-gold/10 border-gold/20' }
  return { dot: 'bg-sky-400', text: 'text-sky-200', bg: 'bg-sky-400/10 border-sky-400/20' }
}

function readinessTone(n: number) {
  if (n >= 90) return { bar: 'bg-gold', text: 'text-gold' }
  if (n >= 80) return { bar: 'bg-gold', text: 'text-[#F8E7AE]' }
  return { bar: 'bg-surface-3', text: 'text-slate-400' }
}

export async function generateStaticParams() {
  return projects.map((p) => ({ id: p.id }))
}

export default async function MarketProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = projects.find((p) => p.id === id)
  if (!project) notFound()

  const tone = statusTone(project.status)
  const rt = readinessTone(project.campaignReadiness)

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      <Link
        href="/freehold-intelligence/apps/market"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Market intelligence
      </Link>

      {/* Header */}
      <section className="mt-7">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-medium ${tone.bg} ${tone.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
            {project.status}
          </span>
          <span className="text-sm text-slate-500">{project.area} · {project.emirate}</span>
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
          {project.projectName}
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-[1.65] text-slate-300">{project.salesAngle}</p>
      </section>

      {/* Key metrics grid */}
      <section className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[18px] border border-line bg-surface p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <CreditCard className="h-3 w-3" /> Price from
          </div>
          <p className="mt-2 text-[22px] font-semibold text-white">
            AED {Number(project.startingPrice).toLocaleString()}
          </p>
        </div>
        <div className="rounded-[18px] border border-line bg-surface p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <Calendar className="h-3 w-3" /> Handover
          </div>
          <p className="mt-2 text-[22px] font-semibold text-white">{project.handover}</p>
        </div>
        <div className="rounded-[18px] border border-line bg-surface p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <Building2 className="h-3 w-3" /> Unit types
          </div>
          <p className="mt-2 text-base font-semibold text-white">{project.unitTypes.join(' · ')}</p>
        </div>
        <div className="rounded-[18px] border border-line bg-surface p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <Target className="h-3 w-3" /> Readiness
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
              <div className={`h-full rounded-full ${rt.bar}`} style={{ width: `${project.campaignReadiness}%` }} />
            </div>
            <span className={`text-lg font-semibold tabular-nums ${rt.text}`}>{project.campaignReadiness}%</span>
          </div>
        </div>
      </section>

      {/* Payment plan */}
      <section className="mt-5 rounded-[18px] border border-line bg-surface px-5 py-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <CreditCard className="h-3 w-3" /> Payment plan
        </div>
        <p className="mt-2 text-base text-slate-100">{project.paymentPlan}</p>
      </section>

      {/* Intelligence cards */}
      <section className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-[22px] border border-gold/15 bg-gold/[0.04] p-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold/80">
            <Megaphone className="h-3 w-3" /> Ad angle
          </div>
          <p className="mt-3 text-sm leading-[1.65] text-slate-100">{project.adAngle}</p>
        </div>

        <div className="rounded-[22px] border border-line bg-surface p-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <Users className="h-3 w-3" /> Buyer profile
          </div>
          <p className="mt-3 text-sm leading-[1.65] text-slate-300">{project.buyerProfile}</p>
        </div>

        <div className="rounded-[22px] border border-line bg-surface p-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <TrendingUp className="h-3 w-3" /> ROI note
          </div>
          <p className="mt-3 text-sm leading-[1.65] text-slate-300">{project.roiNote}</p>
        </div>

        <div className="rounded-[22px] border border-line bg-surface p-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <MapPin className="h-3 w-3" /> Tags
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {project.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-sm text-slate-400">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* AI Prompt */}
      <section className="mt-8">
        <AiPrompt
          placeholder={`Ask about ${project.projectName}…`}
          suggestions={[
            `Draft a WhatsApp opener for ${project.projectName}.`,
            `Write a Meta ad for ${project.area} targeting ${project.buyerProfile.split(',')[0]}.`,
            `Compare ${project.projectName} vs similar in ${project.area}.`,
            `Create a 1-page briefing for ${project.developer}.`,
          ]}
        />
      </section>

      {/* Action bar */}
      <section className="mt-8 flex flex-wrap gap-3">
        <Link
          href={`/freehold-intelligence/notebook?project=${project.id}`}
          className="inline-flex items-center gap-2 rounded-[12px] bg-white px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-white/90"
        >
          <BookOpen className="h-3.5 w-3.5" />
          Open in Notebook
        </Link>
        <Link
          href="/freehold-intelligence/lead-machine/listings"
          className="inline-flex items-center gap-2 rounded-[12px] border border-line bg-surface-2 px-5 py-2.5 text-sm text-slate-300 transition hover:border-gold/30 hover:text-white"
        >
          Add to Lead Machine
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
        <Link
          href="/freehold-intelligence/crm"
          className="inline-flex items-center gap-2 rounded-[12px] border border-line bg-surface-2 px-5 py-2.5 text-sm text-slate-300 transition hover:border-gold/30 hover:text-white"
        >
          Match to CRM lead
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </section>

    </div>
  )
}
