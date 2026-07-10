'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import { Image as ImageIcon, Video, FileText, FileType2, StickyNote, Megaphone, Trash2, ExternalLink, Plus, Loader2, X, Pencil } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { KIND_META, editorTypeForKind, editorHrefForItem, type DriveKind, type EditorType } from '@/lib/freehold/drive'

// Editors that have shipped — grows one PR at a time (progressive enablement).
// An "Edit" action never appears for a type before its editor exists.
const SHIPPED_EDITORS: EditorType[] = ['doc']

type Item = { id: string; kind: DriveKind; title: string; content: string | null; url: string | null; createdBy: string; createdAt: string }

const KINDS: DriveKind[] = ['report', 'note', 'creative', 'image', 'video', 'pdf']

function KindIcon({ kind, className }: { kind: DriveKind; className?: string }) {
  const cls = className ?? 'h-4 w-4'
  switch (kind) {
    case 'image':    return <ImageIcon className={cls} />
    case 'video':    return <Video className={cls} />
    case 'pdf':      return <FileType2 className={cls} />
    case 'note':     return <StickyNote className={cls} />
    case 'creative': return <Megaphone className={cls} />
    default:         return <FileText className={cls} />
  }
}

const stripHtml = (s: string) => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

/**
 * The Drive asset browser — the single grid rendered by both /drive (scope=all)
 * and /drive/library (scope=library). Real: reads /api/freehold/library, filters
 * by kind, opens media, adds media by URL, deletes. Open-in-Editor lights up per
 * type as each editor ships (progressive enablement) — not wired here yet.
 */
