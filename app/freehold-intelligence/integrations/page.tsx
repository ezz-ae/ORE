import {
  Sparkles,
  ArrowUpRight,
  BarChart3,
  Database,
  Megaphone,
  MessageSquare,
  Server,
  Users2,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { executeTool } from '@/lib/freehold/mcp/execute-tool'
import { getAllIntegrations, getLaunchBlockers } from '@/lib/freehold/mcp/mock-integrations'
import { AiPrompt } from '@/components/freehold/ai-prompt'

type IntMeta = { category: string; icon: LucideIcon; copy: string }

const META: Record<string, IntMeta> = {
  hubspot:      { category: 'CRM',            icon: Users2,        copy: 'Lead capture, contact sync, pipeline automation.' },
  'meta-ads':   { category: 'Paid Ads',       icon: Megaphone,     copy: 'Meta & Instagram campaigns and pixel events.' },
  'google-ads': { category: 'Paid Ads',       icon: Megaphone,     copy: 'Google search and display — budget and bidding.' },
  whatsapp:     { category: 'Messaging',      icon: MessageSquare, copy: 'Automated and agent-triggered WhatsApp flows.' },
  tracking:     { category: 'Analytics',      icon: BarChart3,     copy: 'Meta Pixel, GA4, GTM, conversion attribution.' },
  neon:         { category: 'Infrastructure', icon: Database,      copy: 'Neon PostgreSQL — the private data layer.' },
  vercel:       { category: 'Infrastructure', icon: Server,        copy: 'Vercel deployment pipeline and health.' },
}

function statusCfg(status: string) {
  switch (status) {
    case 'connected':       return { label: 'Connected',     dot: 'bg-emerald-400', text: 'text-emerald-300' }
    case 'partial':         return { label: 'Partial',       dot: 'bg-[#D4AF37]',   text: 'text-[#F8E7AE]'   }
    case 'needs_access':    return { label: 'Needs access',  dot: 'bg-orange-400',  text: 'text-orange-200' }
    case 'blocked':
    case 'disconnected':
    case 'not_connected':   return { label: 'Not connected', dot: 'bg-red-400',     text: 'text-red-300'    }
    default:                return { label: 'Pending',       dot: 'bg-sky-400',     text: 'text-sky-200'    }
  }
}

export default async function IntegrationsPage() {
  const [intRes, blockRes] = await Promise.all([
    executeTool({ tool: 'integration_summary', role: 'owner' }),
    executeTool({ tool: 'launch_blockers', role: 'owner' }),
  ])

  const integrations: any[] = intRes.data?.integrations || getAllIntegrations()
  const blockers: any[] = blockRes.data?.blockers || getLaunchBlockers()
  const critical = blockers.filter((b) => b.severity === 'critical')
  const connectedCount = integrations.filter((i: any) => i.status === 'connected').length

  // Group by category
  const grouped = integrations.reduce<Record<string, any[]>>((acc, i) => {
    const cat = META[i.id]?.category || 'Other'
    ;(acc[cat] = acc[cat] || []).push(i)
    return acc
  }, {})
  const categoryOrder = ['CRM', 'Paid Ads', 'Messaging', 'Analytics', 'Infrastructure', 'Other']

  return (
    <div className="mx-auto max-w-3xl px-6 pb-32 pt-12 sm:pt-16">

      {/* Header */}
      <section>
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
          <Zap className="h-3.5 w-3.5" /> Connections
        </div>
        <h1 className="mt-5 text-[40px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[56px]">
          What's plugged in,
          <br />
          <span className="text-white/40">what isn't.</span>
        </h1>
        <p className="mt-7 max-w-2xl text-[18px] leading-[1.6] text-white/65">
          <span className="text-white">{connectedCount} of {integrations.length}</span> external systems are connected. Ads and external writes stay disabled until critical access is granted.
        </p>
      </section>

      {/* AI prompt */}
      <section className="mt-12">
        <AiPrompt
          placeholder="Ask about connections, access, billing…"
          suggestions={[
            'What is blocking Meta launch?',
            'Show all integration blockers.',
            'How do I connect HubSpot?',
            'Which systems are healthy?',
          ]}
        />
      </section>

      {/* Critical blockers */}
      {critical.length > 0 && (
        <section className="mt-20">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-red-300/85">Must clear before launch</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
            {critical.length} {critical.length === 1 ? 'thing is' : 'things are'} holding back the server
          </h2>
          <div className="mt-7 grid gap-4">
            {critical.map((b: any) => (
              <div
                key={b.id}
                className="rounded-[24px] border border-red-400/15 bg-red-500/[0.04] p-6 sm:p-7"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-red-300/85">
                      {String(b.integrationId || b.integration_id || 'system').replace(/-/g, ' ')}
                    </div>
                    <h3 className="mt-2 text-lg font-semibold text-white">{b.title || b.message}</h3>
                  </div>
                  <span className="shrink-0 rounded-full border border-red-400/25 bg-red-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-red-200">
                    Critical
                  </span>
                </div>
                {(b.description || b.resolutionSteps?.[0]) && (
                  <p className="mt-3 text-[15px] leading-[1.6] text-white/65">
                    {b.description || b.resolutionSteps?.[0]}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Integrations grouped */}
      <section className="mt-20">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">All connections</div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">By category</h2>

        <div className="mt-8 grid gap-12">
          {categoryOrder
            .filter((cat) => grouped[cat])
            .map((cat) => (
              <div key={cat}>
                <div className="mb-4 text-[10px] font-medium uppercase tracking-[0.22em] text-white/35">{cat}</div>
                <div className="grid gap-3">
                  {grouped[cat].map((integration: any) => {
                    const meta = META[integration.id]
                    const Icon = meta?.icon ?? Server
                    const st = statusCfg(integration.status)
                    return (
                      <div
                        key={integration.id}
                        className="flex items-center gap-5 rounded-2xl border border-white/[0.06] bg-[#0A0D10] p-5 transition hover:border-[#D4AF37]/20"
                      >
                        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.03]">
                          <Icon className="h-5 w-5 text-white/90" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[15px] font-semibold text-white">{integration.name}</div>
                          <div className="mt-0.5 text-[13px] leading-snug text-white/50">{meta?.copy || integration.description}</div>
                        </div>
                        <div className={`flex shrink-0 items-center gap-1.5 text-[12px] ${st.text}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                          {st.label}
                        </div>
                        {integration.status !== 'connected' && (
                          <button className="hidden shrink-0 items-center gap-1 rounded-full bg-white/[0.04] px-3 py-1.5 text-[12px] text-white/80 transition hover:bg-white/10 hover:text-white sm:inline-flex">
                            Connect <ArrowUpRight className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
        </div>
      </section>

      {/* AI take footer */}
      <section className="mt-20 rounded-[28px] border border-white/[0.06] bg-white/[0.02] px-7 py-8 sm:px-10 sm:py-10">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/80">
          <Sparkles className="h-3 w-3" /> AI take
        </div>
        <p className="mt-3 text-[17px] font-medium leading-[1.65] text-white/85 sm:text-lg">
          The fastest path to launch is to confirm the Meta billing owner. Once that's cleared, conversion event mapping is a single check on the tracking side, and Dubai Hills can move into a paid campaign immediately.
        </p>
      </section>
    </div>
  )
}
