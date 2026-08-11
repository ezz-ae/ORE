'use client'

/**
 * LIVE CAMPAIGNS — the first thing an ads page owes its operator.
 *
 * Not a link to a list: the actual state of the money, on the home screen.
 * Each row says what Meta is DOING (its delivery state, not the status we
 * asked for), what it has spent, what it brought back, and what that cost.
 *
 * Numbers arrive from the campaigns endpoint that already exists; nothing is
 * computed here that the campaign page would compute differently — a home
 * widget that disagrees with the detail screen is worse than no widget.
 *
 * THAT SENTENCE WAS FALSE FOR A WHILE, and the screen showed it: this widget
 * read one campaign at AED 204 and one lead while the campaign page read
 * AED 501 and two, and every paused campaign below it printed zeros. Neither
 * screen was computing anything wrong — the ENDPOINT was answering a different
 * question (rolling 30 days, ACTIVE campaigns only) than the detail page asks.
 * Fixed at the source: /api/meta/campaigns now returns the lifetime window for
 * every campaign, which is what a report owes and what `headlineInsights`
 * names. A comment claiming agreement is not agreement; the shared function is.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Radio, ArrowUpRight } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { deliveryOf } from '@/lib/meta/delivery-status'
import { metaLeadCount } from '@/lib/meta/lead-count'
import type { MetaInsights } from '@/lib/meta/types'

interface Row {
  id: string
  name: string
  status?: string
  effective_status?: string
  daily_budget?: string
  insights?: MetaInsights | null
}

const aed = (n: number) => `AED ${Math.round(n).toLocaleString()}`

export default function LiveCampaignsWidget() {
  const t = useT()
  const [rows, setRows] = useState<Row[] | null>(null)

  useEffect(() => {
    fetch('/api/meta/campaigns', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setRows(Array.isArray(d?.campaigns) ? d.campaigns : []))
      .catch(() => setRows([]))
  }, [])

  if (rows === null) {
    return (
      <div className="flex min-h-[140px] items-center justify-center rounded-2xl border border-line bg-surface">
        <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
      </div>
    )
  }

  // Live first, then by spend — the ones costing money are the ones to read.
  const live = rows
    .filter((c) => String(c.status ?? '').toUpperCase() !== 'DELETED')
    .sort((a, b) => {
      const aLive = String(a.status ?? '').toUpperCase() === 'ACTIVE' ? 1 : 0
      const bLive = String(b.status ?? '').toUpperCase() === 'ACTIVE' ? 1 : 0
      if (aLive !== bLive) return bLive - aLive
      return (Number(b.insights?.spend) || 0) - (Number(a.insights?.spend) || 0)
    })
    .slice(0, 5)

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Radio className="h-4 w-4 text-gold" /> {t('lm.w.live.title')}
        </h2>
        <Link href="/freehold-intelligence/ads-live/meta" className="inline-flex items-center gap-1 text-[11px] text-gold/80 transition hover:text-gold">
          {t('lm.w.live.all')} <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      {live.length === 0 ? (
        <p className="mt-4 text-[13px] text-slate-500">{t('lm.w.live.empty')}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {live.map((c) => {
            const spend = Number(c.insights?.spend) || 0
            const leads = metaLeadCount(c.insights?.actions)
            const d = deliveryOf({ status: c.status, effectiveStatus: c.effective_status })
            const tone = d.tone === 'good' ? 'text-emerald-300' : d.tone === 'bad' ? 'text-rose-300'
              : d.tone === 'working' ? 'text-sky-300' : 'text-slate-500'
            return (
              <Link key={c.id} href={`/freehold-intelligence/ads-live/meta/${encodeURIComponent(c.id)}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 transition hover:border-gold/25">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-white">{c.name}</div>
                  <div className={`text-[11px] ${tone}`}>{t(`lm.delivery.${d.state}`)}</div>
                </div>
                <div className="flex shrink-0 items-center gap-4 text-end">
                  <div>
                    <div className="text-[13px] font-semibold tabular-nums text-white">{aed(spend)}</div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500">{t('lm.w.live.spend')}</div>
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold tabular-nums text-gold">{leads}</div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500">{t('lm.w.live.leads')}</div>
                  </div>
                  {/* Cost per lead only where both halves are real — a CPL from
                      zero leads is a division by nothing dressed as a metric. */}
                  {leads > 0 && spend > 0 && (
                    <div>
                      <div className="text-[13px] font-semibold tabular-nums text-white">{aed(spend / leads)}</div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500">{t('lm.w.live.cpl')}</div>
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
