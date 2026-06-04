import Link from 'next/link'
import { Activity, PhoneCall, MessageCircle, FileText, ArrowLeftRight, Bell, Zap } from 'lucide-react'
import { crmActivityLog, type CRMActivityEvent } from '@/src/features/freehold-intelligence/server-session'
import { AiPrompt } from '@/components/freehold/ai-prompt'

type EventType = CRMActivityEvent['type']

const TYPE_CONFIG: Record<EventType, { icon: typeof PhoneCall; label: string; iconColor: string; iconBg: string }> = {
  call:         { icon: PhoneCall,       label: 'Call',        iconColor: 'text-emerald-300', iconBg: 'bg-emerald-400/10 border-emerald-400/20' },
  whatsapp:     { icon: MessageCircle,   label: 'WhatsApp',    iconColor: 'text-[#D4AF37]',   iconBg: 'bg-[#D4AF37]/10 border-[#D4AF37]/20' },
  note:         { icon: FileText,        label: 'Note',        iconColor: 'text-sky-300',     iconBg: 'bg-sky-400/10 border-sky-400/20' },
  stage_change: { icon: ArrowLeftRight,  label: 'Stage',       iconColor: 'text-violet-300',  iconBg: 'bg-violet-400/10 border-violet-400/20' },
  assignment:   { icon: ArrowLeftRight,  label: 'Assigned',    iconColor: 'text-rose-300',    iconBg: 'bg-rose-400/10 border-rose-400/20' },
  follow_up:    { icon: Bell,            label: 'Reminder',    iconColor: 'text-orange-300',  iconBg: 'bg-orange-400/10 border-orange-400/20' },
  system:       { icon: Zap,             label: 'System',      iconColor: 'text-white/45',    iconBg: 'bg-white/[0.04] border-white/10' },
}

function OutcomeChip({ outcome }: { outcome?: string }) {
  if (!outcome) return null
  if (outcome === 'connected')
    return <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-300">Connected</span>
  if (outcome === 'no_answer')
    return <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/40">No answer</span>
  if (outcome === 'progressed')
    return <span className="rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/10 px-2 py-0.5 text-[10px] text-[#D4AF37]">Progressed</span>
  return null
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai',
  })
}

export default function CrmActivityPage() {
  const sorted = [...crmActivityLog].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  const todayStr = '2026-06-04'
  const todayEvents = sorted.filter((e) => e.createdAt.startsWith(todayStr))
  const callsToday     = todayEvents.filter((e) => e.type === 'call').length
  const messagesToday  = todayEvents.filter((e) => e.type === 'whatsapp').length
  const notesToday     = todayEvents.filter((e) => e.type === 'note').length

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-10 sm:px-6 lg:pt-14">

      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
        <Activity className="h-3.5 w-3.5" /> Activity
      </div>
      <h1 className="mt-4 text-[36px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[48px]">
        Communication<br /><span className="text-white/35">history.</span>
      </h1>
      <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-white/55">
        {sorted.length} events logged. Every call, message, note and stage change — in order.
      </p>

      <div className="mt-8 grid grid-cols-3 gap-3">
        <div className="rounded-[18px] border border-white/[0.06] bg-[#0A0D10] p-5">
          <div className="text-[28px] font-semibold text-emerald-300">{callsToday}</div>
          <div className="mt-0.5 text-[11px] text-white/40">Calls today</div>
        </div>
        <div className="rounded-[18px] border border-white/[0.06] bg-[#0A0D10] p-5">
          <div className="text-[28px] font-semibold text-[#D4AF37]">{messagesToday}</div>
          <div className="mt-0.5 text-[11px] text-white/40">Messages today</div>
        </div>
        <div className="rounded-[18px] border border-white/[0.06] bg-[#0A0D10] p-5">
          <div className="text-[28px] font-semibold text-sky-300">{notesToday}</div>
          <div className="mt-0.5 text-[11px] text-white/40">Notes today</div>
        </div>
      </div>

      <div className="mt-10">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">Timeline</div>
        <div className="mt-5 space-y-2">
          {sorted.map((event) => {
            const config = TYPE_CONFIG[event.type] ?? TYPE_CONFIG.system
            const Icon = config.icon
            return (
              <div key={event.id} className="flex gap-4 rounded-[18px] border border-white/[0.05] bg-[#0A0D10] px-5 py-4">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${config.iconBg}`}>
                  <Icon className={`h-4 w-4 ${config.iconColor}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[12px] font-medium text-white/40">{config.label}</span>
                    <Link
                      href={`/freehold-intelligence/crm/leads/${event.leadId}`}
                      className="text-[14px] font-semibold text-white transition hover:text-[#D4AF37]"
                    >
                      {event.leadName}
                    </Link>
                    {typeof event.durationMin === 'number' && event.durationMin > 0 && (
                      <span className="text-[11px] text-white/30">{event.durationMin}m</span>
                    )}
                    <OutcomeChip outcome={event.outcome} />
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed text-white/60">{event.content}</p>
                  <div className="mt-1.5 flex items-center gap-2.5 text-[11px] text-white/30">
                    <span>{event.actor}</span>
                    <span>·</span>
                    <span>{formatTime(event.createdAt)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <section className="mt-10">
        <AiPrompt
          placeholder="Ask about activity, calls, outreach…"
          suggestions={[
            'How many calls happened today?',
            'Which lead has had the most follow-up attempts?',
            'Show me all activity for Rami Haddad.',
          ]}
        />
      </section>

    </div>
  )
}