export function AssetBrowser({ scope }: { scope: 'all' | 'library' }) {
  const t = useT()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<DriveKind | 'all'>('all')
  const [preview, setPreview] = useState<Item | null>(null)
  // add-by-url
  const [addOpen, setAddOpen] = useState(false)
  const [aTitle, setATitle] = useState('')
  const [aUrl, setAUrl] = useState('')
  const [aKind, setAKind] = useState<DriveKind>('image')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/freehold/library', { cache: 'no-store' })
      const d = await res.json()
      if (Array.isArray(d.items)) setItems(d.items as Item[])
    } catch { /* keep last */ } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const shown = filter === 'all' ? items : items.filter((i) => i.kind === filter)

  async function addByUrl() {
    if (!aTitle.trim() || !/^https?:\/\//.test(aUrl.trim())) { toast.error(t('drive.needUrl')); return }
    setSaving(true)
    try {
      const res = await fetch('/api/freehold/library', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: aKind, title: aTitle.trim(), url: aUrl.trim() }),
      })
      if (!res.ok) { toast.error(t('drive.saveFailed')); return }
      toast.success(t('drive.saved'))
      setATitle(''); setAUrl(''); setAddOpen(false); load()
    } catch { toast.error(t('drive.saveFailed')) } finally { setSaving(false) }
  }

  async function remove(item: Item) {
    if (!confirm(t('drive.confirmDelete'))) return
    try {
      const res = await fetch(`/api/freehold/library?id=${encodeURIComponent(item.id)}`, { method: 'DELETE' })
      const d = await res.json()
      if (res.ok && d.ok) { setItems((prev) => prev.filter((x) => x.id !== item.id)); toast.success(t('drive.deleted')) }
      else toast.error(t('drive.deleteFailed'))
    } catch { toast.error(t('drive.deleteFailed')) }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-5 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-white">{t(scope === 'library' ? 'drive.libraryTitle' : 'drive.homeTitle')}</h1>
          {!loading && <p className="mt-0.5 text-xs text-slate-500">{items.length} {t('drive.count')}</p>}
        </div>
        <button type="button" onClick={() => setAddOpen((o) => !o)} className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3.5 py-2 text-xs font-semibold text-gold transition hover:bg-gold/20">
          <Plus className="h-3.5 w-3.5" /> {t('drive.save')}
        </button>
      </div>

      {addOpen && (
        <div className="mb-4 grid gap-2 rounded-2xl border border-line bg-surface-2/50 p-3 sm:grid-cols-[1fr_1.4fr_auto_auto]">
          <input value={aTitle} onChange={(e) => setATitle(e.target.value)} placeholder={t('drive.addTitlePh')} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600" />
          <input value={aUrl} onChange={(e) => setAUrl(e.target.value)} placeholder={t('drive.addUrlPh')} inputMode="url" className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600" />
          <select value={aKind} onChange={(e) => setAKind(e.target.value as DriveKind)} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-white outline-none">
            {(['image', 'video', 'pdf'] as DriveKind[]).map((k) => <option key={k} value={k}>{t(KIND_META[k].i18nKey)}</option>)}
          </select>
          <button type="button" onClick={addByUrl} disabled={saving} className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-ink transition hover:bg-[#F8E7AE] disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('drive.save')}
          </button>
        </div>
      )}

      {/* Kind filter */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setFilter('all')} className={`rounded-full border px-3 py-1 text-xs font-medium transition ${filter === 'all' ? 'border-gold/40 bg-gold/15 text-gold' : 'border-line bg-surface-2 text-slate-400 hover:text-slate-200'}`}>{t('nb.lib.all')}</button>
        {KINDS.map((k) => (
          <button key={k} type="button" onClick={() => setFilter(k)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${filter === k ? 'border-gold/40 bg-gold/15 text-gold' : 'border-line bg-surface-2 text-slate-400 hover:text-slate-200'}`}>
            <KindIcon kind={k} className="h-3 w-3" /> {t(KIND_META[k].i18nKey)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-16 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> {t('common.loading')}</div>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line py-16 text-center text-sm text-slate-500">{t('drive.empty')}</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((item) => {
            const meta = KIND_META[item.kind]
            const isImg = item.kind === 'image' && item.url
            return (
              <div key={item.id} className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface-2/60">
                <div className="relative aspect-[4/3] w-full bg-surface">
                  {isImg
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={item.url!} alt="" className="h-full w-full object-cover" />
                    : (
                      <div className="flex h-full flex-col items-center justify-center gap-2 p-3 text-center">
                        <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: `${meta.accent}18`, color: meta.accent }}><KindIcon kind={item.kind} className="h-5 w-5" /></span>
                        {!meta.media && item.content && <p className="line-clamp-3 text-[11px] leading-snug text-slate-500">{stripHtml(item.content).slice(0, 120)}</p>}
                      </div>
                    )}
                  <span className="absolute start-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: `${meta.accent}22`, color: meta.accent }}>{t(meta.i18nKey)}</span>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-3">
                  <p className="line-clamp-2 text-xs font-medium text-slate-200">{item.title}</p>
                  <div className="mt-auto flex items-center gap-1.5">
                    {SHIPPED_EDITORS.includes(editorTypeForKind(item.kind, !!item.url)) ? (
                      <Link href={editorHrefForItem(item)} className="inline-flex items-center gap-1 rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 text-[11px] font-semibold text-gold transition hover:bg-gold/20">
                        <Pencil className="h-3 w-3" /> {t('drive.edit')}
                      </Link>
                    ) : (
                      <button type="button" onClick={() => (item.url ? window.open(item.url, '_blank', 'noopener') : setPreview(item))} className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[11px] text-slate-300 transition hover:text-white">
                        <ExternalLink className="h-3 w-3" /> {t('drive.open')}
                      </button>
                    )}
                    <button type="button" onClick={() => remove(item)} title={t('drive.delete')} className="ms-auto text-slate-500 transition hover:text-rose-400"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Text preview */}
      {preview && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/60 p-4" onClick={() => setPreview(null)}>
          <div className="max-h-[80vh] w-full max-w-2xl overflow-auto rounded-2xl border border-line bg-surface p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-white">{preview.title}</h3>
              <button type="button" onClick={() => setPreview(null)} className="text-slate-500 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            {preview.kind === 'report'
              ? <div className="prose prose-invert prose-sm max-w-none text-slate-200" dangerouslySetInnerHTML={{ __html: preview.content ?? '' }} />
              : <pre className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{preview.content ?? ''}</pre>}
          </div>
        </div>
      )}
    </div>
  )
}
