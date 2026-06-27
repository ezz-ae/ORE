'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Globe, Search, Loader2, ExternalLink, ChevronDown, ChevronUp, Plus } from 'lucide-react'
import type { MicrositeListItem } from '@/lib/microsites'

const STATUS_BADGE: Record<string, string> = {
  published: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  draft: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
}

export function MicrositesClient() {
  const [items, setItems] = useState<MicrositeListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [openSlug, setOpenSlug] = useState<string | null>(null)
  const [busySlug, setBusySlug] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/crm/microsites', { cache: 'no-store' })
      const data = await res.json()
      setItems(Array.isArray(data.microsites) ? data.microsites : [])
    } catch {
      toast.error('Failed to load projects')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return items
    return items.filter((i) => [i.name, i.area, i.developerName, i.projectSlug].some((v) => (v || '').toLowerCase().includes(s)))
  }, [items, q])

  const liveCount = items.filter((i) => i.status === 'published').length

  async function save(projectSlug: string, patch: Record<string, unknown>) {
    setBusySlug(projectSlug)
    try {
      const res = await fetch('/api/crm/microsites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectSlug, ...patch }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Save failed')
      toast.success('Saved')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setBusySlug(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-sky-400/70">
            <Globe className="h-3.5 w-3.5" /> Web Studio
          </div>
          <h1 className="text-2xl font-semibold text-white">Project Microsites</h1>
          <p className="mt-1 text-sm text-slate-500">
            Generate a full multi-section website for any project — its own URL at <span className="font-mono text-slate-400">/site/&lt;slug&gt;</span>.
          </p>
        </div>
        <div className="rounded-xl border border-line bg-surface-2 px-4 py-2 text-sm text-slate-300">
          <span className="font-semibold text-white">{liveCount}</span> published
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search projects…"
          className="w-full rounded-xl border border-line bg-surface-2 py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-sky-400/40"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          {filtered.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">No projects match.</div>
          ) : (
            <div className="divide-y divide-line">
              {filtered.map((item) => {
                const open = openSlug === item.projectSlug
                const busy = busySlug === item.projectSlug
                return (
                  <div key={item.projectSlug}>
                    <div className="flex items-center gap-4 px-5 py-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-slate-100">{item.name}</span>
                          {item.hasMicrosite && item.status && (
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_BADGE[item.status]}`}>{item.status}</span>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">{item.area} · {item.developerName}</div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {!item.hasMicrosite ? (
                          <button
                            disabled={busy}
                            onClick={() => save(item.projectSlug, { status: 'draft' })}
                            className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/25 bg-sky-400/[0.07] px-3.5 py-1.5 text-xs font-medium text-sky-300 transition hover:bg-sky-400/15 disabled:opacity-50"
                          >
                            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Generate
                          </button>
                        ) : (
                          <>
                            {item.slug && (
                              <a href={`/site/${item.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border border-line-strong px-3 py-1.5 text-xs text-slate-300 transition hover:text-white">
                                View <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                            <button
                              disabled={busy}
                              onClick={() => save(item.projectSlug, { status: item.status === 'published' ? 'draft' : 'published' })}
                              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition disabled:opacity-50 ${item.status === 'published' ? 'border border-line-strong text-slate-300 hover:text-white' : 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'}`}
                            >
                              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                              {item.status === 'published' ? 'Unpublish' : 'Publish'}
                            </button>
                            <button onClick={() => setOpenSlug(open ? null : item.projectSlug)} className="text-slate-500 transition hover:text-slate-300">
                              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {open && item.hasMicrosite && (
                      <MicrositeEditor item={item} busy={busy} onSave={(patch) => save(item.projectSlug, patch)} />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MicrositeEditor({ item, busy, onSave }: { item: MicrositeListItem; busy: boolean; onSave: (patch: Record<string, unknown>) => void }) {
  const [headline, setHeadline] = useState('')
  const [summary, setSummary] = useState('')
  const [brochureUrl, setBrochureUrl] = useState('')

  const inputCls = 'w-full rounded-lg border border-line-strong bg-surface-2 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-sky-400/40'

  return (
    <div className="space-y-3 border-t border-line bg-surface-2/30 px-5 py-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Headline override</label>
          <input className={inputCls} value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder={`${item.name} — ${item.area}`} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Brochure URL (PDF)</label>
          <input className={inputCls} value={brochureUrl} onChange={(e) => setBrochureUrl(e.target.value)} placeholder="https://…/brochure.pdf" />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Summary override</label>
        <textarea className={`${inputCls} min-h-[60px]`} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Short tagline shown in the hero…" />
      </div>
      <button
        disabled={busy}
        onClick={() => onSave({
          ...(headline.trim() ? { headline } : {}),
          ...(summary.trim() ? { summary } : {}),
          ...(brochureUrl.trim() ? { brochureUrl } : {}),
        })}
        className="inline-flex items-center gap-2 rounded-lg border border-sky-400/25 bg-sky-400/[0.07] px-4 py-2 text-sm font-medium text-sky-300 transition hover:bg-sky-400/15 disabled:opacity-50"
      >
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save details
      </button>
      <p className="text-xs text-slate-600">Leave a field blank to keep the value derived from the project data.</p>
    </div>
  )
}
