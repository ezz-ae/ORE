import Link from 'next/link'
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  MessageSquare,
  Send,
  Sparkles,
  TriangleAlert,
  Zap,
} from 'lucide-react'
import {
  currentServerUser,
  getRoleScope,
  serverSummary,
  type ServerActionCard,
} from '@/src/features/freehold-intelligence/server-session'
import { ProgressFooter } from '@/src/features/freehold-intelligence/components/progress-footer'
import { getMilestones } from '@/src/features/freehold-intelligence/data-access'
import { executeTool } from '@/lib/freehold/mcp/execute-tool'

const priorityBorder: Record<ServerActionCard['priority'], string> = {
  critical: 'border-l-red-400/60',
  high:     'border-l-[#D4AF37]/60',
  medium:   'border-l-sky-400/50',
  low:      'border-l-white/20',
}
const priorityBg: Record<ServerActionCard['priority'], string> = {
  critical: 'border-red-400/25 bg-red-500/[0.07]',
  high:     'border-[#D4AF37]/25 bg-[#D4AF37]/[0.06]',
  medium:   'border-sky-300/20 bg-sky-400/[0.06]',
  low:      'border-white/10 bg-white/[0.03]',
}

function ActionCard({ item }: { item: ServerActionCard }) {
  return (
    <article className={`border border-l-2 p-4 ${priorityBorder[item.priority]} ${priorityBg[item.priority]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
            {item.app} · {item.type.replace('_', ' ')}
          </div>
          <h3 className="mt-1.5 text-sm font-semibold leading-snug text-white">{item.title}</h3>
        </div>
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-white/35">{item.priority}</span>
      </div>
      <p className="mt-2.5 text-xs leading-5 text-white/60">{item.body}</p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/35">
        <span>Owner: {item.owner}</span>
        <span>Status: {item.status}</span>
        {item.due && <span className="text-[#D4AF37]/70">Due: {item.due}</span>}
      </div>
    </article>
  )
}

export default async function FreeholdIntelligencePage() {
  const [milestones, serverRes, blockRes] = await Promise.all([
    getMilestones(),
    executeTool({ tool: 'server_summary', role: 'owner' }),
    executeTool({ tool: 'launch_blockers', role: 'owner' }),
  ])

  const activeMilestone = milestones.find((m) => m.status === 'in_progress') ?? milestones[0]
  const roleScope = getRoleScope(currentServerUser.role)
  const liveServer = serverRes.data
  const openBlockers: number = blockRes.data?.criticalCount ?? 0

  const statsRow = [
    { label: 'Live projects',     value: liveServer?.publicData?.totalProjects?.toLocaleString() ?? '—' },
    { label: 'Active users',      value: liveServer?.privateServer?.activeUsers ?? '—' },
    { label: 'Open tasks',        value: liveServer?.privateServer?.openTasks ?? '—' },
    { label: 'Launch blockers',   value: openBlockers, accent: openBlockers > 0 ? 'text-red-300' : 'text-emerald-300' },
    { label: 'Milestones done',   value: `${liveServer?.privateServer?.milestonesDone ?? '—'} / ${liveServer?.privateServer?.milestonesTotal ?? '—'}` },
    { label: 'Audit 24h',         value: liveServer?.privateServer?.auditEvents24h ?? '—' },
  ]

  const allActionCards = [
    ...serverSummary.urgentTasks,
    ...serverSummary.blockedItems,
    ...serverSummary.pendingApprovals,
  ]

  return (
    <div className="grid min-h-full gap-0 xl:grid-cols-[minmax(0,1fr)_340px]">

      {/* ── Main column ─────────────────────────────────────────── */}
      <section className="min-w-0 px-4 py-5 sm:px-6 lg:px-8">

        {/* Session bar */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border border-white/10 bg-white/[0.03] px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center border border-[#D4AF37]/35 bg-[#D4AF37]/10">
              <Bot className="h-4 w-4 text-[#D4AF37]" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">AI Home</div>
              <div className="text-xs text-white/40">Role-aware private operating session</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-emerald-300">
            <LockKeyhole className="h-3.5 w-3.5" />
            {currentServerUser.accountLevel} access
          </div>
        </div>

        {/* Live stats row */}
        <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {statsRow.map(({ label, value, accent }) => (
            <div key={label} className="border border-white/10 bg-white/[0.025] p-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30">{label}</div>
              <div className={`mt-1.5 text-xl font-semibold tabular-nums ${(accent as string | undefined) ?? 'text-white'}`}>
                {String(value)}
              </div>
            </div>
          ))}
        </div>

        {/* Greeting */}
        <div className="border border-[#D4AF37]/15 bg-[radial-gradient(ellipse_at_top_left,rgba(212,175,55,0.10),transparent_28rem)] p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center border border-[#D4AF37]/35 bg-[#D4AF37]/10">
              <Sparkles className="h-5 w-5 text-[#D4AF37]" />
            </div>
            <div className="max-w-4xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D4AF37]">Generated 24-hour briefing</p>
              <h1 className="mt-3 text-2xl font-semibold leading-tight text-white sm:text-3xl">{serverSummary.greeting}</h1>
              <p className="mt-3 text-sm leading-7 text-white/60">{serverSummary.summaryText}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/freehold-intelligence/review-requests" className="inline-flex items-center gap-2 border border-[#D4AF37]/30 bg-[#D4AF37]/[0.07] px-3 py-1.5 text-xs font-semibold text-[#F8E7AE] transition hover:bg-[#D4AF37]/15">
                  Review approvals <ArrowRight className="h-3 w-3" />
                </Link>
                <Link href="/freehold-intelligence/integrations" className="inline-flex items-center gap-2 border border-white/10 px-3 py-1.5 text-xs text-white/55 transition hover:text-white">
                  <Zap className="h-3 w-3 text-[#D4AF37]" /> Integration status
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Action cards + Ask panel */}
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
              <TriangleAlert className="h-4 w-4 text-[#D4AF37]" />
              Urgent operating cards
              <span className="ml-1 text-xs font-normal text-white/35">({allActionCards.length})</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {allActionCards.map((item) => <ActionCard key={item.id} item={item} />)}
            </div>
          </div>

          <aside>
            <div className="border border-[#D4AF37]/20 bg-[#D4AF37]/[0.06] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <MessageSquare className="h-4 w-4 text-[#D4AF37]" />
                Ask the server
              </div>
              <div className="mt-4 grid gap-2">
                {serverSummary.askableQuestions.map((q) => (
                  <button key={q} className="border border-white/10 bg-black/15 px-3 py-2.5 text-left text-xs leading-5 text-white/60 transition hover:border-[#D4AF37]/35 hover:text-white">
                    {q}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex gap-2 border border-white/10 bg-black/20 p-2">
                <input
                  className="min-w-0 flex-1 bg-transparent px-2 text-sm text-white outline-none placeholder:text-white/25"
                  placeholder="Ask within your role scope..."
                />
                <button className="grid h-9 w-9 shrink-0 place-items-center bg-[#D4AF37] text-[#07110D]">
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 text-[11px] text-white/30">
                Scope: {roleScope.slice(0, 3).join(', ')}…
              </div>
            </div>
          </aside>
        </div>

        {/* Secondary alerts */}
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[...serverSummary.crmAlerts, ...serverSummary.leadMachineAlerts, ...serverSummary.notebookRecentOutputs].map((item) => (
            <ActionCard key={item.id} item={item} />
          ))}
        </div>

        {/* Role scope */}
        <div className="mt-5 border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-white">Role answer scope</div>
              <p className="mt-0.5 text-xs text-white/40">
                The AI answers only within this account level until real auth and approvals are connected.
              </p>
            </div>
            <Link href="/freehold-intelligence/security" className="inline-flex items-center gap-1.5 shrink-0 text-xs text-[#D4AF37]">
              Security model <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {roleScope.map((scope) => (
              <span key={scope} className="border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/55">{scope}</span>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <ProgressFooter milestone={activeMilestone} />
        </div>
      </section>

      {/* ── Right sidebar ────────────────────────────────────────── */}
      <aside className="border-l border-white/10 bg-[#07110D]/85 p-4 xl:min-h-full">
        <div className="grid gap-4">

          {/* Today's actions */}
          <section className="border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Clock3 className="h-4 w-4 text-[#D4AF37]" />
              Today's recommended actions
            </div>
            <div className="mt-4 grid gap-3">
              {serverSummary.recommendedActions.map((item) => (
                <div key={item.id} className="border border-white/10 bg-black/15 p-3">
                  <div className="text-sm font-semibold text-white">{item.title}</div>
                  <p className="mt-1.5 text-xs leading-5 text-white/50">{item.body}</p>
                  <div className="mt-2 text-[11px] text-white/30">{item.app} · {item.owner}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Pending approvals */}
          <section className="border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <CheckCircle2 className="h-4 w-4 text-[#D4AF37]" />
                Pending approvals
              </div>
              <span className="border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-2 py-0.5 text-[10px] font-semibold text-[#F8E7AE]">
                {serverSummary.pendingApprovals.length}
              </span>
            </div>
            <div className="mt-4 grid gap-2">
              {serverSummary.pendingApprovals.map((item) => (
                <Link
                  key={item.id}
                  href="/freehold-intelligence/review-requests"
                  className="block border border-white/10 bg-black/15 p-3 text-xs text-white/60 transition hover:border-[#D4AF37]/30 hover:text-white"
                >
                  <div className="font-semibold text-white">{item.title}</div>
                  <div className="mt-0.5 text-white/40">{item.app} · {item.owner}</div>
                </Link>
              ))}
            </div>
            <Link href="/freehold-intelligence/review-requests" className="mt-3 flex items-center justify-center gap-2 border border-[#D4AF37]/25 bg-[#D4AF37]/[0.07] px-4 py-2.5 text-xs font-semibold text-[#F8E7AE]">
              Open review queue <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </section>

          {/* Quick links */}
          <section className="border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">Quick access</div>
            <div className="grid gap-1.5">
              {[
                ['/freehold-intelligence/apps/lead-machine', 'Lead Machine'],
                ['/freehold-intelligence/crm', 'CRM Intelligence'],
                ['/freehold-intelligence/integrations', 'Integrations'],
                ['/freehold-intelligence/milestones', 'Milestones'],
                ['/freehold-intelligence/server-status', 'Server Status'],
              ].map(([href, label]) => (
                <Link key={href} href={href} className="flex items-center justify-between border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs text-white/50 transition hover:border-[#D4AF37]/20 hover:text-white">
                  {label} <ArrowRight className="h-3 w-3 text-white/25" />
                </Link>
              ))}
            </div>
          </section>

        </div>
      </aside>

    </div>
  )
}
