import Link from 'next/link'
import { ArrowLeft, Globe, CheckCircle2, AlertCircle, Clock, Database, Zap, ArrowUpRight } from 'lucide-react'
import { getDashboardSnapshot } from '@/src/features/freehold-intelligence/data-access'
import { AiPrompt } from '@/components/freehold/ai-prompt'

type RouteStatus = 'live' | 'pending' | 'planned' | 'down'

interface RouteEntry {
  path: string
  type: 'page' | 'api' | 'layout'
  status: RouteStatus
  note: string
}

const ROUTES: RouteEntry[] = [
  { path: '/freehold-intelligence',                   type: 'page',   status: 'live',    note: 'Home — server session, greeting, AI prompt'       },
  { path: '/freehold-intelligence/crm',               type: 'page',   status: 'live',    note: 'CRM — leads ranked by intent + suggested actions'   },
  { path: '/freehold-intelligence/crm/leads/[id]',   type: 'page',   status: 'live',    note: 'Lead detail — AI summary, activity, quick actions'  },
  { path: '/freehold-intelligence/crm/pipeline',      type: 'page',   status: 'live',    note: 'Pipeline stages — stage spotlight, stage counts'    },
  { path: '/freehold-intelligence/crm/inbox',         type: 'page',   status: 'live',    note: 'Unassigned lead queue with AI routing notes'        },
  { path: '/freehold-intelligence/crm/agents',        type: 'page',   status: 'live',    note: 'Agent roster, utilization, overload detection'      },
  { path: '/freehold-intelligence/crm/reports',       type: 'page',   status: 'live',    note: 'CRM KPIs, source breakdown, intent bars'            },
  { path: '/freehold-intelligence/lead-machine',      type: 'page',   status: 'live',    note: 'Lead Machine hub with stats and launch readiness'   },
  { path: '/freehold-intelligence/lead-machine/campaigns', type: 'page', status: 'live', note: 'Meta campaign list with live insights'              },
  { path: '/freehold-intelligence/lead-machine/campaigns/new', type: 'page', status: 'live', note: '4-step campaign launch wizard'               },
  { path: '/freehold-intelligence/lead-machine/campaigns/[id]', type: 'page', status: 'live', note: 'Campaign detail — metrics, pause/activate'  },
  { path: '/freehold-intelligence/lead-machine/listings/[id]', type: 'page', status: 'live', note: 'Listing detail — ad readiness, landing status' },
  { path: '/freehold-intelligence/apps',              type: 'page',   status: 'live',    note: 'App catalog — all modules by role'                 },
  { path: '/freehold-intelligence/integrations',      type: 'page',   status: 'live',    note: 'Integration hub — Meta, HubSpot, WhatsApp'         },
  { path: '/freehold-intelligence/notebook',          type: 'page',   status: 'live',    note: 'AI notebook — conversations, pinned outputs'       },
  { path: '/freehold-intelligence/milestones',        type: 'page',   status: 'live',    note: 'Milestones — delivery plan and progress'           },
  { path: '/freehold-intelligence/security',          type: 'page',   status: 'live',    note: 'Security — role matrix, audit trail, hardening'    },
  { path: '/freehold-intelligence/tasks',             type: 'page',   status: 'live',    note: 'Tasks — owner-assigned items, blockers'            },
  { path: '/freehold-intelligence/review-requests',   type: 'page',   status: 'live',    note: 'Review queue — approvals, corrections, comments'   },
  { path: '/api/meta/campaigns',                      type: 'api',    status: 'live',    note: 'GET campaign list with parallel insights fetch'     },
  { path: '/api/meta/campaigns/[id]',                 type: 'api',    status: 'live',    note: 'GET detail / PATCH status (activate/pause/delete)' },
  { path: '/api/meta/launch',                         type: 'api',    status: 'live',    note: 'POST atomic campaign launch — AED budget gate'      },
  { path: '/api/ai/chat',                             type: 'api',    status: 'live',    note: 'Role-scoped AI chat — prompt, context, tool calls'  },
  { path: 'Auth middleware (all private routes)',      type: 'layout', status: 'pending', note: 'NextAuth / JWT gate — final wiring required'       },
  { path: 'RBAC database enforcement',                type: 'layout', status: 'pending', note: 'UI gates active; DB-level RBAC not yet applied'     },
]

