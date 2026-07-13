'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Loader2, Download, FileDown, Code2, Type as TypeIcon, LayoutTemplate,
  Bold, Italic, Underline, Heading1, Heading2, List, ListOrdered, Quote,
  Link2, Image as ImageIcon, AlignLeft, AlignCenter, AlignRight, Eraser,
} from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { DriveEditorFrame } from '@/components/freehold/drive/drive-editor-frame'
import { AiEditorRail } from '@/components/freehold/drive/ai-editor-rail'
import { AiUnavailable, DOC_LIMIT, type ArtifactAdapter, type PresetChip } from '@/lib/freehold/drive-ai-rail'
import type { DriveKind } from '@/lib/freehold/drive'
import { useAutosaveDraft } from '@/lib/freehold/use-autosave-draft'

type Item = { id: string; kind: DriveKind; title: string; content: string | null; url: string | null }

// Quick-edit chips → prefill the co-editor composer (never auto-sent).
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

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const hasHtml = (s: string) => /<[a-z!/][\s\S]*>/i.test(s)
// Legacy plain-text docs → simple HTML paragraphs so the visual editor keeps
// their line breaks. Anything that already carries tags is used as-is.
function textToHtml(s: string): string {
  if (!s.trim()) return ''
  return s.split(/\n{2,}/).map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('')
}
const toEditableHtml = (raw: string) => (hasHtml(raw) ? raw : textToHtml(raw))
const plainLen = (html: string) => html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/g, ' ').trim().length

// Print / export stylesheet — a clean A4-ish document look (brochure-worthy).
const DOC_CSS = `
  *{box-sizing:border-box}
  body{font-family:'Inter',system-ui,-apple-system,sans-serif;color:#141414;line-height:1.65;max-width:760px;margin:40px auto;padding:0 28px}
  h1{font-family:'Playfair Display',Georgia,serif;font-size:30px;line-height:1.2;margin:0 0 10px;color:#0a0a0a}
  h2{font-family:'Playfair Display',Georgia,serif;font-size:22px;margin:26px 0 8px;color:#141414}
  h3{font-size:16px;margin:18px 0 6px}
  p{margin:0 0 12px} ul,ol{margin:0 0 12px 22px} li{margin:4px 0}
  blockquote{border-inline-start:3px solid #D4AF37;margin:14px 0;padding:6px 18px;color:#444;font-style:italic}
  a{color:#AA8122;text-decoration:underline} img{max-width:100%;height:auto;border-radius:8px;margin:10px 0}
  hr{border:none;border-top:1px solid #e6e6e6;margin:22px 0}
  @media print{body{margin:0;padding:22px}}
`

