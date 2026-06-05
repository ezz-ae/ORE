import Link from 'next/link'
import {
  LayoutDashboard, ArrowLeft, ShieldCheck, Users, Zap, AlertCircle,
  CheckCircle2, Clock, ArrowUpRight, TrendingUp,
} from 'lucide-react'
import {
  serverSummary, serverApps, crmLeads, crmAgentRoster, crmFollowUpQueue,
} from '@/src/features/freehold-intelligence/server-session'
import { getDashboardSnapshot } from '@/src/features/freehold-intelligence/data-access'
import { AiPrompt } from '@/components/freehold/ai-prompt'
import { ActionItems } from './_components/ActionItems'

const INFRA = [
  { label: 'Neon database',     status: 'live',    note: 'freehold_site_projects — 7,015 rows' },
  { label: 'Vercel deployment', status: 'live',    note: 'Production + preview pipelines' },
  { label: 'MCP layer',         status: 'live',    note: '9 tools registered, role-gated' },
  { label: 'Auth middleware',   status: 'pending', note: 'Route protection pending final wiring' },
] as const

function infraDot(s: string) {
  if (s === 'live') return 'bg-emerald-400'
  return 'bg-[#D4AF37]'
}

function infraLabel(s: string) {
  if (s === 'live') return { text: 'text-emerald-300', label: 'Live' }
  return { text: 'text-[#F8E7AE]', label: 'Pending' }
}

export default async function DashboardOverviewPage() {
  const snapshot = await getDashboardSnapshot()

  const liveApps  = serverApps.filter((a) => a.status === 'live').length
  const blocked   = serverApps.reduce((s, a) => s + a.blockedCount, 0)
  const approvals = serverApps.reduce((s, a) => s + a.pendingApprovalCount, 0)
  const hotLeads  = crmLeads.filter((l) => l.urgency === 'critical' || l.urgency === 'high').length
  const overdue   = crmFollowUpQueue.length
  const available = crmAgentRoster.filter((a) => a.status === 'available').length

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-10 sm:px-6 sm:pt-14">

      <Link href="/freehold-intelligence/apps/dashboard" className="inline-flex items-center gap-1.5 text-[12px] text-white/40 transition hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> Dashboard App
      </Link>

      <section className="mt-7">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
          <LayoutDashboard className="h-3.5 w-3.5" /> Operating Overview
        </div>
        <h1 className="mt-4 text-[36px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[52px]">
          Today at a glance<br /><span className="text-white/35">across every surface.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-[17px] leading-[1.65] text-white/60">
          {Number(snapshot.total_projects).toLocaleString()} projects · {snapshot.total_areas} areas · {snapshot.total_developers} developers · {liveApps} apps live.
        </p>
      </section>

      {/* KPI row */}
      <section className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'Live apps',   value: liveApps,       tone: 'text-emerald-300' },
          { label: 'Hot leads',   value: hotLeads,       tone: 'text-red-400' },
          { label: 'Overdue FU',  value: overdue,        tone: 'text-orange-300' },
          { label: 'Approvals',   value: approvals,      tone: 'text-[#D4AF37]' },
          { label: 'Blocked',     value: blocked,        tone: 'text-red-400' },
          { label: 'Agents avail',value: available,      tone: 'text-emerald-300' },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-[18px] border border-white/[0.06] bg-[#0A0D10] p-4 text-center">
            <div className={`text-[28px] font-semibold ${kpi.tone}`}>{kpi.value}</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-white/35">{kpi.label}</div>
          </div>
        ))}
      </section>

      <ActionItems
        urgentTasks={serverSummary.urgentTasks}
        pendingApprovals={serverSummary.pendingApprovals}
      />

      {/* Infrastructure */}
      <section className="mt-14">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">
          <ShieldCheck className="h-3.5 w-3.5" /> Infrastructure
        </div>
        <h2 className="mt-2 text-xl font-semibold text-white">Live components</h2>
        <div className="mt-5 grid gap-3">
          {INFRA.map((item) => {
            const t = infraLabel(item.status)
            return (
              <div key={item.label} className="flex items-center justify-between gap-5 rounded-2xl border border-white/[0.06] bg-[#0A0D10] p-5">
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-white">{item.label}</div>
                  <div className="mt-0.5 text-[12px] text-white/45">{item.note}</div>
                </div>
                <span className={`flex shrink-0 items-center gap-1.5 text-[12px] ${t.text}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${infraDot(item.status)}`} />
                  {t.label}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {/* App health matrix */}
      <section className="mt-14">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">
          <TrendingUp className="h-3.5 w-3.5" /> Apps
        </div>
        <h2 className="mt-2 text-xl font-semibold text-white">Live status matrix</h2>
        <div className="mt-5 overflow-hidden rounded-[22px] border border-white/[0.06] bg-[#0A0D10]">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-white/[0.05]">
                <th className="px-6 py-3 text-left text-[10px] font-medium uppercase tracking-[0.18em] text-white/30">App</th>
                <th className="hidden px-4 py-3 text-center text-[10px] font-medium uppercase tracking-[0.18em] text-white/30 sm:table-cell">Urgent</th>
                <th className="hidden px-4 py-3 text-center text-[10px] font-medium uppercase tracking-[0.18em] text-white/30 md:table-cell">Blocked</th>
                <th className="hidden px-4 py-3 text-center text-[10px] font-medium uppercase tracking-[0.18em] text-white/30 lg:table-cell">Approvals</th>
                <th className="px-6 py-3 text-right text-[10px] font-medium uppercase tracking-[0.18em] text-white/30">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {serverApps.filter((a) => a.status !== 'planned').slice(0, 8).map((app) => (
                <tr key={app.id} className="transition hover:bg-white/[0.02]">
                  <td className="px-6 py-4">
                    <Link href={app.href} className="font-medium text-white/85 transition hover:text-[#D4AF37]">{app.name}</Link>
                  </td>
                  <td className="hidden px-4 py-4 text-center sm:table-cell">
                    <span className={`font-medium tabular-nums ${app.urgentCount > 0 ? 'text-red-400' : 'text-white/25'}`}>{app.urgentCount}</span>
                  </td>
                  <td className="hidden px-4 py-4 text-center md:table-cell">
                    <span className={`font-medium tabular-nums ${app.blockedCount > 0 ? 'text-orange-300' : 'text-white/25'}`}>{app.blockedCount}</span>
                  </td>
                  <td className="hidden px-4 py-4 text-center lg:table-cell">
                    <span className={`font-medium tabular-nums ${app.pendingApprovalCount > 0 ? 'text-[#D4AF37]' : 'text-white/25'}`}>{app.pendingApprovalCount}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`text-[11px] font-medium ${app.status === 'live' ? 'text-emerald-300' : app.status === 'in_progress' ? 'text-[#F8E7AE]' : 'text-white/35'}`}>
                      {app.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12">
        <AiPrompt
          placeholder="Ask about the operating overview…"
          suggestions={[
            'What needs my attention first today?',
            'Which apps have unresolved blockers?',
            'Give me a health summary of the server.',
          ]}
        />
      </section>

      <section className="mt-8 flex flex-wrap gap-3">
        {[
          { label: 'CRM Intelligence', href: '/freehold-intelligence/crm' },
          { label: 'Lead Machine', href: '/freehold-intelligence/lead-machine' },
          { label: 'Review Requests', href: '/freehold-intelligence/review-requests' },
          { label: 'Server Status', href: '/freehold-intelligence/server-status' },
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