const INFRA = [
  { label: 'Neon database',     status: 'live' as RouteStatus,    note: 'freehold_site_projects + CRM + audit tables'     },
  { label: 'Vercel deployment', status: 'live' as RouteStatus,    note: 'Production + preview pipelines, instant rollback' },
  { label: 'Meta API layer',    status: 'live' as RouteStatus,    note: 'Campaign CRUD, insights, launch endpoint v20.0'   },
  { label: 'MCP server',        status: 'live' as RouteStatus,    note: '9 tools registered, role-gated execution'         },
  { label: 'Auth middleware',   status: 'pending' as RouteStatus, note: 'Route protection — final wiring in progress'      },
  { label: 'Rate limiting',     status: 'planned' as RouteStatus, note: 'AI endpoint throttling — V2 roadmap'              },
]

function statusConfig(s: RouteStatus) {
  if (s === 'live')    return { dot: 'bg-emerald-400', text: 'text-emerald-300', label: 'Live'    }
  if (s === 'pending') return { dot: 'bg-[#D4AF37]',   text: 'text-[#F8E7AE]',  label: 'Pending' }
  if (s === 'planned') return { dot: 'bg-sky-400',     text: 'text-sky-200',    label: 'Planned' }
  return                      { dot: 'bg-red-400',     text: 'text-red-300',    label: 'Down'    }
}

function StatusIcon({ s }: { s: RouteStatus }) {
  if (s === 'live')    return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
  if (s === 'pending') return <Clock className="h-3.5 w-3.5 text-[#D4AF37]" />
  if (s === 'planned') return <Clock className="h-3.5 w-3.5 text-sky-400" />
  return <AlertCircle className="h-3.5 w-3.5 text-red-400" />
}

