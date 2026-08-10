'use client'

/**
 * THE FULFILMENT QUEUE — where a broker's ask becomes a manager's launch.
 *
 * Approve hands the request to the launcher prefilled (?request=<id>): the
 * launch then charges the REQUESTING broker's Assets and attributes the
 * campaign to them, and the request flips to launched with the campaign as
 * its receipt. Reject ends it; nothing was charged, so nothing refunds.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Inbox, ExternalLink } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { useSession } from '@/lib/freehold/use-session'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'

interface Req {
  id: string; brokerId: string; title: string; note: string | null
  projectName: string | null; dailyBudgetAed: number
  status: string; createdAt: string; campaignId: string | null
}

const TONE: Record<string, string> = {
  requested: 'border-amber-400/25 bg-amber-400/[0.07] text-amber-200',
  approved:  'border-sky-400/25 bg-sky-400/[0.07] text-sky-200',
  launched:  'border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-200',
  rejected:  'border-line bg-surface text-slate-500',
}

export default function CampaignRequestsQueue() {
  const t = useT()
  const { user } = useSession()
  const canManage = !!user && (MANAGEMENT_ROLES as readonly string[]).includes(user.role)
  const [requests, setRequests] = useState<Req[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')

  async function refresh() {
    try {
      const r = await fetch('/api/freehold/campaign-requests', { cache: 'no-store' })
      const d = await r.json().catch(() => ({}))
      if (Array.isArray(d?.requests)) setRequests(d.requests)
    } catch { /* keep last list */ } finally { setLoading(false) }
  }
  useEffect(() => { void refresh() }, [])

  async function decide(id: string, action: 'approve' | 'reject') {
    setBusyId(id); setError('')
    try {
      const res = await fetch('/api/freehold/campaign-requests', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d?.error || t('creq.q.failed')); return }
      void refresh()
    } catch { setError(t('creq.q.failed')) } finally { setBusyId('') }
  }

  const open = requests.filter((r) => r.status === 'requested' || r.status === 'approved')
  const closed = requests.filter((r) => r.status === 'launched' || r.status === 'rejected')

  if (loading) return <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-slate-500" /></div>

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <h1 className="flex items-center gap-2 text-[20px] font-semibold text-white">
          <Inbox className="h-5 w-5 text-gold" /> {t('creq.q.title')}
        </h1>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-500">{t('creq.q.sub')}</p>
      </div>

      {error && <p className="rounded-xl border border-rose-400/25 bg-rose-400/[0.06] px-4 py-2.5 text-[13px] text-rose-200">{error}</p>}

      {open.length === 0 && (
        <p className="rounded-[16px] border border-line bg-surface-2 px-4 py-6 text-center text-[13px] text-slate-500">{t('creq.q.empty')}</p>
      )}

      {open.map((r) => (
        <div key={r.id} className="rounded-[18px] border border-line bg-surface-2 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[15px] font-semibold text-white">{r.title}</div>
              <div className="mt-0.5 text-[12px] text-slate-500">
                {r.brokerId} · {r.projectName ? `${r.projectName} · ` : ''}AED {r.dailyBudgetAed}/d
              </div>
              {r.note && <p className="mt-2 text-[13px] leading-relaxed text-slate-400">“{r.note}”</p>}
            </div>
            <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium ${TONE[r.status]}`}>
              {t(`creq.status.${r.status}`)}
            </span>
          </div>
          {canManage && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {r.status === 'requested' && (
                <button type="button" onClick={() => void decide(r.id, 'approve')} disabled={busyId === r.id}
                  className="rounded-full bg-gold px-4 py-2 text-xs font-semibold text-ink transition hover:bg-gold-bright disabled:opacity-50">
                  {t('creq.q.approve')}
                </button>
              )}
              {r.status === 'approved' && (
                <Link href={`/freehold-intelligence/lead-machine/campaigns/new?request=${encodeURIComponent(r.id)}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-xs font-semibold text-ink transition hover:bg-gold-bright">
                  {t('creq.q.launch')} <ExternalLink className="h-3 w-3" />
                </Link>
              )}
              <button type="button" onClick={() => void decide(r.id, 'reject')} disabled={busyId === r.id}
                className="rounded-full border border-line px-4 py-2 text-xs text-slate-300 transition hover:text-rose-300 disabled:opacity-50">
                {t('creq.q.reject')}
              </button>
            </div>
          )}
        </div>
      ))}

      {closed.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-slate-500">{t('creq.q.done')}</h2>
          {closed.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-[14px] border border-line bg-surface-2 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-[14px] text-white">{r.title}</div>
                <div className="text-[11px] text-slate-500">{r.brokerId} · AED {r.dailyBudgetAed}/d</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {r.campaignId && (
                  <Link href={`/freehold-intelligence/ads-live/meta/${encodeURIComponent(r.campaignId)}`}
                    className="text-[11px] text-gold underline">{t('creq.q.viewCampaign')}</Link>
                )}
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${TONE[r.status]}`}>
                  {t(`creq.status.${r.status}`)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
