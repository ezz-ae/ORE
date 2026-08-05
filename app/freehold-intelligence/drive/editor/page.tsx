'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Image as ImageIcon, FileText, Loader2, Pencil, Plus } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { editorHrefForItem, editorTypeForKind, KIND_META, type DriveKind, type EditorType } from '@/lib/freehold/drive'

type Item = { id: string; kind: DriveKind; title: string; content: string | null; url: string | null; createdAt: string }
const SHIPPED: EditorType[] = ['doc', 'image', 'video', 'pdf']

// Editor launcher — one place to start a NEW asset or jump back into a recent
// one. Every editor here is real (it only links to shipped editors).
export default function DriveEditorLauncher() {
  const t = useT()
  const router = useRouter()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/freehold/library', { cache: 'no-store' })
      const d = await res.json()
      if (Array.isArray(d.items)) setItems((d.items as Item[]).filter((i) => SHIPPED.includes(editorTypeForKind(i.kind, !!i.url))).slice(0, 12))
    } catch { /* keep */ } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  async function newDoc() {
    setCreating(true)
    try {
      const res = await fetch('/api/freehold/library', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'note', title: t('drive.new.docTitle'), content: '' }),
      })
      const d = await res.json()
      if (res.ok && d.item) router.push(`/freehold-intelligence/drive/editor/doc/${d.item.id}`)
      else toast.error(t('drive.saveFailed'))
    } catch { toast.error(t('drive.saveFailed')) } finally { setCreating(false) }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
      <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{t('drive.nav.editor')}</h1>
      <p className="mt-1 text-sm text-slate-400">{t('drive.room.editor.desc')}</p>
      <p className="mt-0.5 text-xs text-slate-500">{t('drive.editor.tag')}</p>

      {/* New */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/freehold-intelligence/creative-studio/image/new" className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2/60 p-4 transition hover:border-gold/30">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-400/15 text-emerald-400"><ImageIcon className="h-5 w-5" /></span>
          <div><div className="text-sm font-semibold text-white">{t('drive.new.image')}</div><div className="text-[11px] text-slate-500">{t('drive.new.imageSub')}</div></div>
          <Plus className="ms-auto h-4 w-4 text-slate-500" />
        </Link>
        <button type="button" onClick={newDoc} disabled={creating} className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2/60 p-4 text-start transition hover:border-gold/30 disabled:opacity-60">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-violet-400/15 text-violet-400">{creating ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5" />}</span>
          <div><div className="text-sm font-semibold text-white">{t('drive.new.doc')}</div><div className="text-[11px] text-slate-500">{t('drive.new.docSub')}</div></div>
          <Plus className="ms-auto h-4 w-4 text-slate-500" />
        </button>
      </div>

      {/* Recents */}
      <h2 className="mb-2 mt-7 text-sm font-semibold text-slate-300">{t('drive.editor.recents')}</h2>
      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> {t('common.loading')}</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line py-12 text-center text-sm text-slate-500">{t('drive.editor.recentsEmpty')}</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => {
            const meta = KIND_META[item.kind]
            return (
              <Link key={item.id} href={editorHrefForItem(item)} className="group flex items-center gap-2.5 rounded-2xl border border-line bg-surface-2/60 p-3 transition hover:border-gold/30">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: `${meta.accent}18`, color: meta.accent }}><Pencil className="h-4 w-4" /></span>
                <span className="min-w-0"><span className="line-clamp-2 text-xs font-medium text-slate-200">{item.title}</span><span className="text-[10px] text-slate-500">{t(meta.i18nKey)}</span></span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
