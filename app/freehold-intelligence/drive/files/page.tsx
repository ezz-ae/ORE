'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowLeft, Search, Loader2, ExternalLink, Cloud as CloudIcon, Sparkles, Link2, Check,
  Download, FolderInput, Trash2, Folder,
  Image as ImageIcon, Video, FileType2, FileSpreadsheet, FileText, StickyNote, Megaphone,
} from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { editorTypeForKind, editorHrefForItem, type DriveKind } from '@/lib/freehold/drive'

// Files Manager — a Finder over EVERY file on the platform: the Library
// (things the app generated) and the Cloud (files you uploaded), unified into
// one searchable list. Generated items open in their editor; cloud files open
// in a new tab. Read-only browser — create/edit happens in the source room.
type Unified = {
  id: string
  rawId: string         // the store id without the lib-/cld- prefix (delete/move)
  name: string
  kind: string          // image | video | pdf | doc | sheet | note | creative | file
  url: string | null
  source: 'library' | 'cloud'
  folder: string | null
  createdAt: string
  driveKind?: DriveKind  // library only — for opening the right editor
}

const SHIPPED = new Set(['doc', 'image', 'video', 'pdf'])

function KindIcon({ kind, className = 'h-4 w-4' }: { kind: string; className?: string }) {
  switch (kind) {
    case 'image':    return <ImageIcon className={className} />
    case 'video':    return <Video className={className} />
    case 'pdf':      return <FileType2 className={className} />
    case 'sheet':    return <FileSpreadsheet className={className} />
    case 'note':     return <StickyNote className={className} />
    case 'creative': return <Megaphone className={className} />
    default:         return <FileText className={className} />
  }
}

const cloudKind = (mime: string | null, name: string): string => {
  const m = mime || ''
  if (m.startsWith('image/')) return 'image'
  if (m.startsWith('video/')) return 'video'
  if (m === 'application/pdf' || /\.pdf$/i.test(name)) return 'pdf'
  if (/sheet|excel|csv/i.test(m) || /\.(xlsx?|csv)$/i.test(name)) return 'sheet'
  if (/word|document/i.test(m) || /\.docx?$/i.test(name)) return 'doc'
  return 'file'
}

