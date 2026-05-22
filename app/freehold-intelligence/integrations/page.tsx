// app/freehold-intelligence/integrations/page.tsx

import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Database,
  ExternalLink,
  Megaphone,
  MessageSquare,
  RefreshCw,
  Server,
  Triangle,
  Users2,
  XCircle,
  Zap,
} from 'lucide-react'
import { executeTool } from '@/lib/freehold/mcp/execute-tool'
import { getAllIntegrations, getLaunchBlockers } from '@/lib/freehold/mcp/mock-integrations'
import { getMilestones } from '@/src/features/freehold-intelligence/data-access'
import { ProgressFooter } from '@/src/features/freehold-intelligence/components/progress-footer'

const integrationMeta: Record<string, { category: string; Icon: React.ElementType; connectNote: string }> = {
  hubspot:     { category: 'CRM',            Icon: Users2,       connectNote: 'Lead capture, contact sync, pipeline automation' },
  'meta-ads':  { category: 'Paid Ads',       Icon: Megaphone,    connectNote: 'Meta and Instagram campaign management, pixel events' },
  'google-ads':{ category: 'Paid Ads',       Icon: Megaphone,    connectNote: 'Google search and display — budget and bidding control' },
  whatsapp:    { category: 'Messaging',      Icon: MessageSquare,connectNote: 'Automated and agent-triggered WhatsApp lead flows' },
  tracking:    { category: 'Analytics',      Icon: BarChart3,    connectNote: 'Meta Pixel, GA4, GTM, conversion event attribution' },
  neon:        { category: 'Infrastructure', Icon: Database,     connectNote: 'Neon PostgreSQL — the private server data layer' },
  vercel:      { category: 'Infrastructure', Icon: Server,       connectNote: 'Vercel deployment pipeline and production health' },
}

function statusCfg(status: string) {
  switch (status) {
    case 'connected':
      return { label: 'Connected', chip: 'border-emerald-300/25 bg-emerald-400/10 text-emerald-200', dot: 'bg-emerald-400', accent: 'border-l-emerald-400/50' }
    case 'disconnected':
    case 'not_connected':
      return { label: 'Not connected', chip: 'border-red-300/25 bg-red-500/10 text-red-200', dot: 'bg-red-400', accent: 'border-l-red-500/50' }
    case 'needs_access':
      return { label: 'Needs access', chip: 'border-orange-300/25 bg-orange-500/10 text-orange-200', dot: 'bg-orange-400', accent: 'border-l-orange-400/50' }
    case 'partial':
      return { label: 'Partial', chip: 'border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#F8E7AE]', dot: 'bg-[#D4AF37]', accent: 'border-l-[#D4AF37]/50' }
    case 'blocked':
      return { label: 'Blocked', chip: 'border-red-300/25 bg-red-500/10 text-red-200', dot: 'bg-red-400', accent: 'border-l-red-500/50' }
    default:
      return { label: 'Pending', chip: 'border-sky-300/25 bg-sky-400/10 text-sky-200', dot: 'bg-sky-400', accent: 'border-l-sky-400/50' }
  }
}

function severityCfg(severity: string) {
  if (severity === 'critical')
    return { border: 'border-red-400/35 bg-red-500/[0.08]', badge: 'border-red-300/30 bg-red-400/10 text-red-200', num: 'text-red-300', step: 'text-white/55' }
  return { border: 'border-[#D4AF37]/30 bg-[#D4AF37]/[0.07]', badge: 'border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#F8E7AE]', num: 'text-[#D4AF37]', step: 'text-white/55' }
}

