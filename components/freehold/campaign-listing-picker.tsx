'use client'

// The campaign wizard's project/landing picker. Replaces a flat <select> that
// buried landings in an unsearchable list. Every listing is shown, grouped by
// developer and searchable by developer OR project, each row carrying its
// landing status plus Preview (always) and Edit (editors only) affordances — so
// no landing page is ever hidden and staff can jump straight to it.

import { useMemo, useRef, useState, useEffect } from 'react'
import { Search, Eye, Pencil, ChevronDown, Check, X } from 'lucide-react'

export interface PickerListing {
  id: string // project slug — the campaign target
  projectName: string
  area: string
  developer: string
  landingStatus: string // 'live' | 'draft' | 'pending_review' | 'missing'
  landingSlug: string | null
}

interface Props {
  listings: PickerListing[]
  value: string
  onChange: (id: string) => void
  loading: boolean
  /** Editors (non-brokers) get an Edit affordance; everyone gets Preview. */
  canEdit: boolean
  t: (key: string, vars?: Record<string, string | number>) => string
  inputCls: string
}

const STATUS_STYLE: Record<string, string> = {
  live: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  draft: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  pending_review: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
}
// Sentinel developer key so blank-developer projects sort last under "Other".
const NO_DEV = '￿'

export function CampaignListingPicker({ listings, value, onChange, loading, canEdit, t, inputCls }: Props) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const selected = listings.find((l) => l.id === value) || null

  // Group by developer → project, filtered by the query (developer, project or area).
  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const match = (l: PickerListing) =>
      !needle ||
      l.developer.toLowerCase().includes(needle) ||
      l.projectName.toLowerCase().includes(needle) ||
      l.area.toLowerCase().includes(needle)
    const byDev = new Map<string, PickerListing[]>()
    for (const l of listings) {
      if (!match(l)) continue
      const dev = l.developer.trim() || NO_DEV
      const arr = byDev.get(dev)
      if (arr) arr.push(l)
      else byDev.set(dev, [l])
    }
    return [...byDev.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([dev, items]) => ({
        developer: dev === NO_DEV ? '' : dev,
        items: items.slice().sort((a, b) => a.projectName.localeCompare(b.projectName)),
      }))
  }, [listings, q])

  const totalShown = groups.reduce((s, g) => s + g.items.length, 0)
  const previewHref = (l: PickerListing) => `/lp/${l.landingSlug || l.id}`
  const editHref = (l: PickerListing) =>
    l.landingSlug ? `/freehold-intelligence/inventory/landings/${l.landingSlug}/edit` : null

  function statusBadge(l: PickerListing) {
    const key =
      l.landingStatus === 'live' ? 'statusLive'
      : l.landingStatus === 'draft' ? 'statusDraft'
      : l.landingStatus === 'pending_review' ? 'statusPending'
      : null
    if (!key) return <span className="text-[10px] text-slate-500">{t('lm.newCampaign.s1.picker.landingNone')}</span>
    return (
      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[l.landingStatus]}`}>
        {t(`lm.newCampaign.s1.picker.${key}`)}
      </span>
    )
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`${inputCls} flex items-center justify-between gap-2 text-start`}
      >
        <span className={`truncate ${selected ? 'text-white' : 'text-white/40'}`}>
          {selected
            ? `${selected.projectName} · ${selected.area}`
            : loading ? t('common.loading') : t('lm.newCampaign.s1.pickProject')}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-40 mt-2 w-full overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
          <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('lm.newCampaign.s1.picker.search')}
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
            />
            {q && (
              <button type="button" onClick={() => setQ('')} aria-label={t('lm.newCampaign.s1.picker.clear')}>
                <X className="h-3.5 w-3.5 text-slate-500 hover:text-white" />
              </button>
            )}
          </div>

          <div className="max-h-[min(60vh,340px)] overflow-y-auto py-1" role="listbox">
            {totalShown === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-slate-500">
                {loading ? t('common.loading') : t('lm.newCampaign.s1.picker.noResults')}
              </div>
            ) : (
              groups.map((g) => (
                <div key={g.developer || '__other'}>
                  <div className="sticky top-0 z-10 bg-surface px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gold/70">
                    {g.developer || t('lm.newCampaign.s1.picker.other')}
                  </div>
                  {g.items.map((l) => {
                    const isSel = l.id === value
                    const edit = editHref(l)
                    return (
                      <div
                        key={l.id}
                        className={`group flex items-center gap-2 px-2.5 py-2 ${isSel ? 'bg-gold/10' : 'hover:bg-surface-2'}`}
                      >
                        <button
                          type="button"
                          onClick={() => { onChange(l.id); setOpen(false) }}
                          role="option"
                          aria-selected={isSel}
                          className="flex min-w-0 flex-1 items-center gap-2 text-start"
                        >
                          {isSel
                            ? <Check className="h-3.5 w-3.5 shrink-0 text-gold" />
                            : <span className="h-3.5 w-3.5 shrink-0" />}
                          <span className="min-w-0">
                            <span className="block truncate text-sm text-white">{l.projectName}</span>
                            <span className="block truncate text-[11px] text-slate-500">{l.area}</span>
                          </span>
                        </button>
                        {statusBadge(l)}
                        <a
                          href={previewHref(l)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          title={t('lm.newCampaign.s1.picker.preview')}
                          aria-label={t('lm.newCampaign.s1.picker.preview')}
                          className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-surface hover:text-white"
                        >
                          <Eye className="h-4 w-4" />
                        </a>
                        {edit && (
                          <a
                            href={edit}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title={t(canEdit ? 'lm.newCampaign.s1.picker.edit' : 'lm.newCampaign.s1.picker.suggest')}
                            aria-label={t(canEdit ? 'lm.newCampaign.s1.picker.edit' : 'lm.newCampaign.s1.picker.suggest')}
                            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-surface hover:text-gold"
                          >
                            <Pencil className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
