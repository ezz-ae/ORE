import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowUpRight, Building2, MapPin, Calendar, CreditCard, Users, Megaphone, TrendingUp, BookOpen, Target } from 'lucide-react'
import { projects } from '@/src/data/projects'
import { AiPrompt } from '@/components/freehold/ai-prompt'

function statusTone(s: string) {
  if (s === 'Ready') return { dot: 'bg-emerald-400', text: 'text-emerald-300', bg: 'bg-emerald-400/10 border-emerald-400/20' }
  if (s === 'Under construction') return { dot: 'bg-[#D4AF37]', text: 'text-[#F8E7AE]', bg: 'bg-[#D4AF37]/10 border-[#D4AF37]/20' }
  return { dot: 'bg-sky-400', text: 'text-sky-200', bg: 'bg-sky-400/10 border-sky-400/20' }
}

function readinessTone(n: number) {
  if (n >= 90) return { bar: 'bg-emerald-400', text: 'text-emerald-300' }
  if (n >= 80) return { bar: 'bg-[#D4AF37]', text: 'text-[#F8E7AE]' }
  return { bar: 'bg-white/30', text: 'text-white/50' }
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
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-10 sm:px-6 sm:pt-14">

      <Link
        href="/freehold-intelligence/apps/market"
        className="inline-flex items-center gap-1.5 text-[12px] text-white/40 transition hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Market intelligence
      </Link>

      {/* Header */}
      <section className="mt-7">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${tone.bg} ${tone.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
            {project.status}
          </span>
          <span className="text-[11px] text-white/30">{project.area} · {project.emirate}</span>
        </div>
        <h1 className="mt-4 text-[36px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[52px]">
          {project.projectName}
        </h1>
        <p className="mt-5 max-w-2xl text-[17px] leading-[1.65] text-white/65">{project.salesAngle}</p>
      </section>

      {/* Key metrics grid */}
      <section className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[18px] border border-white/[0.06] bg-[#0A0D10] p-5">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">
            <CreditCard className="h-3 w-3" /> Price from
          </div>
          <p className="mt-2 text-[22px] font-semibold text-white">
            AED {Number(project.startingPrice).toLocaleString()}
          </p>
        </div>
        <div className="rounded-[18px] border border-white/[0.06] bg-[#0A0D10] p-5">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">
            <Calendar className="h-3 w-3" /> Handover
          </div>
          <p className="mt-2 text-[22px] font-semibold text-white">{project.handover}</p>
        </div>
        <div className="rounded-[18px] border border-white/[0.06] bg-[#0A0D10] p-5">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">
            <Building2 className="h-3 w-3" /> Unit types
          </div>
          <p className="mt-2 text-[15px] font-semibold text-white">{project.unitTypes.join(' · ')}</p>
        </div>
        <div className="rounded-[18px] border border-white/[0.06] bg-[#0A0D10] p-5">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">
            <Target className="h-3 w-3" /> Readiness
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
              <div className={`h-full rounded-full ${rt.bar}`} style={{ width: `${project.campaignReadiness}%` }} />
            </div>
            <span className={`text-[18px] font-semibold tabular-nums ${rt.text}`}>{project.campaignReadiness}%</span>
          </div>
        </div>
      </section>

      {/* Payment plan */}
      <section className="mt-5 rounded-[18px] border border-white/[0.06] bg-[#0A0D10] px-5 py-4">
        <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">
          <CreditCard className="h-3 w-3" /> Payment plan
        </div>
        <p className="mt-2 text-[15px] text-white/85">{project.paymentPlan}</p>
      </section>

      {/* Intelligence cards */}
      <section className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-[22px] border border-[#D4AF37]/15 bg-[#D4AF37]/[0.04] p-6">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-[#D4AF37]/80">
            <Megaphone className="h-3 w-3" /> Ad angle
          </div>
          <p className="mt-3 text-[14px] leading-[1.65] text-white/85">{project.adAngle}</p>
        </div>

        <div className="rounded-[22px] border border-white/[0.06] bg-[#0A0D10] p-6">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">
            <Users className="h-3 w-3" /> Buyer profile
          </div>
          <p className="mt-3 text-[14px] leading-[1.65] text-white/75">{project.buyerProfile}</p>
        </div>

        <div className="rounded-[22px] border border-white/[0.06] bg-[#0A0D10] p-6">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">
            <TrendingUp className="h-3 w-3" /> ROI note
          </div>
          <p className="mt-3 text-[14px] leading-[1.65] text-white/75">{project.roiNote}</p>
        </div>

        <div className="rounded-[22px] border border-white/[0.06] bg-[#0A0D10] p-6">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">
            <MapPin className="h-3 w-3" /> Tags
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {project.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-0.5 text-[11px] text-white/55">
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
          className="inline-flex items-center gap-2 rounded-[12px] bg-white px-5 py-2.5 text-[13px] font-semibold text-[#06080A] transition hover:bg-white/90"
        >
          <BookOpen className="h-3.5 w-3.5" />
          Open in Notebook
        </Link>
        <Link
          href="/freehold-intelligence/lead-machine/listings"
          className="inline-flex items-center gap-2 rounded-[12px] border border-white/[0.08] bg-white/[0.025] px-5 py-2.5 text-[13px] text-white/70 transition hover:border-[#D4AF37]/30 hover:text-white"
        >
          Add to Lead Machine
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
        <Link
          href="/freehold-intelligence/crm"
          className="inline-flex items-center gap-2 rounded-[12px] border border-white/[0.08] bg-white/[0.025] px-5 py-2.5 text-[13px] text-white/70 transition hover:border-[#D4AF37]/30 hover:text-white"
        >
          Match to CRM lead
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </section>

    </div>
  )
}
