'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { upload } from '@vercel/blob/client'
import {
  Cloud, Upload, FolderPlus, Folder, FolderOpen, Loader2, Trash2,
  FolderInput, ExternalLink, FileText, FileSpreadsheet, FileType2, File as FileIcon,
  PhoneCall, Copy, X,
} from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

// ─── Cloud — account-level file store ─────────────────────────────────────────
// A real working-files surface: bulk-upload images, PDFs and spreadsheets into
// folders to prep for lead calls. Bytes go browser→Vercel Blob directly (signed
// by /api/freehold/cloud/upload); this page records the returned URL and shows
// everything as image thumbnails or document cards, organized by folder.

interface CloudFile {
  id: string
  folder: string | null
  name: string
  mime: string | null
  url: string
  pathname: string
  size: number
  createdAt: string
}
interface CloudFolder { name: string; files: number }

// activeFolder: null = all files · '' = root/unfiled · other = that folder name.
type ActiveFolder = string | null

const humanSize = (n: number): string => {
  if (!n || n < 1024) return `${Math.max(0, Math.round(n))} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

const isImage = (f: CloudFile) => !!f.mime && f.mime.startsWith('image/')

function DocIcon({ file, className }: { file: CloudFile; className?: string }) {
  const cls = className ?? 'h-8 w-8'
  const mime = file.mime ?? ''
  const name = file.name.toLowerCase()
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return <FileType2 className={cls} />
  if (/sheet|excel|csv/.test(mime) || /\.(xlsx?|csv)$/.test(name)) return <FileSpreadsheet className={cls} />
  if (/word|document/.test(mime) || /\.docx?$/.test(name)) return <FileText className={cls} />
  return <FileIcon className={cls} />
}

export default function CloudPage() {
  const t = useT()
  const [files, setFiles] = useState<CloudFile[]>([])
  const [folders, setFolders] = useState<CloudFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFolder, setActiveFolder] = useState<ActiveFolder>(null)
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [busyNames, setBusyNames] = useState<Set<string>>(new Set())
  const [callBusy, setCallBusy] = useState(false)
  const [callScript, setCallScript] = useState<string | null>(null)
  const [offerBusy, setOfferBusy] = useState(false)

  const fileInput = useRef<HTMLInputElement | null>(null)
  const dragDepth = useRef(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [f, fol] = await Promise.all([
        fetch('/api/freehold/cloud/files', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({})),
        fetch('/api/freehold/cloud/folders', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({})),
      ])
      if (Array.isArray(f.files)) setFiles(f.files as CloudFile[])
      if (Array.isArray(fol.folders)) setFolders(fol.folders as CloudFolder[])
    } catch { /* keep last */ } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  // The folder a new upload is filed into: a real named folder, else root.
  const uploadTarget = () => (activeFolder && activeFolder !== '' ? activeFolder : null)

  const visible = useMemo(() => {
    if (activeFolder === null) return files
    if (activeFolder === '') return files.filter((f) => !f.folder)
    return files.filter((f) => f.folder === activeFolder)
  }, [files, activeFolder])

  const unfiledCount = useMemo(() => files.filter((f) => !f.folder).length, [files])

  // Bulk upload: browser→Blob per file, then record metadata. Errors are toasted
  // per file so one bad upload never sinks the batch; the grid reloads at the end.
  async function uploadFiles(list: File[]) {
    if (!list.length) return
    const folder = uploadTarget()
    setProgress({ done: 0, total: list.length })
    setBusyNames(new Set(list.map((f) => f.name)))
    let done = 0
    for (const file of list) {
      try {
        const blob = await upload(file.name, file, { access: 'public', handleUploadUrl: '/api/freehold/cloud/upload' })
        await fetch('/api/freehold/cloud/files', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: file.name, url: blob.url, pathname: blob.pathname, mime: file.type, size: file.size, folder }),
        })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('cloud.uploadFailed', { name: file.name }))
      } finally {
        done += 1
        setProgress({ done, total: list.length })
        setBusyNames((prev) => { const n = new Set(prev); n.delete(file.name); return n })
      }
    }
    setProgress(null)
    setBusyNames(new Set())
    await load()
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    const dropped = Array.from(e.dataTransfer.files || [])
    if (dropped.length) void uploadFiles(dropped)
  }

  async function newFolder() {
    const name = window.prompt(t('cloud.newFolderPrompt'), '')
    if (name === null) return
    const clean = name.trim()
    if (!clean) return
    try {
      const res = await fetch('/api/freehold/cloud/folders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: clean }),
      })
      if (!res.ok) { toast.error(t('cloud.folderFailed')); return }
      toast.success(t('cloud.folderCreated'))
      setActiveFolder(clean)
      await load()
    } catch { toast.error(t('cloud.folderFailed')) }
  }

  async function removeFolder(name: string) {
    if (!confirm(t('cloud.confirmDeleteFolder'))) return
    try {
      await fetch(`/api/freehold/cloud/folders?name=${encodeURIComponent(name)}`, { method: 'DELETE' })
      if (activeFolder === name) setActiveFolder(null)
      await load()
    } catch { toast.error(t('cloud.folderFailed')) }
  }

  // Generate a cold-call script grounded on the active folder's brochures, and
  // save it back into the folder as a .txt (the broker's prep pack for lead calls).
  async function generateCallScript() {
    const folder = activeFolder && activeFolder !== '' ? activeFolder : null
    setCallBusy(true)
    try {
      const res = await fetch('/api/freehold/cloud/call-scenario', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder, projectName: folder ?? undefined }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d.script) { toast.error(d.error || t('cloud.call.failed')); return }
      setCallScript(d.script as string)
      if (d.file) await load()  // the saved .txt now lives in the folder
    } catch { toast.error(t('cloud.call.failed')) } finally { setCallBusy(false) }
  }

  // Generate a watermarked DRAFT sales offer from the folder's brochures — a
  // broker sends it to gauge whether a lead is serious. Saved into the folder.
  async function generateOffer() {
    const folder = activeFolder && activeFolder !== '' ? activeFolder : null
    setOfferBusy(true)
    try {
      const res = await fetch('/api/freehold/cloud/broker-doc', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'offer', folder, projectName: folder ?? undefined }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d.file) { toast.error(d.error || t('cloud.offer.failed')); return }
      toast.success(t('cloud.offer.done'))
      await load()
      if (d.file?.url) window.open(d.file.url as string, '_blank', 'noopener')
    } catch { toast.error(t('cloud.offer.failed')) } finally { setOfferBusy(false) }
  }

  async function moveFile(file: CloudFile) {
    const name = window.prompt(t('cloud.movePrompt'), file.folder ?? '')
    if (name === null) return
    const folder = name.trim() || null
    try {
      await fetch('/api/freehold/cloud/files', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: file.id, folder }),
      })
      toast.success(t('cloud.moved'))
      await load()
    } catch { toast.error(t('cloud.moved')) }
  }

  async function removeFile(file: CloudFile) {
    if (!confirm(t('cloud.confirmDelete'))) return
    try {
      const res = await fetch(`/api/freehold/cloud/files?id=${encodeURIComponent(file.id)}`, { method: 'DELETE' })
      const d = await res.json().catch(() => ({}))
      if (res.ok && d.ok) { setFiles((prev) => prev.filter((x) => x.id !== file.id)); toast.success(t('cloud.deleted')) }
      else toast.error(t('cloud.deleteFailed') || t('cloud.delete'))
    } catch { toast.error(t('cloud.delete')) }
  }

  const openFile = (file: CloudFile) => window.open(file.url, '_blank', 'noopener')

  const chip = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
      active ? 'border-gold/40 bg-gold/15 text-gold' : 'border-line bg-surface-2 text-slate-400 hover:text-slate-200'
    }`

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-5 sm:px-6">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start gap-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 grid h-8 w-8 place-items-center rounded-lg border border-teal-400/25 bg-teal-400/10 text-teal-400">
            <Cloud className="h-4 w-4" />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-white">{t('cloud.title')}</h1>
            <p className="mt-0.5 max-w-xl text-xs text-slate-500">{t('cloud.subtitle')}</p>
          </div>
        </div>
        <div className="ms-auto flex flex-wrap items-center gap-2.5">
          <input ref={fileInput} type="file" multiple hidden
            onChange={(e) => { const list = Array.from(e.target.files || []); if (list.length) void uploadFiles(list); e.target.value = '' }} />
          <button type="button" onClick={() => void generateCallScript()} disabled={callBusy} title={t('cloud.call.hint')}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:text-white disabled:opacity-50">
            {callBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PhoneCall className="h-3.5 w-3.5" />} {t('cloud.call.btn')}
          </button>
          <button type="button" onClick={() => void generateOffer()} disabled={offerBusy} title={t('cloud.offer.hint')}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:text-white disabled:opacity-50">
            {offerBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileType2 className="h-3.5 w-3.5" />} {t('cloud.offer.btn')}
          </button>
          <button type="button" onClick={() => newFolder()}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:text-white">
            <FolderPlus className="h-3.5 w-3.5" /> {t('cloud.newFolder')}
          </button>
          <button type="button" onClick={() => fileInput.current?.click()} disabled={!!progress}
            className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3.5 py-2 text-xs font-semibold text-gold transition hover:bg-gold/20 disabled:opacity-50">
            {progress ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} {t('cloud.upload')}
          </button>
        </div>
      </div>

      {/* Folder rail */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => setActiveFolder(null)} className={chip(activeFolder === null)}>
          <FolderOpen className="h-3 w-3" /> {t('cloud.all')}<span className="text-[10px] text-slate-500">{files.length}</span>
        </button>
        {folders.map((f) => (
          <span key={f.name} className={`group/chip ${chip(activeFolder === f.name)}`}>
            <button type="button" onClick={() => setActiveFolder(activeFolder === f.name ? null : f.name)} className="inline-flex items-center gap-1.5">
              <Folder className="h-3 w-3" /> {f.name}<span className="text-[10px] text-slate-500">{f.files}</span>
            </button>
            <button type="button" onClick={() => removeFolder(f.name)} title={t('cloud.delete')}
              className="ms-0.5 grid h-3.5 w-3.5 place-items-center rounded-full text-slate-500 transition hover:text-rose-400">
              <Trash2 className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        {unfiledCount > 0 && (
          <button type="button" onClick={() => setActiveFolder(activeFolder === '' ? null : '')} className={chip(activeFolder === '')}>
            {t('cloud.unfiled')}<span className="text-[10px] text-slate-500">{unfiledCount}</span>
          </button>
        )}
      </div>

      {/* Upload progress line */}
      {progress && (
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-xs text-slate-300">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-gold" />
          {t('cloud.uploading', { done: progress.done, total: progress.total })}
        </div>
      )}

      {/* File area — drag-and-drop zone */}
      <div
        onDragEnter={(e) => { e.preventDefault(); dragDepth.current += 1; setDragging(true) }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => { e.preventDefault(); dragDepth.current -= 1; if (dragDepth.current <= 0) { dragDepth.current = 0; setDragging(false) } }}
        onDrop={onDrop}
        className={`relative min-h-[240px] rounded-2xl border transition ${dragging ? 'border-gold/50' : 'border-transparent'}`}
      >
        {dragging && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-gold/60 bg-surface/80 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-gold">
              <Upload className="h-4 w-4" /> {t('cloud.dropHere')}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 py-16 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> {t('common.loading')}
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line py-16 text-center text-sm text-slate-500">
            {activeFolder !== null && activeFolder !== '' ? t('cloud.emptyFolder')
              : files.length === 0 && folders.length === 0 ? t('cloud.empty')
              : t('cloud.emptyFolder')}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {visible.map((file) => {
              const busy = busyNames.has(file.name)
              return (
                <div key={file.id} role="button" tabIndex={0} onClick={() => openFile(file)}
                  onKeyDown={(e) => { if (e.key === 'Enter') openFile(file) }}
                  className="group relative cursor-pointer overflow-hidden rounded-xl border border-line bg-surface transition hover:border-white/20">
                  <div className="aspect-video w-full bg-surface-2">
                    {isImage(file) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={file.url} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-500">
                        <DocIcon file={file} className="h-9 w-9 opacity-70" />
                      </div>
                    )}
                    {busy && (
                      <div className="absolute inset-0 grid place-items-center bg-black/40">
                        <Loader2 className="h-5 w-5 animate-spin text-white" />
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="truncate text-[11px] font-medium text-slate-100">{file.name}</p>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-500">
                      <span>{humanSize(file.size)}</span>
                      {file.folder && <span className="inline-flex items-center gap-0.5 truncate"><Folder className="h-2.5 w-2.5" />{file.folder}</span>}
                    </div>
                  </div>

                  {/* Hover actions */}
                  <div className="pointer-events-none absolute inset-x-2 top-2 flex items-center justify-end gap-1.5 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
                    <button type="button" onClick={(e) => { e.stopPropagation(); openFile(file) }}
                      title={t('cloud.open')} className="grid h-6 w-6 place-items-center rounded-full bg-black/60 text-slate-200 shadow-lg backdrop-blur hover:text-white">
                      <ExternalLink className="h-3 w-3" />
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); void moveFile(file) }}
                      title={t('cloud.move')} className="grid h-6 w-6 place-items-center rounded-full bg-black/60 text-slate-300 shadow-lg backdrop-blur hover:text-white">
                      <FolderInput className="h-3 w-3" />
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); void removeFile(file) }}
                      title={t('cloud.delete')} className="grid h-6 w-6 place-items-center rounded-full bg-black/60 text-slate-300 shadow-lg backdrop-blur hover:text-rose-400">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Call-script result — the broker's prep pack (also saved into the folder) */}
      {callScript !== null && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4" onClick={() => setCallScript(null)}>
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-semibold text-white"><PhoneCall className="h-4 w-4 text-teal-400" /> {t('cloud.call.title')}</span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => { navigator.clipboard?.writeText(callScript); toast.success(t('cloud.call.copied')) }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-xs text-slate-300 transition hover:text-white">
                  <Copy className="h-3.5 w-3.5" /> {t('cloud.call.copy')}
                </button>
                <button type="button" onClick={() => setCallScript(null)} className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 hover:bg-surface-2 hover:text-white"><X className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="overflow-y-auto px-5 py-4">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-200">{callScript}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
