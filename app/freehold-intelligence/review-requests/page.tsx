'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckSquare, Handshake, FileText, ArrowUpRight, Loader2, CheckCircle2 } from 'lucide-react'
import { useSessionGuard } from '@/lib/freehold/use-session'
import { PageHeader, StatCard, Panel } from '@/components/freehold/ui'
import { useT } from '@/lib/i18n/provider'

// The approvals inbox — REAL queues only: deals waiting for management
// approval and ad requests waiting to become campaigns. Approving happens on
// the owning page (deals / campaigns); this is the one place to see what waits.

interface PendingDeal {
  id: string
  projectName?: string | null
  agentName?: string | null
  priceAed?: number | null
}

interface AdRequestRow {
  id: string
  project_slug: string
  platform: string | null
  status: string | null
  created_at: string
}

const MGMT = ['admin', 'ceo', 'director', 'sales_manager'] as const

export default function ReviewRequestsPage() {
  const t = useT()
  const { ready } = useSessionGuard([...MGMT, 'marketing'])
  const [deals, setDeals] = useState<PendingDeal[]>([])
  const [adRequests, setAdRequests] = useState<AdRequestRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    Promise.all([
      fetch('/api/freehold/deals?status=pending_step2', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch('/api/freehold/lead-machine/ad-requests', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([d, a]) => {
      if (cancelled) return
      if (Array.isArray(d?.deals)) setDeals(d.deals)
      if (Array.isArray(a?.adRequests)) setAdRequests(a.adRequests.filter((r: AdRequestRow) => !/launch|live|reject/i.test(r.status ?? '')))
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [ready])

  if (!ready) return null

  const total = deals.length + adRequests.length

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
      <PageHeader
        eyebrow={t('previews.eyebrow')}
        Icon={CheckSquare}
        title={t('previews.title')}
        subtitle={t('previews.subtitle')}
      />

      <div className="mt-6 grid grid-cols-2 gap-3">
        <StatCard label={t('previews.stat.deals')} value={deals.length} hint={t('previews.stat.dealsHint')} />
        <StatCard label={t('previews.stat.adRequests')} value={adRequests.length} hint={t('previews.stat.adRequestsHint')} />
      </div>

      {loading ? (
        <div className="mt-8 flex items-center gap-2 rounded-2xl border border-line bg-surface px-5 py-6 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> {t('common.loading')}
        </div>
      ) : total === 0 ? (
        <div className="mt-8 rounded-2xl border border-gold/20 bg-gold/[0.04] px-6 py-10 text-center">
          <CheckCircle2 className="mx-auto h-7 w-7 text-gold" />
          <p className="mt-3 text-sm font-medium text-slate-200">{t('previews.allClear')}</p>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {deals.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <Handshake className="h-4 w-4" /> {t('previews.sec.deals')}
              </h2>
              <Panel>
                <div className="divide-y divide-line">
                  {deals.map((d) => (
                    <div key={d.id} className="flex items-center gap-4 px-6 py-4">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-white">{d.projectName || d.id}</div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {d.agentName || '—'}{d.priceAed ? ` · AED ${Number(d.priceAed).toLocaleString()}` : ''}
                        </div>
                      </div>
                      <Link href="/freehold-intelligence/management/deals" className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gold px-3.5 py-1.5 text-xs font-semibold text-ink transition hover:opacity-90">
                        {t('previews.review')} <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </div>
                  ))}
                </div>
              </Panel>
            </section>
          )}

          {adRequests.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <FileText className="h-4 w-4" /> {t('previews.sec.adRequests')}
              </h2>
              <Panel>
                <div className="divide-y divide-line">
                  {adRequests.map((r) => (
                    <div key={r.id} className="flex items-center gap-4 px-6 py-4">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-white">{r.project_slug}</div>
                        <div className="mt-0.5 text-xs text-slate-500">{r.platform || 'Meta'} · {r.status ?? 'Draft'}</div>
                      </div>
                      <Link
                        href={`/freehold-intelligence/lead-machine/campaigns/new?project=${encodeURIComponent(r.project_slug)}`}
                        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line-strong bg-surface-2 px-3.5 py-1.5 text-xs font-medium text-slate-200 transition hover:border-gold/40 hover:text-white"
                      >
                        {t('previews.build')} <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </div>
                  ))}
                </div>
              </Panel>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
