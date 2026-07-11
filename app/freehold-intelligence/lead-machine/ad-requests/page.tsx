'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FileText, Plus, ArrowUpRight, Loader2 } from 'lucide-react'
import { PageHeader, StatCard, Panel, buttonClass } from '@/components/freehold/ui'
import { useT } from '@/lib/i18n/provider'

// Ad requests — the REAL queue (freehold_site_ad_requests). Each row is a
// campaign brief someone filed; nothing here is sample data.

interface AdRequestRow {
  id: string
  project_slug: string
  platform: string | null
  status: string | null
  created_at: string
}

function statusTone(status: string) {
  const s = status.toLowerCase()
  if (s.includes('launch') || s.includes('live') || s.includes('approved')) return 'border-gold/20 bg-gold/10 text-gold'
  if (s.includes('reject') || s.includes('block')) return 'border-red-400/20 bg-red-400/10 text-red-300'
  return 'border-line-strong bg-surface-2 text-slate-300'
}

export default function AdRequestsPage() {
  const t = useT()
  const [rows, setRows] = useState<AdRequestRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/freehold/lead-machine/ad-requests', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && Array.isArray(d?.adRequests)) setRows(d.adRequests) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const open = rows.filter((r) => !/launch|live|reject/i.test(r.status ?? '')).length

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
      <PageHeader
        eyebrow={t('lm.hub.eyebrow')}
        Icon={FileText}
        title={t('lm.adreq.title')}
        subtitle={t('lm.adreq.subtitle')}
        actions={
          <Link href="/freehold-intelligence/lead-machine/campaigns/new" className={buttonClass('primary', 'md')}>
            <Plus className="h-3.5 w-3.5" /> {t('lm.adreq.newCampaign')}
          </Link>
        }
      />

      <div className="mt-6 grid grid-cols-2 gap-3">
        <StatCard label={t('lm.adreq.stat.total')} value={rows.length} hint={t('lm.adreq.stat.allTime')} />
        <StatCard label={t('lm.adreq.stat.open')} value={open} hint={t('lm.adreq.stat.inQueue')} />
      </div>

      <div className="mt-8">
        {loading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-5 py-6 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> {t('common.loading')}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface px-6 py-10 text-center">
            <FileText className="mx-auto h-6 w-6 text-slate-500" />
            <p className="mt-3 text-sm text-slate-400">{t('lm.adreq.empty')}</p>
            <Link href="/freehold-intelligence/lead-machine/campaigns/new" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-gold hover:opacity-80">
              {t('lm.adreq.newCampaign')} <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <Panel>
            <div className="divide-y divide-line">
              {rows.map((r) => (
                <div key={r.id} className="flex items-center gap-4 px-6 py-4">
                  <div className="min-w-0 flex-1">
                    <Link href={`/freehold-intelligence/inventory/${r.project_slug}`} className="truncate text-sm font-semibold text-white transition hover:text-gold">
                      {r.project_slug}
                    </Link>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {(r.platform || 'Meta')} · {new Date(r.created_at).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', timeZone: 'Asia/Dubai' })}
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusTone(r.status ?? 'draft')}`}>
                    {r.status ?? t('lm.adreq.statusDraft')}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        )}
      </div>
    </div>
  )
}