export default function FilesManagerPage() {
  const t = useT()
  const router = useRouter()
  const [items, setItems] = useState<Unified[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [source, setSource] = useState<'all' | 'library' | 'cloud'>('all')
  const [activeFolder, setActiveFolder] = useState<string | null>(null) // null = all · '' = unfiled
  const [shared, setShared] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [lib, cloud] = await Promise.all([
        fetch('/api/freehold/library', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({})),
        fetch('/api/freehold/cloud/files', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({})),
      ])
      const out: Unified[] = []
      if (Array.isArray(lib.items)) {
        for (const it of lib.items) out.push({
          id: `lib-${it.id}`, rawId: it.id, name: it.title || 'Untitled', kind: it.kind, url: it.url ?? null,
          source: 'library', folder: it.folder ?? null, createdAt: it.createdAt || '', driveKind: it.kind,
        })
      }
      if (Array.isArray(cloud.files)) {
        for (const f of cloud.files) out.push({
          id: `cld-${f.id}`, rawId: f.id, name: f.name, kind: cloudKind(f.mime, f.name), url: f.url,
          source: 'cloud', folder: f.folder ?? null, createdAt: f.createdAt || '',
        })
      }
      out.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      setItems(out)
    } catch { /* keep last */ } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const folders = useMemo(() => {
    const set = new Set<string>()
    for (const i of items) if (i.folder) set.add(i.folder)
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [items])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items
      .filter((i) => source === 'all' || i.source === source)
      .filter((i) => activeFolder === null || (i.folder ?? '') === activeFolder)
      .filter((i) => !q || i.name.toLowerCase().includes(q))
  }, [items, query, source, activeFolder])

  function open(it: Unified) {
    if (it.source === 'library' && it.driveKind && SHIPPED.has(editorTypeForKind(it.driveKind, !!it.url))) {
      router.push(editorHrefForItem({ id: it.id.replace(/^lib-/, ''), kind: it.driveKind, url: it.url }))
      return
    }
    if (it.url) window.open(it.url, '_blank', 'noopener')
  }

  // Create a public share link and copy it — the "global sharing center".
  async function share(it: Unified) {
    if (!it.url) { toast.error(t('fm.cantShare')); return }
    try {
      const res = await fetch('/api/freehold/shares', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: it.name, url: it.url, kind: it.kind, source: it.source, refId: it.id }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d.path) { toast.error(d.error || t('fm.shareFailed')); return }
      const link = `${window.location.origin}${d.path}`
      try { await navigator.clipboard?.writeText(link) } catch { /* clipboard may be blocked */ }
      setShared(it.id)
      setTimeout(() => setShared((s) => (s === it.id ? null : s)), 2000)
      toast.success(t('fm.shared'))
    } catch { toast.error(t('fm.shareFailed')) }
  }

  function download(it: Unified) {
    if (!it.url) return
    const a = document.createElement('a')
    a.href = it.url; a.download = it.name; a.target = '_blank'; a.rel = 'noopener'
    a.click()
  }

  async function move(it: Unified) {
    const name = window.prompt(t('fm.movePrompt'), it.folder ?? '')
    if (name === null) return
    const folder = name.trim() || null
    const url = it.source === 'library' ? '/api/freehold/library' : '/api/freehold/cloud/files'
    setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, folder } : x)))
    try {
      await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: it.rawId, folder }) })
      toast.success(t('fm.moved'))
    } catch { toast.error(t('fm.moveFailed')); load() }
  }

  async function remove(it: Unified) {
    if (!confirm(t('fm.confirmDelete'))) return
    const url = it.source === 'library'
      ? `/api/freehold/library?id=${encodeURIComponent(it.rawId)}`
      : `/api/freehold/cloud/files?id=${encodeURIComponent(it.rawId)}`
    try {
      const res = await fetch(url, { method: 'DELETE' })
      const d = await res.json().catch(() => ({}))
      if (res.ok && d.ok) { setItems((prev) => prev.filter((x) => x.id !== it.id)); toast.success(t('fm.deleted')) }
      else toast.error(t('fm.deleteFailed'))
    } catch { toast.error(t('fm.deleteFailed')) }
  }

  const chip = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
      active ? 'border-gold/40 bg-gold/15 text-gold' : 'border-line bg-surface-2 text-slate-400 hover:text-slate-200'
    }`

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
      <Link href="/freehold-intelligence/drive" className="mb-4 inline-flex items-center gap-1.5 text-xs text-slate-400 transition hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5 rtl:-scale-x-100" /> {t('drive.rooms.title')}
      </Link>
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{t('drive.room.files.title')}</h1>
          {!loading && <p className="mt-1 text-sm text-slate-400">{shown.length} {t('fm.count')}</p>}
        </div>
        <div className="relative ms-auto min-w-[180px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('fm.searchPh')}
            className="w-full rounded-full border border-line bg-surface-2 py-2 ps-9 pe-3 text-xs text-white outline-none placeholder:text-slate-600 focus:border-gold/40" />
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setSource('all')} className={chip(source === 'all')}>{t('fm.all')}</button>
        <button type="button" onClick={() => setSource('library')} className={chip(source === 'library')}><Sparkles className="h-3 w-3" /> {t('fm.generated')}</button>
        <button type="button" onClick={() => setSource('cloud')} className={chip(source === 'cloud')}><CloudIcon className="h-3 w-3" /> {t('fm.cloud')}</button>
      </div>

      {/* Folder rail — folders across both stores + an Unfiled bucket */}
      {(folders.length > 0 || items.some((i) => !i.folder)) && (
        <div className="mb-5 flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => setActiveFolder(null)} className={chip(activeFolder === null)}>{t('fm.folders.all')}</button>
          {folders.map((fld) => (
            <button key={fld} type="button" onClick={() => setActiveFolder(activeFolder === fld ? null : fld)} className={chip(activeFolder === fld)}>
              <Folder className="h-3 w-3" /> {fld}
              <span className="text-[10px] text-slate-500">{items.filter((i) => i.folder === fld).length}</span>
            </button>
          ))}
          <button type="button" onClick={() => setActiveFolder(activeFolder === '' ? null : '')} className={chip(activeFolder === '')}>{t('fm.unfiled')}</button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-16 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> {t('common.loading')}</div>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line py-16 text-center text-sm text-slate-500">{t('fm.empty')}</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((it) => (
            <div key={it.id} role="button" tabIndex={0} onClick={() => open(it)}
              onKeyDown={(e) => { if (e.key === 'Enter') open(it) }}
              className="group relative cursor-pointer overflow-hidden rounded-xl border border-line bg-surface text-left transition hover:border-line-strong">
              <div className="relative aspect-[4/3] w-full bg-surface-2">
                {it.kind === 'image' && it.url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={it.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  : <div className="flex h-full items-center justify-center text-slate-600"><KindIcon kind={it.kind} className="h-8 w-8" /></div>}
                <span className="absolute end-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-black/55 text-slate-300" title={it.source}>
                  {it.source === 'cloud' ? <CloudIcon className="h-3 w-3" /> : <Sparkles className="h-3 w-3 text-gold" />}
                </span>
                {/* Share — the sharing center: public link, copied to clipboard */}
                {it.url && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); void share(it) }} title={t('fm.share')}
                    className="absolute start-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-slate-200 opacity-0 shadow-lg backdrop-blur transition hover:text-white group-hover:opacity-100">
                    {shared === it.id ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Link2 className="h-3.5 w-3.5" />}
                  </button>
                )}
                {/* File options — download · move · delete (open = card click) */}
                <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
                  {it.url && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); download(it) }} title={t('fm.download')}
                      className="grid h-6 w-6 place-items-center rounded-full bg-black/60 text-slate-200 shadow-lg backdrop-blur hover:text-white"><Download className="h-3 w-3" /></button>
                  )}
                  <button type="button" onClick={(e) => { e.stopPropagation(); void move(it) }} title={t('fm.move')}
                    className="grid h-6 w-6 place-items-center rounded-full bg-black/60 text-slate-300 shadow-lg backdrop-blur hover:text-white"><FolderInput className="h-3 w-3" /></button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); void remove(it) }} title={t('fm.delete')}
                    className="grid h-6 w-6 place-items-center rounded-full bg-black/60 text-slate-300 shadow-lg backdrop-blur hover:text-rose-400"><Trash2 className="h-3 w-3" /></button>
                </div>
              </div>
              <div className="p-2.5">
                <p className="flex items-center gap-1.5 truncate text-[13px] font-medium text-slate-100"><KindIcon kind={it.kind} className="h-3 w-3 shrink-0 text-slate-500" /> {it.name}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
