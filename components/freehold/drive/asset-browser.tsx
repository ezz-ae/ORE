'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Image as ImageIcon, Video, FileText, FileType2, StickyNote, Megaphone,
  Trash2, ExternalLink, Plus, Loader2, X, Pencil, Search, Monitor, Folder, FolderOpen, FolderInput, Upload, Cloud, FilePlus,
} from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { KIND_META, editorTypeForKind, editorHrefForItem, type DriveKind, type EditorType } from '@/lib/freehold/drive'

// Editors that have shipped — an "Edit" action never appears before its editor exists.
const SHIPPED_EDITORS: EditorType[] = ['doc', 'image', 'video', 'pdf']

type Item = { id: string; kind: DriveKind; title: string; content: string | null; url: string | null; folder: string | null; createdBy: string; createdAt: string }
type Landing = { slug: string; title: string; status: string; heroImage: string; area: string; priceFromAed: number | null; leads: number; views: number; updatedAt: string | null }

const fmtPrice = (n: number | null) => n && n >= 1_000_000 ? `AED ${(n / 1_000_000).toFixed(1)}M` : n && n >= 1000 ? `AED ${Math.round(n / 1000)}K` : n ? `AED ${n}` : ''

const KINDS: DriveKind[] = ['image', 'video', 'pdf', 'creative', 'report', 'note']
type SortKey = 'new' | 'old' | 'az'

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
 * The Drive library. One organized surface instead of a crowded wall of
 * identical tiles: assets group into kind shelves (images, videos, PDFs,
 * creatives, reports, notes), each with a card design that matches what it
 * holds — media as thumbnails with hover actions, documents as paper cards
 * with a text preview. Search and sort work across everything; clicking a
 * card opens its editor as a full-screen app.
 */
