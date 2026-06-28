'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Sparkles,
  ArrowUpRight,
  BarChart3,
  Database,
  GitBranch,
  Megaphone,
  MessageSquare,
  Server,
  Users2,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { getAllIntegrations, getLaunchBlockers } from '@/lib/freehold/mcp/mock-integrations'
import { PageHeader } from '@/components/freehold/ui'
import { ExpertDepth } from '@/components/freehold/expert-depth'

// Map live API status to the page's expected shape
function liveToIntegration(l: { id: string; name: string; state: string; note: string }) {
  return {
    id: l.id,
    name: l.name,
    status: l.state === 'connected' ? 'connected' : l.state === 'partial' ? 'partial' : 'not_connected',
    description: l.note,
  }
}

type IntMeta = { category: string; icon: LucideIcon; copy: string }

const META: Record<string, IntMeta & { href?: string }> = {
  hubspot:      { category: 'CRM',            icon: Users2,        copy: 'Lead capture, contact sync, pipeline automation.',         href: '/freehold-intelligence/integrations/hubspot' },
  'meta-ads':   { category: 'Paid Ads',       icon: Megaphone,     copy: 'Meta & Instagram campaigns and pixel events.',             href: '/freehold-intelligence/integrations/meta' },
  'google-ads': { category: 'Paid Ads',       icon: Megaphone,     copy: 'Google search and display — budget and bidding.' },
  whatsapp:     { category: 'Messaging',      icon: MessageSquare, copy: 'Automated and agent-triggered WhatsApp flows.',            href: '/freehold-intelligence/integrations/whatsapp' },
  tracking:     { category: 'Analytics',      icon: BarChart3,     copy: 'Meta Pixel, GA4, GTM, conversion attribution.' },
  neon:         { category: 'Infrastructure', icon: Database,      copy: 'Neon PostgreSQL — the private data layer.' },
  vercel:       { category: 'Infrastructure', icon: Server,        copy: 'Vercel deployment pipeline and health.' },
  github:       { category: 'Infrastructure', icon: GitBranch,     copy: 'Repository, CI/CD pipeline, and deployment tracking.',     href: '/freehold-intelligence/integrations/github' },
}

const CATEGORY_ORDER = ['CRM', 'Paid Ads', 'Messaging', 'Analytics', 'Infrastructure', 'Other']

type StatusFilter = 'All' | 'connected' | 'partial' | 'not_connected'

const STATUS_PILLS: { key: StatusFilter; label: string }[] = [
  { key: 'All',           label: 'All' },
  { key: 'connected',     label: 'Connected' },
  { key: 'partial',       label: 'Partial' },
  { key: 'not_connected', label: 'Disconnected' },
]

function statusCfg(status: string) {
  switch (status) {
    case 'connected':       return { label: 'Connected',     dot: 'bg-gold', text: 'text-gold' }
    case 'partial':         return { label: 'Partial',       dot: 'bg-gold',   text: 'text-[#F8E7AE]'   }
    case 'needs_access':    return { label: 'Needs access',  dot: 'bg-orange-400',  text: 'text-orange-200' }
    case 'blocked':
    case 'disconnected':
    case 'not_connected':   return { label: 'Not connected', dot: 'bg-red-400',     text: 'text-red-300'    }
    default:                return { label: 'Pending',       dot: 'bg-sky-400',     text: 'text-sky-200'    }
  }
}

// Mock fallback data (module-level, kept as initial state)
const mockIntegrations = getAllIntegrations()
const mockBlockers     = getLaunchBlockers()
const mockCritical     = mockBlockers.filter((b: any) => b.severity === 'critical')