export default async function PlatformManagerPage() {
  const snapshot = await getDashboardSnapshot()

  const liveRoutes   = ROUTES.filter((r) => r.status === 'live').length
  const pendingRoutes = ROUTES.filter((r) => r.status === 'pending').length
  const liveInfra    = INFRA.filter((i) => i.status === 'live').length

  const pages = ROUTES.filter((r) => r.type === 'page')
  const apis  = ROUTES.filter((r) => r.type === 'api')
  const gates = ROUTES.filter((r) => r.type === 'layout')

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-10 sm:px-6 sm:pt-14">

      <Link
        href="/freehold-intelligence/apps"
        className="inline-flex items-center gap-1.5 text-[12px] text-white/40 transition hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All apps
      </Link>

      {/* Header */}
      <section className="mt-7">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
          <Globe className="h-3.5 w-3.5" /> Platform Manager
        </div>
        <h1 className="mt-4 text-[36px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[52px]">
          {liveRoutes} routes live.<br />
          <span className="text-white/35">{pendingRoutes} still pending.</span>
        </h1>
        <p className="mt-5 max-w-xl text-[16px] leading-[1.65] text-white/60">
          Production deployment health, route audit, and infrastructure status for the Freehold Intelligence control room.
        </p>
      </section>

      {/* DB stats */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Projects',    value: Number(snapshot.total_projects).toLocaleString(), color: 'text-white'       },
          { label: 'Areas',       value: snapshot.total_areas,                             color: 'text-white'       },
          { label: 'Developers',  value: snapshot.total_developers,                        color: 'text-white'       },
          { label: 'Audit events (24h)', value: snapshot.audit_events_24h,                color: 'text-[#D4AF37]'   },
        ].map((s) => (
          <div key={s.label} className="rounded-[18px] border border-white/[0.06] bg-[#0A0D10] p-4 text-center">
            <div className={`text-[24px] font-semibold leading-none ${s.color}`}>{s.value}</div>
            <div className="mt-1.5 text-[10px] text-white/35">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Infrastructure */}
      <section className="mt-12">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">Infrastructure</div>
        <h2 className="mt-1.5 text-lg font-semibold text-white">{liveInfra} of {INFRA.length} components live</h2>
        <div className="mt-4 space-y-2">
          {INFRA.map((item) => {
            const st = statusConfig(item.status)
            return (
              <div key={item.label} className="flex items-center justify-between gap-4 rounded-[18px] border border-white/[0.06] bg-[#0A0D10] p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Database className="h-4 w-4 shrink-0 text-white/30" />
                  <div className="min-w-0">
                    <div className="text-[14px] font-medium text-white/85">{item.label}</div>
                    <div className="text-[12px] text-white/40">{item.note}</div>
                  </div>
                </div>
                <span className={`flex shrink-0 items-center gap-1.5 text-[11px] font-medium ${st.text}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                  {st.label}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {/* Route table — pages */}
      <section className="mt-12">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">Route audit — pages</div>
        <h2 className="mt-1.5 text-lg font-semibold text-white">{pages.length} page routes</h2>
        <div className="mt-4 overflow-hidden rounded-[22px] border border-white/[0.06] bg-[#0A0D10]">
          <div className="divide-y divide-white/[0.04]">
            {pages.map((route) => {
              const st = statusConfig(route.status)
              return (
                <div key={route.path} className="flex items-center gap-4 px-5 py-3.5">
                  <StatusIcon s={route.status} />
                  <div className="min-w-0 flex-1">
                    <code className="text-[12px] font-mono text-white/70 truncate block">{route.path}</code>
                    <p className="mt-0.5 text-[11px] text-white/35 truncate">{route.note}</p>
                  </div>
                  <span className={`hidden shrink-0 text-[11px] font-medium sm:block ${st.text}`}>{st.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Route table — API */}
      <section className="mt-8">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">Route audit — API</div>
        <h2 className="mt-1.5 text-lg font-semibold text-white">{apis.length} API routes</h2>
        <div className="mt-4 overflow-hidden rounded-[22px] border border-white/[0.06] bg-[#0A0D10]">
          <div className="divide-y divide-white/[0.04]">
            {apis.map((route) => {
              const st = statusConfig(route.status)
              return (
                <div key={route.path} className="flex items-center gap-4 px-5 py-3.5">
                  <StatusIcon s={route.status} />
                  <div className="min-w-0 flex-1">
                    <code className="text-[12px] font-mono text-[#D4AF37]/70 truncate block">{route.path}</code>
                    <p className="mt-0.5 text-[11px] text-white/35">{route.note}</p>
                  </div>
                  <span className={`hidden shrink-0 text-[11px] font-medium sm:block ${st.text}`}>{st.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Gates */}
      <section className="mt-8">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">Security gates</div>
        <div className="mt-4 space-y-2">
          {gates.map((gate) => {
            const st = statusConfig(gate.status)
            return (
              <div key={gate.path} className="flex items-start gap-3 rounded-[18px] border border-[#D4AF37]/15 bg-[#D4AF37]/[0.03] p-4">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#D4AF37]" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-white">{gate.path}</div>
                  <p className="mt-0.5 text-[12px] text-white/50">{gate.note}</p>
                </div>
                <span className={`shrink-0 text-[11px] font-medium ${st.text}`}>{st.label}</span>
              </div>
            )
          })}
        </div>
        <Link
          href="/freehold-intelligence/security"
          className="mt-3 inline-flex items-center gap-1 text-[12px] text-[#D4AF37]/60 transition hover:text-[#D4AF37]"
        >
          Full security report <ArrowUpRight className="h-3 w-3" />
        </Link>
      </section>

      <section className="mt-12">
        <AiPrompt
          placeholder="Ask about routes, deployment, infrastructure…"
          suggestions={[
            'Which pages need auth middleware before wider exposure?',
            'What is the current deployment health status?',
            'Show all pending route items.',
            'How many API routes are live vs planned?',
          ]}
        />
      </section>

    </div>
  )
}