function formatSyncTime(ts?: string) {
  if (!ts) return 'Never synced'
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default async function IntegrationsPage() {
  const [intRes, blockRes, milestones] = await Promise.all([
    executeTool({ tool: 'integration_summary', role: 'owner' }),
    executeTool({ tool: 'launch_blockers', role: 'owner' }),
    getMilestones(),
  ])

  const integrations: any[] = intRes.data?.integrations || getAllIntegrations()
  const blockData = blockRes.data || {}
  const blockers: any[] = blockData.blockers || getLaunchBlockers()
  const criticalCount: number = blockData.criticalCount ?? blockers.filter((b: any) => b.severity === 'critical').length
  const canLaunch: boolean = blockData.canLaunch ?? criticalCount === 0
  const connectedCount = integrations.filter((i: any) => i.status === 'connected').length
  const total = integrations.length
  const criticalBlockers = blockers.filter((b: any) => b.severity === 'critical')
  const warningBlockers = blockers.filter((b: any) => ['warning', 'high', 'medium'].includes(b.severity))
  const m1 = milestones.find((m) => m.code === 'M1') ?? milestones[0]

  const grouped = integrations.reduce<Record<string, any[]>>((acc, i) => {
    const cat = integrationMeta[i.id]?.category || i.category || 'Other'
    ;(acc[cat] = acc[cat] || []).push(i)
    return acc
  }, {})

  return (
    <div className="min-h-full px-4 py-5 sm:px-6 lg:px-8">

      {/* ── Header ─────────────────────────────────────────────── */}
      <section className="border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D4AF37]">Integration Layer</p>
            <h1 className="mt-3 text-3xl font-semibold text-white">External connection readiness</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/55">
              CRM, paid ads, messaging, analytics and infrastructure connections that must be live before campaign launch and external writes are permitted by the MCP layer.
            </p>
          </div>
          <div className={`shrink-0 border px-4 py-3 text-sm font-semibold ${canLaunch ? 'border-emerald-300/30 bg-emerald-400/[0.08] text-emerald-200' : 'border-red-300/30 bg-red-500/[0.08] text-red-200'}`}>
            {canLaunch
              ? <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Ready to launch</span>
              : <span className="flex items-center gap-2"><XCircle className="h-4 w-4" /> {criticalCount} critical blocker{criticalCount !== 1 ? 's' : ''}</span>
            }
          </div>
        </div>
      </section>

      {/* ── Stats row ──────────────────────────────────────────── */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="border border-white/10 bg-white/[0.03] p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">Total integrations</div>
          <div className="mt-2 text-3xl font-semibold text-white">{total}</div>
        </div>
        <div className="border border-emerald-300/20 bg-emerald-400/[0.05] p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">Connected</div>
          <div className="mt-2 text-3xl font-semibold text-emerald-300">{connectedCount}</div>
        </div>
        <div className="border border-red-300/20 bg-red-500/[0.05] p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">Critical blockers</div>
          <div className="mt-2 text-3xl font-semibold text-red-300">{criticalCount}</div>
        </div>
        <div className="border border-[#D4AF37]/20 bg-[#D4AF37]/[0.05] p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">Warnings</div>
          <div className="mt-2 text-3xl font-semibold text-[#D4AF37]">{warningBlockers.length}</div>
        </div>
      </div>

      {/* ── Critical blockers ──────────────────────────────────── */}
      {criticalBlockers.length > 0 && (
        <section className="mt-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-red-200">
            <XCircle className="h-4 w-4 text-red-400" />
            Critical — must resolve before launch
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {criticalBlockers.map((blocker: any) => {
              const cfg = severityCfg(blocker.severity)
              const steps: string[] = blocker.resolutionSteps || blocker.resolution_steps || []
              return (
                <div key={blocker.id} className={`border p-4 ${cfg.border}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-red-300/60">
                        {String(blocker.integrationId || blocker.integration_id || 'system').replace(/-/g, ' ')} · critical
                      </div>
                      <h3 className="mt-2 text-sm font-semibold text-white">{blocker.title || blocker.message}</h3>
                    </div>
                    <span className={`shrink-0 border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${cfg.badge}`}>Critical</span>
                  </div>
                  {blocker.description && <p className="mt-2 text-xs leading-5 text-white/55">{blocker.description}</p>}
                  {steps.length > 0 && (
                    <ol className="mt-3 grid gap-1.5">
                      {steps.slice(0, 4).map((step: string, i: number) => (
                        <li key={i} className={`flex gap-2 text-xs ${cfg.step}`}>
                          <span className={`shrink-0 font-semibold ${cfg.num}`}>{i + 1}.</span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  )}
                  {blocker.nextAction && (
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-[#D4AF37]">
                      <ArrowRight className="h-3 w-3" /> {blocker.nextAction}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Warning blockers ───────────────────────────────────── */}
      {warningBlockers.length > 0 && (
        <section className="mt-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#F8E7AE]">
            <AlertTriangle className="h-4 w-4 text-[#D4AF37]" />
            Warnings — resolve before stable operations
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {warningBlockers.map((blocker: any) => {
              const cfg = severityCfg(blocker.severity)
              const steps: string[] = blocker.resolutionSteps || blocker.resolution_steps || []
              return (
                <div key={blocker.id} className={`border p-4 ${cfg.border}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#D4AF37]/60">
                        {String(blocker.integrationId || blocker.integration_id || 'system').replace(/-/g, ' ')} · {blocker.severity}
                      </div>
                      <h3 className="mt-2 text-sm font-semibold text-white">{blocker.title || blocker.message}</h3>
                    </div>
                    <span className={`shrink-0 border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${cfg.badge}`}>
                      {blocker.severity}
                    </span>
                  </div>
                  {steps.length > 0 && (
                    <ol className="mt-3 grid gap-1.5">
                      {steps.slice(0, 3).map((step: string, i: number) => (
                        <li key={i} className={`flex gap-2 text-xs ${cfg.step}`}>
                          <span className={`shrink-0 font-semibold ${cfg.num}`}>{i + 1}.</span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Integration cards ──────────────────────────────────── */}
      <section className="mt-6">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
          <Zap className="h-4 w-4 text-[#D4AF37]" />
          Integration status by category
        </div>
        <div className="grid gap-6">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">{category}</div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((integration: any) => {
                  const meta = integrationMeta[integration.id]
                  const IconComp = meta?.Icon ?? Server
                  const st = statusCfg(integration.status)
                  return (
                    <div
                      key={integration.id}
                      className={`border border-l-2 bg-white/[0.025] p-4 transition hover:bg-white/[0.04] ${st.accent} border-white/10`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="grid h-9 w-9 shrink-0 place-items-center border border-white/10 bg-white/[0.03]">
                            <IconComp className="h-4 w-4 text-[#D4AF37]/80" />
                          </div>
                          <div>
                            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30">{meta?.category || category}</div>
                            <h3 className="mt-0.5 text-sm font-semibold text-white">{integration.name}</h3>
                          </div>
                        </div>
                        <span className={`shrink-0 border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${st.chip}`}>
                          {st.label}
                        </span>
                      </div>

                      <p className="mt-3 text-xs leading-5 text-white/45">{meta?.connectNote || integration.description}</p>

                      <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/[0.07] pt-3">
                        <div className="flex items-center gap-1.5 text-xs text-white/30">
                          <span className={`h-1.5 w-1.5 shrink-0 ${st.dot}`} />
                          {formatSyncTime(integration.lastSync || integration.last_sync)}
                        </div>
                        {integration.status !== 'connected' ? (
                          <button className="flex items-center gap-1.5 border border-[#D4AF37]/30 bg-[#D4AF37]/[0.07] px-3 py-1.5 text-xs font-semibold text-[#F8E7AE] transition hover:bg-[#D4AF37]/15">
                            <ExternalLink className="h-3 w-3" /> Connect
                          </button>
                        ) : (
                          <button className="flex items-center gap-1.5 border border-emerald-300/20 px-3 py-1.5 text-xs text-emerald-300/70 transition hover:border-emerald-300/40 hover:text-emerald-200">
                            <RefreshCw className="h-3 w-3" /> Sync now
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Data source badge ──────────────────────────────────── */}
      {intRes.fallbackStatus === 'mock' && (
        <div className="mt-6 border border-[#D4AF37]/15 bg-[#D4AF37]/[0.04] px-4 py-3 text-xs text-[#F8E7AE]/60">
          Data source: mock fallback — freehold_integration_connections table empty or unreachable
        </div>
      )}

      <div className="mt-6">
        <ProgressFooter milestone={m1} />
      </div>
    </div>
  )
}
