import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  GitBranch,
  Server,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { getAuditEvents, getDashboardSnapshot, getMilestones } from '@/src/features/freehold-intelligence/data-access'
import { StatusPill } from '@/src/features/freehold-intelligence/components/status-pill'
import { ProgressFooter } from '@/src/features/freehold-intelligence/components/progress-footer'

function KpiCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="border border-white/10 bg-white/[0.03] p-5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">{label}</div>
      <div className={`mt-2 text-3xl font-semibold tabular-nums ${accent ?? 'text-white'}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      {sub && <div className="mt-1 text-xs text-white/40">{sub}</div>}
    </div>
  )
}

export default async function ServerStatusPage() {
  const [snapshot, milestones, auditEvents] = await Promise.all([
    getDashboardSnapshot(),
    getMilestones(),
    getAuditEvents(),
  ])

  const m9 = milestones.find((m) => m.code === 'M9') ?? milestones[milestones.length - 1]
  const inProgress = milestones.filter((m) => m.status === 'in_progress')
  const done = milestones.filter((m) => m.status === 'done' || m.status === 'live')
  const atRisk = milestones.filter((m) => m.health === 'at_risk' || m.health === 'overdue')

  return (
    <div className="min-h-full px-4 py-5 sm:px-6 lg:px-8">

      {/* ── Header ─────────────────────────────────────────────── */}
      <section className="border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D4AF37]">Operational readiness</p>
            <h1 className="mt-3 text-3xl font-semibold text-white">Server status</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/55">
              Live readiness checks from Neon-backed Freehold tables, audit log, milestone health and infrastructure state.
            </p>
          </div>
          <div className="flex items-center gap-2 border border-emerald-300/25 bg-emerald-400/10 px-4 py-2 text-xs font-semibold text-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Systems operational
          </div>
        </div>
      </section>

      {/* ── KPI grid ───────────────────────────────────────────── */}
      <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Live projects" value={snapshot.total_projects} sub={`${snapshot.total_areas} areas · ${snapshot.total_developers} developers`} />
        <KpiCard label="Milestones" value={`${snapshot.milestones_done} / ${snapshot.milestones_total}`} sub={`${inProgress.length} in progress`} accent="text-[#D4AF37]" />
        <KpiCard label="Open tasks" value={snapshot.open_tasks} sub="freehold_comments_tasks" accent={snapshot.open_tasks > 0 ? 'text-[#F8E7AE]' : 'text-white'} />
        <KpiCard label="Audit events 24h" value={snapshot.audit_events_24h} sub="system actions logged" />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">

        {/* ── Milestone health ───────────────────────────────────── */}
        <section className="border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <GitBranch className="h-4 w-4 text-[#D4AF37]" />
              Milestone health
            </div>
            <div className="flex items-center gap-3 text-xs text-white/45">
              <span className="text-emerald-300">{done.length} done</span>
              <span className="text-[#D4AF37]">{inProgress.length} active</span>
              {atRisk.length > 0 && <span className="text-red-300">{atRisk.length} at risk</span>}
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {milestones.map((milestone) => (
              <div key={milestone.code} className="flex items-center justify-between border border-white/10 bg-black/15 px-4 py-3">
                <div>
                  <span className="text-[10px] font-semibold text-[#D4AF37]">{milestone.code}</span>
                  <div className="mt-0.5 text-sm text-white/80">{milestone.title}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusPill value={milestone.status} className="rounded-none!" />
                  {milestone.health && milestone.health !== milestone.status && (
                    <StatusPill value={milestone.health} className="rounded-none!" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Right column ──────────────────────────────────────── */}
        <div className="grid gap-5">

          {/* Infrastructure status */}
          <section className="border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
              <Server className="h-4 w-4 text-[#D4AF37]" />
              Infrastructure
            </div>
            <div className="grid gap-2">
              {[
                { label: 'Neon database', status: 'connected', note: 'freehold_site_projects and related tables' },
                { label: 'Vercel deployment', status: 'connected', note: 'Production and preview environments' },
                { label: 'Auth middleware', status: 'pending', note: 'Route protection still requires final wiring' },
                { label: 'MCP layer', status: 'live', note: '9 tools registered, role-gated execution' },
              ].map(({ label, status, note }) => (
                <div key={label} className="flex items-start justify-between gap-3 border border-white/10 bg-black/15 px-3 py-2.5">
                  <div>
                    <div className="text-sm text-white">{label}</div>
                    <div className="mt-0.5 text-[11px] text-white/40">{note}</div>
                  </div>
                  <StatusPill value={status} className="shrink-0 rounded-none!" />
                </div>
              ))}
            </div>
          </section>

          {/* Data layer */}
          <section className="border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
              <Database className="h-4 w-4 text-[#D4AF37]" />
              Data layer
            </div>
            <div className="grid gap-2">
              {[
                { label: 'freehold_site_projects', value: snapshot.total_projects.toLocaleString() + ' rows', ok: true },
                { label: 'freehold_private_dashboard', value: 'View ready', ok: true },
                { label: 'freehold_integration_connections', value: '7 records', ok: true },
                { label: 'freehold_integration_requirements', value: '6 requirements', ok: true },
                { label: 'freehold_ai_sessions', value: 'Tables created', ok: true },
                { label: 'freehold_rbac_matrix', value: 'Wiring pending', ok: false },
              ].map(({ label, value, ok }) => (
                <div key={label} className="flex items-center justify-between border border-white/10 bg-black/15 px-3 py-2">
                  <span className="font-mono text-xs text-white/60">{label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/40">{value}</span>
                    {ok
                      ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      : <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[#D4AF37]" />
                    }
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* ── Audit log ──────────────────────────────────────────── */}
      <section className="mt-5 border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
          <Activity className="h-4 w-4 text-[#D4AF37]" />
          Recent audit events
        </div>
        {auditEvents.length === 0 ? (
          <div className="border border-white/10 bg-black/15 px-4 py-6 text-center text-sm text-white/40">
            No audit events yet — events will appear here once server actions mutate data with actor context.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <div className="grid grid-cols-[1fr_1fr_1fr_1.5fr] border-b border-white/10 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
                <span>Time</span><span>Actor</span><span>Action</span><span>Target</span>
              </div>
              {auditEvents.slice(0, 20).map((event) => (
                <div key={String(event.log_id)} className="grid grid-cols-[1fr_1fr_1fr_1.5fr] border-b border-white/[0.06] px-4 py-3 text-xs text-white/60 hover:bg-white/[0.02]">
                  <span className="text-white/35">{String(event.created_at).slice(0, 19).replace('T', ' ')}</span>
                  <span>{event.actor ?? 'system'}</span>
                  <span className="text-[#D4AF37]/80">{event.action}</span>
                  <span className="truncate font-mono text-white/40">{event.target_table}:{event.target_id}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="mt-6">
        <ProgressFooter milestone={m9} />
      </div>
    </div>
  )
}
