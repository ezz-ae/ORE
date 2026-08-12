'use client'

/**
 * THE THINGS YOU DO TO A LEAD, DONE ON ITS ROW.
 *
 * Every one of these already existed one screen away. Rating meant opening the
 * lead. Assigning meant opening the lead. Seeing which campaign brought them
 * meant reading an id. Seeing the AD they actually answered was impossible
 * from the CRM at all — even though the ad's id has been stored on every
 * synced lead since the sync existed.
 *
 * With 571 rows in front of you, "open it, do the thing, come back" is not a
 * workflow. So the row does the work:
 *
 *   RATE      0–10 in two clicks. The single highest-value action in this
 *             product — a rated lead teaches Meta which kind of person to find
 *             more of, and an unrated one teaches it nothing.
 *   ASSIGN    only for whoever may assign. A lead nobody owns is a lead nobody
 *             is calling, and the person who can fix that should not have to
 *             leave the list to do it.
 *   CAMPAIGN  its NAME, and a link to it. Not the ad set's name — a broker
 *             wants to know which campaign brought this person, and an ad set
 *             is an implementation detail of one.
 *   SEE AD    the real Meta-rendered ad, in place. Not a link away: the
 *             question "what did this person see before they gave us their
 *             number" is asked WHILE reading the row, and answering it by
 *             navigating loses the row.
 *
 * ROLE DECIDES WHAT THE ROW OFFERS. A broker sees their own leads and cannot
 * hand them to someone else; a manager can. Showing a control that will be
 * refused is worse than not showing it.
 */
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Loader2, Star, X, Eye, UserPlus } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

const FI = '/freehold-intelligence'

/** ≥6 is "buy more of this", ≤2 is "stop buying this" — the same bands the
 *  campaign-quality score and the Meta value write-back already use, so a
 *  broker's tap here means the same thing everywhere it is read. */
const bandOf = (v: number): 'good' | 'bad' | 'mid' => (v >= 6 ? 'good' : v <= 2 ? 'bad' : 'mid')
const BAND_CLS: Record<string, string> = {
  good: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300',
  bad: 'border-rose-400/40 bg-rose-400/10 text-rose-200',
  mid: 'border-line-strong bg-surface-2 text-slate-300',
}

