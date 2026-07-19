'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Zap, TrendingDown, TrendingUp, PlugZap, ArrowUpRight, Loader2 } from 'lucide-react'
import { EmptyState } from '@/components/freehold/ui'
import { useT } from '@/lib/i18n/provider'
import { metaLeadCount } from '@/lib/meta/lead-count'

// Campaign optimizer — ranks the REAL campaigns by cost-per-lead and points
// budget from the least efficient to the most efficient. No seed budgets,
// no invented projections.

interface LiveCampaign {
  id: string
  name: string
  platform: 'meta' | 'google'
  running: boolean
  spendAED: number
  leads: number
  cpl: number
}

const metaLeads = (insights?: { actions?: Array<{ action_type: string; value: string }> } | null) =>
  metaLeadCount(insights?.actions)

export default function CampaignOptimizePage() {
  const t = useT()
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const [campaigns, setCampaigns] = useState<LiveCampaign[]>([])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/api/meta/campaigns', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/google/campaigns', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([meta, google]) => {
      if (cancelled) return
      const rows: LiveCampaign[] = []
      if (meta && !meta.demo) {
        for (const c of meta.campaigns ?? []) {
          const spend = Number(c?.insights?.spend) || 0
          const leads = metaLeads(c?.insights)
          rows.push({ id: c.id, name: c.name, platform: 'meta', running: c.status === 'ACTIVE', spendAED: spend, leads, cpl: leads > 0 ? spend / leads : 0 })
        }
      }
      if (google && !google.demo) {
        for (const c of google.campaigns ?? []) {
          const spend = Number(c?.metrics?.costAed ?? c?.metrics?.cost) || 0
          const leads = Number(c?.metrics?.conversions ?? c?.metrics?.leads) || 0
          rows.push({ id: c.id, name: c.name, platform: 'google', running: /enabled|active|running/i.test(String(c.status ?? '')), spendAED: spend, leads, cpl: leads > 0 ? spend / leads : 0 })
        }
      }
      setConnected(Boolean((meta && !meta.demo) || (google && !google.demo)))
      setCampaigns(rows)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  const ranked = useMemo(
    () => [...campaigns].filter((c) => c.cpl > 0).sort((a, b) => a.cpl - b.cpl),
    [campaigns],
  )
  const best = ranked[0]
  const worst = ranked.length > 1 ? ranked[ranked.length - 1] : undefined

  if (!loading && !connected) {
    return (
      <div className="mx-auto max-w-4xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
        <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-gold/85">
          <Zap className="h-3.5 w-3.5" /> {t('lm.optimize.eyebrow')}
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white">{t('lm.optimize.title')}</h1>
        <div className="mt-8">
          <EmptyState
            Icon={PlugZap}
            title={t('lm.live.connect.title')}
            description={t('lm.live.connect.desc')}
            action={
              <Link href="/freehold-intelligence/integrations" className="inline-flex items-center gap-2 rounded-xl border border-gold/35 bg-gold/10 px-4 py-2.5 text-sm font-semibold text-gold transition hover:bg-gold/20">
                {t('lm.live.connect.cta')} <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
      <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-gold/85">
        <Zap className="h-3.5 w-3.5" /> {t('lm.optimize.eyebrow')}
      </div>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white">{t('lm.optimize.title')}</h1>

      {loading ? (
        <div className="mt-8 flex items-center gap-2 rounded-2xl border border-line bg-surface px-5 py-6 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> {t('common.loading')}
        </div>
      ) : ranked.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-line bg-surface px-6 py-10 text-center">
          <p className="text-sm text-slate-400">{t('lm.optimize.noData')}</p>
          <Link href="/freehold-intelligence/lead-machine/campaigns/new" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-gold hover:opacity-80">
            {t('lm.live.empty.cta')} <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <>
          {/* Recommendation — from the real spread, only when there IS one */}
          {best && worst && best.id !== worst.id && (
            <div className="mt-8 rounded-2xl border border-gold/20 bg-gold/[0.04] p-5">
              <div className="text-xs font-semibold uppercase tracking-wider text-gold">{t('lm.optimize.aiRecommendations')}</div>
              <p className="mt-2 text-sm leading-relaxed text-slate-200">
                {t('lm.optimize.shiftReco', {
                  from: worst.name,
                  fromCpl: worst.cpl.toFixed(0),
                  to: best.name,
                  toCpl: best.cpl.toFixed(0),
                })}
              </p>
            </div>
          )}

          {/* Efficiency ranking */}
          <section className="mt-8">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{t('lm.optimize.efficiencyRank')}</h2>
            <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {ranked.map((c, i) => (
                <div key={c.id} className="flex items-center gap-4 px-5 py-4">
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${i === 0 ? 'bg-gold/15 text-gold' : 'bg-surface-2 text-slate-400'}`}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-white">{c.name}</div>
                    <div className="mt-0.5 text-xs text-slate-500 capitalize">{t('lm.optimize.rowMeta', { platform: c.platform, n: c.leads, spend: c.spendAED.toLocaleString() })}</div>
                  </div>
                  <div className={`flex shrink-0 items-center gap-1 text-sm font-semibold ${i === 0 ? 'text-emerald-400' : i === ranked.length - 1 ? 'text-red-300' : 'text-slate-300'}`}>
                    {i === 0 ? <TrendingDown className="h-3.5 w-3.5" /> : i === ranked.length - 1 ? <TrendingUp className="h-3.5 w-3.5" /> : null}
                    AED {c.cpl.toFixed(0)}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/freehold-intelligence/lead-machine/campaigns/attribution" className="inline-flex items-center gap-1 text-sm text-gold/70 transition hover:text-gold">
              {t('lm.optimize.fullAttribution')} <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
