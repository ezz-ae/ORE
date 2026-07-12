'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Download, Printer, Eye, Pencil, LayoutTemplate } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { DriveEditorFrame } from '@/components/freehold/drive/drive-editor-frame'
import { AiEditorRail } from '@/components/freehold/drive/ai-editor-rail'
import { AiUnavailable, DOC_LIMIT, type ArtifactAdapter, type PresetChip } from '@/lib/freehold/drive-ai-rail'
import type { DriveKind } from '@/lib/freehold/drive'
import { useAutosaveDraft } from '@/lib/freehold/use-autosave-draft'

type Item = { id: string; kind: DriveKind; title: string; content: string | null; url: string | null }

// Quick-edit chips → prefill the co-editor composer (never auto-sent). Labels reuse
// the existing action strings; instructions are the full ed.ai.preset.doc.* prompts.
const DOC_PRESETS: PresetChip[] = [
  { labelKey: 'ed.doc.ai.rewrite',                 instructionKey: 'ed.ai.preset.doc.rewrite' },
  { labelKey: 'ed.doc.ai.professional',            instructionKey: 'ed.ai.preset.doc.professional' },
  { labelKey: 'ed.doc.ai.shorten',                 instructionKey: 'ed.ai.preset.doc.shorten' },
  { labelKey: 'ed.doc.ai.expand',                  instructionKey: 'ed.ai.preset.doc.expand' },
  { labelKey: 'ed.ai.preset.doc.luxuryLabel',      instructionKey: 'ed.ai.preset.doc.luxury' },
  { labelKey: 'ed.ai.preset.doc.whatsappLabel',    instructionKey: 'ed.ai.preset.doc.whatsapp' },
  { labelKey: 'ed.ai.preset.doc.translateArLabel', instructionKey: 'ed.ai.preset.doc.translateAr' },
  { labelKey: 'ed.ai.preset.doc.translateRuLabel', instructionKey: 'ed.ai.preset.doc.translateRu' },
  { labelKey: 'ed.ai.preset.doc.translateEnLabel', instructionKey: 'ed.ai.preset.doc.translateEn' },
]

const DOC_TEMPLATES = [
  { key: 'brochure',   labelKey: 'ed.doc.tpl.brochure',   bodyKey: 'ed.doc.tpl.brochureBody' },
  { key: 'offer',      labelKey: 'ed.doc.tpl.offer',      bodyKey: 'ed.doc.tpl.offerBody' },
  { key: 'report',     labelKey: 'ed.doc.tpl.report',     bodyKey: 'ed.doc.tpl.reportBody' },
  { key: 'whatsapp',   labelKey: 'ed.doc.tpl.whatsapp',   bodyKey: 'ed.doc.tpl.whatsappBody' },
  { key: 'social',     labelKey: 'ed.doc.tpl.social',     bodyKey: 'ed.doc.tpl.socialBody' },
]

export default function DriveDocEditor() {
  const t = useT()
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = String(params?.id || '')

  // One-click document templates — a blank doc offers real-estate starters
  // the broker can fill and then run the AI presets on. Structure only; no
  // invented numbers (fields are [bracketed] to complete).
  const applyTemplate = (body: string) => { setContent(body); setDirty(true); setRevision((r) => r + 1) }
    const [item, setItem] = useState<Item | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  // Bumped on every MANUAL textarea edit (never on an AI turn) so the co-editor
  // rail can detect edits made after an AI change and confirm before undoing them.
  const [revision, setRevision] = useState(0)

  // Draft-everything: unsaved edits autosave (and flush on tab close) so the
  // work is resumable from the Drive "Continue editing" shelf. Cleared on Save.
  const { clearDraft } = useAutosaveDraft({
    kind: 'doc', refKey: id, href: `/freehold-intelligence/drive/editor/doc/${id}`,
    title: title || item?.title, active: dirty, data: { title, content },
  })

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
      setDirty(false); clearDraft(); toast.success(t('ed.saved'))
    } catch { toast.error(t('ed.saveFailed')) } finally { setSaving(false) }
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

  // Doc adapter: the reversible unit is the textarea content. AI edits apply
  // directly; on failure the endpoint throws and the text is left untouched.
  const docAdapter: ArtifactAdapter<string> = {
    kind: 'doc',
    snapshot: () => content,
    restore: (s) => { setContent(s); setDirty(true) },
    preflight: (_i, before) =>
      before.length > DOC_LIMIT ? t('ed.ai.err.tooLong', { n: before.length, limit: DOC_LIMIT }) : null,
    apply: async ({ instruction, before, signal }) => {
      const res = await fetch('/api/freehold/drive/doc-ai', {
        method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: before, mode: 'instruct', instruction }),
      })
      const d = await res.json().catch(() => ({}))
      if (d.unavailable) throw new AiUnavailable()
      if (!res.ok || typeof d.content !== 'string' || !d.content) throw new Error(d.error || t('ed.doc.aiFailed'))
      if (d.truncated) return { after: before, summary: '', truncated: true }
      if (d.content === before) return { after: before, summary: '', noop: true }
      setContent(d.content); setDirty(true)
      return { after: d.content, summary: t('ed.ai.summary.doc', { before: before.length, after: d.content.length }) }
    },
  }

  const aiRail = (
    <AiEditorRail
      adapter={docAdapter}
      revision={revision}
      presets={DOC_PRESETS}
      placeholderKey="ed.ai.placeholder.doc"
      disabled={isReport && showPreview}
      disabledHintKey="ed.ai.disabled.docPreview"
    />
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
        {!content.trim() && !(isReport && showPreview) && (
          <div className="mb-3 rounded-xl border border-gold/20 bg-gold/[0.04] p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gold"><LayoutTemplate className="h-3.5 w-3.5" /> {t('ed.doc.tpl.title')}</div>
            <div className="flex flex-wrap gap-1.5">
              {DOC_TEMPLATES.map((tpl) => (
                <button key={tpl.key} type="button" onClick={() => applyTemplate(t(tpl.bodyKey))}
                  className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[11px] font-medium text-slate-300 transition hover:border-gold/30 hover:text-white">
                  {t(tpl.labelKey)}
                </button>
              ))}
            </div>
          </div>
        )}
        {isReport && showPreview ? (
          <div className="prose prose-invert prose-sm max-w-none rounded-xl border border-line bg-surface-2/40 p-4 text-slate-200" dangerouslySetInnerHTML={{ __html: content }} />
        ) : (
          <textarea value={content} onChange={(e) => { setContent(e.target.value); setDirty(true); setRevision((r) => r + 1) }}
            className="min-h-[60vh] w-full resize-y rounded-xl border border-line bg-surface-2/40 p-4 text-sm leading-relaxed text-slate-100 outline-none focus:border-gold/30"
            dir="auto" placeholder={t('ed.doc.placeholder')} />
        )}
        <div className="mt-2 text-[11px] text-slate-500">{content.length} {t('ed.doc.chars')}</div>
      </div>
    </DriveEditorFrame>
  )
}