export default function DriveDocEditor() {
  const t = useT()
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = String(params?.id || '')

  const [item, setItem] = useState<Item | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('') // HTML
  const [mode, setMode] = useState<'rich' | 'source'>('rich')
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [saving, setSaving] = useState(false)
  // Bumped on every edit (manual or AI) so the co-editor rail can detect edits
  // made after an AI change and confirm before undoing them.
  const [revision, setRevision] = useState(0)

  const editorRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef(content); contentRef.current = content
  const fileRef = useRef<HTMLInputElement | null>(null)

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
      setItem(found); setTitle(found.title); setContent(toEditableHtml(found.content ?? ''))
    } catch { setNotFound(true) } finally { setLoading(false) }
  }, [id])
  useEffect(() => { if (id) load() }, [id, load])

  // Seed the contentEditable surface from state when the doc loads or when we
  // return to rich mode. Keyed on id+mode only (NOT content) so typing never
  // re-writes innerHTML mid-edit (which would jump the caret).
  useEffect(() => {
    if (mode === 'rich' && editorRef.current) editorRef.current.innerHTML = contentRef.current
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, mode])

  // Central mutation: update state (+ counter/dirty) and optionally write the DOM.
  const commitHtml = useCallback((html: string, writeDom: boolean) => {
    setContent(html); setDirty(true); setRevision((r) => r + 1)
    if (writeDom && editorRef.current) editorRef.current.innerHTML = html
  }, [])

  function exec(cmd: string, val?: string) {
    editorRef.current?.focus()
    try { document.execCommand(cmd, false, val) } catch { /* unsupported cmd — ignore */ }
    if (editorRef.current) commitHtml(editorRef.current.innerHTML, false)
  }
  function insertLink() {
    const url = window.prompt(t('ed.doc.linkPrompt'), 'https://')
    if (url) exec('createLink', url)
  }
  function insertImageFile(file: File | null) {
    if (!file) return
    if (file.size > 3 * 1024 * 1024) { toast.error(t('ed.doc.imageTooLarge')); return }
    const reader = new FileReader()
    reader.onload = () => {
      editorRef.current?.focus()
      try { document.execCommand('insertImage', false, String(reader.result)) } catch { /* ignore */ }
      if (editorRef.current) commitHtml(editorRef.current.innerHTML, false)
    }
    reader.readAsDataURL(file)
  }
  const applyTemplate = (body: string) => { commitHtml(toEditableHtml(body), true) }

  async function save() {
    if (!item) return
    setSaving(true)
    try {
      const res = await fetch('/api/freehold/library', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, title, content }),
      })
      if (res.status === 404) {
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

  const fullDoc = () =>
    `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title || 'document')}</title><style>${DOC_CSS}</style></head><body>${content}</body></html>`
  function downloadHtml() {
    const blob = new Blob([fullDoc()], { type: 'text/html' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${(title || 'document').replace(/[^\w؀-ۿ-]+/g, '_').slice(0, 60)}.html`
    a.click(); URL.revokeObjectURL(a.href)
  }
  function exportPdf() {
    const w = window.open('', '_blank'); if (!w) return
    w.document.write(fullDoc()); w.document.close(); w.focus()
    setTimeout(() => w.print(), 300)
  }

  if (loading) return <div className="flex h-[calc(100vh-56px)] items-center justify-center text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /></div>
  if (notFound || !item) return (
    <div className="flex h-[calc(100vh-56px)] flex-col items-center justify-center gap-3 text-center">
      <p className="text-sm text-slate-400">{t('ed.notFound')}</p>
      <button onClick={() => router.push('/freehold-intelligence/drive')} className="text-sm text-gold hover:opacity-80">{t('drive.homeTitle')}</button>
    </div>
  )

  // Doc adapter: the reversible unit is the HTML content. AI edits apply directly
  // and write to the DOM; on failure the endpoint throws and the text is untouched.
  const docAdapter: ArtifactAdapter<string> = {
    kind: 'doc',
    snapshot: () => content,
    restore: (s) => commitHtml(s, true),
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
      commitHtml(d.content, true)
      return { after: d.content, summary: t('ed.ai.summary.doc', { before: before.length, after: d.content.length }) }
    },
  }

  const aiRail = <AiEditorRail adapter={docAdapter} revision={revision} presets={DOC_PRESETS} placeholderKey="ed.ai.placeholder.doc" />

  // ── Formatting toolbar (works in rich mode; source mode edits raw HTML) ──────
  const TB: { icon: typeof Bold; titleKey: string; run: () => void }[] = [
    { icon: Heading1,    titleKey: 'ed.doc.fmt.h1',       run: () => exec('formatBlock', 'H1') },
    { icon: Heading2,    titleKey: 'ed.doc.fmt.h2',       run: () => exec('formatBlock', 'H2') },
    { icon: TypeIcon,    titleKey: 'ed.doc.fmt.p',        run: () => exec('formatBlock', 'P') },
    { icon: Bold,        titleKey: 'ed.doc.fmt.bold',     run: () => exec('bold') },
    { icon: Italic,      titleKey: 'ed.doc.fmt.italic',   run: () => exec('italic') },
    { icon: Underline,   titleKey: 'ed.doc.fmt.underline',run: () => exec('underline') },
    { icon: List,        titleKey: 'ed.doc.fmt.bullet',   run: () => exec('insertUnorderedList') },
    { icon: ListOrdered, titleKey: 'ed.doc.fmt.number',   run: () => exec('insertOrderedList') },
    { icon: Quote,       titleKey: 'ed.doc.fmt.quote',    run: () => exec('formatBlock', 'BLOCKQUOTE') },
    { icon: AlignLeft,   titleKey: 'ed.doc.fmt.alignLeft',   run: () => exec('justifyLeft') },
    { icon: AlignCenter, titleKey: 'ed.doc.fmt.alignCenter', run: () => exec('justifyCenter') },
    { icon: AlignRight,  titleKey: 'ed.doc.fmt.alignRight',  run: () => exec('justifyRight') },
    { icon: Link2,       titleKey: 'ed.doc.fmt.link',     run: insertLink },
    { icon: ImageIcon,   titleKey: 'ed.doc.fmt.image',    run: () => fileRef.current?.click() },
    { icon: Eraser,      titleKey: 'ed.doc.fmt.clear',    run: () => exec('removeFormat') },
  ]

  return (
    <DriveEditorFrame
      type="doc" title={title || item.title} dirty={dirty} saving={saving} onSave={save} aiRail={aiRail}
      actions={
        <>
          <button type="button" onClick={() => setMode((m) => (m === 'rich' ? 'source' : 'rich'))}
            title={mode === 'rich' ? t('ed.doc.source') : t('ed.doc.rich')}
            className={`rounded-full border p-1.5 transition ${mode === 'source' ? 'border-gold/40 text-gold' : 'border-line text-slate-400 hover:text-white'}`}>
            {mode === 'rich' ? <Code2 className="h-3.5 w-3.5" /> : <TypeIcon className="h-3.5 w-3.5" />}
          </button>
          <button type="button" onClick={downloadHtml} title={t('ed.doc.exportHtml')} className="rounded-full border border-line p-1.5 text-slate-400 hover:text-white"><Download className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={exportPdf} title={t('ed.doc.exportPdf')} className="rounded-full border border-line p-1.5 text-slate-400 hover:text-white"><FileDown className="h-3.5 w-3.5" /></button>
        </>
      }
    >
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { insertImageFile(e.target.files?.[0] ?? null); e.target.value = '' }} />

      {/* Sticky formatting toolbar */}
      {mode === 'rich' && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-white/[0.07] bg-chrome/95 px-3 py-1.5 backdrop-blur">
          {TB.map((b, i) => (
            <button key={i} type="button" title={t(b.titleKey)} aria-label={t(b.titleKey)} onClick={b.run}
              className="rounded-md p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-white">
              <b.icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      )}

      <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6">
        <input value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true) }} placeholder={t('drive.addTitlePh')}
          className="mb-3 w-full bg-transparent text-xl font-semibold text-white outline-none placeholder:text-slate-600" />

        {!plainLen(content) && mode === 'rich' && (
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

        {mode === 'rich' ? (
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            dir="auto"
            onInput={(e) => commitHtml((e.target as HTMLDivElement).innerHTML, false)}
            data-placeholder={t('ed.doc.placeholder')}
            className="lp-doc-editor min-h-[60vh] w-full rounded-xl border border-line bg-white p-6 text-[14px] leading-relaxed text-slate-900 outline-none focus:border-gold/40"
          />
        ) : (
          <textarea value={content} onChange={(e) => { setContent(e.target.value); setDirty(true); setRevision((r) => r + 1) }}
            className="min-h-[60vh] w-full resize-y rounded-xl border border-line bg-surface-2/40 p-4 font-mono text-xs leading-relaxed text-slate-100 outline-none focus:border-gold/30"
            dir="ltr" spellCheck={false} placeholder={t('ed.doc.placeholder')} />
        )}
        <div className="mt-2 text-[11px] text-slate-500">{plainLen(content)} {t('ed.doc.chars')}</div>
      </div>

      <style jsx global>{`
        .lp-doc-editor:empty:before { content: attr(data-placeholder); color: #9ca3af; }
        .lp-doc-editor h1 { font-size: 26px; font-weight: 700; margin: 0 0 8px; }
        .lp-doc-editor h2 { font-size: 20px; font-weight: 700; margin: 18px 0 6px; }
        .lp-doc-editor p { margin: 0 0 10px; }
        .lp-doc-editor ul { list-style: disc; margin: 0 0 10px 22px; }
        .lp-doc-editor ol { list-style: decimal; margin: 0 0 10px 22px; }
        .lp-doc-editor li { margin: 3px 0; }
        .lp-doc-editor blockquote { border-inline-start: 3px solid #D4AF37; margin: 10px 0; padding: 4px 14px; color: #444; font-style: italic; }
        .lp-doc-editor a { color: #AA8122; text-decoration: underline; }
        .lp-doc-editor img { max-width: 100%; height: auto; border-radius: 8px; margin: 8px 0; }
      `}</style>
    </DriveEditorFrame>
  )
}