export function AssetBrowser({ scope }: { scope: 'all' | 'library' }) {
  const t = useT()
  const router = useRouter()
  const [items, setItems] = useState<Item[]>([])
  const [landings, setLandings] = useState<Landing[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<DriveKind | 'all' | 'landing'>('all')
  const [activeFolder, setActiveFolder] = useState<string | null>(null)  // null = all folders
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('new')
  const [preview, setPreview] = useState<Item | null>(null)
  // add-by-url
  const [addOpen, setAddOpen] = useState(false)
  const [aTitle, setATitle] = useState('')
  const [aUrl, setAUrl] = useState('')
  const [aKind, setAKind] = useState<DriveKind>('image')
  const [saving, setSaving] = useState(false)
  // upload-from-device
  const fileInput = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [assets, lps] = await Promise.all([
        fetch('/api/freehold/library', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({})),
        fetch('/api/freehold/drive/landings', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({})),
      ])
      if (Array.isArray(assets.items)) setItems(assets.items as Item[])
      if (Array.isArray(lps.landings)) setLandings(lps.landings as Landing[])
    } catch { /* keep last */ } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const shelves = useMemo(() => {
    const q = query.trim().toLowerCase()
    let pool = filter === 'all' ? items : items.filter((i) => i.kind === filter)
    if (activeFolder !== null) pool = pool.filter((i) => (i.folder ?? '') === activeFolder)
    if (q) pool = pool.filter((i) => i.title.toLowerCase().includes(q) || (i.content && stripHtml(i.content).toLowerCase().includes(q)))
    const sorted = [...pool].sort((a, b) =>
      sort === 'az' ? a.title.localeCompare(b.title)
      : sort === 'old' ? a.createdAt.localeCompare(b.createdAt)
      : b.createdAt.localeCompare(a.createdAt))
    // Kind shelves, ordered by their freshest item so active work floats up.
    const groups = KINDS
      .map((k) => ({ kind: k, rows: sorted.filter((i) => i.kind === k) }))
      .filter((g) => g.rows.length > 0)
    if (sort === 'new') groups.sort((a, b) => b.rows[0].createdAt.localeCompare(a.rows[0].createdAt))
    return groups
  }, [items, filter, query, sort, activeFolder])

  const total = shelves.reduce((n, g) => n + g.rows.length, 0)

  // Blank-start: create an empty document and open it in the doc editor (which
  // offers one-click templates when empty). The Media Editor's "new" entry.
  async function newDoc() {
    if (creating) return
    setCreating(true)
    try {
      const res = await fetch('/api/freehold/library', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'note', title: t('drive.newDoc.title'), content: '', folder: activeFolder || undefined }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d.item?.id) { toast.error(t('drive.saveFailed')); return }
      router.push(`/freehold-intelligence/drive/editor/doc/${d.item.id}`)
    } catch { toast.error(t('drive.saveFailed')) } finally { setCreating(false) }
  }

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

  // Upload a file straight from the device — no external bucket. Text files go
  // in as notes; small images inline as thumbnails; PDFs/large images are read
  // by the AI into a report; other binaries are honestly refused by the route.
  async function uploadFile(file: File) {
    if (file.size > 5 * 1024 * 1024) { toast.error(t('drive.upload.tooBig')); return }
    setUploading(true)
    const tid = toast.loading(t('drive.upload.working', { name: file.name }))
    try {
      const isText = /^text\//.test(file.type) || /\.(txt|md|csv|json)$/i.test(file.name)
      const payload: Record<string, unknown> = { name: file.name, mimeType: file.type, folder: activeFolder || undefined }
      if (isText) {
        payload.text = await file.text()
      } else {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const fr = new FileReader()
          fr.onload = () => resolve(String(fr.result))
          fr.onerror = () => reject(fr.error)
          fr.readAsDataURL(file)
        })
        payload.data = dataUrl.slice(dataUrl.indexOf(',') + 1)  // strip "data:...;base64,"
      }
      const res = await fetch('/api/freehold/drive/upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(d.error || t('drive.upload.failed'), { id: tid }); return }
      toast.success(t('drive.upload.done'), { id: tid })
      load()
    } catch { toast.error(t('drive.upload.failed'), { id: tid }) } finally { setUploading(false) }
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

  // Distinct folders present across the user's assets (for the sidebar).
  const folders = useMemo(() => {
    const set = new Set<string>()
    for (const i of items) if (i.folder) set.add(i.folder)
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [items])

  async function moveToFolder(item: Item, folder: string | null) {
    // Optimistic; the Library PATCH persists the move.
    setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, folder } : x)))
    try {
      await fetch('/api/freehold/library', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, folder }),
      })
    } catch { toast.error(t('drive.saveFailed')); load() }
  }

  function openItem(item: Item) {
    if (SHIPPED_EDITORS.includes(editorTypeForKind(item.kind, !!item.url))) router.push(editorHrefForItem(item))
    else if (item.url) window.open(item.url, '_blank', 'noopener')
    else setPreview(item)
  }

  const canEdit = (item: Item) => SHIPPED_EDITORS.includes(editorTypeForKind(item.kind, !!item.url))

  // Hover action bar shared by every card style.
  const Actions = ({ item }: { item: Item }) => (
    <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-center justify-end gap-1.5 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
      {canEdit(item) && (
        <Link href={editorHrefForItem(item)} onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 rounded-full bg-gold px-2.5 py-1 text-[11px] font-semibold text-ink shadow-lg">
          <Pencil className="h-3 w-3" /> {t('drive.edit')}
        </Link>
      )}
      {item.url && (
        <button type="button" onClick={(e) => { e.stopPropagation(); window.open(item.url!, '_blank', 'noopener') }}
          title={t('drive.open')} className="grid h-6 w-6 place-items-center rounded-full bg-black/60 text-slate-200 shadow-lg backdrop-blur hover:text-white">
          <ExternalLink className="h-3 w-3" />
        </button>
      )}
      <button type="button" onClick={(e) => { e.stopPropagation(); const name = window.prompt(t('drive.moveTo'), item.folder ?? ''); if (name !== null) void moveToFolder(item, name.trim() || null) }}
        title={t('drive.move')} className="grid h-6 w-6 place-items-center rounded-full bg-black/60 text-slate-300 shadow-lg backdrop-blur hover:text-white">
        <FolderInput className="h-3 w-3" />
      </button>
      <button type="button" onClick={(e) => { e.stopPropagation(); void remove(item) }}
        title={t('drive.delete')} className="grid h-6 w-6 place-items-center rounded-full bg-black/60 text-slate-300 shadow-lg backdrop-blur hover:text-rose-400">
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  )

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-5 sm:px-6">
      {/* Toolbar: search · sort · add */}
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <div>
          <h1 className="text-lg font-semibold text-white">{t(scope === 'library' ? 'drive.libraryTitle' : 'drive.homeTitle')}</h1>
          {!loading && <p className="mt-0.5 text-xs text-slate-500">{total} {t('drive.count')}</p>}
        </div>
        <div className="relative ms-auto min-w-[180px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('drive.searchPh')}
            className="w-full rounded-full border border-line bg-surface-2 py-2 ps-9 pe-3 text-xs text-white outline-none placeholder:text-slate-600 focus:border-gold/40" />
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-full border border-line bg-surface-2 px-3 py-2 text-xs text-slate-300 outline-none">
          <option value="new">{t('drive.sort.new')}</option>
          <option value="old">{t('drive.sort.old')}</option>
          <option value="az">{t('drive.sort.az')}</option>
        </select>
        <input ref={fileInput} type="file" hidden
          accept="image/*,application/pdf,text/plain,text/markdown,text/csv,.txt,.md,.csv,.json"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadFile(f); e.target.value = '' }} />
        <button type="button" onClick={() => void newDoc()} disabled={creating}
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:text-white disabled:opacity-50">
          {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FilePlus className="h-3.5 w-3.5" />} {t('drive.newDoc.btn')}
        </button>
        <button type="button" onClick={() => fileInput.current?.click()} disabled={uploading}
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:text-white disabled:opacity-50">
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} {t('drive.upload.btn')}
        </button>
        <button type="button" onClick={() => setAddOpen((o) => !o)} className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3.5 py-2 text-xs font-semibold text-gold transition hover:bg-gold/20">
          <Plus className="h-3.5 w-3.5" /> {t('drive.save')}
        </button>
        <Link href="/freehold-intelligence/cloud"
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:text-white">
          <Cloud className="h-3.5 w-3.5" /> {t('cloud.title')}
        </Link>
      </div>

      {/* Folder rail — the user's own folders + an Unfiled bucket */}
      {(folders.length > 0 || items.some((i) => !i.folder)) && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => setActiveFolder(null)} className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${activeFolder === null ? 'border-gold/40 bg-gold/10 text-gold' : 'border-line bg-surface-2 text-slate-300 hover:text-white'}`}>
            <FolderOpen className="h-3 w-3" /> {t('drive.allFolders')}
          </button>
          {folders.map((f) => {
            const n = items.filter((i) => i.folder === f).length
            return (
              <button key={f} type="button" onClick={() => setActiveFolder(activeFolder === f ? null : f)} className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${activeFolder === f ? 'border-gold/40 bg-gold/10 text-gold' : 'border-line bg-surface-2 text-slate-300 hover:text-white'}`}>
                <Folder className="h-3 w-3" /> {f}<span className="text-[10px] text-slate-500">{n}</span>
              </button>
            )
          })}
          {items.some((i) => !i.folder) && (
            <button type="button" onClick={() => setActiveFolder(activeFolder === '' ? null : '')} className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${activeFolder === '' ? 'border-gold/40 bg-gold/10 text-gold' : 'border-line bg-surface-2 text-slate-300 hover:text-white'}`}>
              {t('drive.unfiled')}<span className="text-[10px] text-slate-500">{items.filter((i) => !i.folder).length}</span>
            </button>
          )}
        </div>
      )}

      {addOpen && (
        <div className="mb-4 grid gap-2 rounded-2xl border border-line bg-surface-2/50 p-3 sm:grid-cols-[1fr_1.4fr_auto_auto]">
          <input value={aTitle} onChange={(e) => setATitle(e.target.value)} placeholder={t('drive.addTitlePh')} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600" />
          <input value={aUrl} onChange={(e) => setAUrl(e.target.value)} placeholder={t('drive.addUrlPh')} inputMode="url" className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600" />
          <select value={aKind} onChange={(e) => setAKind(e.target.value as DriveKind)} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-white outline-none">
            {(['image', 'video', 'pdf'] as DriveKind[]).map((k) => <option key={k} value={k}>{t(KIND_META[k].i18nKey)}</option>)}
          </select>
          <button type="button" onClick={addByUrl} disabled={saving} className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-ink transition hover:bg-gold-bright disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('drive.save')}
          </button>
        </div>
      )}

      {/* Kind filter */}
      <div className="mb-6 flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setFilter('all')} className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${filter === 'all' ? 'border-gold/40 bg-gold/10 text-gold' : 'border-line bg-surface-2 text-slate-300 hover:text-white'}`}>{t('nb.lib.all')}</button>
        {landings.length > 0 && (
          <button type="button" onClick={() => setFilter(filter === 'landing' ? 'all' : 'landing')} className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${filter === 'landing' ? 'border-gold/40 bg-gold/10 text-gold' : 'border-line bg-surface-2 text-slate-300 hover:text-white'}`}>
            <Monitor className="h-3 w-3" /> {t('drive.landings')}<span className="text-[10px] text-slate-500">{landings.length}</span>
          </button>
        )}
        {KINDS.map((k) => {
          const n = items.filter((i) => i.kind === k).length
          return (
            <button key={k} type="button" onClick={() => setFilter(filter === k ? 'all' : k)} className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${filter === k ? 'border-gold/40 bg-gold/10 text-gold' : 'border-line bg-surface-2 text-slate-300 hover:text-white'}`}>
              <KindIcon kind={k} className="h-3 w-3" /> {t(KIND_META[k].i18nKey)}{n > 0 && <span className="text-[10px] text-slate-500">{n}</span>}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-16 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> {t('common.loading')}</div>
      ) : total === 0 && landings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line py-16 text-center text-sm text-slate-500">{t('drive.empty')}</div>
      ) : (
        <div className="space-y-8">
          {(filter === 'all' || filter === 'landing') && landings.length > 0 && (() => {
            const q = query.trim().toLowerCase()
            const shown = q ? landings.filter((l) => l.title.toLowerCase().includes(q) || l.area.toLowerCase().includes(q)) : landings
            if (!shown.length) return null
            return (
              <section>
                <div className="mb-2.5 flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-lg bg-teal-400/15 text-teal-300"><Monitor className="h-3.5 w-3.5" /></span>
                  <h2 className="text-[13px] font-semibold text-slate-200">{t('drive.landings')}</h2>
                  <span className="text-[11px] text-slate-500">{shown.length}</span>
                  {/* One system: the Drive shows your live pages; the manager
                      creates them from inventory. Same store, same editor. */}
                  <Link href="/freehold-intelligence/lead-machine/landings"
                    className="ms-auto inline-flex items-center gap-1 text-[11px] font-medium text-teal-300/90 transition hover:text-teal-200">
                    {t('drive.landings.manage')} <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {shown.map((l) => (
                    <div key={l.slug} role="button" tabIndex={0}
                      onClick={() => router.push(`/freehold-intelligence/lead-machine/landings/${l.slug}/edit`)}
                      onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/freehold-intelligence/lead-machine/landings/${l.slug}/edit`) }}
                      className="group relative cursor-pointer overflow-hidden rounded-xl border border-line bg-surface transition hover:border-teal-400/30">
                      <div className="relative aspect-[4/3] w-full bg-surface-2">
                        {l.heroImage
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={l.heroImage} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
                          : <div className="flex h-full items-center justify-center text-teal-300/50"><Monitor className="h-8 w-8" /></div>}
                        <span className={`absolute end-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${l.status === 'published' ? 'bg-emerald-500/85 text-white' : l.status === 'pending' ? 'bg-amber-500/85 text-black' : 'bg-slate-700/85 text-slate-200'}`}>
                          {t(`drive.lp.${l.status}`)}
                        </span>
                      </div>
                      <div className="p-3">
                        <p className="truncate text-[13px] font-semibold text-slate-100">{l.title}</p>
                        <p className="mt-0.5 truncate text-[11px] text-slate-500">{[l.area, fmtPrice(l.priceFromAed)].filter(Boolean).join(' · ')}</p>
                        <div className="mt-1.5 flex items-center gap-3 text-[10px] text-slate-500">
                          <span>{t('drive.lp.leads', { n: l.leads })}</span>
                          <span>{t('drive.lp.views', { n: l.views })}</span>
                        </div>
                      </div>
                      <div className="pointer-events-none absolute inset-x-2 bottom-2 flex justify-end opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
                        <Link href={`/freehold-intelligence/lead-machine/landings/${l.slug}/edit`} onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 rounded-full bg-teal-400 px-2.5 py-1 text-[11px] font-semibold text-black shadow-lg"><Pencil className="h-3 w-3" /> {t('drive.edit')}</Link>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )
          })()}
          {filter !== 'landing' && shelves.map(({ kind, rows }) => {
            const meta = KIND_META[kind]
            const isMedia = kind === 'image' || kind === 'video'
            return (
              <section key={kind}>
                <div className="mb-2.5 flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-lg" style={{ background: `${meta.accent}18`, color: meta.accent }}>
                    <KindIcon kind={kind} className="h-3.5 w-3.5" />
                  </span>
                  <h2 className="text-[13px] font-semibold text-slate-200">{t(meta.i18nKey)}</h2>
                  <span className="text-[11px] text-slate-500">{rows.length}</span>
                </div>

                {isMedia ? (
                  /* Media shelf: thumbnails, actions on hover only */
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {rows.map((item) => (
                      <div key={item.id} role="button" tabIndex={0} onClick={() => openItem(item)}
                        onKeyDown={(e) => { if (e.key === 'Enter') openItem(item) }}
                        className="group relative cursor-pointer overflow-hidden rounded-xl border border-line bg-surface transition hover:border-white/20">
                        <div className="aspect-video w-full bg-surface-2">
                          {item.kind === 'image' && item.url
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={item.url} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
                            : (
                              <div className="flex h-full items-center justify-center" style={{ color: meta.accent }}>
                                <KindIcon kind={item.kind} className="h-8 w-8 opacity-60" />
                              </div>
                            )}
                        </div>
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2.5 pb-2 pt-6">
                          <p className="truncate text-[11px] font-medium text-white">{item.title}</p>
                        </div>
                        <Actions item={item} />
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Document shelf: paper cards with a real text preview */
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {rows.map((item) => (
                      <div key={item.id} role="button" tabIndex={0} onClick={() => openItem(item)}
                        onKeyDown={(e) => { if (e.key === 'Enter') openItem(item) }}
                        className="group relative cursor-pointer overflow-hidden rounded-xl border border-line bg-surface-2/60 transition hover:border-white/20">
                        <div className="h-1 w-full" style={{ background: `${meta.accent}66` }} />
                        <div className="p-3.5 pb-9">
                          <p className="truncate text-[13px] font-semibold text-slate-100">{item.title}</p>
                          {item.content
                            ? <p className="mt-1.5 line-clamp-3 text-[11px] leading-relaxed text-slate-500">{stripHtml(item.content).slice(0, 200)}</p>
                            : <p className="mt-1.5 text-[11px] italic text-slate-600">{t('drive.noPreview')}</p>}
                        </div>
                        <Actions item={item} />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}

      {/* Text preview (types without a shipped editor) */}
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
