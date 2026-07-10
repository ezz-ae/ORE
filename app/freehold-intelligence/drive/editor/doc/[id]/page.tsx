'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Wand2, Languages, Download, Printer, Eye, Pencil } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { DriveEditorFrame } from '@/components/freehold/drive/drive-editor-frame'
import type { DriveKind } from '@/lib/freehold/drive'

type Item = { id: string; kind: DriveKind; title: string; content: string | null; url: string | null }

const AI_ACTIONS: { mode: string; key: string; Icon: typeof Wand2 }[] = [
  { mode: 'rewrite',      key: 'ed.doc.ai.rewrite',      Icon: Wand2 },
  { mode: 'professional', key: 'ed.doc.ai.professional', Icon: Wand2 },
  { mode: 'shorten',      key: 'ed.doc.ai.shorten',      Icon: Wand2 },
  { mode: 'expand',       key: 'ed.doc.ai.expand',       Icon: Wand2 },
]
const TRANSLATE: { mode: string; label: string }[] = [
  { mode: 'translate_en', label: 'EN' },
  { mode: 'translate_ar', label: 'ع' },
  { mode: 'translate_ru', label: 'RU' },
]

export default function DriveDocEditor() {
  const t = useT()
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = String(params?.id || '')

  const [item, setItem] = useState<Item | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [saving, setSaving] = useState(false)
  const [aiBusy, setAiBusy] = useState('')
  const [showPreview, setShowPreview] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/freehold/library', { cache: 'no-store' })
      const d = await res.json()
      const found = (Array.isArray(d.items) ? d.items : []).find((x: Item) => x.id === id) as Item | undefined
      if (!found) { setNotFound(true); return }
      setItem(found); setTitle(found.title); setContent(found.content ?? '')
    } catch { setNotFound(true) } finally { setLoading(false) }
  }, [id])
  useEffect(() => { if (id) load() }, [id, load])

  async function save() {
    if (!item) return
    setSaving(true)
    try {
      const res = await fetch('/api/freehold/library', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, title, content }),
      })
      if (res.status === 404) {
        // Read-only source (e.g. a Notebook output) → save an editable copy.
        const copy = await fetch('/api/freehold/library', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: item.kind === 'report' ? 'note' : item.kind, title: title || 'Untitled', content }),
        })
        const cd = await copy.json()
        if (copy.ok && cd.item) { toast.success(t('ed.doc.savedCopy')); router.replace(`/freehold-intelligence/drive/editor/doc/${cd.item.id}`); return }
        toast.error(t('ed.saveFailed')); return
      }
      if (!res.ok) { toast.error(t('ed.saveFailed')); return }
      setDirty(false); toast.success(t('ed.saved'))
    } catch { toast.error(t('ed.saveFailed')) } finally { setSaving(false) }
  }

  async function runAi(mode: string) {
    if (!content.trim() || aiBusy) return
    setAiBusy(mode)
    try {
      const res = await fetch('/api/freehold/drive/doc-ai', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, mode }),
      })
      const d = await res.json()
      if (d.unavailable) { toast.error(t('ed.doc.aiUnavailable')); return }
      if (!res.ok || !d.content) { toast.error(d.error || t('ed.doc.aiFailed')); return }
      setContent(d.content); setDirty(true); toast.success(t('ed.doc.aiApplied'))
    } catch { toast.error(t('ed.doc.aiFailed')) } finally { setAiBusy('') }
  }

  function download() {
    const isHtml = item?.kind === 'report'
    const blob = new Blob([content], { type: isHtml ? 'text/html' : 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${(title || 'document').replace(/[^\w؀-ۿ-]+/g, '_').slice(0, 60)}.${isHtml ? 'html' : 'txt'}`
    a.click(); URL.revokeObjectURL(a.href)
  }
  function printDoc() {
    const w = window.open('', '_blank'); if (!w) return
    const isHtml = item?.kind === 'report'
    w.document.write(`<html><head><title>${title}</title><meta charset="utf-8"></head><body style="font-family:system-ui;max-width:720px;margin:40px auto;padding:0 20px;line-height:1.6">${isHtml ? content : `<pre style="white-space:pre-wrap;font-family:system-ui">${content.replace(/</g, '&lt;')}</pre>`}</body></html>`)
    w.document.close(); w.focus(); setTimeout(() => w.print(), 250)
  }

  if (loading) return <div className="flex h-[calc(100vh-56px)] items-center justify-center text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /></div>
  if (notFound || !item) return (
    <div className="flex h-[calc(100vh-56px)] flex-col items-center justify-center gap-3 text-center">
      <p className="text-sm text-slate-400">{t('ed.notFound')}</p>
      <button onClick={() => router.push('/freehold-intelligence/drive')} className="text-sm text-gold hover:opacity-80">{t('drive.homeTitle')}</button>
    </div>
  )

  const isReport = item.kind === 'report'
  const aiRail = (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gold"><Wand2 className="h-3.5 w-3.5" /> {t('ed.doc.aiTitle')}</div>
        <div className="space-y-1.5">
          {AI_ACTIONS.map((a) => (
            <button key={a.mode} type="button" onClick={() => runAi(a.mode)} disabled={!!aiBusy}
              className="flex w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-start text-xs text-slate-200 transition hover:border-gold/30 disabled:opacity-50">
              {aiBusy === a.mode ? <Loader2 className="h-3.5 w-3.5 animate-spin text-gold" /> : <a.Icon className="h-3.5 w-3.5 text-gold/70" />} {t(a.key)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400"><Languages className="h-3.5 w-3.5" /> {t('ed.doc.translate')}</div>
        <div className="flex gap-1.5">
          {TRANSLATE.map((tr) => (
            <button key={tr.mode} type="button" onClick={() => runAi(tr.mode)} disabled={!!aiBusy}
              className="flex-1 rounded-lg border border-line bg-surface px-2 py-2 text-xs font-medium text-slate-200 transition hover:border-gold/30 disabled:opacity-50">
              {aiBusy === tr.mode ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" /> : tr.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <DriveEditorFrame
      type="doc" title={title || item.title} dirty={dirty} saving={saving} onSave={save} aiRail={aiRail}
      actions={
        <>
          {isReport && <button type="button" onClick={() => setShowPreview((p) => !p)} title={showPreview ? t('ed.doc.edit') : t('ed.doc.preview')} className="rounded-full border border-line p-1.5 text-slate-400 hover:text-white">{showPreview ? <Pencil className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button>}
          <button type="button" onClick={download} title={t('ed.download')} className="rounded-full border border-line p-1.5 text-slate-400 hover:text-white"><Download className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={printDoc} title={t('ed.doc.print')} className="rounded-full border border-line p-1.5 text-slate-400 hover:text-white"><Printer className="h-3.5 w-3.5" /></button>
        </>
      }
    >
      <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6">
        <input value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true) }} placeholder={t('drive.addTitlePh')}
          className="mb-3 w-full bg-transparent text-xl font-semibold text-white outline-none placeholder:text-slate-600" />
        {isReport && showPreview ? (
          <div className="prose prose-invert prose-sm max-w-none rounded-xl border border-line bg-surface-2/40 p-4 text-slate-200" dangerouslySetInnerHTML={{ __html: content }} />
        ) : (
          <textarea value={content} onChange={(e) => { setContent(e.target.value); setDirty(true) }}
            className="min-h-[60vh] w-full resize-y rounded-xl border border-line bg-surface-2/40 p-4 text-sm leading-relaxed text-slate-100 outline-none focus:border-gold/30"
            dir="auto" placeholder={t('ed.doc.placeholder')} />
        )}
        <div className="mt-2 text-[11px] text-slate-500">{content.length} {t('ed.doc.chars')}</div>
      </div>
    </DriveEditorFrame>
  )
}
