'use client'

// Landing edit-requests inbox. Approvers (the non-broker accounts Cor/Bashar/
// Yamen) see the queue of broker-proposed edits and Preview → Publish / Send
// back. A broker instead sees their own requests and where each one stands.

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Eye, CheckCircle2, RotateCcw, Loader2, Inbox } from 'lucide-react'
import { toast } from 'sonner'
import { useT } from '@/lib/i18n/provider'

type Req = {
  id: string
  landingSlug: string
  projectSlug: string | null
  landingHeadline: string | null
  requestedBy: string
  requestedByName: string | null
  status: 'draft' | 'pending' | 'approved' | 'rejected'
  note: string | null
  reviewNote: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  updatedAt: string
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  approved: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  rejected: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  draft: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
}

export default function LandingEditRequestsPage() {
  const t = useT()
  const [reqs, setReqs] = useState<Req[]>([])
  const [canApprove, setCanApprove] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/freehold/landing-edits', { cache: 'no-store' })
      const d = await res.json()
      if (res.ok) { setReqs(Array.isArray(d.requests) ? d.requests : []); setCanApprove(!!d.canApprove) }
    } catch { /* leave empty */ }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  async function act(id: string, action: 'approve' | 'reject', note?: string) {
    setBusy(id)
    try {
      const res = await fetch(`/api/freehold/landing-edits/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(d.error || t('lpe.saveFailed')); return }
      toast.success(action === 'approve' ? t('lper.publishedToast') : t('lper.sentBackToast'))
      await load()
    } catch { toast.error(t('lpe.saveFailed')) }
    finally { setBusy(null) }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-6 sm:px-6">
      <Link href="/freehold-intelligence/lead-machine/landings" className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> {t('lpe.backToLandings')}
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-white">{canApprove ? t('lper.title') : t('lper.mineTitle')}</h1>
      <p className="mt-0.5 text-sm text-slate-500">{canApprove ? t('lper.subtitle') : t('lper.mineSubtitle')}</p>

      {loading ? (
        <div className="mt-8 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> {t('common.loading')}</div>
      ) : reqs.length === 0 ? (
        <div className="mt-12 flex flex-col items-center gap-2 text-center text-sm text-slate-500">
          <Inbox className="h-8 w-8 text-slate-600" />
          {canApprove ? t('lper.empty') : t('lper.emptyBroker')}
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {reqs.map((r) => (
            <li key={r.id} className="rounded-2xl border border-line bg-surface p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-semibold text-white">{r.landingHeadline || r.landingSlug}</span>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[r.status] ?? STATUS_STYLE.draft}`}>
                    {t(`lper.status.${r.status}`)}
                  </span>
                </div>
                <p className="mt-0.5 font-mono text-[11px] text-slate-500">/lp/{r.landingSlug}</p>
                <p className="mt-1 text-[12px] text-slate-400">{t('lper.by', { name: r.requestedByName || r.requestedBy })}</p>
                {r.note && <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-slate-300">{r.note}</p>}
                {r.reviewNote && <p className="mt-2 text-[12px] text-rose-300">{t('lper.reviewNote')}: {r.reviewNote}</p>}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <a href={`/lp/${r.landingSlug}?editRequest=${r.id}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:text-white">
                  <Eye className="h-3.5 w-3.5" /> {t('lper.preview')}
                </a>
                {canApprove && r.status === 'pending' && (
                  <>
                    <button type="button" disabled={busy === r.id} onClick={() => act(r.id, 'approve')}
                      className="inline-flex items-center gap-1.5 rounded-full bg-gold px-3.5 py-1.5 text-[11px] font-semibold text-ink transition hover:bg-[#F8E7AE] disabled:opacity-60">
                      {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} {t('lper.publish')}
                    </button>
                    <button type="button" disabled={busy === r.id}
                      onClick={() => { const note = window.prompt(t('lper.sendBackPrompt')); if (note !== null) act(r.id, 'reject', note) }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3.5 py-1.5 text-[11px] font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-60">
                      <RotateCcw className="h-3.5 w-3.5" /> {t('lper.sendBack')}
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
