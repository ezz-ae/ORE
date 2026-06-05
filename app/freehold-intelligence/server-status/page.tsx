import { ShieldCheck } from 'lucide-react'
import { getAuditEvents, getDashboardSnapshot } from '@/src/features/freehold-intelligence/data-access'
import { AiPrompt } from '@/components/freehold/ai-prompt'

const INFRA = [
  { label: 'Neon database',    status: 'live',    note: 'freehold_site_projects and related tables' },
  { label: 'Vercel deployment',status: 'live',    note: 'Production and preview pipelines' },
  { label: 'MCP layer',        status: 'live',    note: '9 tools registered, role-gated execution' },
  { label: 'Auth middleware',  status: 'pending', note: 'Route protection still requires final wiring' },
] as const

function statusTone(s: string) {
  if (s === 'live') return { dot: 'bg-[#D4AF37]', label: 'Live',     text: 'text-[#D4AF37]' }
  if (s === 'pending') return { dot: 'bg-[#D4AF37]', label: 'Pending', text: 'text-[#F8E7AE]' }
  return { dot: 'bg-red-400', label: 'Down', text: 'text-red-300' }
}

export default async function ServerStatusPage() {
  const [snapshot, audit] = await Promise.all([
    getDashboardSnapshot(),
    getAuditEvents(),
  ])

  return (
    <div className="mx-auto max-w-5xl px-6 pb-32 pt-12 sm:pt-16">

      <section>
        <div className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
          <ShieldCheck className="h-3.5 w-3.5" /> Server
        </div>
        <h1 className="mt-5 text-[40px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[56px]">
          Everything important
          <br />
          <span className="text-white/40">is alive.</span>
        </h1>
        <p className="mt-7 max-w-2xl text-[18px] leading-[1.6] text-white/65">
          <span className="text-white">{Number(snapshot.total_projects).toLocaleString()} projects</span> across {snapshot.total_areas} areas and {snapshot.total_developers} developers. {snapshot.audit_events_24h} actions logged in the last 24 hours.
        </p>
      </section>

      <section className="mt-12">
        <AiPrompt
          placeholder="Ask about uptime, audit, infrastructure…"
          suggestions={[
            'What is pending production hardening?',
            'Show recent audit events.',
            'How many projects today vs last week?',
          ]}
        />
      </section>

      <section className="mt-20">
        <div className="text-[13px] font-medium uppercase tracking-[0.22em] text-white/40">Infrastructure</div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Live components</h2>
        <div className="mt-7 grid gap-3">
          {INFRA.map((i) => {
            const t = statusTone(i.status)
            return (
              <div key={i.label} className="flex items-center justify-between gap-5 rounded-2xl border border-white/[0.08] bg-[#131B2B] p-5">
                <div className="min-w-0">
                  <div className="text-[15px] font-semibold text-white">{i.label}</div>
                  <div className="mt-0.5 text-[13px] text-white/50">{i.note}</div>
                </div>
                <span className={`flex shrink-0 items-center gap-1.5 text-[12px] ${t.text}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
                  {t.label}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      <section className="mt-20">
        <div className="text-[13px] font-medium uppercase tracking-[0.22em] text-white/40">Audit</div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">What happened recently</h2>
        <div className="mt-7 overflow-hidden rounded-3xl border border-white/[0.08] bg-[#131B2B]">
          {audit.length === 0 ? (
            <div className="px-6 py-12 text-center text-[14px] text-white/45">
              No audit events yet. They'll appear here as actor-tagged actions land.
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {audit.slice(0, 12).map((event) => (
                <li key={String(event.log_id)} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 text-[13px]">
                  <div className="min-w-0">
                    <span className="text-white/85">{event.actor ?? 'system'}</span>
                    <span className="text-white/30"> · </span>
                    <span className="text-[#D4AF37]/85">{event.action}</span>
                  </div>
                  <div className="flex items-center gap-3 text-white/40">
                    <span className="font-mono text-[12px] text-white/40">{event.target_table}</span>
                    <span className="text-[12px]">{String(event.created_at).slice(0, 16).replace('T', ' ')}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