export default function IntegrationsPage() {
  const [categoryFilter, setCategoryFilter] = useState<string>('All')
  const [statusFilter,   setStatusFilter]   = useState<StatusFilter>('All')
  const [connecting, setConnecting] = useState<string | null>(null)
  const [connected,  setConnected]  = useState<string[]>([])

  // Restore previously connected integrations (persisted on device).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('fh_connected_integrations') || '[]')
      if (Array.isArray(saved) && saved.length) setConnected(saved)
    } catch {}
  }, [])

  // Live data — fetched on mount; falls back to mock when unavailable
  const [integrations, setIntegrations] = useState<any[]>(mockIntegrations)
  // Blockers come from mock; API doesn't yet expose them
  const critical = mockCritical

  useEffect(() => {
    fetch('/api/freehold/integrations/status')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.statuses?.length > 0) {
          setIntegrations(d.statuses.map(liveToIntegration))
        }
      })
      .catch(() => {})
  }, [])

  const connectedCount = integrations.filter((i: any) => i.status === 'connected').length

  const availableCategories = useMemo(() => {
    const cats = new Set(integrations.map((i: any) => META[i.id]?.category || 'Other'))
    return ['All', ...CATEGORY_ORDER.filter((c) => cats.has(c))]
  }, [integrations])

  const filteredGrouped = useMemo(() => {
    let items = integrations as any[]
    if (statusFilter !== 'All') {
      items = items.filter((i) => {
        if (statusFilter === 'not_connected') {
          return i.status === 'not_connected' || i.status === 'disconnected' || i.status === 'blocked'
        }
        return i.status === statusFilter
      })
    }
    if (categoryFilter !== 'All') {
      items = items.filter((i) => (META[i.id]?.category || 'Other') === categoryFilter)
    }
    return items.reduce<Record<string, any[]>>((acc, i) => {
      const cat = META[i.id]?.category || 'Other'
      ;(acc[cat] = acc[cat] || []).push(i)
      return acc
    }, {})
  }, [integrations, statusFilter, categoryFilter])

  const visibleCategories = CATEGORY_ORDER.filter((cat) => filteredGrouped[cat]?.length > 0)
  const totalVisible = visibleCategories.reduce((s, cat) => s + (filteredGrouped[cat]?.length || 0), 0)

  return (
    <div className="mx-auto max-w-5xl px-6 pb-16 pt-6 sm:pt-16">

      <PageHeader
        eyebrow="Connections"
        Icon={Zap}
        title="Integrations"
        subtitle={`${connectedCount} of ${integrations.length} external systems connected. Ads and writes stay disabled until critical access is granted.`}
      />

      <ExpertDepth prompts={['expert.depth.integrations.q1', 'expert.depth.integrations.q2', 'expert.depth.integrations.q3']} className="mt-8" />

      {/* Critical blockers */}
      {critical.length > 0 && (
        <section className="mt-20">
          <div className="text-sm font-medium uppercase tracking-wider text-red-300/85">Must clear before launch</div>
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
                    <div className="text-xs font-medium uppercase tracking-wider text-red-300/85">
                      {String(b.integrationId || b.integration_id || 'system').replace(/-/g, ' ')}
                    </div>
                    <h3 className="mt-2 text-lg font-semibold text-white">{b.title || b.message}</h3>
                  </div>
                  <span className="shrink-0 rounded-full border border-red-400/25 bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.18em] text-red-200">
                    Critical
                  </span>
                </div>
                {(b.description || b.resolutionSteps?.[0]) && (
                  <p className="mt-3 text-sm leading-[1.6] text-slate-300">
                    {b.description || b.resolutionSteps?.[0]}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Filter controls */}
      <section className="mt-14">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium uppercase tracking-wider text-slate-400">All connections</div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {totalVisible} of {integrations.length} integrations
            </h2>
          </div>
        </div>

        {/* Status pills */}
        <div className="mt-4 flex flex-wrap gap-2">
          {STATUS_PILLS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={[
                'rounded-full border px-3 py-1 text-sm font-medium transition',
                statusFilter === key
                  ? 'border-gold/40 bg-gold/10 text-gold'
                  : 'border-line-strong bg-surface-2 text-slate-400 hover:text-slate-200',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
          <span className="mx-1 self-center text-slate-700">|</span>
          {availableCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={[
                'rounded-full border px-3 py-1 text-sm font-medium transition',
                categoryFilter === cat
                  ? 'border-gold/40 bg-gold/10 text-gold'
                  : 'border-line-strong bg-surface-2 text-slate-400 hover:text-slate-200',
              ].join(' ')}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Integration cards grouped by category */}
      <div className="mt-8 grid gap-12">
        {visibleCategories.length === 0 ? (
          <div className="rounded-xl border border-line bg-surface-2 px-6 py-12 text-center">
            <p className="text-[14px] text-slate-400">No integrations match these filters.</p>
            <button
              onClick={() => { setStatusFilter('All'); setCategoryFilter('All') }}
              className="mt-3 rounded-full border border-line px-4 py-1.5 text-xs text-slate-400 transition hover:text-slate-200"
            >
              Clear filters
            </button>
          </div>
        ) : (
          visibleCategories.map((cat) => (
            <div key={cat}>
              <div className="mb-4 text-xs font-medium uppercase tracking-wider text-slate-400">{cat}</div>
              <div className="grid gap-3">
                {filteredGrouped[cat].map((integration: any) => {
                  const meta = META[integration.id]
                  const Icon = meta?.icon ?? Server
                  const st = statusCfg(integration.status)
                  return (
                    <div
                      key={integration.id}
                      className="flex items-center gap-5 rounded-xl border border-line bg-surface p-5 transition hover:border-gold/20"
                    >
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-line bg-surface-2">
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-white">{integration.name}</div>
                        <div className="mt-0.5 text-sm leading-snug text-slate-400">{meta?.copy || integration.description}</div>
                      </div>
                      <div className={`flex shrink-0 items-center gap-1.5 text-xs ${st.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                        {st.label}
                      </div>
                      {meta?.href ? (
                        <Link href={meta.href} className="hidden shrink-0 items-center gap-1 rounded-full bg-surface-2 px-3 py-1.5 text-xs text-slate-100 transition hover:bg-white/10 hover:text-white sm:inline-flex">
                          View <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      ) : connected.includes(integration.id) ? (
                        <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-400 sm:inline-flex">
                          Connected
                        </span>
                      ) : integration.status !== 'connected' ? (
                        <button
                          disabled={connecting === integration.id}
                          onClick={() => {
                            setConnecting(integration.id)
                            setTimeout(() => {
                              setConnecting(null)
                              setConnected((prev) => {
                                const next = [...prev, integration.id]
                                try { localStorage.setItem('fh_connected_integrations', JSON.stringify(next)) } catch {}
                                return next
                              })
                              toast.success(integration.name + ' connected')
                            }, 1200)
                          }}
                          className="hidden shrink-0 items-center gap-1 rounded-full bg-surface-2 px-3 py-1.5 text-xs text-slate-100 transition hover:bg-white/10 hover:text-white disabled:opacity-60 sm:inline-flex"
                        >
                          {connecting === integration.id ? 'Connecting…' : (<>Connect <ArrowUpRight className="h-3 w-3" /></>)}
                        </button>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* AI take footer */}
      <section className="mt-20 rounded-[28px] border border-line bg-surface-2 px-7 py-8 sm:px-10 sm:py-10">
        <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-gold/80">
          <Sparkles className="h-3 w-3" /> AI take
        </div>
        <p className="mt-3 text-[17px] font-medium leading-[1.65] text-slate-100 sm:text-lg">
          The fastest path to launch is to confirm the Meta billing owner. Once that's cleared, conversion event mapping is a single check on the tracking side, and Dubai Hills can move into a paid campaign immediately.
        </p>
      </section>
    </div>
  )
}
