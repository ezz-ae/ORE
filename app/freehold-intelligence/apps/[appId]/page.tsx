import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowUpRight, AlertCircle, MessageSquare, Clock, CheckCircle2, Blocks } from 'lucide-react'
import { getServerApp } from '@/src/features/freehold-intelligence/server-session'
import { AiPrompt } from '@/components/freehold/ai-prompt'

function statusTone(s: string) {
  if (s === 'live')        return { dot: 'bg-[#D4AF37]', text: 'text-[#D4AF37]', bg: 'bg-[#D4AF37]/10 border-[#D4AF37]/20', label: 'Live' }
  if (s === 'in_progress') return { dot: 'bg-[#D4AF37]', text: 'text-[#F8E7AE]', bg: 'bg-[#D4AF37]/10 border-[#D4AF37]/20', label: 'In progress' }
  if (s === 'blocked')     return { dot: 'bg-red-400',   text: 'text-red-300',   bg: 'bg-red-400/10 border-red-400/20',       label: 'Blocked' }
  return                          { dot: 'bg-sky-400',   text: 'text-sky-200',   bg: 'bg-sky-400/10 border-sky-400/20',       label: 'Planned' }
}

export default async function GenericServerAppPage({ params }: { params: Promise<{ appId: string }> }) {
  const { appId } = await params
  const app = getServerApp(appId)
  if (!app) notFound()

  const tone = statusTone(app.status)

  const metrics = [
    { label: 'Urgent items',      value: app.urgentCount,          icon: AlertCircle,   alert: app.urgentCount > 0          },
    { label: 'Pending approvals', value: app.pendingApprovalCount, icon: Clock,         alert: app.pendingApprovalCount > 0 },
    { label: 'Blocked items',     value: app.blockedCount,         icon: AlertCircle,   alert: app.blockedCount > 0         },
    { label: 'Open comments',     value: app.openComments,         icon: MessageSquare, alert: false                        },
  ]

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      <Link href="/freehold-intelligence/apps" className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> All apps
      </Link>

      <section className="mt-7">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-medium ${tone.bg} ${tone.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
            {tone.label}
          </span>
          {app.linkedMilestoneId && (
            <span className="text-sm text-slate-500">{app.linkedMilestoneId}</span>
          )}
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
          {app.name}
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-[1.65] text-slate-300">{app.description}</p>
      </section>

      <section className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map((m) => {
          const Icon = m.icon
          return (
            <div key={m.label} className="rounded-[18px] border border-slate-800 bg-slate-900 p-5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <Icon className="h-3 w-3" /> {m.label}
              </div>
              <p className={`mt-2 text-[28px] font-semibold leading-none tabular-nums ${m.alert && m.value > 0 ? 'text-red-400' : 'text-white'}`}>
                {m.value}
              </p>
            </div>
          )
        })}
      </section>

      <section className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-[18px] border border-slate-800 bg-slate-900 p-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <Clock className="h-3 w-3" /> Latest activity
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">{app.latestActivity}</p>
        </div>
        <div className="rounded-[18px] border border-[#D4AF37]/15 bg-[#D4AF37]/[0.04] p-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#D4AF37]/80">
            <CheckCircle2 className="h-3 w-3" /> Next action
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-100">{app.nextAction}</p>
        </div>
      </section>

      <section className="mt-8">
        <AiPrompt
          placeholder={`Ask about ${app.name}…`}
          suggestions={[
            `What is blocking ${app.name}?`,
            `Summarise the current status of ${app.name}.`,
            `What should be done next in ${app.name}?`,
          ]}
        />
      </section>

      <section className="mt-8 rounded-[20px] border border-slate-800 bg-slate-900 p-6">
        <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <Blocks className="h-3 w-3" /> Navigate
        </div>
        <div className="flex flex-wrap gap-3">
          {[
            { label: 'All apps', href: '/freehold-intelligence/apps' },
            { label: 'Review requests', href: '/freehold-intelligence/review-requests' },
            { label: 'Milestones', href: '/freehold-intelligence/milestones' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex items-center gap-1.5 rounded-[10px] border border-slate-800 bg-slate-800/50 px-4 py-2 text-sm text-slate-400 transition hover:border-[#D4AF37]/30 hover:text-white"
            >
              {item.label} <ArrowUpRight className="h-3 w-3" />
            </Link>
          ))}
        </div>
      </section>

    </div>
  )
}
