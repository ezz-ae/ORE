'use client'

/**
 * A BROKER ASKS FOR A CAMPAIGN — and never needs the ads tools.
 *
 * The INBOUND deal: the broker states WHAT (project, budget in Assets, what
 * they want said), the system does the HOW. The request is priced in Assets
 * up front — 1 Asset funds AED 10 of daily spend — and nothing is charged
 * until the campaign actually launches, through the same ledger every launch
 * uses. A rejected request costs nothing because it moved nothing.
 */
import { useEffect, useState } from 'react'
import { Loader2, Megaphone, Coins } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

interface Listing { id: string; projectName: string }
interface Req {
  id: string; title: string; projectName: string | null; dailyBudgetAed: number
  status: string; createdAt: string; campaignId: string | null
}

const STATUS_TONE: Record<string, string> = {
  requested: 'border-amber-400/25 bg-amber-400/[0.07] text-amber-200',
  approved:  'border-sky-400/25 bg-sky-400/[0.07] text-sky-200',
  launched:  'border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-200',
  rejected:  'border-line bg-surface text-slate-500',
}

export default function RequestCampaignPage() {
  const t = useT()
  const [listings, setListings] = useState<Listing[]>([])
  const [requests, setRequests] = useState<Req[]>([])
  const [balance, setBalance] = useState<number | null>(null)
  const [title, setTitle] = useState('')
  const [projectId, setProjectId] = useState('')
  const [budget, setBudget] = useState(100)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    fetch('/api/freehold/inventory', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const items = Array.isArray(d?.properties) ? d.properties : Array.isArray(d) ? d : []
        setListings(items.map((x: { id?: string; slug?: string; projectName?: string; name?: string }) => ({
          id: String(x.id ?? x.slug ?? ''), projectName: String(x.projectName ?? x.name ?? ''),
        })).filter((x: Listing) => x.id && x.projectName))
      })
      .catch(() => {})
    fetch('/api/freehold/credits/balance', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (typeof d?.balance === 'number') setBalance(d.balance) })
      .catch(() => {})
    void refresh()
  }, [])

  async function refresh() {
    try {
      const r = await fetch('/api/freehold/campaign-requests', { cache: 'no-store' })
      const d = await r.json().catch(() => ({}))
      if (Array.isArray(d?.requests)) setRequests(d.requests)
    } catch { /* list stays stale */ }
  }

  // 1 Asset funds AED 10/day of ad spend — the same rate the launch charges.
  const assetsNeeded = Math.ceil(Math.max(0, budget) / 10)

  async function submit() {
    if (busy) return
    setBusy(true); setError(''); setDone(false)
    try {
      const listing = listings.find((l) => l.id === projectId)
      const res = await fetch('/api/freehold/campaign-requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          projectSlug: projectId || undefined,
          projectName: listing?.projectName,
          dailyBudgetAed: budget,
          note: note.trim() || undefined,
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(d?.error === 'insufficient_assets'
          ? t('creq.insufficient', { required: d.required ?? 0, balance: d.balance ?? 0 })
          : (d?.error || t('creq.failed')))
        return
      }
      setDone(true); setTitle(''); setNote('')
      void refresh()
    } catch { setError(t('creq.failed')) } finally { setBusy(false) }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <h1 className="flex items-center gap-2 text-[20px] font-semibold text-white">
          <Megaphone className="h-5 w-5 text-gold" /> {t('creq.title')}
        </h1>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-500">{t('creq.sub')}</p>
      </div>

      {balance !== null && (
        <div className="flex items-center gap-2 rounded-[14px] border border-line bg-surface-2 px-4 py-2.5 text-[13px] text-slate-300">
          <Coins className="h-4 w-4 text-gold" />
          {t('creq.balance', { assets: balance })}
        </div>
      )}

      <div className="space-y-4 rounded-[20px] border border-line bg-surface-2 p-5">
        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">{t('creq.field.title')}</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder={t('creq.field.titlePh')}
            className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-gold/40" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">{t('creq.field.project')}</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}
              className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-white outline-none focus:border-gold/40">
              <option value="">{t('creq.field.projectAny')}</option>
              {listings.map((l) => <option key={l.id} value={l.id}>{l.projectName}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">{t('creq.field.budget')}</label>
            <input type="number" min={50} step={10} value={budget}
              onChange={(e) => setBudget(Math.max(0, Math.round(Number(e.target.value) || 0)))}
              className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-white outline-none focus:border-gold/40" />
            <p className="mt-1 text-[11px] text-slate-500">{t('creq.field.budgetAssets', { assets: assetsNeeded })}</p>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">{t('creq.field.note')}</label>
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder={t('creq.field.notePh')}
            className="w-full resize-none rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm leading-relaxed text-white outline-none placeholder:text-slate-600 focus:border-gold/40" />
        </div>

        {error && <p className="text-[13px] text-rose-300">{error}</p>}
        {done && <p className="text-[13px] text-emerald-300">{t('creq.sent')}</p>}

        <button type="button" onClick={() => void submit()} disabled={busy || !title.trim() || budget < 50}
          className="inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-gold-bright disabled:opacity-50">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} {t('creq.submit')}
        </button>
      </div>

      {requests.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-slate-500">{t('creq.mine')}</h2>
          {requests.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-[14px] border border-line bg-surface-2 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-[14px] font-medium text-white">{r.title}</div>
                <div className="text-[11px] text-slate-500">
                  {r.projectName ? `${r.projectName} · ` : ''}AED {r.dailyBudgetAed}/d
                </div>
              </div>
              <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium ${STATUS_TONE[r.status] ?? STATUS_TONE.requested}`}>
                {t(`creq.status.${r.status}`)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