async function patchLead(leadId: string, body: Record<string, unknown>): Promise<boolean> {
  try {
    const r = await fetch(`/api/freehold/crm/leads/${encodeURIComponent(leadId)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    return r.ok
  } catch { return false }
}

/** Close on an outside click — one popover at a time on a list this long. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, close])
  return ref
}

// ── RATE ────────────────────────────────────────────────────────────────────

export function LeadRate({ leadId, value, onRated }: {
  leadId: string
  value: number | null
  onRated?: (v: number) => void
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [rating, setRating] = useState<number | null>(value)
  const ref = useDismiss(open, () => setOpen(false))

  async function rate(v: number) {
    if (busy) return
    const prev = rating
    // Optimistic: the tap is the point, and 0–10 on 571 rows must feel
    // instant. Reverted on refusal rather than left showing a value the
    // database does not hold.
    setRating(v); setBusy(true); setOpen(false)
    const ok = await patchLead(leadId, { value_rating: v })
    setBusy(false)
    if (ok) onRated?.(v)
    else setRating(prev)
  }

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button type="button" onClick={() => setOpen((v) => !v)} disabled={busy}
        title={rating !== null ? t('crm.value.current', { v: rating }) : t('crm.rate.hint')}
        className={`inline-flex h-6 min-w-[2rem] items-center justify-center gap-1 rounded-full border px-2 text-[11px] font-semibold transition disabled:opacity-50 ${
          rating !== null ? BAND_CLS[bandOf(rating)] : 'border-dashed border-line text-slate-500 hover:text-white'
        }`}>
        {busy ? <Loader2 className="h-3 w-3 animate-spin" />
          : rating !== null ? rating
          : <><Star className="h-3 w-3" />{t('crm.rate.short')}</>}
      </button>

      {open && (
        <div className="absolute end-0 z-30 mt-1 flex gap-0.5 rounded-xl border border-line bg-surface p-1.5 shadow-xl">
          {Array.from({ length: 11 }, (_, i) => (
            <button key={i} type="button" onClick={() => void rate(i)}
              className={`h-6 w-6 rounded-md text-[11px] font-semibold transition ${
                rating === i ? BAND_CLS[bandOf(i)] : 'text-slate-400 hover:bg-surface-2 hover:text-white'
              }`}>
              {i}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── ASSIGN ──────────────────────────────────────────────────────────────────

interface Agent { id: string; name: string }

export function LeadAssign({ leadId, agent, canAssign, agents, onAssigned }: {
  leadId: string
  agent: string
  /** Whoever may hand a lead to someone else. A broker sees the name and no
   *  control — offering a button that will be refused is worse than none. */
  canAssign: boolean
  agents: Agent[]
  onAssigned?: (agentId: string) => void
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [owner, setOwner] = useState(agent)
  const ref = useDismiss(open, () => setOpen(false))

  const named = agents.find((a) => a.id === owner)?.name ?? owner

  if (!canAssign) {
    return owner
      ? <span className="truncate text-xs text-slate-400">{named}</span>
      : <span className="text-xs text-amber-300/80">{t('crm.unassigned')}</span>
  }

  async function assign(id: string) {
    if (busy) return
    const prev = owner
    setOwner(id); setBusy(true); setOpen(false)
    const ok = await patchLead(leadId, { assigned_broker_id: id })
    setBusy(false)
    if (ok) onAssigned?.(id)
    else setOwner(prev)
  }

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button type="button" onClick={() => setOpen((v) => !v)} disabled={busy}
        className={`inline-flex max-w-full items-center gap-1 truncate rounded-lg border px-2 py-1 text-xs transition ${
          owner ? 'border-transparent text-slate-400 hover:border-line hover:text-white'
                : 'border-amber-400/30 bg-amber-400/[0.07] text-amber-300/90 hover:bg-amber-400/15'
        }`}>
        {busy ? <Loader2 className="h-3 w-3 animate-spin" />
          : owner ? <span className="truncate">{named}</span>
          : <><UserPlus className="h-3 w-3" />{t('crm.assign.action')}</>}
      </button>

      {open && (
        <div className="absolute end-0 z-30 mt-1 max-h-56 w-48 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-xl">
          {agents.length === 0 && (
            <p className="px-2 py-2 text-[11px] text-slate-500">{t('crm.assign.noAgents')}</p>
          )}
          {agents.map((a) => (
            <button key={a.id} type="button" onClick={() => void assign(a.id)}
              className={`block w-full truncate rounded-lg px-2 py-1.5 text-start text-xs transition hover:bg-surface-2 ${
                a.id === owner ? 'text-gold' : 'text-slate-300'
              }`}>
              {a.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── WHERE THEY CAME FROM ────────────────────────────────────────────────────

export function LeadSource({ campaignId, campaignName, adId }: {
  campaignId: string
  campaignName: string
  adId: string
}) {
  const t = useT()
  const [preview, setPreview] = useState<string[] | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function seeAd() {
    setOpen(true)
    if (preview !== null) return
    setLoading(true)
    const d = await fetch(`/api/meta/ads/${encodeURIComponent(adId)}/preview`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null)
    // Meta returns its OWN rendered iframe markup — the exact thing Ads
    // Manager shows. Nothing here mocks an ad.
    setPreview(Array.isArray(d?.previews) ? d.previews.map((p: { body?: string }) => String(p?.body ?? '')).filter(Boolean) : [])
    setLoading(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5" onClick={(e) => e.stopPropagation()}>
      {/* THE AD, IN PLACE. The question "what did this person see before they
          gave us their number" is asked while reading the row — answering it
          by navigating loses the row. The ad's NAME is deliberately absent:
          "cashoffer - creative 2" tells nobody anything the picture does not. */}
      {adId && (
        <button type="button" onClick={() => void seeAd()}
          className="inline-flex items-center gap-1 text-[11px] text-gold/80 transition hover:text-gold">
          <Eye className="h-3 w-3" /> {t('crm.source.seeAd')}
        </button>
      )}

      {campaignName && (
        campaignId
          ? <Link href={`${FI}/ads-live/meta/${encodeURIComponent(campaignId)}`}
              className="truncate text-[11px] text-slate-400 underline-offset-2 transition hover:text-white hover:underline">
              {campaignName}
            </Link>
          : <span className="truncate text-[11px] text-slate-500">{campaignName}</span>
      )}

      {open && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}>
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-surface p-4"
            onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-white">{t('crm.source.adTitle')}</span>
              <button type="button" onClick={() => setOpen(false)} aria-label={t('common.close')}
                className="rounded-lg p-1 text-slate-500 transition hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            {loading && (
              <div className="grid place-items-center py-10 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /></div>
            )}
            {!loading && preview?.length === 0 && (
              <p className="py-6 text-center text-[13px] text-slate-500">{t('crm.source.adGone')}</p>
            )}
            {!loading && preview && preview.length > 0 && (
              <div className="space-y-3">
                {preview.slice(0, 2).map((html, i) => (
                  <div key={i} className="overflow-hidden rounded-xl border border-line bg-white"
                    dangerouslySetInnerHTML={{ __html: html }} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
